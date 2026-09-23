-- Pedido do usuário, pensado para reuso institucional (esta plataforma pode
-- vir a ser usada por outras prefeituras/câmaras, não só Cataguases):
--
-- 1) Catálogo de VEREADORES (novo) — hoje "vereador" é texto livre digitado
--    a cada requerimento, sem padronização nem correção fácil de nome.
--    Nova tabela `vereadores` (mesmo molde de `secretarias`: nome único,
--    `ativo` para afastar/encerrar mandato sem apagar histórico). O campo
--    `requerimentos.vereador` CONTINUA texto livre, sem FK — decisão
--    deliberada: legislatura muda (eleição, afastamento, suplência), e
--    travar por FK rígida quebraria requerimentos antigos ou impediria
--    digitar um nome ainda não cadastrado. A lista suspensa (UI) lê só os
--    vereadores `ativo=true`, com opção "Outro" que libera texto livre —
--    cobre tanto o caso comum (escolher da lista) quanto o excepcional
--    (nome novo ainda não cadastrado, suplente, correção pontual).
--
-- 2) `secretarias` ganha coluna `ativo` (default true) — RENOMEAR já era
--    possível via RLS (só faltava UI/action), agora também dá pra
--    DESATIVAR uma secretaria extinta/fundida sem quebrar
--    `requerimentos_secretarias`/`usuarios.secretaria_id` (nunca DELETE).
--    Secretaria inativa some das listas de distribuição/atribuição de
--    acesso, mas registros antigos continuam mostrando o nome normalmente.
--
-- 3) Requerimento pode ser ANULADO (lançamento incorreto, duplicado, ou
--    retirado pelo próprio vereador) — `anulado_em`/`anulado_motivo` +
--    RPC `anular_requerimento` (mesma permissão de quem distribui:
--    `atua_como_gabinete()`), motivo obrigatório (mín. 3 caracteres),
--    permanente (sem RPC de "desanular" — mesmo padrão do
--    `cancelar_processo` do App-Compras: correção de lançamento é
--    auditável, não um estado reversível). `anulado` vira uma 5ª fase
--    (função pura `faseDoRequerimento`, precedência sobre qualquer outra
--    condição) e trava as demais RPCs do ciclo (`distribuir_requerimento`,
--    `marcar_respondida`, `dar_ciencia`, `anexar_documento`,
--    `solicitar_prorrogacao`, `devolver_a_camara`) via helper
--    `requerimento_esta_anulado`, reaplicadas com `create or replace` a
--    partir do `pg_get_functiondef` do estado vigente (nunca de memória).
--
-- Sem GRANT explícito para a tabela `vereadores`: `pg_default_acl` deste
-- schema já concede `authenticated`/`service_role` automaticamente a toda
-- tabela nova (confirmado antes de escrever esta migration — diferente do
-- schema `public` do App-Compras, que tem o vazamento documentado para
-- `anon`; aqui não existe entrada de `anon` no default ACL).
--
-- Validado transacionalmente antes de aplicar (várias transações
-- menores, padrão da casa): admin renomeia/desativa vereador e secretaria;
-- usuário perfil `secretaria` bloqueado de escrever nos dois catálogos
-- (RLS confirmada pelo row_count = 0, não pela ausência de erro — um
-- UPDATE filtrado pela USING clause não lança exceção, só afeta 0 linhas);
-- anon bloqueado no nível do schema; ciclo completo de anulação (motivo
-- curto bloqueado, anula, evento+log gravados, segunda anulação bloqueada,
-- as 6 RPCs do ciclo bloqueadas com mensagem específica, requerimento
-- normal não afetado); não-gabinete e anon bloqueados de anular.

create table if not exists requerimentos.vereadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table requerimentos.vereadores enable row level security;

drop policy if exists ref_vereadores on requerimentos.vereadores;
create policy ref_vereadores on requerimentos.vereadores
  for select using (requerimentos.sou_usuario());

drop policy if exists admin_gerencia_vereadores on requerimentos.vereadores;
create policy admin_gerencia_vereadores on requerimentos.vereadores
  for all
  using (requerimentos.eh_admin() or requerimentos.eh_diretor())
  with check (requerimentos.eh_admin() or requerimentos.eh_diretor());

alter table requerimentos.secretarias
  add column if not exists ativo boolean not null default true;

alter table requerimentos.requerimentos
  add column if not exists anulado_em date,
  add column if not exists anulado_motivo text;

create or replace function requerimentos.requerimento_esta_anulado(p_requerimento uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select anulado_em from requerimentos.requerimentos where id = p_requerimento) is not null
$$;
revoke all on function requerimentos.requerimento_esta_anulado(uuid) from public;
grant execute on function requerimentos.requerimento_esta_anulado(uuid) to authenticated, service_role;

