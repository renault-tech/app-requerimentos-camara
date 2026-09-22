"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { criarClienteServidor } from "@/lib/supabase/server";

export type ResultadoRequerimento =
  | { sucesso: true }
  | { sucesso: false; erro: string };

export type ResultadoCriarRequerimento =
  | { sucesso: true; id: string }
  | { sucesso: false; erro: string };

/** As RPCs levantam exceções com mensagens em português já prontas para a UI. */
function traduzirErro(mensagem: string | undefined): string {
  if (!mensagem) {
    return "Não foi possível concluir a ação. Tente novamente.";
  }
  const conhecida = mensagem.match(/(?:^|: )([A-ZÁÉÍÓÚÂÊÔÃÕÇJS][^\n]*)/);
  return conhecida?.[1] ?? "Não foi possível concluir a ação. Tente novamente.";
}

function revalidarTudo() {
  revalidatePath("/dashboard");
}

const esquemaCriar = z.object({
  numero: z.string().min(1, "Informe o número do requerimento"),
  vereador: z.string().min(1, "Informe o vereador"),
  assunto: z.string().min(1, "Informe o assunto"),
  recebidoEm: z.string().min(1, "Informe a data de recebimento"),
  diasTotal: z.coerce.number().int().min(1, "Prazo precisa ser de pelo menos 1 dia"),
});

export async function criarRequerimento(
  dados: z.infer<typeof esquemaCriar>
): Promise<ResultadoCriarRequerimento> {
  const analise = esquemaCriar.safeParse(dados);
  if (!analise.success) {
    return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("criar_requerimento", {
    p_numero: analise.data.numero,
    p_vereador: analise.data.vereador,
    p_assunto: analise.data.assunto,
    p_recebido_em: analise.data.recebidoEm,
    p_dias_total: analise.data.diasTotal,
  });

  if (error) {
    console.error("[criarRequerimento] erro na RPC:", error);
    return { sucesso: false, erro: traduzirErro(error.message) };
  }

  revalidarTudo();
  return { sucesso: true, id: data as string };
}

export async function distribuirRequerimento(
  requerimentoId: string,
  secretariaIds: string[]
): Promise<ResultadoRequerimento> {
  if (!z.uuid().safeParse(requerimentoId).success || secretariaIds.length === 0) {
    return { sucesso: false, erro: "Selecione ao menos uma secretaria" };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("distribuir_requerimento", {
    p_requerimento: requerimentoId,
    p_secretarias: secretariaIds,
  });

  if (error) {
    console.error("[distribuirRequerimento] erro na RPC:", error);
    return { sucesso: false, erro: traduzirErro(error.message) };
  }

  revalidarTudo();
  return { sucesso: true };
}

export async function marcarRespondida(
  requerimentoId: string,
  secretariaId: string,
  anexos: string[] = []
): Promise<ResultadoRequerimento> {
  if (!z.uuid().safeParse(requerimentoId).success || !z.uuid().safeParse(secretariaId).success) {
    return { sucesso: false, erro: "Identificador inválido" };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("marcar_respondida", {
    p_requerimento: requerimentoId,
    p_secretaria: secretariaId,
    p_anexos: anexos,
  });

  if (error) {
    console.error("[marcarRespondida] erro na RPC:", error);
    return { sucesso: false, erro: traduzirErro(error.message) };
  }

  revalidarTudo();
  return { sucesso: true };
}

export async function solicitarProrrogacao(
  requerimentoId: string,
  dias: number,
  motivo: string
): Promise<ResultadoRequerimento> {
  if (!z.uuid().safeParse(requerimentoId).success) {
    return { sucesso: false, erro: "Identificador inválido" };
  }
  if (!Number.isInteger(dias) || dias <= 0) {
    return { sucesso: false, erro: "Informe um número de dias válido" };
  }
  if (motivo.trim().length < 3) {
    return { sucesso: false, erro: "Descreva o motivo da prorrogação" };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("solicitar_prorrogacao", {
    p_requerimento: requerimentoId,
    p_dias: dias,
    p_motivo: motivo,
  });

  if (error) {
    console.error("[solicitarProrrogacao] erro na RPC:", error);
    return { sucesso: false, erro: traduzirErro(error.message) };
  }

  revalidarTudo();
  return { sucesso: true };
}

export async function devolverACamara(
  requerimentoId: string,
  protocolo: string
): Promise<ResultadoRequerimento> {
  if (!z.uuid().safeParse(requerimentoId).success) {
    return { sucesso: false, erro: "Identificador inválido" };
  }
  if (protocolo.trim().length < 3) {
    return { sucesso: false, erro: "Informe o protocolo do ofício de devolução" };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("devolver_a_camara", {
    p_requerimento: requerimentoId,
    p_protocolo: protocolo,
  });

  if (error) {
    console.error("[devolverACamara] erro na RPC:", error);
    return { sucesso: false, erro: traduzirErro(error.message) };
  }

  revalidarTudo();
  return { sucesso: true };
}
