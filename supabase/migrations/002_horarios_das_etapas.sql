-- Horário de cada etapa do pedido, para a mesa acompanhar como um rastreio:
-- anotado (criado_em) -> na cozinha (preparando_em) -> a caminho (pronto_em) -> entregue (entregue_em)

alter table public.pedidos
  add column if not exists preparando_em timestamptz,
  add column if not exists pronto_em     timestamptz,
  add column if not exists entregue_em   timestamptz;

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

  update pedidos set
    status = para,
    atualizado_em = now(),
    preparando_em = case when para = 'preparando' then now() else preparando_em end,
    pronto_em     = case when para = 'pronto'     then now() else pronto_em end,
    entregue_em   = case when para = 'entregue'   then now() else entregue_em end
  where id = p_id and restaurante_id = d.restaurante_id and status = de;
  get diagnostics n = row_count;
  return json_build_object('ok', n > 0);
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
        'atualizado', extract(epoch from p.atualizado_em),
        'preparando', extract(epoch from p.preparando_em),
        'pronto', extract(epoch from p.pronto_em),
        'entregue', extract(epoch from p.entregue_em)) order by p.id)
      from pedidos p
      where p.restaurante_id = r.id
        and (d.papel <> 'mesa' or p.mesa = d.mesa)
        and (p.status <> 'entregue' or p.atualizado_em > now() - interval '1 hour')
    ), '[]'::json)
  );
end $$;

-- create or replace mantém as permissões, mas reforçamos:
revoke execute on function public.acao_pedido(text, bigint, text) from public;
revoke execute on function public.estado(text) from public;
grant execute on function public.acao_pedido(text, bigint, text) to anon, authenticated;
grant execute on function public.estado(text) to anon, authenticated;
