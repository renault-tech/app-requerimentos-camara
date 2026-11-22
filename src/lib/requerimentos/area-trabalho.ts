import { normalizarBusca, agruparPorDimensao, type Dimensao, type LerParametro } from "@/lib/modulo/area-trabalho";
import type { OrdemLista } from "@/components/modulo/area-trabalho-lista";
import type { RequerimentoDaLista } from "@/lib/dados/requerimentos";
import { COR_FASE_VIVA, ROTULO_FASE } from "@/lib/requerimentos/cores-fase";
import type { Fase } from "@/lib/requerimentos/status";

/**
 * Regras puras da tela de Requerimentos (gráficos que filtram | lista | detalhe): faixas de prazo, quem ainda deve resposta,
 * as "dimensões" de filtro, a ordem da lista e os indicadores. O servidor monta as linhas (`montarLinhas`) e o navegador só desenha.
 */

export type FaixaPrazo = "atrasado" | "ate3" | "ate7" | "ate15" | "mais15" | "encerrado";

export const ROTULO_FAIXA: Record<FaixaPrazo, string> = {
  atrasado: "Atrasados",
  ate3: "Vencem em até 3 dias",
  ate7: "De 4 a 7 dias",
  ate15: "De 8 a 15 dias",
  mais15: "Mais de 15 dias",
  encerrado: "Encerrados",
};

/** Cores vivas do semáforo (as mesmas da barra de prazo); só preenchimento, nunca texto. */
export const COR_FAIXA: Record<FaixaPrazo, string> = {
  atrasado: "#E24B4A",
  ate3: "#E8862E",
  ate7: "#EF9F27",
  ate15: "#639922",
  mais15: "#378ADD",
  encerrado: "#94A3B8",
};

/** Texto (sobre fundo claro) com contraste de AA: versões escurecidas das cores acima. */
export const COR_TEXTO_FAIXA: Record<FaixaPrazo, string> = {
  atrasado: "#B42318",
  ate3: "#9A4A0A",
  ate7: "#8A5E00",
  ate15: "#3B5C14",
  mais15: "#1D5FA8",
  encerrado: "#475569",
};

export const ORDEM_FAIXAS: FaixaPrazo[] = ["atrasado", "ate3", "ate7", "ate15", "mais15", "encerrado"];

export type SecretariaPendente = { id: string; nome: string };

export type LinhaRequerimento = RequerimentoDaLista & {
  /** Ainda corre o prazo: não foi devolvido à Câmara nem anulado. */
  aberto: boolean;
  faixa: FaixaPrazo;
  /** Secretarias que ainda não responderam (só nos abertos). */
  pendentes: SecretariaPendente[];
};

export function faixaDoPrazo(aberto: boolean, diasRestantes: number): FaixaPrazo {
  if (!aberto) return "encerrado";
  if (diasRestantes < 0) return "atrasado";
  if (diasRestantes <= 3) return "ate3";
  if (diasRestantes <= 7) return "ate7";
  if (diasRestantes <= 15) return "ate15";
  return "mais15";
}

export function montarLinhas(requerimentos: RequerimentoDaLista[]): LinhaRequerimento[] {
  return requerimentos.map((r) => {
    const aberto = r.fase !== "devolvido" && r.fase !== "anulado";
    return {
      ...r,
      aberto,
      faixa: faixaDoPrazo(aberto, r.diasRestantes),
      pendentes: aberto ? r.secretarias.filter((s) => !s.respondidaEm).map((s) => ({ id: s.secretariaId, nome: s.nomeSecretaria })) : [],
    };
  });
}

/** Texto do prazo para a lista ("Atrasado há 3 dias", "Vence hoje", "5 dias"); vazio para o que já foi encerrado. */
export function textoDoPrazo(r: Pick<LinhaRequerimento, "aberto" | "diasRestantes">): string {
  if (!r.aberto) return "";
  const d = r.diasRestantes;
  if (d < 0) return `Atrasado há ${-d} ${-d === 1 ? "dia" : "dias"}`;
  if (d === 0) return "Vence hoje";
  return `${d} ${d === 1 ? "dia" : "dias"}`;
}

