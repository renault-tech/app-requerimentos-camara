"use client";

import * as React from "react";

import { AreaTrabalhoLista } from "@/components/modulo/area-trabalho-lista";
import { CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO } from "@/components/modulo/ui";
import { BarraPrazo } from "@/components/requerimentos/barra-prazo";
import { DetalheRequerimento, EXPORT_COLS, GRUPOS_TOTALIZACAO, ModalNovoRequerimento } from "@/components/requerimentos/acoes-requerimento";
import { ModalExportar } from "@/components/ui/modal-exportar";
import { dataNoFuso } from "@/lib/fuso";
import { filtrarItens, type Dimensao } from "@/lib/modulo/area-trabalho";
import { COR_FASE } from "@/lib/requerimentos/cores-fase";
import { ROTULO_FASE } from "@/lib/requerimentos/cores-fase";
import {
  COR_FAIXA,
  COR_TEXTO_FAIXA,
  dimensoesRequerimentos,
  indicadoresRequerimentos,
  ORDENS_REQUERIMENTOS,
  resumoFiltrosRequerimentos,
  textoBuscaRequerimento,
  textoDoPrazo,
  type LinhaRequerimento,
} from "@/lib/requerimentos/area-trabalho";
import type { ConfigPrazo, Secretaria, Usuario, Vereador } from "@/types/database";

const DIMS = dimensoesRequerimentos();

function ChipPrazo({ r }: { r: LinhaRequerimento }) {
  const texto = textoDoPrazo(r);
  if (!texto) return null;
  return (
    <span className="inline-flex flex-none items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums" style={{ color: COR_TEXTO_FAIXA[r.faixa], backgroundColor: `${COR_FAIXA[r.faixa]}26` }}>
      {texto}
    </span>
  );
}

function ChipFase({ r }: { r: LinhaRequerimento }) {
  return (
    <span className="inline-flex flex-none items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: COR_FASE[r.fase], backgroundColor: `${COR_FASE[r.fase]}1F` }}>
      {ROTULO_FASE[r.fase]}
    </span>
  );
}

function dataBr(iso: string) {
  return iso.split("-").reverse().join("/");
}

/** Uma linha da lista (função de módulo, de identidade estável: a linha é memoizada). */
function renderLinha(r: LinhaRequerimento) {
  const anulado = r.fase === "anulado";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <span className={`flex-none pt-px font-mono text-xs font-semibold text-slate-600 ${anulado ? "line-through" : ""}`}>{r.numero}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-cataguases-marinho">{r.vereador}</span>
        <ChipPrazo r={r} />
      </div>
      <p className={`line-clamp-2 text-[0.8125rem] leading-snug ${anulado ? "text-slate-500" : "text-slate-700"}`}>{r.assunto}</p>
      <div className="flex flex-wrap items-center gap-1">
        <ChipFase r={r} />
        {r.secretarias.map((s) => (
          <span
            key={s.id}
            title={s.respondidaEm ? `Respondida em ${dataBr(s.respondidaEm)}` : s.cienciaEm ? `Ciência em ${dataBr(s.cienciaEm)} — aguardando resposta` : "Aguardando ciência"}
            className={`rounded-full border px-2 py-0.5 text-xs ${s.respondidaEm ? "border-semaforo-verde/40 bg-semaforo-verde/10 text-green-800" : s.cienciaEm ? "border-sky-300 bg-sky-50 text-sky-900" : "border-dashed border-slate-300 bg-slate-100 text-slate-600"}`}
          >
            {s.respondidaEm ? "✓ " : s.cienciaEm ? "◉ " : "○ "}
            {s.nomeSecretaria}
          </span>
        ))}
      </div>
    </div>
  );
}

