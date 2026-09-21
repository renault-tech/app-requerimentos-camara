import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { Usuario } from "@/types/database";

export { RUTULO_PERFIL, PERFIS_SEM_SECRETARIA } from "@/lib/auth/rotulos";

/**
 * Resolve o usuário autenticado (sessão + linha em `usuarios`).
 * Envolto em React.cache: layouts aninhados e páginas chamam esta função
 * na mesma requisição.
 */
export const obterUsuarioAtual = cache(async (): Promise<Usuario | null> => {
  const supabase = await criarClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    // PGRST116 = nenhuma linha: sessão existe, mas não há cadastro em
    // `usuarios` (conta removida). Isso é ausência real, não falha.
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("[obterUsuarioAtual] falha ao ler o perfil:", error);
    throw new Error("Não foi possível carregar seu perfil. Tente novamente.");
  }

  return usuario ?? null;
});

/**
 * Um usuário atua como gabinete (distribui/cobra/devolve) quando o perfil
 * já é `gabinete`, OU quando tem o override `atua_como_gabinete=true` em
 * `permissoes` (opção configurável em Configurações para dar esse papel
 * extra a uma secretaria, sem trocar o perfil base dela).
 */
export const usuarioAtuaComoGabinete = cache(async (usuario: Usuario): Promise<boolean> => {
  if (usuario.perfil === "admin" || usuario.perfil === "diretor" || usuario.perfil === "gabinete") {
    return true;
  }
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("permissoes")
    .select("valor")
    .eq("usuario_id", usuario.id)
    .eq("chave", "atua_como_gabinete")
    .maybeSingle();
  return data?.valor === true;
});
