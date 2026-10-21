import { createBrowserClient } from "@supabase/ssr";

import { envPublico } from "@/lib/env";

/** Avisos da plataforma (`hub.notificacoes`), lidos no navegador com a MESMA
 * sessão deste app (cookies do projeto compartilhado) — a RLS de lá só
 * devolve os avisos da própria pessoa. */
export type AvisoHub = {
  id: string;
  app: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  criado_em: string;
  lida_em: string | null;
};

export function criarClienteHubNavegador() {
  const env = envPublico();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "hub" },
  });
}
