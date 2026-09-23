import { dataNoFuso, diasDeCalendarioEntre } from "@/lib/fuso";
import type { ConfigPrazo, Requerimento, RequerimentoSecretaria } from "@/types/database";

export type Fase = "aguardando" | "distribuido" | "respondido" | "devolvido" | "anulado";

/**
 * Fase é sempre DERIVADA, nunca armazenada — mesma regra da casa usada
 * no App-Compras (nunca duplicar classificação de dados). `anulado` tem
 * precedência sobre qualquer outra condição: um requerimento anulado pode
 * ter sido anulado em qualquer estágio (antes ou depois de distribuído/
 * respondido/devolvido) — a anulação sempre vence.
 */
export function faseDoRequerimento(
  requerimento: Pick<Requerimento, "distribuido_em" | "devolvido_em" | "anulado_em">,
  secretarias: Pick<RequerimentoSecretaria, "respondida_em">[]
): Fase {
  if (requerimento.anulado_em) return "anulado";
  if (requerimento.devolvido_em) return "devolvido";
  if (!requerimento.distribuido_em) return "aguardando";
  if (secretarias.length > 0 && secretarias.every((s) => s.respondida_em)) return "respondido";
  return "distribuido";
}

/**
 * Dias restantes até o fim do prazo (negativo = vencido há N dias).
 * `recebidoEm` é "AAAA-MM-DD" (coluna `date`, sem fuso). A soma de dias é
 * feita em UTC meio-dia (nunca cai numa transição de horário de verão) e
 * a comparação com "hoje" usa o dia-calendário de Brasília
 * (`diasDeCalendarioEntre`) — mesmo cuidado de fuso já usado no
 * App-Compras, essencial entre 21h e 00h.
 */
export function calcularDiasRestantes(
  recebidoEm: string,
  diasTotal: number,
  hoje: Date = new Date()
): number {
  const recebido = new Date(`${recebidoEm}T12:00:00Z`);
  const prazoFinal = new Date(recebido);
  prazoFinal.setUTCDate(prazoFinal.getUTCDate() + diasTotal);
  const prazoFinalISO = new Date(`${dataNoFuso(prazoFinal)}T12:00:00Z`);
  return diasDeCalendarioEntre(hoje, prazoFinalISO);
}

export type CategoriaPrazo = {
  cor: string;
  texto: string;
  /** 0-100: % da barra preenchida. Escala em DIAS ABSOLUTOS (não % do
   * prazo individual) — dois requerimentos com o mesmo nº de dias
   * restantes sempre mostram a mesma barra, mesmo com prazos totais
   * diferentes. Cheia e verde no início, esvazia até quase vazia e
   * vermelha no vencimento. */
  pctBarra: number;
};

const CORES = {
  verde: "#639922",
  amarelo: "#EF9F27",
  laranja: "#E8862E",
  vermelho: "#E24B4A",
} as const;

export function categoriaPrazo(diasRestantes: number, config: ConfigPrazo): CategoriaPrazo {
  if (diasRestantes <= 0) {
    const atraso = Math.abs(diasRestantes);
    return {
      cor: CORES.vermelho,
      texto: diasRestantes === 0 ? "vence hoje" : `vencido há ${atraso} ${atraso === 1 ? "dia" : "dias"}`,
      pctBarra: 0,
    };
  }
  const pctBarra = Math.max(
    0,
    Math.min(100, (diasRestantes / config.prazo_padrao_dias) * 100)
  );
  let cor: string;
  if (diasRestantes >= config.limiar_verde_dias) cor = CORES.verde;
  else if (diasRestantes >= config.limiar_amarelo_dias) cor = CORES.amarelo;
  else if (diasRestantes >= config.limiar_laranja_dias) cor = CORES.laranja;
  else cor = CORES.vermelho;
  return {
    cor,
    texto: `${diasRestantes} ${diasRestantes === 1 ? "dia restante" : "dias restantes"}`,
    pctBarra,
  };
}

/** "Atrasado" é ortogonal à fase: um requerimento distribuído pode estar
 * atrasado; um já devolvido ou anulado nunca está (o relógio parou pra ele). */
export function estaAtrasado(fase: Fase, diasRestantes: number): boolean {
  return fase !== "devolvido" && fase !== "anulado" && diasRestantes <= 0;
}
