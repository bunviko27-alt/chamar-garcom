-- Donos (login com e-mail pelo Supabase Auth) e cadastro de aparelhos por QR Code.
--
-- Fluxo: o aparelho da mesa liga sem cadastro -> pareamento_iniciar() gera um código
-- curto e um segredo -> mostra o QR (site/parear?c=CODIGO). O dono escaneia, entra
-- na conta e escolhe o número da mesa -> pareamento_confirmar(). O aparelho, que
-- consulta pareamento_status(codigo, segredo), recebe o token e vira a "Mesa N".

alter table public.restaurantes add column if not exists dono_id uuid references auth.users on delete set null;
create unique index if not exists restaurantes_um_por_dono on public.restaurantes (dono_id) where dono_id is not null;

alter table public.dispositivos
  add column if not exists id bigint generated always as identity,
  add column if not exists ultimo_contato timestamptz not null default now();
create unique index if not exists dispositivos_id on public.dispositivos (id);

create table if not exists public.pareamentos (
  codigo         text primary key,
  segredo        text not null,
  criado_em      timestamptz not null default now(),
  expira_em      timestamptz not null default now() + interval '15 minutes',
  restaurante_id uuid references public.restaurantes on delete cascade,
  mesa           text,
  token          text
);
alter table public.pareamentos enable row level security;

-- ------------------------------------------------------------- utilidades internas

create or replace function public._codigo_curto()
returns text language sql volatile as $$
  -- 6 caracteres sem os que se confundem (0/O, 1/I/L)
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
  from (select extensions.gen_random_bytes(6) b) x, generate_series(0, 5) i
$$;

create or replace function public._meu_restaurante()
returns public.restaurantes
language plpgsql stable security definer set search_path = public as $$
declare r public.restaurantes;
begin
  if auth.uid() is null then raise exception 'precisa_entrar' using errcode = '28000'; end if;
  select * into r from restaurantes where dono_id = auth.uid();
  return r;
end $$;

-- ------------------------------------------------------------- aparelho (anônimo)

create or replace function public.pareamento_iniciar()
returns json
language plpgsql volatile security definer set search_path = public as $$
declare c text; s text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  delete from pareamentos where expira_em < now();
  if (select count(*) from pareamentos) > 500 then
    raise exception 'muitos_pareamentos';
  end if;
  loop
    c := _codigo_curto();
    exit when not exists (select 1 from pareamentos where codigo = c);
  end loop;
  insert into pareamentos (codigo, segredo) values (c, s);
  return json_build_object('codigo', c, 'segredo', s, 'expira', extract(epoch from now() + interval '15 minutes'));
end $$;

create or replace function public.pareamento_status(p_codigo text, p_segredo text)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare p public.pareamentos;
begin
  select * into p from pareamentos where codigo = upper(p_codigo) and segredo = p_segredo;
  if p.codigo is null or p.expira_em < now() then
    return json_build_object('estado', 'expirado');
  end if;
  if p.token is null then
    return json_build_object('estado', 'aguardando');
  end if;
  delete from pareamentos where codigo = p.codigo;          -- entrega o token uma vez só
  return json_build_object('estado', 'pronto', 'token', p.token, 'mesa', p.mesa);
end $$;

create or replace function public.ping(p_token text)
returns json
language plpgsql volatile security definer set search_path = public as $$
begin
  update dispositivos set ultimo_contato = now() where token = p_token;
  return json_build_object('ok', found);
end $$;

-- ------------------------------------------------------------- dono (logado)

create or replace function public.dono_restaurante()
returns json
language plpgsql stable security definer set search_path = public as $$
declare r public.restaurantes := _meu_restaurante();
begin
  if r.id is null then return null; end if;
  return json_build_object('nome', r.nome, 'mesas', r.mesas, 'codigo', r.codigo);
end $$;

create or replace function public.dono_criar_restaurante(p_nome text)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare c text;
begin
  if auth.uid() is null then raise exception 'precisa_entrar' using errcode = '28000'; end if;
  if exists (select 1 from restaurantes where dono_id = auth.uid()) then
    raise exception 'ja_tem_restaurante';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'nome_invalido'; end if;
  loop
    c := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
    exit when not exists (select 1 from restaurantes where codigo = c);
  end loop;
  insert into restaurantes (nome, mesas, codigo, dono_id) values (left(trim(p_nome), 60), 10, c, auth.uid());
  return dono_restaurante();
end $$;

create or replace function public.dono_atualizar(p_nome text, p_mesas int)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare r public.restaurantes := _meu_restaurante();
begin
  if r.id is null then raise exception 'sem_restaurante'; end if;
  update restaurantes set
    nome = coalesce(nullif(left(trim(p_nome), 60), ''), nome),
    mesas = least(greatest(coalesce(p_mesas, mesas), 1), 500)
  where id = r.id;
  return dono_restaurante();
end $$;

