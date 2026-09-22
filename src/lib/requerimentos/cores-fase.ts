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
};

export const ROTULO_FASE: Record<Fase, string> = {
  aguardando: "Aguardando distribuição",
  distribuido: "Em andamento",
  respondido: "Pronto p/ devolver",
  devolvido: "Devolvido",
};

export const COR_ATRASADO = "#C0392B";
