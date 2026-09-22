"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  computarResumoExportacao,
  type ColunaExportavel,
  type GrupoTotalizacao,
} from "@/lib/exportar-xlsx";
import { ESTILO_CAMPO_PADRAO as ESTILO_CAMPO } from "@/lib/utils";

/**
 * Modal de exportação genérico (formato/escopo/colunas/totalização) —
 * porta a experiência do painel de Contratos Vigentes original para
 * qualquer lista da plataforma: cada tela só descreve suas colunas e
 * grupos de totalização, o modal cuida do resto (Excel multi-aba via
 * `exportar-xlsx.ts`, ou PDF institucional reaproveitando
 * `gerarRelatorioPdf` com as seções de resumo anexadas).
 */
export function ModalExportar<T>({
  aberto,
  onFechar,
  tituloRelatorio,
  colunas,
  linhasFiltradas,
  linhasTodas,
  grupos = [],
  valorMonetario,
  nomeArquivoBase,
  orientacaoPdf = "landscape",
  contextoAdicional,
}: {
  aberto: boolean;
  onFechar: () => void;
  /** Título usado no cabeçalho do PDF institucional. */
  tituloRelatorio: string;
  colunas: ColunaExportavel<T>[];
  linhasFiltradas: T[];
  /** Se informado e diferente de `linhasFiltradas`, habilita a escolha de escopo. */
  linhasTodas?: T[];
  grupos?: GrupoTotalizacao<T>[];
  /** Quando presente, a totalização também soma um valor (ex.: R$) por grupo. */
  valorMonetario?: (linha: T) => number | null;
  nomeArquivoBase: string;
  orientacaoPdf?: "landscape" | "portrait";
  /** Texto extra anexado ao resumo do PDF (ex.: filtros/ordenação em vigor). */
  contextoAdicional?: string;
}) {
  const [formato, setFormato] = React.useState<"xlsx" | "pdf">("xlsx");
  const [escopo, setEscopo] = React.useState<"filtradas" | "todas">("filtradas");
  const [colunasSelecionadas, setColunasSelecionadas] = React.useState<Set<string>>(
    () => new Set(colunas.map((c) => c.key))
  );
  const [totais, setTotais] = React.useState(true);
  const [gruposSelecionados, setGruposSelecionados] = React.useState<Set<string>>(
    () => new Set(grupos.map((g) => g.chave))
  );
  // `nomeArquivo` nasce direto de `nomeArquivoBase` (sem efeito) — o
  // chamador remonta este componente a cada abertura (prop `key` distinta
  // por sessão), então o valor inicial já nasce certo.
  const [nomeArquivo, setNomeArquivo] = React.useState(nomeArquivoBase);
  const [gerando, setGerando] = React.useState(false);
  const [mensagem, setMensagem] = React.useState<{ texto: string; erro: boolean } | null>(null);

  const temEscopo = Boolean(linhasTodas) && linhasTodas!.length !== linhasFiltradas.length;
  const linhasEscopo = escopo === "todas" && linhasTodas ? linhasTodas : linhasFiltradas;

  function alternarColuna(key: string) {
    setColunasSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(key)) novo.delete(key);
      else novo.add(key);
      return novo;
    });
  }

  function alternarGrupo(chave: string) {
    setGruposSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  async function gerar() {
    const colunasEscolhidas = colunas.filter((c) => colunasSelecionadas.has(c.key));
    if (colunasEscolhidas.length === 0) {
      setMensagem({ texto: "Selecione ao menos uma coluna.", erro: true });
      return;
    }
    const nomeBase = (nomeArquivo || nomeArquivoBase).trim() || nomeArquivoBase;
    const resumo =
      totais && grupos.length > 0
        ? computarResumoExportacao(
            linhasEscopo,
            grupos.filter((g) => gruposSelecionados.has(g.chave)),
            valorMonetario
          )
        : totais
          ? computarResumoExportacao(linhasEscopo, [], valorMonetario)
          : undefined;

    setGerando(true);
    setMensagem(null);
    try {
      if (formato === "xlsx") {
        const { gerarXlsxLista, baixarBlob } = await import("@/lib/exportar-xlsx");
        const blob = await gerarXlsxLista({ colunas: colunasEscolhidas, linhas: linhasEscopo, resumo });
        baixarBlob(`${nomeBase}.xlsx`, blob);
      } else {
        const { gerarRelatorioPdf } = await import("@/lib/exportar-pdf");
        const secoes = [
          {
            colunas: colunasEscolhidas.map((c) => c.rotulo),
            linhas: linhasEscopo.map((linha) => colunasEscolhidas.map((c) => String(c.valor(linha) ?? "—"))),
          },
        ];
        if (resumo) {
          secoes.push({
            colunas: ["Resumo", ""],
            linhas: [
              ["Total de registros", String(resumo.total)],
              ...(resumo.valorTotal != null
                ? [["Valor total (R$)", resumo.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })]]
                : []),
            ],
          });
          for (const grupo of resumo.grupos) {
            secoes.push({
              colunas: resumo.valorTotal != null ? [grupo.rotulo, "Nº", "Valor (R$)"] : [grupo.rotulo, "Nº"],
              linhas: grupo.linhas.map((l) =>
                resumo.valorTotal != null
                  ? [l.rotulo, String(l.n), (l.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })]
                  : [l.rotulo, String(l.n)]
              ),
            });
          }
        }
        const resumoEscopo =
          escopo === "todas" ? "Escopo: todos os registros" : "Escopo: registros filtrados";
        await gerarRelatorioPdf({
          titulo: tituloRelatorio,
          filtrosResumo: contextoAdicional ? `${resumoEscopo} · ${contextoAdicional}` : resumoEscopo,
          secoes,
          nomeArquivo: `${nomeBase}.pdf`,
          orientacao: orientacaoPdf,
        });
      }
      setMensagem({ texto: "Arquivo gerado.", erro: false });
    } catch (e) {
      console.error("[ModalExportar] erro ao gerar arquivo:", e);
      setMensagem({ texto: "Não foi possível gerar o arquivo agora. Tente novamente.", erro: true });
    } finally {
      setGerando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Formato</p>
            <div className="flex gap-3 text-sm text-slate-700">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={formato === "xlsx"}
                  onChange={() => setFormato("xlsx")}
                />
                Excel (.xlsx)
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={formato === "pdf"} onChange={() => setFormato("pdf")} />
                PDF (.pdf)
              </label>
            </div>
          </div>

          {temEscopo && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Escopo</p>
              <div className="flex flex-col gap-1.5 text-sm text-slate-700">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={escopo === "filtradas"}
                    onChange={() => setEscopo("filtradas")}
                  />
                  Registros filtrados atualmente ({linhasFiltradas.length})
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={escopo === "todas"} onChange={() => setEscopo("todas")} />
                  Todos os registros ({linhasTodas?.length ?? 0})
                </label>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Colunas incluídas
            </p>
            <div className="grid max-h-40 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {colunas.map((c) => (
                <label key={c.key} className="flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={colunasSelecionadas.has(c.key)}
                    onChange={() => alternarColuna(c.key)}
                  />
                  {c.rotulo}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" checked={totais} onChange={(e) => setTotais(e.target.checked)} />
              Incluir totalização
            </label>
            {totais && grupos.length > 0 && (
              <div className="ml-5 flex flex-col gap-1 text-xs text-slate-600">
                {grupos.map((g) => (
                  <label key={g.chave} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={gruposSelecionados.has(g.chave)}
                      onChange={() => alternarGrupo(g.chave)}
                    />
                    Totais {g.rotulo}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="exp-nome" className="text-xs text-slate-500">
              Nome do arquivo
            </label>
            <input
              id="exp-nome"
              type="text"
              value={nomeArquivo}
              onChange={(e) => setNomeArquivo(e.target.value)}
              className={ESTILO_CAMPO}
            />
          </div>

          {mensagem && (
            <p
              role="alert"
              className={
                mensagem.erro
                  ? "rounded-md border border-red-700/40 bg-red-700/10 px-3 py-1.5 text-xs text-red-700"
                  : "rounded-md border border-green-700/40 bg-green-700/10 px-3 py-1.5 text-xs text-green-700"
              }
            >
              {mensagem.texto}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={gerando} onClick={gerar}>
              {gerando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Gerando…
                </>
              ) : (
                "Gerar arquivo"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
