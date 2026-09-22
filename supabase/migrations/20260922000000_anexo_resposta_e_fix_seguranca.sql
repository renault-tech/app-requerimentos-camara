-- Anexo do ofício/documento de resposta ao marcar uma secretaria como
-- respondida, mais correção de segurança real encontrada ao mexer nesta
-- RPC: o predicado "atua_como_gabinete() or eh_diretor() or minha_secretaria()
-- = p_secretaria" colapsava para NULL (não false) quando o chamador
-- autenticado não tem nenhuma linha em requerimentos.usuarios (minha_secretaria()
-- vira NULL, e NULL = uuid é NULL) — e "if not (NULL) then raise" no plpgsql
-- NÃO dispara, deixando a função prosseguir sem checagem. Como
-- requerimentos e App-Compras/Numera/Hub compartilham o mesmo projeto
-- Supabase, QUALQUER conta autenticada da plataforma (não só quem tem
-- acesso ao módulo Requerimentos) podia chamar marcar_respondida para
-- qualquer requerimento/secretaria e a chamada silenciosamente teria
-- sucesso. Confirmado e corrigido com teste transacional (rollback
-- forçado) antes de aplicar: mesma classe de bug já documentada e
-- corrigida várias vezes no App-Compras (aceitar_atribuicao/
-- parecer_dar_ciencia/parecer_emitir, IS DISTINCT FROM / coalesce).

alter table requerimentos.requerimentos_secretarias
  add column if not exists anexos text[] not null default '{}';

-- Helper reaproveitado pela RPC, pela policy de leitura da tabela e pelas
-- policies de storage (bucket criado abaixo) — nunca duplicar a regra de
-- permissão em três lugares.
create or replace function requerimentos.pode_responder_secretaria(p_secretaria uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    requerimentos.atua_como_gabinete()
      or requerimentos.eh_diretor()
      or requerimentos.minha_secretaria() = p_secretaria,
    false
  )
$$;
revoke all on function requerimentos.pode_responder_secretaria(uuid) from public;
grant execute on function requerimentos.pode_responder_secretaria(uuid) to authenticated, service_role;

drop policy if exists le_requerimentos_secretarias on requerimentos.requerimentos_secretarias;
create policy le_requerimentos_secretarias on requerimentos.requerimentos_secretarias
  for select using (requerimentos.pode_responder_secretaria(secretaria_id));

-- Assinatura muda (ganha p_anexos) -> precisa DROP explícito, senão
-- "create or replace" cria um overload novo ao lado do (uuid,uuid) antigo e
-- a chamada com 2 args fica ambígua entre as duas.
drop function if exists requerimentos.marcar_respondida(uuid, uuid);

create function requerimentos.marcar_respondida(p_requerimento uuid, p_secretaria uuid, p_anexos text[] default '{}')
returns void
language plpgsql security definer set search_path = ''
as $function$
declare v_n int;
begin
  if not requerimentos.pode_responder_secretaria(p_secretaria) then
    raise exception 'Sem permissão para marcar esta resposta';
  end if;
  update requerimentos.requerimentos_secretarias
    set respondida_em = current_date, anexos = p_anexos
    where requerimento_id = p_requerimento and secretaria_id = p_secretaria and respondida_em is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Requerimento não distribuído a essa secretaria, ou já respondido';
  end if;
  insert into requerimentos.eventos_timeline (requerimento_id, tipo, autor_id, detalhe)
    values (p_requerimento, 'secretaria_respondeu', (select auth.uid()), jsonb_build_object('secretaria', p_secretaria, 'anexos', coalesce(array_length(p_anexos, 1), 0)));
  insert into requerimentos.logs (usuario_id, acao, detalhe)
    values ((select auth.uid()), 'marcar_respondida', jsonb_build_object('requerimento_id', p_requerimento, 'secretaria', p_secretaria, 'anexos', p_anexos));
end;
$function$;
revoke all on function requerimentos.marcar_respondida(uuid, uuid, text[]) from public;
grant execute on function requerimentos.marcar_respondida(uuid, uuid, text[]) to authenticated, service_role;

-- Bucket privado para os anexos de resposta. Convenção de caminho
-- {requerimento_id}/{secretaria_id}/{arquivo} — as policies abaixo checam
-- permissão pelo segundo segmento (secretaria_id), reaproveitando o mesmo
-- helper da RPC/policy de tabela. Mesmo tamanho/mime permitido já usado
-- pelo bucket feedback-anexos do App-Compras (mesmo projeto Supabase).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'requerimentos-anexos', 'requerimentos-anexos', false, 5242880,
  array['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain']
)
on conflict (id) do nothing;

drop policy if exists le_anexos_requerimentos on storage.objects;
create policy le_anexos_requerimentos on storage.objects
  for select using (
    bucket_id = 'requerimentos-anexos'
    and requerimentos.pode_responder_secretaria(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists grava_anexos_requerimentos on storage.objects;
create policy grava_anexos_requerimentos on storage.objects
  for insert with check (
    bucket_id = 'requerimentos-anexos'
    and requerimentos.pode_responder_secretaria(((storage.foldername(name))[2])::uuid)
  );
