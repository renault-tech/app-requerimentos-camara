/**
 * Tipos do banco de dados (espelham supabase/migrations).
 * Regenerar/ajustar manualmente quando o schema evoluir (mesmo padrão do
 * App-Compras: tipos escritos à mão, não `supabase gen types`).
 */

export type PerfilUsuario = "admin" | "diretor" | "gabinete" | "secretaria";

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  /** Só usuários de perfil `secretaria` têm. */
  secretaria_id: string | null;
  ativo: boolean;
  criado_em: string;
};

export type Secretaria = {
  id: string;
  nome: string;
  /** Secretaria extinta/fundida some das listas de distribuição e de
   * atribuição de acesso, mas nunca é apagada — registros antigos
   * continuam mostrando o nome normalmente. */
  ativo: boolean;
};

/** Catálogo de vereadores — mesmo molde de `Secretaria`. Usado só para
 * alimentar a lista suspensa do campo `vereador` (texto livre, sem FK —
 * ver comentário em `Requerimento.vereador`). */
export type Vereador = {
  id: string;
  nome: string;
  ativo: boolean;
};

/**
 * Override de permissão pontual. Única chave hoje: `atua_como_gabinete`,
 * que dá a um usuário de secretaria o papel extra de gabinete (distribuir/
 * cobrar/devolver), configurável pelo admin — não é um 5º perfil fixo.
 */
export type Permissao = {
  id: string;
  usuario_id: string;
  chave: string;
  valor: boolean;
};

/** Config singleton (uma linha só, id fixo) do prazo padrão e dos limiares em dias. */
export type ConfigPrazo = {
  id: number;
  prazo_padrao_dias: number;
  limiar_verde_dias: number;
  limiar_amarelo_dias: number;
  limiar_laranja_dias: number;
};

export type Requerimento = {
  id: string;
  numero: string;
  vereador: string;
  assunto: string;
  dias_total: number;
  recebido_em: string;
  distribuido_em: string | null;
  devolvido_em: string | null;
  protocolo_devolucao: string | null;
  criado_em: string;
  /** Anexos do PRÓPRIO requerimento (o documento em PDF a ser enviado às
   * secretarias) — caminhos no bucket `requerimentos-anexos`, caminho
   * `{id}/documento/{arquivo}`. Diferente de `RequerimentoSecretaria.anexos`
   * (anexo da RESPOSTA de cada secretaria). Só gabinete grava
   * (`anexar_documento`, sempre um append), na criação ou depois. */
  anexos: string[];
  /** Lançamento anulado (erro de cadastro, duplicado, retirado pelo
   * vereador) — permanente, sem RPC de "desanular". Trava as demais RPCs
   * do ciclo (`requerimento_esta_anulado`, no banco). */
  anulado_em: string | null;
  anulado_motivo: string | null;
};

/** Junção multi-secretaria: um requerimento pode ir a mais de uma secretaria. */
export type RequerimentoSecretaria = {
  id: string;
  requerimento_id: string;
  secretaria_id: string;
  /** Confirmação explícita de recebimento — só um clique em "Dar ciência"
   * (pela própria secretaria ou pelo gabinete) grava esta data, nunca
   * automático. Não é pré-requisito para `respondida_em`. */
  ciencia_em: string | null;
  respondida_em: string | null;
  /** Caminhos no bucket `requerimentos-anexos` (não URLs — bucket privado,
   * resolvido para signed URL na leitura). Gravado só uma vez, junto com
   * `respondida_em`, por `marcar_respondida`. */
  anexos: string[];
};

export type Prorrogacao = {
  id: string;
  requerimento_id: string;
  dias_concedidos: number;
  motivo: string;
  solicitado_por: string;
  solicitado_em: string;
  decidido_por: string | null;
  decidido_em: string | null;
  aprovada: boolean | null;
};

