import type { Fase } from "./status";

/**
 * Cores de FOREGROUND (texto direto sobre branco, ou texto branco sobre
 * fundo colorido) — versões escurecidas do semáforo (#378ADD/#EF9F27/
 * #639922/#94A3B8) e do vermelho (#E24B4A). As cores "puras" do semáforo
 * têm só ~2-3,6:1 de contraste contra branco, abaixo do mínimo de 4,5:1
 * (WCAG AA, texto pequeno) — essas aqui passam. A barra de prazo
 * (`status.ts`) continua com as cores vivas: preenchimento de barra não
 * é texto, não tem essa exigência.
 */
export const COR_FASE: Record<Fase, string> = {
  aguardando: "#2B6CB0",
  distribuido: "#8A5E00",
  respondido: "#3B5C14",
  devolvido: "#475569",
  anulado: "#52525B",
};

export const ROTULO_FASE: Record<Fase, string> = {
  aguardando: "Aguardando distribuição",
  distribuido: "Em andamento",
  respondido: "Pronto p/ devolver",
  devolvido: "Devolvido",
  anulado: "Anulado",
};

export const COR_ATRASADO = "#C0392B";

/**
 * Cores VIVAS do semáforo — só para preenchimento/tinta de fundo (barra
 * superior do cartão, tinta do ícone com opacidade), nunca como texto
 * direto. Mesmo par cor/corNúmero já usado nos cartões-filtro de
 * `painel-processos.tsx` no App-Compras.
 */
export const COR_FASE_VIVA: Record<Fase, string> = {
  aguardando: "#378ADD",
  distribuido: "#EF9F27",
  respondido: "#639922",
  devolvido: "#94A3B8",
  anulado: "#A1A1AA",
};

export const COR_ATRASADO_VIVA = "#E24B4A";
