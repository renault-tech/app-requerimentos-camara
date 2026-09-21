import { describe, expect, it } from "vitest";

import { calcularDiasRestantes, categoriaPrazo, estaAtrasado, faseDoRequerimento } from "./status";
import type { ConfigPrazo } from "@/types/database";

const CONFIG: ConfigPrazo = {
  id: 1,
  prazo_padrao_dias: 15,
  limiar_verde_dias: 8,
  limiar_amarelo_dias: 4,
  limiar_laranja_dias: 2,
};

describe("faseDoRequerimento", () => {
  it("aguardando: ainda não distribuído", () => {
    expect(faseDoRequerimento({ distribuido_em: null, devolvido_em: null }, [])).toBe(
      "aguardando"
    );
  });

  it("distribuido: alguma secretaria ainda não respondeu", () => {
    const fase = faseDoRequerimento({ distribuido_em: "2026-01-01", devolvido_em: null }, [
      { respondida_em: "2026-01-05" },
      { respondida_em: null },
    ]);
    expect(fase).toBe("distribuido");
  });

  it("respondido: todas as secretarias responderam", () => {
    const fase = faseDoRequerimento({ distribuido_em: "2026-01-01", devolvido_em: null }, [
      { respondida_em: "2026-01-05" },
      { respondida_em: "2026-01-06" },
    ]);
    expect(fase).toBe("respondido");
  });

  it("devolvido vence qualquer outra condição", () => {
    const fase = faseDoRequerimento(
      { distribuido_em: "2026-01-01", devolvido_em: "2026-01-10" },
      [{ respondida_em: null }]
    );
    expect(fase).toBe("devolvido");
  });
});

describe("calcularDiasRestantes", () => {
  it("prazo de 15 dias recebido hoje ainda tem 15 dias restantes", () => {
    const hoje = new Date("2026-03-10T12:00:00Z");
    expect(calcularDiasRestantes("2026-03-10", 15, hoje)).toBe(15);
  });

  it("no dia do vencimento retorna 0", () => {
    const hoje = new Date("2026-03-25T12:00:00Z");
    expect(calcularDiasRestantes("2026-03-10", 15, hoje)).toBe(0);
  });

  it("vencido retorna negativo", () => {
    const hoje = new Date("2026-03-27T12:00:00Z");
    expect(calcularDiasRestantes("2026-03-10", 15, hoje)).toBe(-2);
  });

  it("não adianta o dia perto da meia-noite de Brasília (21h-00h UTC)", () => {
    // 2026-03-10T00:30:00Z = 09/03 21h30 em Brasília — "hoje" ainda é dia 09.
    // Recebido também no dia 09: prazo cheio (15), não 14 (o que uma
    // leitura ingênua em UTC, que já veria "dia 10", produziria).
    const hoje = new Date("2026-03-10T00:30:00Z");
    expect(calcularDiasRestantes("2026-03-09", 15, hoje)).toBe(15);
  });
});

describe("categoriaPrazo", () => {
  it("vencido: barra quase vazia e vermelha", () => {
    const cat = categoriaPrazo(-3, CONFIG);
    expect(cat.pctBarra).toBe(0);
    expect(cat.cor).toBe("#E24B4A");
    expect(cat.texto).toBe("vencido há 3 dias");
  });

  it("vence hoje: texto específico", () => {
    expect(categoriaPrazo(0, CONFIG).texto).toBe("vence hoje");
  });

  it("escala em dias absolutos: 12 dias sempre maior que 9 dias, mesmo com prazos totais diferentes", () => {
    const cat9 = categoriaPrazo(9, CONFIG);
    const cat12 = categoriaPrazo(12, CONFIG);
    expect(cat12.pctBarra).toBeGreaterThan(cat9.pctBarra);
    // 9/15 = 60%, 12/15 = 80%
    expect(cat9.pctBarra).toBeCloseTo(60);
    expect(cat12.pctBarra).toBeCloseTo(80);
  });

  it("cores por limiar em dias absolutos", () => {
    expect(categoriaPrazo(10, CONFIG).cor).toBe("#639922"); // >= 8: verde
    expect(categoriaPrazo(6, CONFIG).cor).toBe("#EF9F27"); // >= 4: amarelo
    expect(categoriaPrazo(3, CONFIG).cor).toBe("#E8862E"); // >= 2: laranja
    expect(categoriaPrazo(1, CONFIG).cor).toBe("#E24B4A"); // < 2: vermelho
  });
});

describe("estaAtrasado", () => {
  it("distribuído e vencido conta como atrasado", () => {
    expect(estaAtrasado("distribuido", -1)).toBe(true);
  });

  it("devolvido nunca é atrasado, mesmo com dias negativos", () => {
    expect(estaAtrasado("devolvido", -10)).toBe(false);
  });

  it("dentro do prazo não é atrasado", () => {
    expect(estaAtrasado("distribuido", 5)).toBe(false);
  });
});
