-- Três pedidos do usuário sobre o módulo Requerimentos:
--
-- 1) "Quando um requerimento foi distribuído, ele não pode ser distribuído
--    novamente." Hoje `distribuir_requerimento` podia ser chamada várias
--    vezes para ir acrescentando secretarias aos poucos (só travava
--    duplicar a MESMA secretaria, via `on conflict do nothing`). Passa a
--    ser um ato único: uma vez `distribuido_em` preenchido, qualquer nova
--    chamada é recusada — a escolha de secretarias tem que ser feita de
--    uma vez só. Guarda em duas camadas (RPC + UI, mesmo padrão do
--    App-Compras): a UI (painel-requerimentos.tsx) esconde o botão
--    "Distribuir" quando `distribuidoEm` já existe.
--
-- 2) Ciência da secretaria vira um passo explícito e rastreado — hoje não
--    existia NENHUM conceito de ciência (só "distribuído" -> "respondido").
--    `dar_ciencia` só pode ser chamada por quem tem permissão de responder
--    por aquela secretaria (`pode_responder_secretaria`, já existente:
--    gabinete, diretor, ou a própria secretaria) — nos moldes do
--    `aceitar_atribuicao` do App-Compras. Deliberadamente NÃO bloqueia
--    "marcar respondida": o pedido foi sobre quem PODE dar ciência, não
--    sobre transformar ciência em pré-requisito de resposta — não inventar
--    regra de negócio não pedida.
--
-- 3) Anexo do PRÓPRIO requerimento (documento em PDF a ser enviado às
--    secretarias) — diferente do anexo de RESPOSTA que já existia em
--    `requerimentos_secretarias.anexos` (migration 20260922000000). Nova
--    coluna `requerimentos.anexos`, gravável só pelo gabinete
--    (`anexar_documento`, sempre um APPEND — nunca substitui, para não
--    perder anexo de outra pessoa por corrida), legível por qualquer um
--    que possa ver aquele requerimento (`pode_ver_requerimento`, novo
--    helper — mesmo escopo de `le_requerimentos`, extraído para reuso
--    também pelas policies de storage abaixo, nunca duplicar a regra em
--    três lugares). Mesmo bucket `requerimentos-anexos` já existente,
--    caminho `{requerimento_id}/documento/{arquivo}` — segmento literal
--    "documento" (não um secretaria_id), então as policies novas comparam
--    texto no 2º segmento, não fazem cast para uuid (evita colidir com as
--    policies de anexo de resposta, que fazem esse cast).
--
-- Validado transacionalmente (9 cenários: distribuição dupla bloqueada,
-- ciência pela própria secretaria, ciência dupla bloqueada, ciência por
-- secretaria errada bloqueada, anon bloqueado em dar_ciencia/
-- pode_ver_requerimento, secretaria não-distribuída não vê o requerimento,
-- secretaria distribuída vê, secretaria não pode anexar_documento, gabinete
-- anexa em duas chamadas e o resultado é APPEND não substituição) antes de
-- aplicar — `rollback` forçado. `get_advisors` depois de aplicar: mesma
-- contagem de sempre (13 anon-executável, sem categoria nova), as 3 funções
-- novas aparecem só como "authenticated executável", nunca "anon
-- executável" — schema `requerimentos` não sofre do vazamento de default
-- privilege a `anon` que o schema `public` do App-Compras tem (confirmado:
-- `anon` recebe "permission denied for schema requerimentos" antes mesmo de
-- checar GRANT de função).

create or replace function requerimentos.distribuir_requerimento(p_requerimento uuid, p_secretarias uuid[])
returns void
language plpgsql security definer set search_path = ''
as $function$
begin
  if not requerimentos.atua_como_gabinete() then
    raise exception 'Sem permissão para distribuir requerimento';
  end if;
  if (select distribuido_em from requerimentos.requerimentos where id = p_requerimento) is not null then
    raise exception 'Requerimento já distribuído — não pode ser distribuído novamente';
  end if;
  insert into requerimentos.requerimentos_secretarias (requerimento_id, secretaria_id)
    select p_requerimento, s from unnest(p_secretarias) as s
    on conflict (requerimento_id, secretaria_id) do nothing;
  update requerimentos.requerimentos
    set distribuido_em = coalesce(distribuido_em, current_date)
    where id = p_requerimento;
  insert into requerimentos.eventos_timeline (requerimento_id, tipo, autor_id, detalhe)
    values (p_requerimento, 'distribuido', (select auth.uid()), jsonb_build_object('secretarias', p_secretarias));
  insert into requerimentos.logs (usuario_id, acao, detalhe)
    values ((select auth.uid()), 'distribuir_requerimento', jsonb_build_object('requerimento_id', p_requerimento, 'secretarias', p_secretarias));
