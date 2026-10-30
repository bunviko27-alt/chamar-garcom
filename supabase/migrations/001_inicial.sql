-- Chamar garçom: banco de dados.
--
-- Segurança: o site é público e usa a chave anon do Supabase, então NENHUMA
-- tabela é acessível direto (RLS ligado, sem políticas). Tudo passa por
-- funções RPC que exigem o token do aparelho. O token é obtido uma vez,
-- digitando o código da equipe do restaurante (função entrar).
--
-- Tempo real: quando algo muda, um gatilho manda um "mudou" pelo canal de
-- broadcast do restaurante (nome aleatório, só revelado a quem tem token).
-- As telas então pedem o estado de novo via RPC.

create extension if not exists pgcrypto with schema extensions;

create table public.restaurantes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  mesas      int  not null default 10 check (mesas between 1 and 500),
  codigo     text not null unique check (codigo ~ '^\d{6}$'),
  canal      text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  criado_em  timestamptz not null default now()
);

create table public.dispositivos (
  token          text primary key default encode(extensions.gen_random_bytes(24), 'hex'),
  restaurante_id uuid not null references public.restaurantes on delete cascade,
  papel          text not null check (papel in ('mesa', 'garcom', 'cozinha')),
  mesa           text,
  criado_em      timestamptz not null default now()
);

create table public.chamados (
  restaurante_id uuid not null references public.restaurantes on delete cascade,
  mesa           text not null,
  criado_em      timestamptz not null default now(),
  primary key (restaurante_id, mesa)
);

