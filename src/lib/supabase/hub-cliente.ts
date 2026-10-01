import { createClient } from "@supabase/supabase-js";

import { envPublico } from "@/lib/env";

/**
 * Cliente mínimo apontando para o schema `hub`, do MESMO projeto Supabase
 * (não é um projeto separado — só schema diferente, sem segredo novo).
 * Usado só para ler `esta_bloqueado_login_direto` antes do login, então não
 * precisa de sessão/cookies — a checagem não depende de quem está
 * perguntando.
 */
export function criarClienteHub() {
  const env = envPublico();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "hub" },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Mesmo cliente do schema `hub`, mas com o token de uma sessão já
 * autenticada — para gravar/ler o próprio feedback (`hub.feedback`). */
export function criarClienteHubComSessao(accessToken: string) {
  const env = envPublico();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "hub" },
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