export type TipoEvento =
  | "criado"
  | "distribuido"
  | "secretaria_deu_ciencia"
  | "secretaria_respondeu"
  | "documento_anexado"
  | "prorrogacao_solicitada"
  | "prorrogacao_decidida"
  | "devolvido"
  | "anulado";

export type EventoTimeline = {
  id: string;
  requerimento_id: string;
  tipo: TipoEvento;
  detalhe: Record<string, unknown>;
  autor_id: string | null;
  criado_em: string;
};

export type Log = {
  id: string;
  usuario_id: string | null;
  acao: string;
  detalhe: Record<string, unknown>;
  criado_em: string;
};

type Tabela<Row, Obrigatorios extends keyof Row, Gerados extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Obrigatorios> & Partial<Omit<Row, Obrigatorios | Gerados>>;
  Update: Partial<Omit<Row, Gerados>>;
  Relationships: [];
};

// A chave de topo é `requerimentos` (não `public`): este projeto Supabase
// é compartilhado com o App-Compras, que já usa `public`. Os clientes
// (client.ts/server.ts/admin.ts) passam `Database` + `"requerimentos"`
// como os dois parâmetros de tipo, e `db: { schema: "requerimentos" }`
// em runtime — os dois precisam bater.
export type Database = {
  requerimentos: {
    Tables: {
      usuarios: Tabela<Usuario, "id" | "nome" | "email" | "perfil", never>;
      secretarias: Tabela<Secretaria, "nome", "id">;
      vereadores: Tabela<Vereador, "nome", "id">;
      permissoes: Tabela<Permissao, "usuario_id" | "chave", "id">;
      config_prazo: Tabela<
        ConfigPrazo,
        "prazo_padrao_dias" | "limiar_verde_dias" | "limiar_amarelo_dias" | "limiar_laranja_dias",
        never
      >;
      requerimentos: Tabela<
        Requerimento,
        "numero" | "vereador" | "assunto" | "dias_total" | "recebido_em",
        "id" | "criado_em"
      >;
      requerimentos_secretarias: Tabela<
        RequerimentoSecretaria,
        "requerimento_id" | "secretaria_id",
        "id"
      >;
      prorrogacoes: Tabela<
        Prorrogacao,
        "requerimento_id" | "dias_concedidos" | "motivo" | "solicitado_por",
        "id" | "solicitado_em"
      >;
      eventos_timeline: Tabela<EventoTimeline, "requerimento_id" | "tipo", "id" | "criado_em">;
      logs: Tabela<Log, "acao", "id" | "criado_em">;
    };
    Views: Record<string, never>;
    Functions: {
      criar_requerimento: {
        Args: {
          p_numero: string;
          p_vereador: string;
          p_assunto: string;
          p_recebido_em: string;
          p_dias_total: number;
        };
        Returns: string;
      };
      distribuir_requerimento: {
        Args: { p_requerimento: string; p_secretarias: string[] };
        Returns: undefined;
      };
      marcar_respondida: {
        Args: { p_requerimento: string; p_secretaria: string; p_anexos?: string[] };
        Returns: undefined;
      };
      dar_ciencia: {
        Args: { p_requerimento: string; p_secretaria: string };
        Returns: undefined;
      };
      anexar_documento: {
        Args: { p_requerimento: string; p_anexos: string[] };
        Returns: undefined;
      };
      solicitar_prorrogacao: {
        Args: { p_requerimento: string; p_dias: number; p_motivo: string };
        Returns: undefined;
      };
      devolver_a_camara: {
        Args: { p_requerimento: string; p_protocolo: string };
        Returns: undefined;
      };
      anular_requerimento: {
        Args: { p_requerimento: string; p_motivo: string };
        Returns: undefined;
      };
      definir_acesso: {
        Args: {
          p_email: string;
          p_nome: string;
          p_perfil: PerfilUsuario;
          p_secretaria_id: string | null;
          p_ativo: boolean;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