create or replace function requerimentos.anular_requerimento(p_requerimento uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $function$
begin
  if not requerimentos.atua_como_gabinete() then
    raise exception 'Sem permissão para anular requerimento';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Informe o motivo da anulação';
  end if;
  if requerimentos.requerimento_esta_anulado(p_requerimento) then
    raise exception 'Requerimento já está anulado';
  end if;
  update requerimentos.requerimentos
    set anulado_em = current_date, anulado_motivo = trim(p_motivo)
    where id = p_requerimento;
  if not found then
    raise exception 'Requerimento não encontrado';
  end if;
  insert into requerimentos.eventos_timeline (requerimento_id, tipo, autor_id, detalhe)
    values (p_requerimento, 'anulado', (select auth.uid()), jsonb_build_object('motivo', trim(p_motivo)));
  insert into requerimentos.logs (usuario_id, acao, detalhe)
    values ((select auth.uid()), 'anular_requerimento', jsonb_build_object('requerimento_id', p_requerimento, 'motivo', trim(p_motivo)));
end;
$function$;
revoke all on function requerimentos.anular_requerimento(uuid, text) from public;
grant execute on function requerimentos.anular_requerimento(uuid, text) to authenticated, service_role;

-- As 6 RPCs abaixo são `create or replace` idêntico ao estado vigente
-- (conferido via pg_get_functiondef antes de escrever), só acrescentando
-- o guard de anulado logo após a checagem de permissão. ACL preservado
-- (create or replace não muda GRANT existente).

create or replace function requerimentos.distribuir_requerimento(p_requerimento uuid, p_secretarias uuid[])
returns void
language plpgsql security definer set search_path = ''
as $function$
begin
  if not requerimentos.atua_como_gabinete() then
    raise exception 'Sem permissão para distribuir requerimento';
  end if;
  if requerimentos.requerimento_esta_anulado(p_requerimento) then
    raise exception 'Requerimento anulado — não pode ser distribuído';
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

create or replace function requerimentos.marcar_respondida(p_requerimento uuid, p_secretaria uuid, p_anexos text[] default '{}'::text[])
returns void
language plpgsql security definer set search_path = ''
as $function$
declare v_n int;
begin
  if not requerimentos.pode_responder_secretaria(p_secretaria) then
    raise exception 'Sem permissão para marcar esta resposta';
  end if;
  if requerimentos.requerimento_esta_anulado(p_requerimento) then
    raise exception 'Requerimento anulado — não pode ser respondido';
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

create or replace function requerimentos.dar_ciencia(p_requerimento uuid, p_secretaria uuid)
returns void
language plpgsql security definer set search_path = ''
as $function$
declare v_n int;
begin
  if not requerimentos.pode_responder_secretaria(p_secretaria) then
    raise exception 'Sem permissão para dar ciência por esta secretaria';
  end if;
  if requerimentos.requerimento_esta_anulado(p_requerimento) then
    raise exception 'Requerimento anulado — ciência bloqueada';
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

create or replace function requerimentos.anexar_documento(p_requerimento uuid, p_anexos text[])
returns void
language plpgsql security definer set search_path = ''
as $function$
begin
  if not requerimentos.atua_como_gabinete() then
    raise exception 'Sem permissão para anexar documento ao requerimento';
  end if;
  if requerimentos.requerimento_esta_anulado(p_requerimento) then
    raise exception 'Requerimento anulado — não pode receber novo anexo';
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

create or replace function requerimentos.solicitar_prorrogacao(p_requerimento uuid, p_dias integer, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $function$
begin
  if not requerimentos.atua_como_gabinete() then
    raise exception 'Sem permissão para solicitar prorrogação';
  end if;
  if requerimentos.requerimento_esta_anulado(p_requerimento) then
    raise exception 'Requerimento anulado — prorrogação bloqueada';
  end if;
  insert into requerimentos.prorrogacoes (requerimento_id, dias_concedidos, motivo, solicitado_por)
    values (p_requerimento, p_dias, p_motivo, (select auth.uid()));
  update requerimentos.requerimentos set dias_total = dias_total + p_dias where id = p_requerimento;
  insert into requerimentos.eventos_timeline (requerimento_id, tipo, autor_id, detalhe)
    values (p_requerimento, 'prorrogacao_solicitada', (select auth.uid()), jsonb_build_object('dias', p_dias, 'motivo', p_motivo));
  insert into requerimentos.logs (usuario_id, acao, detalhe)
    values ((select auth.uid()), 'solicitar_prorrogacao', jsonb_build_object('requerimento_id', p_requerimento, 'dias', p_dias));
end;
$function$;

create or replace function requerimentos.devolver_a_camara(p_requerimento uuid, p_protocolo text)
returns void
language plpgsql security definer set search_path = ''
as $function$
declare v_pendentes int;
begin
  if not requerimentos.atua_como_gabinete() then
    raise exception 'Sem permissão para devolver à câmara';
  end if;
  if requerimentos.requerimento_esta_anulado(p_requerimento) then
    raise exception 'Requerimento anulado — não pode ser devolvido';
  end if;
  select count(*) into v_pendentes from requerimentos.requerimentos_secretarias
    where requerimento_id = p_requerimento and respondida_em is null;
  if v_pendentes > 0 then
    raise exception 'Ainda há % secretaria(s) sem resposta', v_pendentes;
  end if;
  if not exists (select 1 from requerimentos.requerimentos_secretarias where requerimento_id = p_requerimento) then
    raise exception 'Requerimento nunca foi distribuído a nenhuma secretaria';
  end if;
  update requerimentos.requerimentos
    set devolvido_em = current_date, protocolo_devolucao = p_protocolo
    where id = p_requerimento;
  insert into requerimentos.eventos_timeline (requerimento_id, tipo, autor_id, detalhe)
    values (p_requerimento, 'devolvido', (select auth.uid()), jsonb_build_object('protocolo', p_protocolo));
  insert into requerimentos.logs (usuario_id, acao, detalhe)
    values ((select auth.uid()), 'devolver_a_camara', jsonb_build_object('requerimento_id', p_requerimento, 'protocolo', p_protocolo));
end;
$function$;
