/**
 * Impede open redirect (CWE-601). Achado de auditoria de segurança: o filtro
 * ingênuo `valor.startsWith("/") && !valor.startsWith("//")` não barra
 * `/\evil.com` — o parser de URL (WHATWG, usado tanto pelo `new URL()`
 * quanto pela resolução do header `Location` no navegador) normaliza `\`
 * para `/` em esquemas especiais, então `/\evil.com` vira `//evil.com` →
 * autoridade `evil.com`. Confirmado ao vivo (`new URL("/\\evil.com", base)`
 * resolve para `https://evil.com/`). Esta função resolve o valor com o
 * MESMO parser que vai processar o redirect de verdade, e só aceita quando
 * a origem resultante não muda. `http://localhost` é só uma base fixa e
 * arbitrária pra checar "isto é um caminho relativo, não um redirect pra
 * outro host" — nunca é a origem real da requisição.
 *
 * Extraída pra cá (antes só existia local em `src/lib/actions/auth.ts`)
 * porque a entrada via SSO (`/auth/entrar-via-hub`) precisa da mesma
 * validação num segundo lugar.
 */
export function destinoSeguro(valor: string | null | undefined, fallback: string): string {
  if (!valor) return fallback;
  try {
    const base = "http://localhost";
    const resolvido = new URL(valor, base);
    if (resolvido.origin !== base) return fallback;
    return resolvido.pathname + resolvido.search + resolvido.hash;
  } catch {
    return fallback;
  }
}
