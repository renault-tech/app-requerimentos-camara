-- Cadastro unificado pelo Hub Central Cataguases (`centraltech`, schema
-- `hub`, mesmo projeto Supabase do Requerimentos/Compras): admin/diretor do
-- Hub (`hub.eh_admin_hub()`) passa a poder conceder acesso ao Requerimentos
-- também, sem precisar já ser `requerimentos.eh_admin()` — é a mesma conta
-- física (`auth.uid()` compartilhado entre os 3 apps deste projeto), só a
-- aprovação passa a poder vir do Hub. Aditivo: quem já é admin do
-- Requerimentos continua funcionando exatamente igual (o `or` só amplia).
--
-- `marcar_login_origem` alimenta o sinal "quantos usuários já migraram
-- para o login pelo Hub" no painel de bloqueio do Hub.

alter table requerimentos.usuarios
  add column if not exists ultimo_acesso_origem text,
  add column if not exists veio_do_hub_em timestamptz;

create or replace function requerimentos.marcar_login_origem(p_origem text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'É preciso estar autenticado.';
  end if;
  if p_origem not in ('hub', 'direto') then
    raise exception 'Origem inválida: %', p_origem;
  end if;
  update requerimentos.usuarios
     set ultimo_acesso_origem = p_origem,
         veio_do_hub_em = case when p_origem = 'hub' then now() else veio_do_hub_em end
   where id = v_uid;
end;
$function$;

revoke execute on function requerimentos.marcar_login_origem(text) from public;
grant execute on function requerimentos.marcar_login_origem(text) to authenticated, service_role;

create or replace function requerimentos.definir_acesso(p_email text, p_nome text, p_perfil requerimentos.perfil_usuario, p_secretaria_id uuid, p_ativo boolean default true)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_auth_id uuid;
begin
  if not (requerimentos.eh_admin() or hub.eh_admin_hub()) then
    raise exception 'Sem permissão para conceder acesso';
  end if;
  select id into v_auth_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_auth_id is null then
    raise exception 'Nenhuma conta encontrada com o e-mail %. A pessoa precisa já ter login em algum módulo da plataforma.', p_email;
  end if;
  insert into requerimentos.usuarios (id, nome, email, perfil, secretaria_id, ativo)
    values (v_auth_id, p_nome, p_email, p_perfil, p_secretaria_id, p_ativo)
    on conflict (id) do update set
      nome = excluded.nome, perfil = excluded.perfil,
      secretaria_id = excluded.secretaria_id, ativo = excluded.ativo;
  insert into requerimentos.logs (usuario_id, acao, detalhe)
    values ((select auth.uid()), 'definir_acesso', jsonb_build_object('usuario_id', v_auth_id, 'email', p_email, 'perfil', p_perfil));
  return v_auth_id;
end;
$function$;
