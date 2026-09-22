import { describe, expect, it } from "vitest";

import { computarResumoExportacao } from "./exportar-xlsx";

type Linha = { categoria: string; grupos: string[]; valor: number };

describe("computarResumoExportacao", () => {
  const linhas: Linha[] = [
    { categoria: "A", grupos: ["Norte"], valor: 100 },
    { categoria: "A", grupos: ["Sul"], valor: 50 },
    { categoria: "B", grupos: ["Norte", "Sul"], valor: 30 },
  ];

  it("soma total e valor total quando um valorDe é informado", () => {
    const resumo = computarResumoExportacao(linhas, [], (l) => l.valor);
    expect(resumo.total).toBe(3);
    expect(resumo.valorTotal).toBe(180);
  });

  it("sem valorDe, valorTotal fica nulo", () => {
    const resumo = computarResumoExportacao(linhas, []);
    expect(resumo.valorTotal).toBeNull();
  });

  it("agrupa por uma chave simples, contando e somando por grupo", () => {
    const resumo = computarResumoExportacao(
      linhas,
      [{ chave: "categoria", rotulo: "por Categoria", chavesDaLinha: (l) => [l.categoria] }],
      (l) => l.valor
    );
    const grupo = resumo.grupos[0];
    expect(grupo.linhas).toEqual([
      { rotulo: "A", n: 2, valor: 150 },
      { rotulo: "B", n: 1, valor: 30 },
    ]);
  });

  it("uma linha com múltiplas chaves de grupo conta integralmente em cada uma", () => {
    const resumo = computarResumoExportacao(
      linhas,
      [{ chave: "regiao", rotulo: "por Região", chavesDaLinha: (l) => l.grupos }],
      (l) => l.valor
    );
    const grupo = resumo.grupos[0];
    expect(grupo.linhas).toEqual([
      { rotulo: "Norte", n: 2, valor: 130 },
      { rotulo: "Sul", n: 2, valor: 80 },
    ]);
  });
});
