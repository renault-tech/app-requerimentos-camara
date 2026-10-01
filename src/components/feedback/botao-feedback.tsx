"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Megaphone, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { enviarFeedback, meusEnvios } from "@/lib/actions/feedback";
import type { EnvioFeedback } from "@/lib/dados/feedback";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { cn, ESTILO_CAMPO_PADRAO as ESTILO_CAMPO } from "@/lib/utils";

type TipoFeedback = "suporte" | "sugestao";

const ROTULO_TIPO: Record<TipoFeedback, string> = {
  suporte: "Suporte",
  sugestao: "Sugestão",
};

const ROTULO_STATUS = {
  novo: "Recebido",
  lido: "Em análise",
  resolvido: "Resolvido",
  nao_possivel: "Não possível",
} as const;

const TAMANHO_MAX_MB = 5;
const MAX_ANEXOS = 5;

/**
 * Botão discreto no header para qualquer perfil mandar um pedido de
 * suporte ou uma sugestão, com anexos (screenshots). O upload dos arquivos acontece
 * direto do navegador para o bucket privado "feedback-anexos" (RLS exige
 * que cada um suba na própria pasta — ver migration), e só os CAMINHOS
 * resultantes são gravados na linha via `enviarFeedback`. Visível a todos
 * (diferente da tela /feedback, que só o admin vê).
 */
