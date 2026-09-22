import { criarClienteServidor } from "@/lib/supabase/server";
import { calcularDiasRestantes, categoriaPrazo, estaAtrasado, faseDoRequerimento } from "@/lib/requerimentos/status";
import type { CategoriaPrazo, Fase } from "@/lib/requerimentos/status";
import type { ConfigPrazo, Secretaria } from "@/types/database";

export type AnexoResposta = {
  /** Caminho no bucket — usado como key estável em listas React. */
  caminho: string;
  /** URL assinada (10 min), ou null se a geração falhou — o link some, não quebra a tela. */
  url: string | null;
  nomeArquivo: string;
};

export type SecretariaDoRequerimento = {
  id: string;
  secretariaId: string;
  nomeSecretaria: string;
  respondidaEm: string | null;
  anexos: AnexoResposta[];
};

export type RequerimentoDaLista = {
  id: string;
  numero: string;
  vereador: string;
  assunto: string;
  diasTotal: number;
  recebidoEm: string;
  distribuidoEm: string | null;
  devolvidoEm: string | null;
  protocoloDevolucao: string | null;
  secretarias: SecretariaDoRequerimento[];
  fase: Fase;
  diasRestantes: number;
  prazo: CategoriaPrazo;
  atrasado: boolean;
};

/**
 * Lê requerimentos, a junção de secretarias e o catálogo de secretarias
 * em três consultas separadas e cruza em JS — mesmo padrão do
 * App-Compras (nunca embed do PostgREST, que exige `Relationships`
 * tipado só pra isso). RLS já restringe o escopo de cada perfil.
 */
export async function listarRequerimentos(): Promise<RequerimentoDaLista[]> {
  const supabase = await criarClienteServidor();

  const [
    { data: requerimentos, error: erroReq },
    { data: vinculos, error: erroVinculos },
    { data: secretarias, error: erroSecretarias },
    config,
  ] = await Promise.all([
    supabase
      .from("requerimentos")
      .select("*")
      .order("recebido_em", { ascending: false }),
    supabase.from("requerimentos_secretarias").select("*"),
    supabase.from("secretarias").select("*"),
    obterConfigPrazo(),
  ]);

  if (erroReq || erroVinculos || erroSecretarias) {
    console.error(
      "[listarRequerimentos] falha ao ler dados:",
      erroReq ?? erroVinculos ?? erroSecretarias
    );
    throw new Error("Não foi possível carregar os requerimentos.");
  }

  const nomePorSecretaria = new Map((secretarias ?? []).map((s) => [s.id, s.nome]));
  const hoje = new Date();

  // Bucket privado — resolve todas as signed URLs de uma vez (não uma
  // chamada por anexo), validade curta (10 min), igual ao padrão já usado
  // pelo Feedback do App-Compras.
  const todosOsCaminhos = (vinculos ?? []).flatMap((v) => v.anexos ?? []);
  const urlPorCaminho = new Map<string, string | null>();
  if (todosOsCaminhos.length > 0) {
    const { data: assinadas, error: erroAssinadas } = await supabase.storage
      .from("requerimentos-anexos")
      .createSignedUrls(todosOsCaminhos, 600);
    if (erroAssinadas) {
      console.error("[listarRequerimentos] falha ao assinar anexos:", erroAssinadas);
    }
    for (const a of assinadas ?? []) {
      if (a.path) urlPorCaminho.set(a.path, a.error ? null : a.signedUrl);
    }
  }

  return (requerimentos ?? []).map((r) => {
    const secretariasDoRequerimento: SecretariaDoRequerimento[] = (vinculos ?? [])
      .filter((v) => v.requerimento_id === r.id)
      .map((v) => ({
        id: v.id,
        secretariaId: v.secretaria_id,
        nomeSecretaria: nomePorSecretaria.get(v.secretaria_id) ?? "?",
        respondidaEm: v.respondida_em,
        anexos: (v.anexos ?? []).map((caminho) => ({
          caminho,
          url: urlPorCaminho.get(caminho) ?? null,
          nomeArquivo: caminho.split("/").pop() ?? caminho,
        })),
      }));
    const fase = faseDoRequerimento(
      { distribuido_em: r.distribuido_em, devolvido_em: r.devolvido_em },
      secretariasDoRequerimento.map((s) => ({ respondida_em: s.respondidaEm }))
    );
    const diasRestantes = calcularDiasRestantes(r.recebido_em, r.dias_total, hoje);
    return {
      id: r.id,
      numero: r.numero,
      vereador: r.vereador,
      assunto: r.assunto,
      diasTotal: r.dias_total,
      recebidoEm: r.recebido_em,
      distribuidoEm: r.distribuido_em,
      devolvidoEm: r.devolvido_em,
      protocoloDevolucao: r.protocolo_devolucao,
      secretarias: secretariasDoRequerimento,
      fase,
      diasRestantes,
      prazo: categoriaPrazo(diasRestantes, config),
      atrasado: estaAtrasado(fase, diasRestantes),
    };
  });
}

export async function listarSecretarias(): Promise<Secretaria[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("secretarias").select("*").order("nome");
  if (error) {
    console.error("[listarSecretarias] falha:", error);
    throw new Error("Não foi possível carregar as secretarias.");
  }
  return data ?? [];
}

export async function obterConfigPrazo(): Promise<ConfigPrazo> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("config_prazo").select("*").eq("id", 1).single();
  if (error) {
    console.error("[obterConfigPrazo] falha:", error);
    throw new Error("Não foi possível carregar a configuração de prazo.");
  }
  return data;
}
