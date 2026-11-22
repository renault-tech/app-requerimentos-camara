import { describe, expect, it } from "vitest";

import { filtrarItens } from "@/lib/modulo/area-trabalho";
import type { RequerimentoDaLista } from "@/lib/dados/requerimentos";
import {
  dimensoesRequerimentos,
  faixaDoPrazo,
  indicadoresRequerimentos,
  montarLinhas,
  ORDENS_REQUERIMENTOS,
  resumoFiltrosRequerimentos,
  textoBuscaRequerimento,
  textoDoPrazo,
} from "@/lib/requerimentos/area-trabalho";

function req(p: Partial<RequerimentoDaLista> & { numero: string }): RequerimentoDaLista {
  return {
    id: p.numero,
    vereador: "Ana Souza",
    assunto: "Poda de árvores",
    diasTotal: 15,
    recebidoEm: "2026-11-01",
    distribuidoEm: null,
    devolvidoEm: null,
    protocoloDevolucao: null,
    secretarias: [],
    anexos: [],
    anuladoEm: null,
    anuladoMotivo: null,
    fase: "aguardando",
    diasRestantes: 10,
    prazo: { cor: "#000", texto: "", pctBarra: 0 },
    atrasado: false,
    ...p,
  };
}
const sec = (id: string, nome: string, respondida: string | null = null) => ({ id: `v-${id}`, secretariaId: id, nomeSecretaria: nome, cienciaEm: null, respondidaEm: respondida, anexos: [] });

const base = [
  req({ numero: "1/2026", fase: "distribuido", diasRestantes: -3, atrasado: true, secretarias: [sec("s1", "Saúde"), sec("s2", "Obras", "2026-11-10")] }),
  req({ numero: "2/2026", fase: "distribuido", diasRestantes: 2, secretarias: [sec("s2", "Obras")] }),
  req({ numero: "3/2026", fase: "respondido", diasRestantes: 6, secretarias: [sec("s1", "Saúde", "2026-11-10")] }),
  req({ numero: "4/2026", fase: "aguardando", diasRestantes: 40, vereador: "José Lima" }),
  req({ numero: "5/2026", fase: "devolvido", diasRestantes: -20, devolvidoEm: "2026-11-05", secretarias: [sec("s1", "Saúde", "2026-11-02")] }),
  req({ numero: "6/2026", fase: "anulado", diasRestantes: 1, anuladoEm: "2026-11-02" }),
];
const linhas = montarLinhas(base);
const ler = (m: Record<string, string>) => (k: string) => m[k];
const dims = dimensoesRequerimentos();

describe("faixas de prazo", () => {
  it("separa por dias restantes e deixa os encerrados de fora", () => {
    expect(faixaDoPrazo(true, -1)).toBe("atrasado");
    expect(faixaDoPrazo(true, 0)).toBe("ate3");
    expect(faixaDoPrazo(true, 3)).toBe("ate3");
    expect(faixaDoPrazo(true, 4)).toBe("ate7");
    expect(faixaDoPrazo(true, 7)).toBe("ate7");
    expect(faixaDoPrazo(true, 8)).toBe("ate15");
    expect(faixaDoPrazo(true, 15)).toBe("ate15");
    expect(faixaDoPrazo(true, 16)).toBe("mais15");
    expect(faixaDoPrazo(false, -50)).toBe("encerrado");
  });

  it("devolvido e anulado não têm prazo correndo nem pendência", () => {
    const l = (n: string) => linhas.find((x) => x.numero === n)!;
    expect(l("5/2026").aberto).toBe(false);
    expect(l("6/2026").aberto).toBe(false);
    expect(l("5/2026").pendentes).toEqual([]);
  });

  it("pendentes = secretarias que ainda não responderam", () => {
    expect(linhas[0].pendentes.map((s) => s.nome)).toEqual(["Saúde"]);
    expect(linhas[2].pendentes).toEqual([]); // respondido: tudo em dia, falta só devolver
  });

  it("textos do prazo", () => {
    expect(textoDoPrazo({ aberto: true, diasRestantes: -1 })).toBe("Atrasado há 1 dia");
    expect(textoDoPrazo({ aberto: true, diasRestantes: -3 })).toBe("Atrasado há 3 dias");
    expect(textoDoPrazo({ aberto: true, diasRestantes: 0 })).toBe("Vence hoje");
    expect(textoDoPrazo({ aberto: true, diasRestantes: 1 })).toBe("1 dia");
    expect(textoDoPrazo({ aberto: false, diasRestantes: 9 })).toBe("");
  });
});