create table public.pedidos (
  id             bigint generated always as identity primary key,
  restaurante_id uuid not null references public.restaurantes on delete cascade,
  mesa           text not null,
  descricao      text not null default '',
  status         text not null default 'enviado'
                 check (status in ('enviado', 'preparando', 'pronto', 'entregue')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index on public.pedidos (restaurante_id, atualizado_em desc);

create table public.push_inscricoes (
  endpoint  text primary key,
  token     text not null references public.dispositivos on delete cascade,
  dados     jsonb not null,
  criado_em timestamptz not null default now()
);

-- Chaves VAPID das notificações; só a Edge Function (service role) lê.
create table public.privado (chave text primary key, valor text not null);

-- Tentativas erradas de código, para frear quem tenta adivinhar.
create table public.tentativas_erradas (em timestamptz not null default now());

alter table public.restaurantes       enable row level security;
alter table public.dispositivos       enable row level security;
alter table public.chamados           enable row level security;
alter table public.pedidos            enable row level security;
alter table public.push_inscricoes    enable row level security;
alter table public.privado            enable row level security;
alter table public.tentativas_erradas enable row level security;

-- ---------------------------------------------------------------- funções

create or replace function public._dispositivo(p_token text)
returns public.dispositivos
language plpgsql stable security definer set search_path = public as $$
declare d public.dispositivos;
begin
  select * into d from dispositivos where token = p_token;
  if d.token is null then
    raise exception 'token_invalido' using errcode = '28000';
  end if;
  return d;
end $$;

create or replace function public.entrar(p_codigo text, p_papel text, p_mesa text default null)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare r public.restaurantes; d public.dispositivos;
begin
  if (select count(*) from tentativas_erradas where em > now() - interval '10 minutes') > 60 then
    return json_build_object('erro', 'muitas_tentativas');
  end if;
  select * into r from restaurantes where codigo = p_codigo;
  if r.id is null then
    -- Retorna em vez de dar erro, senão o registro da tentativa seria desfeito.
    insert into tentativas_erradas default values;
    delete from tentativas_erradas where em < now() - interval '1 day';
    return json_build_object('erro', 'codigo_invalido');
  end if;
  if p_papel not in ('mesa', 'garcom', 'cozinha') then
    raise exception 'papel_invalido';
  end if;
  if p_papel = 'mesa' and (p_mesa is null or p_mesa !~ '^\w{1,10}$') then
    raise exception 'mesa_invalida';
  end if;
  insert into dispositivos (restaurante_id, papel, mesa)
  values (r.id, p_papel, case when p_papel = 'mesa' then p_mesa end)
  returning * into d;
  return json_build_object('token', d.token);
end $$;

create or replace function public.estado(p_token text)
returns json
language plpgsql stable security definer set search_path = public as $$
declare d public.dispositivos; r public.restaurantes;
begin
  d := _dispositivo(p_token);
  select * into r from restaurantes where id = d.restaurante_id;
  return json_build_object(
    'agora', extract(epoch from now()),
    'canal', r.canal,
    'papel', d.papel,
    'mesa', d.mesa,
    'config', json_build_object('restaurante', r.nome, 'mesas', r.mesas),
    'chamados', coalesce((
      select json_object_agg(c.mesa, extract(epoch from c.criado_em))
      from chamados c
      where c.restaurante_id = r.id and (d.papel <> 'mesa' or c.mesa = d.mesa)
    ), '{}'::json),
    'pedidos', coalesce((
      select json_agg(json_build_object(
        'id', p.id, 'mesa', p.mesa, 'desc', p.descricao, 'status', p.status,
        'criado', extract(epoch from p.criado_em),
        'atualizado', extract(epoch from p.atualizado_em)) order by p.id)
      from pedidos p
      where p.restaurante_id = r.id
        and (d.papel <> 'mesa' or p.mesa = d.mesa)
        and (p.status <> 'entregue' or p.atualizado_em > now() - interval '1 hour')
    ), '[]'::json)
  );
end $$;

create or replace function public.acao_mesa(p_token text, p_mesa text, p_acao text, p_desc text default '')
returns json
language plpgsql volatile security definer set search_path = public as $$
declare d public.dispositivos;
begin
  d := _dispositivo(p_token);
  if d.papel = 'mesa' and (p_mesa <> d.mesa or p_acao not in ('chamar', 'cancelar')) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_mesa !~ '^\w{1,10}$' then raise exception 'mesa_invalida'; end if;

  if p_acao = 'chamar' then
    insert into chamados (restaurante_id, mesa) values (d.restaurante_id, p_mesa)
    on conflict do nothing;
  elsif p_acao in ('cancelar', 'atender') then
    delete from chamados where restaurante_id = d.restaurante_id and mesa = p_mesa;
  elsif p_acao = 'pedido' then
    delete from chamados where restaurante_id = d.restaurante_id and mesa = p_mesa;
    insert into pedidos (restaurante_id, mesa, descricao)
    values (d.restaurante_id, p_mesa, left(trim(coalesce(p_desc, '')), 300));
  else
    raise exception 'acao_invalida';
  end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.acao_pedido(p_token text, p_id bigint, p_acao text)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare d public.dispositivos; de text; para text; n int;
begin
  d := _dispositivo(p_token);
  if d.papel = 'mesa' then raise exception 'sem_permissao' using errcode = '42501'; end if;

  if p_acao = 'cancelar' then
    delete from pedidos where id = p_id and restaurante_id = d.restaurante_id;
    return json_build_object('ok', true);
  end if;
  select x.de, x.para into de, para from (values
    ('preparar', 'enviado', 'preparando'),
    ('pronto', 'preparando', 'pronto'),
    ('entregue', 'pronto', 'entregue')) as x(acao, de, para)
  where x.acao = p_acao;
  if para is null then raise exception 'acao_invalida'; end if;

  update pedidos set status = para, atualizado_em = now()
  where id = p_id and restaurante_id = d.restaurante_id and status = de;
  get diagnostics n = row_count;
  return json_build_object('ok', n > 0);
end $$;

create or replace function public.salvar_push(p_token text, p_inscricao jsonb)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare d public.dispositivos;
begin
  d := _dispositivo(p_token);
  if d.papel = 'mesa' then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if coalesce(p_inscricao->>'endpoint', '') !~ '^https://' then
    raise exception 'inscricao_invalida';
  end if;
  insert into push_inscricoes (endpoint, token, dados)
  values (p_inscricao->>'endpoint', p_token, p_inscricao)
  on conflict (endpoint) do update set token = excluded.token, dados = excluded.dados;
  return json_build_object('ok', true);
end $$;

-- Gatilho: avisa as telas do restaurante que algo mudou.
create or replace function public._avisar_mudanca()
returns trigger
language plpgsql security definer set search_path = public as $$
declare rid uuid := coalesce(new.restaurante_id, old.restaurante_id);
begin
  perform realtime.send(json_build_object('t', extract(epoch from now()))::jsonb,
                        'mudou', (select canal from restaurantes where id = rid), false);
  return null;
end $$;

create trigger avisar_chamados after insert or update or delete on public.chamados
  for each row execute function public._avisar_mudanca();
create trigger avisar_pedidos after insert or update or delete on public.pedidos
  for each row execute function public._avisar_mudanca();

-- Só as RPCs públicas ficam liberadas para o site.
revoke execute on all functions in schema public from anon, authenticated, public;
grant execute on function public.entrar(text, text, text)            to anon, authenticated;
grant execute on function public.estado(text)                        to anon, authenticated;
grant execute on function public.acao_mesa(text, text, text, text)   to anon, authenticated;
grant execute on function public.acao_pedido(text, bigint, text)     to anon, authenticated;
grant execute on function public.salvar_push(text, jsonb)            to anon, authenticated;