function AcoesRequerimentos({ params, itens, podeDistribuir, vereadores, diasPadrao }: { params: URLSearchParams; itens: LinhaRequerimento[]; podeDistribuir: boolean; vereadores: Vereador[]; diasPadrao: number }) {
  const [exportarAberto, setExportarAberto] = React.useState(false);
  const [novoAberto, setNovoAberto] = React.useState(false);
  const ler = (k: string) => params.get(k);
  const q = params.get("q") ?? "";
  const ordem = ORDENS_REQUERIMENTOS.find((o) => o.chave === params.get("ordem")) ?? ORDENS_REQUERIMENTOS[0];
  // A exportação leva a lista como está na tela: mesmos filtros, mesma busca, mesma ordem.
  const visiveis = [...filtrarItens(itens, DIMS as Dimensao<LinhaRequerimento>[], ler, { texto: textoBuscaRequerimento, q })].sort(ordem.comparar);

  return (
    <>
      <button type="button" className={CLASSE_BOTAO_SECUNDARIO} disabled={visiveis.length === 0} onClick={() => setExportarAberto(true)}>
        Exportar
      </button>
      {podeDistribuir && (
        <button type="button" className={CLASSE_BOTAO} onClick={() => setNovoAberto(true)}>
          Novo requerimento
        </button>
      )}
      {podeDistribuir && <ModalNovoRequerimento aberto={novoAberto} onFechar={() => setNovoAberto(false)} diasPadrao={diasPadrao} vereadores={vereadores} />}
      <ModalExportar
        key={exportarAberto ? "aberto" : "fechado"}
        aberto={exportarAberto}
        onFechar={() => setExportarAberto(false)}
        tituloRelatorio="Requerimentos da Câmara — Prefeitura de Cataguases"
        colunas={EXPORT_COLS}
        linhasFiltradas={visiveis}
        linhasTodas={itens}
        grupos={GRUPOS_TOTALIZACAO}
        nomeArquivoBase={`requerimentos-camara-${dataNoFuso(new Date())}`}
        contextoAdicional={`Filtros aplicados: ${resumoFiltrosRequerimentos(DIMS, ler, itens, q)}`}
      />
    </>
  );
}

/**
 * Tela de Requerimentos no padrão dos módulos (gráficos que filtram | lista | detalhe). A lista abre pelos mais urgentes; os dois
 * gráficos respondem "quando vence" e "quem ainda deve resposta"; ao escolher um requerimento, o detalhe ao lado traz as mesmas
 * ações de antes (distribuir, ciência, responder, prorrogar, devolver, anular).
 */
export function AreaRequerimentos({
  linhas,
  secretarias,
  vereadores,
  config,
  usuario,
  podeDistribuir,
}: {
  linhas: LinhaRequerimento[];
  secretarias: Secretaria[];
  vereadores: Vereador[];
  config: ConfigPrazo;
  usuario: Usuario;
  podeDistribuir: boolean;
}) {
  return (
    <AreaTrabalhoLista<LinhaRequerimento>
      chave="requerimentos"
      titulo="Requerimentos da Câmara"
      unidades={{ singular: "requerimento", plural: "requerimentos" }}
      itens={linhas}
      id={(r) => r.id}
      dims={DIMS}
      medidas={[]}
      graficos={["prazo", "pendente"]}
      textoBusca={textoBuscaRequerimento}
      placeholderBusca="Buscar por nº, vereador, assunto ou secretaria…"
      ordens={ORDENS_REQUERIMENTOS}
      kpis={indicadoresRequerimentos}
      renderLinha={renderLinha}
      corLinha={(r) => COR_FAIXA[r.faixa]}
      tituloResumo={(r) => `Requerimento ${r.numero}`}
      subtituloResumo={(r) => r.vereador}
      hrefPagina={() => null}
      rotuloPagina=""
      vazio="Nenhum requerimento cadastrado ainda."
      acoes={(params) => <AcoesRequerimentos params={params} itens={linhas} podeDistribuir={podeDistribuir} vereadores={vereadores} diasPadrao={config.prazo_padrao_dias} />}
      renderResumo={(r) => (
        <div className="space-y-4">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <ChipFase r={r} />
              <ChipPrazo r={r} />
            </div>
            {r.aberto && <BarraPrazo prazo={r.prazo} />}
            <p className="text-sm leading-relaxed text-slate-700">{r.assunto}</p>
          </div>
          {/* `key`: o estado dos formulários (distribuir, devolver…) não pode vazar de um requerimento para outro. */}
          <DetalheRequerimento key={r.id} requerimento={r} secretarias={secretarias} usuario={usuario} podeDistribuir={podeDistribuir} />
        </div>
      )}
    />
  );
}
