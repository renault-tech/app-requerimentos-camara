"use server";

import { z } from "zod";

import { clienteHubDaSessao, listarMeusEnvios, type EnvioFeedback } from "@/lib/dados/feedback";
type TipoFeedback = "suporte" | "sugestao";

export type ResultadoFeedback = { sucesso: true } | { sucesso: false; erro: string };

const TIPOS: TipoFeedback[] = ["suporte", "sugestao"];

const esquemaEnvio = z.object({
  tipo: z.enum(TIPOS as [TipoFeedback, ...TipoFeedback[]]),
  mensagem: z.string().trim().min(5, "Escreva um pouco mais.").max(4000),
  pagina: z.string().trim().max(200).optional(),
  // Caminhos já enviados ao bucket "feedback-anexos" pelo cliente (RLS do
  // Storage já garante que só a própria pasta do usuário aceita upload) —
  // aqui só gravamos a referência, não recebemos o arquivo em si.
  anexos: z.array(z.string().trim().min(1)).max(5).optional(),
});

/** Registra o feedback na tabela CENTRAL do Hub (`hub.feedback`) com app = requerimentos. */
export async function enviarFeedback(dados: {
  tipo: TipoFeedback;
  mensagem: string;
  pagina?: string;
  anexos?: string[];
}): Promise<ResultadoFeedback> {
  const analise = esquemaEnvio.safeParse(dados);
  if (!analise.success) {
    return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const ctx = await clienteHubDaSessao();
  if (!ctx) return { sucesso: false, erro: "Não autenticado." };

  const { error } = await ctx.hub.rpc("enviar_feedback", {
    p_app: "requerimentos",
    p_tipo: analise.data.tipo,
    p_mensagem: analise.data.mensagem,
    p_pagina: analise.data.pagina ?? null,
    p_anexos: analise.data.anexos ?? [],
  });
  if (error) {
    console.error("[enviarFeedback] erro:", error);
    return { sucesso: false, erro: "Não foi possível enviar. Tente novamente." };
  }
  return { sucesso: true };
}

/** Histórico de envios do próprio usuário, para a aba "Meus envios". */
export async function meusEnvios(): Promise<EnvioFeedback[]> {
  return listarMeusEnvios();
}
