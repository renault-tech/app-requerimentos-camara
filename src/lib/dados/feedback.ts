import { criarClienteHubComSessao } from "@/lib/supabase/hub-cliente";
import { criarClienteServidor } from "@/lib/supabase/server";

export type EnvioFeedback = {
  id: string;
  tipo: "suporte" | "sugestao";
  mensagem: string;
  status: "novo" | "lido" | "resolvido" | "nao_possivel";
  criado_em: string;
};

/**
 * Cliente do schema `hub` (mesmo projeto Supabase) com o token da sessão
 * atual — o feedback é centralizado no Hub (`hub.feedback`), não mais aqui.
 */
export async function clienteHubDaSessao() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  return { hub: criarClienteHubComSessao(session.access_token), usuarioId: user.id };
}

/** Histórico do próprio usuário (RLS: `usuario_id = auth.uid()`), só deste app. */
export async function listarMeusEnvios(): Promise<EnvioFeedback[]> {
  const ctx = await clienteHubDaSessao();
  if (!ctx) return [];
  const { data, error } = await ctx.hub
    .from("feedback")
    .select("id, tipo, mensagem, status, criado_em")
    .eq("usuario_id", ctx.usuarioId)
    .eq("app", "requerimentos")
    .order("criado_em", { ascending: false })
    .limit(30);
  if (error) {
    console.error("[listarMeusEnvios]", error);
    return [];
  }
  return (data ?? []) as EnvioFeedback[];
}