end;
$function$;

alter table requerimentos.requerimentos_secretarias
  add column if not exists ciencia_em date;

create or replace function requerimentos.dar_ciencia(p_requerimento uuid, p_secretaria uuid)
returns void
language plpgsql security definer set search_path = ''
as $function$
declare v_n int;
begin
  if not requerimentos.pode_responder_secretaria(p_secretaria) then
    raise exception 'Sem permissão para dar ciência por esta secretaria';
  end if;
  update requerimentos.requerimentos_secretarias
    set ciencia_em = current_date
    where requerimento_id = p_requerimento and secretaria_id = p_secretaria and ciencia_em is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Requerimento não distribuído a essa secretaria, ou ciência já dada';
  end if;
  insert into requerimentos.eventos_timeline (requerimento_id, tipo, autor_id, detalhe)
    values (p_requerimento, 'secretaria_deu_ciencia', (select auth.uid()), jsonb_build_object('secretaria', p_secretaria));
  insert into requerimentos.logs (usuario_id, acao, detalhe)
    values ((select auth.uid()), 'dar_ciencia', jsonb_build_object('requerimento_id', p_requerimento, 'secretaria', p_secretaria));
end;
$function$;
revoke all on function requerimentos.dar_ciencia(uuid, uuid) from public;
grant execute on function requerimentos.dar_ciencia(uuid, uuid) to authenticated, service_role;

alter table requerimentos.requerimentos
  add column if not exists anexos text[] not null default '{}';

create or replace function requerimentos.pode_ver_requerimento(p_requerimento uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    requerimentos.eh_admin()
      or requerimentos.eh_diretor()
      or requerimentos.atua_como_gabinete()
      or exists (
        select 1 from requerimentos.requerimentos_secretarias rs
        where rs.requerimento_id = p_requerimento and rs.secretaria_id = requerimentos.minha_secretaria()
      ),
    false
  )
$$;
revoke all on function requerimentos.pode_ver_requerimento(uuid) from public;
grant execute on function requerimentos.pode_ver_requerimento(uuid) to authenticated, service_role;

create or replace function requerimentos.anexar_documento(p_requerimento uuid, p_anexos text[])
returns void
language plpgsql security definer set search_path = ''
as $function$
begin
  if not requerimentos.atua_como_gabinete() then
    raise exception 'Sem permissão para anexar documento ao requerimento';
  end if;
  update requerimentos.requerimentos
    set anexos = anexos || p_anexos
    where id = p_requerimento;
  if not found then
    raise exception 'Requerimento não encontrado';
  end if;
  insert into requerimentos.eventos_timeline (requerimento_id, tipo, autor_id, detalhe)
    values (p_requerimento, 'documento_anexado', (select auth.uid()), jsonb_build_object('quantidade', coalesce(array_length(p_anexos,1),0)));
  insert into requerimentos.logs (usuario_id, acao, detalhe)
    values ((select auth.uid()), 'anexar_documento', jsonb_build_object('requerimento_id', p_requerimento, 'anexos', p_anexos));
end;
$function$;
revoke all on function requerimentos.anexar_documento(uuid, text[]) from public;
grant execute on function requerimentos.anexar_documento(uuid, text[]) to authenticated, service_role;

drop policy if exists le_documento_requerimento on storage.objects;
create policy le_documento_requerimento on storage.objects
  for select using (
    bucket_id = 'requerimentos-anexos'
    and (storage.foldername(name))[2] = 'documento'
    and requerimentos.pode_ver_requerimento(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists grava_documento_requerimento on storage.objects;
create policy grava_documento_requerimento on storage.objects
  for insert with check (
    bucket_id = 'requerimentos-anexos'
    and (storage.foldername(name))[2] = 'documento'
    and requerimentos.atua_como_gabinete()
  );
