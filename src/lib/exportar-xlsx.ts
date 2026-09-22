/**
 * Exportação para Excel (.xlsx) via SheetJS, carregado sob demanda (mesmo
 * padrão de jsPDF/jspdf-autotable em exportar-pdf.ts: o chamador faz
 * `await import("@/lib/exportar-xlsx")`, então a lib só entra no bundle
 * quando alguém de fato exporta).
 *
 * Duas formas de uso:
 * - `gerarXlsxSecoes`: uma aba por seção com título — mesmo formato de
 *   `SecaoRelatorioPdf`, para relatórios já agregados (ex.: /relatorios).
 * - `gerarXlsxLista` + `computarResumoExportacao`: uma aba "Dados" com as
 *   colunas escolhidas de uma lista de linhas, mais uma aba "Resumo"
 *   opcional com totalização por grupo — para listas com seletor de
 *   colunas e totalização (ex.: /processos, /contratos).
 */
import * as XLSX from "xlsx";

export type ColunaExportavel<T> = {
  key: string;
  rotulo: string;
  valor: (linha: T) => string | number | null;
};

export type GrupoTotalizacao<T> = {
  chave: string;
  rotulo: string;
  /** Chaves de agrupamento desta linha — normalmente uma, mas pode ser
   * várias (ex.: um contrato com mais de uma secretaria conta em cada). */
  chavesDaLinha: (linha: T) => string[];
};

export type ResumoExportacao = {
  total: number;
  valorTotal: number | null;
  grupos: Array<{
    rotulo: string;
    linhas: Array<{ rotulo: string; n: number; valor: number | null }>;
  }>;
};

/** Totalização por grupo — mesma lógica de `computeSummary` do painel original. */
export function computarResumoExportacao<T>(
  linhas: T[],
  grupos: GrupoTotalizacao<T>[],
  valorDe?: (linha: T) => number | null
): ResumoExportacao {
  const temValor = Boolean(valorDe);
  return {
    total: linhas.length,
    valorTotal: temValor ? linhas.reduce((soma, l) => soma + (valorDe!(l) ?? 0), 0) : null,
    grupos: grupos.map((g) => {
      const mapa = new Map<string, { n: number; valor: number }>();
      linhas.forEach((l) => {
        const chaves = g.chavesDaLinha(l);
        const chavesEfetivas = chaves.length > 0 ? chaves : ["—"];
        chavesEfetivas.forEach((chave) => {
          const atual = mapa.get(chave) ?? { n: 0, valor: 0 };
          atual.n += 1;
          atual.valor += valorDe?.(l) ?? 0;
          mapa.set(chave, atual);
        });
      });
      return {
        rotulo: g.rotulo,
        linhas: Array.from(mapa.entries())
          .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
          .map(([rotulo, v]) => ({ rotulo, n: v.n, valor: temValor ? v.valor : null })),
      };
    }),
  };
}

function celulaLargura(texto: string): { wch: number } {
  return { wch: Math.min(Math.max(texto.length + 2, 10), 60) };
}

async function paraBlob(livro: XLSX.WorkBook): Promise<Blob> {
  const saida: ArrayBuffer = XLSX.write(livro, { bookType: "xlsx", type: "array" });
  return new Blob([saida], { type: "application/octet-stream" });
}

export type SecaoXlsx = { titulo: string; colunas: string[]; linhas: (string | number)[][] };

/** Uma aba por seção — mesmo shape de `SecaoRelatorioPdf`, para relatórios já agregados. */
export async function gerarXlsxSecoes(secoes: SecaoXlsx[]): Promise<Blob> {
  const livro = XLSX.utils.book_new();
  secoes.forEach((secao, indice) => {
    const aoa = [secao.colunas, ...secao.linhas];
    const planilha = XLSX.utils.aoa_to_sheet(aoa);
    planilha["!cols"] = secao.colunas.map((c) => celulaLargura(c));
    const nomeAba = secao.titulo.slice(0, 31) || `Seção ${indice + 1}`;
    XLSX.utils.book_append_sheet(livro, planilha, nomeAba);
  });
  return paraBlob(livro);
}

/**
 * Aba "Dados" com as colunas escolhidas, mais aba "Resumo" opcional com
 * totalização por grupo (contagem + soma de valor quando aplicável).
 */
export async function gerarXlsxLista<T>(opts: {
  colunas: ColunaExportavel<T>[];
  linhas: T[];
  resumo?: ResumoExportacao;
}): Promise<Blob> {
  const { colunas, linhas, resumo } = opts;
  const livro = XLSX.utils.book_new();

  const aoaDados = [
    colunas.map((c) => c.rotulo),
    ...linhas.map((linha) => colunas.map((c) => c.valor(linha) ?? "")),
  ];
  const planilhaDados = XLSX.utils.aoa_to_sheet(aoaDados);
  planilhaDados["!cols"] = colunas.map((c) => celulaLargura(c.rotulo));
  XLSX.utils.book_append_sheet(livro, planilhaDados, "Dados");

  if (resumo) {
    const aoaResumo: (string | number)[][] = [
      [`Resumo — gerado em ${new Date().toLocaleString("pt-BR")}`],
      ["Total de registros", resumo.total],
    ];
    if (resumo.valorTotal != null) {
      aoaResumo.push(["Valor total (R$)", resumo.valorTotal]);
    }
    aoaResumo.push([]);
    for (const grupo of resumo.grupos) {
      aoaResumo.push([grupo.rotulo]);
      aoaResumo.push(
        resumo.valorTotal != null ? ["", "Nº de registros", "Valor (R$)"] : ["", "Nº de registros"]
      );
      grupo.linhas.forEach((l) => {
        aoaResumo.push(resumo.valorTotal != null ? [l.rotulo, l.n, l.valor ?? 0] : [l.rotulo, l.n]);
      });
      aoaResumo.push([]);
    }
    const planilhaResumo = XLSX.utils.aoa_to_sheet(aoaResumo);
    planilhaResumo["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(livro, planilhaResumo, "Resumo");
  }

  return paraBlob(livro);
}

export function baixarBlob(nomeArquivo: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