export function dimensoesRequerimentos(): Dimensao<LinhaRequerimento>[] {
  return [
    {
      chave: "prazo",
      rotulo: "Prazo",
      param: "prazo",
      // só os abertos têm prazo correndo: o gráfico não é dominado pelo histórico já devolvido
      valores: (r) => (r.aberto ? [{ chave: r.faixa, rotulo: ROTULO_FAIXA[r.faixa], cor: COR_FAIXA[r.faixa] }] : []),
      ordem: ORDEM_FAIXAS,
    },
    {
      chave: "pendente",
      rotulo: "Resposta pendente de",
      param: "pend",
      valores: (r) => r.pendentes.map((s) => ({ chave: s.id, rotulo: s.nome })),
    },
    {
      chave: "situacao",
      rotulo: "Situação",
      param: "fase",
      valores: (r) => [{ chave: r.fase, rotulo: ROTULO_FASE[r.fase], cor: COR_FASE_VIVA[r.fase] }],
      ordem: ["aguardando", "distribuido", "respondido", "devolvido", "anulado"] satisfies Fase[],
    },
    {
      chave: "secretaria",
      rotulo: "Secretaria",
      param: "sec",
      valores: (r) => r.secretarias.map((s) => ({ chave: s.secretariaId, rotulo: s.nomeSecretaria })),
    },
    {
      chave: "vereador",
      rotulo: "Vereador",
      param: "ver",
      valores: (r) => [{ chave: normalizarBusca(r.vereador), rotulo: r.vereador }],
    },
  ];
}

/** Busca por número, vereador, assunto e nome das secretarias. */
export function textoBuscaRequerimento(r: LinhaRequerimento): string {
  return [r.numero, r.vereador, r.assunto, ...r.secretarias.map((s) => s.nomeSecretaria)].join(" ");
}

const porNumero = (a: LinhaRequerimento, b: LinhaRequerimento) => a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });

export const ORDENS_REQUERIMENTOS: OrdemLista<LinhaRequerimento>[] = [
  {
    chave: "urgencia",
    rotulo: "Mais urgentes primeiro",
    // abertos antes dos encerrados; entre os abertos, o que vence antes (ou está mais atrasado) vem primeiro
    comparar: (a, b) => Number(b.aberto) - Number(a.aberto) || (a.aberto ? a.diasRestantes - b.diasRestantes : b.recebidoEm.localeCompare(a.recebidoEm)) || porNumero(a, b),
  },
  { chave: "recentes", rotulo: "Recebidos mais recentemente", comparar: (a, b) => b.recebidoEm.localeCompare(a.recebidoEm) || porNumero(b, a) },
  { chave: "numero", rotulo: "Número", comparar: porNumero },
];

export type Indicador = { rotulo: string; valor: string; apoio?: string };

/** Quatro números que dizem o que fazer hoje: atrasados, vencendo na semana, a distribuir e prontos para devolver à Câmara. */
export function indicadoresRequerimentos(filtrados: LinhaRequerimento[], todos: LinhaRequerimento[]): Indicador[] {
  const abertosTodos = todos.filter((r) => r.aberto).length;
  const conta = (lista: LinhaRequerimento[], f: (r: LinhaRequerimento) => boolean) => lista.filter(f).length;
  const atrasados = (r: LinhaRequerimento) => r.faixa === "atrasado";
  const semana = (r: LinhaRequerimento) => r.faixa === "ate3" || r.faixa === "ate7";
  const aDistribuir = (r: LinhaRequerimento) => r.fase === "aguardando";
  const prontos = (r: LinhaRequerimento) => r.fase === "respondido";
  return [
    { rotulo: "Atrasados", valor: String(conta(filtrados, atrasados)), apoio: `de ${abertosTodos} em aberto` },
    { rotulo: "Vencem em 7 dias", valor: String(conta(filtrados, semana)), apoio: "contando hoje" },
    { rotulo: "A distribuir", valor: String(conta(filtrados, aDistribuir)), apoio: "no Gabinete" },
    { rotulo: "Prontos p/ devolver", valor: String(conta(filtrados, prontos)), apoio: "todas responderam" },
  ];
}

/** "Prazo: Atrasados · Secretaria: Saúde · Busca: …" — para o cabeçalho das exportações. */
export function resumoFiltrosRequerimentos(dims: Dimensao<LinhaRequerimento>[], ler: LerParametro, itens: LinhaRequerimento[], q: string): string {
  const partes: string[] = [];
  for (const d of dims) {
    const v = ler(d.param);
    if (!v) continue;
    partes.push(`${d.rotulo}: ${agruparPorDimensao(itens, d).find((g) => g.chave === v)?.rotulo ?? v}`);
  }
  if (q.trim()) partes.push(`Busca: "${q.trim()}"`);
  return partes.length > 0 ? partes.join(" · ") : "Nenhum filtro aplicado — todos os requerimentos";
}