export function BotaoFeedback() {
  const pathname = usePathname();
  const [aberto, setAberto] = React.useState(false);
  const [tipo, setTipo] = React.useState<TipoFeedback>("sugestao");
  const [mensagem, setMensagem] = React.useState("");
  const [arquivos, setArquivos] = React.useState<File[]>([]);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [enviado, setEnviado] = React.useState(false);
  const [aba, setAba] = React.useState<"enviar" | "meus">("enviar");
  const [envios, setEnvios] = React.useState<EnvioFeedback[] | null>(null);

  async function abrirMeus() {
    setAba("meus");
    setEnvios(null);
    setEnvios(await meusEnvios());
  }

  function limparEFechar(novoAberto: boolean) {
    setAberto(novoAberto);
    if (!novoAberto) {
      setTipo("sugestao");
      setMensagem("");
      setArquivos([]);
      setErro(null);
      setEnviado(false);
      setAba("enviar");
    }
  }

  function aoEscolherArquivos(evento: React.ChangeEvent<HTMLInputElement>) {
    const novos = Array.from(evento.target.files ?? []);
    evento.target.value = "";

    // Valida arquivo a arquivo — um anexo grande demais não deve descartar
    // os outros da mesma seleção, e o motivo da rejeição precisa aparecer,
    // não sumir silenciosamente.
    const grandeDemais = novos.filter((f) => f.size > TAMANHO_MAX_MB * 1024 * 1024);
    const validos = novos.filter((f) => f.size <= TAMANHO_MAX_MB * 1024 * 1024);
    const combinados = [...arquivos, ...validos];
    const cortados = combinados.slice(MAX_ANEXOS);

    const avisos: string[] = [];
    if (grandeDemais.length > 0) {
      avisos.push(`${grandeDemais.map((f) => f.name).join(", ")} passa${grandeDemais.length > 1 ? "m" : ""} de ${TAMANHO_MAX_MB}MB e não ${grandeDemais.length > 1 ? "foram anexados" : "foi anexado"}.`);
    }
    if (cortados.length > 0) {
      avisos.push(`Máximo de ${MAX_ANEXOS} anexos — ${cortados.map((f) => f.name).join(", ")} não ${cortados.length > 1 ? "couberam" : "coube"}.`);
    }

    setArquivos(combinados.slice(0, MAX_ANEXOS));
    setErro(avisos.length > 0 ? avisos.join(" ") : null);
  }

  function removerArquivo(indice: number) {
    setArquivos((atual) => atual.filter((_, i) => i !== indice));
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (mensagem.trim().length < 5) {
      setErro("Escreva um pouco mais.");
      return;
    }
    setEnviando(true);
    setErro(null);

    try {
      const supabase = criarClienteNavegador();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setErro("Sessão expirada — recarregue a página.");
        return;
      }

      const caminhos: string[] = [];
      for (const arquivo of arquivos) {
        const nomeSeguro = arquivo.name.replace(/[^\w.-]/g, "_");
        const caminho = `${user.id}/${crypto.randomUUID()}-${nomeSeguro}`;
        const { error: erroUpload } = await supabase.storage
          .from("feedback-anexos")
          .upload(caminho, arquivo, { contentType: arquivo.type || undefined });
        if (erroUpload) {
          throw new Error(`Não foi possível enviar o anexo "${arquivo.name}".`);
        }
        caminhos.push(caminho);
      }

      const resultado = await enviarFeedback({
        tipo,
        mensagem: mensagem.trim(),
        pagina: pathname,
        anexos: caminhos,
      });

      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }

      setEnviado(true);
      setMensagem("");
      setArquivos([]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={limparEFechar}>
      <button
        type="button"
        aria-label="Enviar feedback"
        title="Enviar feedback"
        onClick={() => setAberto(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Megaphone className="h-5 w-5" aria-hidden strokeWidth={1.8} />
      </button>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar feedback</DialogTitle>
        </DialogHeader>

        <div className="-mt-1 flex gap-1 border-b border-slate-200 text-sm">
          {(["enviar", "meus"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => (a === "meus" ? abrirMeus() : setAba("enviar"))}
              className={cn(
                "border-b-2 px-3 py-1.5",
                aba === a ? "border-cataguases-azul font-medium text-cataguases-marinho" : "border-transparent text-slate-500 hover:text-cataguases-marinho"
              )}
            >
              {a === "enviar" ? "Enviar" : "Meus envios"}
            </button>
          ))}
        </div>

        {aba === "meus" ? (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto py-1">
            {envios === null ? (
              <p className="text-sm text-slate-400">Carregando…</p>
            ) : envios.length === 0 ? (
              <p className="text-sm text-slate-400">Você ainda não enviou nenhum feedback daqui.</p>
            ) : (
              envios.map((e) => (
                <div key={e.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>
                      {new Date(e.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} ·{" "}
                      {ROTULO_TIPO[e.tipo]}
                    </span>
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 font-medium text-slate-600">
                      {ROTULO_STATUS[e.status]}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-700">{e.mensagem}</p>
                </div>
              ))
            )}
          </div>
        ) : enviado ? (
          <div className="space-y-3 py-1">
            <p className="text-sm text-slate-600">
              Recebido, obrigado! Sua mensagem chega direto pra quem cuida da plataforma.
            </p>
            <Button size="sm" type="button" onClick={() => limparEFechar(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={enviar}>
            <div className="flex flex-col gap-1">
              <label htmlFor="feedback-tipo" className="text-xs text-slate-500">
                Tipo
              </label>
              <select
                id="feedback-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoFeedback)}
                className={ESTILO_CAMPO}
              >
                {(Object.keys(ROTULO_TIPO) as TipoFeedback[]).map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="feedback-mensagem" className="text-xs text-slate-500">
                Mensagem
              </label>
              <textarea
                id="feedback-mensagem"
                required
                minLength={5}
                maxLength={4000}
                rows={4}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Conte o que aconteceu ou o que você gostaria de ver..."
                className={cn(ESTILO_CAMPO, "resize-none")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="feedback-anexos"
                className="flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-cataguases-azul hover:text-cataguases-azul/80"
              >
                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                Anexar screenshot
              </label>
              <input
                id="feedback-anexos"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain"
                multiple
                onChange={aoEscolherArquivos}
                className="hidden"
                disabled={arquivos.length >= MAX_ANEXOS}
              />
              {arquivos.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {arquivos.map((arquivo, indice) => (
                    <li
                      key={`${arquivo.name}-${indice}`}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                    >
                      <span className="min-w-0 flex-1 truncate">{arquivo.name}</span>
                      <button
                        type="button"
                        onClick={() => removerArquivo(indice)}
                        aria-label={`Remover ${arquivo.name}`}
                        className="shrink-0 text-slate-400 hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {erro && (
              <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                {erro}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => limparEFechar(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