describe("filtros", () => {
  const nums = (l: typeof linhas) => l.map((x) => x.numero);
  it("a dimensão Prazo só enxerga os abertos", () => {
    expect(nums(filtrarItens(linhas, dims, ler({ prazo: "atrasado" }), null))).toEqual(["1/2026"]);
    expect(nums(filtrarItens(linhas, dims, ler({ prazo: "encerrado" }), null))).toEqual([]);
  });
  it("Resposta pendente de: quem ainda deve", () => {
    expect(nums(filtrarItens(linhas, dims, ler({ pend: "s1" }), null))).toEqual(["1/2026"]);
    expect(nums(filtrarItens(linhas, dims, ler({ pend: "s2" }), null))).toEqual(["2/2026"]);
  });
  it("Secretaria vale para todos, inclusive os já devolvidos", () => {
    expect(nums(filtrarItens(linhas, dims, ler({ sec: "s1" }), null))).toEqual(["1/2026", "3/2026", "5/2026"]);
  });
  it("vereador ignora acento e caixa", () => {
    expect(nums(filtrarItens(linhas, dims, ler({ ver: "jose lima" }), null))).toEqual(["4/2026"]);
  });
  it("combina filtros e busca (inclui o nome da secretaria)", () => {
    const busca = { texto: textoBuscaRequerimento, q: "obras" };
    expect(nums(filtrarItens(linhas, dims, ler({ fase: "distribuido" }), busca))).toEqual(["1/2026", "2/2026"]);
  });
});

describe("ordem", () => {
  const urgencia = ORDENS_REQUERIMENTOS[0].comparar;
  it("abertos primeiro, do mais atrasado ao mais folgado; encerrados no fim", () => {
    expect([...linhas].sort(urgencia).map((x) => x.numero)).toEqual(["1/2026", "2/2026", "3/2026", "4/2026", "5/2026", "6/2026"]);
  });
  it("número com ordem natural", () => {
    const l = montarLinhas([req({ numero: "10/2026" }), req({ numero: "9/2026" })]);
    expect([...l].sort(ORDENS_REQUERIMENTOS[2].comparar).map((x) => x.numero)).toEqual(["9/2026", "10/2026"]);
  });
});

describe("indicadores e resumo dos filtros", () => {
  it("conta o que pede ação, sobre o que está filtrado", () => {
    const k = indicadoresRequerimentos(linhas, linhas);
    expect(k.map((i) => i.valor)).toEqual(["1", "2", "1", "1"]);
    expect(k[0].apoio).toBe("de 4 em aberto");
    const so = indicadoresRequerimentos(filtrarItens(linhas, dims, ler({ sec: "s1" }), null), linhas);
    expect(so.map((i) => i.valor)).toEqual(["1", "1", "0", "1"]);
  });
  it("texto dos filtros para a exportação", () => {
    expect(resumoFiltrosRequerimentos(dims, ler({ prazo: "atrasado", sec: "s1" }), linhas, "poda")).toBe('Prazo: Atrasados · Secretaria: Saúde · Busca: "poda"');
    expect(resumoFiltrosRequerimentos(dims, ler({}), linhas, "")).toContain("Nenhum filtro");
  });
});