create or replace function public.dono_trocar_codigo()
returns json
language plpgsql volatile security definer set search_path = public as $$
declare r public.restaurantes := _meu_restaurante(); c text;
begin
  if r.id is null then raise exception 'sem_restaurante'; end if;
  loop
    c := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
    exit when not exists (select 1 from restaurantes where codigo = c);
  end loop;
  update restaurantes set codigo = c where id = r.id;
  -- Garçons e cozinha precisam entrar de novo com o código novo; as mesas continuam.
  delete from dispositivos where restaurante_id = r.id and papel <> 'mesa';
  return dono_restaurante();
end $$;

create or replace function public.dono_aparelhos()
returns json
language plpgsql stable security definer set search_path = public as $$
declare r public.restaurantes := _meu_restaurante();
begin
  if r.id is null then raise exception 'sem_restaurante'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', d.id, 'mesa', d.mesa,
      'criado', extract(epoch from d.criado_em),
      'contato', extract(epoch from d.ultimo_contato),
      'online', d.ultimo_contato > now() - interval '3 minutes'
    ) order by lpad(d.mesa, 10, '0'))
    from dispositivos d where d.restaurante_id = r.id and d.papel = 'mesa'
  ), '[]'::json);
end $$;

create or replace function public.dono_mudar_mesa(p_id bigint, p_mesa text)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare r public.restaurantes := _meu_restaurante();
begin
  if r.id is null then raise exception 'sem_restaurante'; end if;
  if p_mesa !~ '^\w{1,10}$' then raise exception 'mesa_invalida'; end if;
  update dispositivos set mesa = p_mesa where id = p_id and restaurante_id = r.id and papel = 'mesa';
  return json_build_object('ok', found);
end $$;

create or replace function public.dono_remover_aparelho(p_id bigint)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare r public.restaurantes := _meu_restaurante();
begin
  if r.id is null then raise exception 'sem_restaurante'; end if;
  delete from dispositivos where id = p_id and restaurante_id = r.id and papel = 'mesa';
  return json_build_object('ok', found);
end $$;

create or replace function public.pareamento_confirmar(p_codigo text, p_mesa text)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare r public.restaurantes := _meu_restaurante(); p public.pareamentos; d public.dispositivos;
begin
  if r.id is null then raise exception 'sem_restaurante'; end if;
  if p_mesa !~ '^\w{1,10}$' then raise exception 'mesa_invalida'; end if;
  select * into p from pareamentos where codigo = upper(trim(p_codigo));
  if p.codigo is null or p.expira_em < now() then raise exception 'codigo_expirado'; end if;
  if p.token is not null then raise exception 'ja_cadastrado'; end if;
  insert into dispositivos (restaurante_id, papel, mesa) values (r.id, 'mesa', p_mesa) returning * into d;
  update pareamentos set token = d.token, mesa = p_mesa, restaurante_id = r.id where codigo = p.codigo;
  -- Se a mesa tem número maior que o total cadastrado, aumenta o total.
  if p_mesa ~ '^\d+$' and p_mesa::int > r.mesas then
    update restaurantes set mesas = least(p_mesa::int, 500) where id = r.id;
  end if;
  return json_build_object('ok', true, 'mesa', p_mesa, 'restaurante', r.nome);
end $$;

create or replace function public.dono_proxima_mesa()
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(min(n)::text, '1') from generate_series(1, 500) n
  where not exists (
    select 1 from dispositivos d, restaurantes r
    where r.dono_id = auth.uid() and d.restaurante_id = r.id and d.papel = 'mesa' and d.mesa = n::text)
$$;

-- ------------------------------------------------------------- permissões
revoke execute on all functions in schema public from anon, authenticated, public;
grant execute on function public.entrar(text, text, text)            to anon, authenticated;
grant execute on function public.estado(text)                        to anon, authenticated;
grant execute on function public.acao_mesa(text, text, text, text)   to anon, authenticated;
grant execute on function public.acao_pedido(text, bigint, text)     to anon, authenticated;
grant execute on function public.salvar_push(text, jsonb)            to anon, authenticated;
grant execute on function public.pareamento_iniciar()                to anon, authenticated;
grant execute on function public.pareamento_status(text, text)       to anon, authenticated;
grant execute on function public.ping(text)                          to anon, authenticated;
grant execute on function public.dono_restaurante()                  to authenticated;
grant execute on function public.dono_criar_restaurante(text)        to authenticated;
grant execute on function public.dono_atualizar(text, int)           to authenticated;
grant execute on function public.dono_trocar_codigo()                to authenticated;
grant execute on function public.dono_aparelhos()                    to authenticated;
grant execute on function public.dono_mudar_mesa(bigint, text)       to authenticated;
grant execute on function public.dono_remover_aparelho(bigint)       to authenticated;
grant execute on function public.pareamento_confirmar(text, text)    to authenticated;
grant execute on function public.dono_proxima_mesa()                 to authenticated;
