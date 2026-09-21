"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { PerfilUsuario } from "@/types/database";

export type ResultadoConfig = { sucesso: true } | { sucesso: false; erro: string };

function traduzirErro(mensagem: string | undefined): string {
  if (!mensagem) return "Não foi possível concluir a ação. Tente novamente.";
  const conhecida = mensagem.match(/(?:^|: )([A-ZÁÉÍÓÚÂÊÔÃÕÇJS][^\n]*)/);
  return conhecida?.[1] ?? "Não foi possível concluir a ação. Tente novamente.";
}

function revalidar() {
  revalidatePath("/configuracoes");
}

const esquemaPrazo = z.object({
  prazoPadraoDias: z.coerce.number().int().min(1),
  limiarVerdeDias: z.coerce.number().int().min(1),
  limiarAmareloDias: z.coerce.number().int().min(1),
  limiarLaranjaDias: z.coerce.number().int().min(1),
});

export async function atualizarConfigPrazo(
  dados: z.infer<typeof esquemaPrazo>
): Promise<ResultadoConfig> {
  const analise = esquemaPrazo.safeParse(dados);
  if (!analise.success) {
    return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("config_prazo")
    .update({
      prazo_padrao_dias: analise.data.prazoPadraoDias,
      limiar_verde_dias: analise.data.limiarVerdeDias,
      limiar_amarelo_dias: analise.data.limiarAmareloDias,
      limiar_laranja_dias: analise.data.limiarLaranjaDias,
    })
    .eq("id", 1);

  if (error) {
    console.error("[atualizarConfigPrazo] erro:", error);
    return { sucesso: false, erro: "Não foi possível salvar a configuração." };
  }

  revalidar();
  return { sucesso: true };
}

const esquemaSecretaria = z.object({ nome: z.string().trim().min(2).max(120) });

export async function criarSecretaria(dados: { nome: string }): Promise<ResultadoConfig> {
  const analise = esquemaSecretaria.safeParse(dados);
  if (!analise.success) {
    return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("secretarias").insert({ nome: analise.data.nome });

  if (error) {
    console.error("[criarSecretaria] erro:", error);
    return {
      sucesso: false,
      erro: error.code === "23505" ? "Já existe uma secretaria com esse nome." : "Não foi possível criar a secretaria.",
    };
  }

  revalidar();
  return { sucesso: true };
}

const esquemaAcesso = z.object({
  email: z.email("Informe um e-mail válido"),
  nome: z.string().trim().min(2, "Informe o nome"),
  perfil: z.enum(["admin", "diretor", "gabinete", "secretaria"]),
  secretariaId: z.uuid().nullable(),
  ativo: z.boolean(),
});

export async function definirAcesso(
  dados: z.infer<typeof esquemaAcesso>
): Promise<ResultadoConfig> {
  const analise = esquemaAcesso.safeParse(dados);
  if (!analise.success) {
    return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos" };
  }
  if (analise.data.perfil === "secretaria" && !analise.data.secretariaId) {
    return { sucesso: false, erro: "Selecione a secretaria" };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("definir_acesso", {
    p_email: analise.data.email,
    p_nome: analise.data.nome,
    p_perfil: analise.data.perfil as PerfilUsuario,
    p_secretaria_id: analise.data.perfil === "secretaria" ? analise.data.secretariaId : null,
    p_ativo: analise.data.ativo,
  });

  if (error) {
    console.error("[definirAcesso] erro na RPC:", error);
    return { sucesso: false, erro: traduzirErro(error.message) };
  }

  revalidar();
  return { sucesso: true };
}

export async function definirAtuaComoGabinete(
  usuarioId: string,
  valor: boolean
): Promise<ResultadoConfig> {
  if (!z.uuid().safeParse(usuarioId).success) {
    return { sucesso: false, erro: "Identificador inválido" };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("permissoes")
    .upsert(
      { usuario_id: usuarioId, chave: "atua_como_gabinete", valor },
      { onConflict: "usuario_id,chave" }
    );

  if (error) {
    console.error("[definirAtuaComoGabinete] erro:", error);
    return { sucesso: false, erro: "Não foi possível salvar a permissão." };
  }

  revalidar();
  return { sucesso: true };
}
