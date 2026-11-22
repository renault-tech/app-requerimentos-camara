"use client";

import { useLinkStatus } from "next/link";

/**
 * Vai DENTRO de um `<Link>`: enquanto a navegação desse link não termina, mostra um ponto pulsando e o CSS
 * (`a:has([data-pendente])`, em `globals.css`) acende o item. O clique responde no mesmo instante, mesmo quando a tela nova
 * ainda está sendo buscada.
 */
export function MarcaPendente() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span data-pendente aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F4C95D]" />;
}
