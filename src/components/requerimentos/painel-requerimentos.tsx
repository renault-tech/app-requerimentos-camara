"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRightCircle,
  Ban,
  CheckCheck,
  FileStack,
  Hourglass,
  Inbox,
  Paperclip,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModalExportar } from "@/components/ui/modal-exportar";
import { BarraPrazo } from "@/components/requerimentos/barra-prazo";
import { useAcao } from "@/lib/hooks/usar-acao";
import { ESTILO_CAMPO_PADRAO as ESTILO_CAMPO, cn } from "@/lib/utils";
import { criarClienteNavegador } from "@/lib/supabase/client";
import {
  criarRequerimento,
  distribuirRequerimento,
  darCiencia,
  marcarRespondida,
  anexarDocumento,
  solicitarProrrogacao,
  devolverACamara,
  anularRequerimento,
  type ResultadoRequerimento,
} from "@/lib/actions/requerimentos";
import type { AnexoDocumento, RequerimentoDaLista, SecretariaDoRequerimento } from "@/lib/dados/requerimentos";
import type { Fase } from "@/lib/requerimentos/status";
import {
  COR_FASE,
  COR_FASE_VIVA,
  ROTULO_FASE,
  COR_ATRASADO,
  COR_ATRASADO_VIVA,
} from "@/lib/requerimentos/cores-fase";
import { dataNoFuso } from "@/lib/fuso";
import type { ColunaExportavel, GrupoTotalizacao } from "@/lib/exportar-xlsx";
import type { ConfigPrazo, Secretaria, Usuario, Vereador } from "@/types/database";

type FiltroCartao = "todos" | "atrasados" | Fase;

const EXPORT_COLS: ColunaExportavel<RequerimentoDaLista>[] = [
  { key: "numero", rotulo: "Nº", valor: (r) => r.numero },
  { key: "vereador", rotulo: "Vereador", valor: (r) => r.vereador },
  { key: "assunto", rotulo: "Assunto", valor: (r) => r.assunto },
  {
    key: "secretarias",
    rotulo: "Secretarias",
    valor: (r) => r.secretarias.map((s) => s.nomeSecretaria).join(", ") || "—",
  },
  { key: "recebido_em", rotulo: "Recebido em", valor: (r) => r.recebidoEm },
  { key: "dias_total", rotulo: "Prazo total (dias)", valor: (r) => r.diasTotal },
  { key: "dias_restantes", rotulo: "Dias restantes", valor: (r) => r.diasRestantes },
  { key: "distribuido_em", rotulo: "Distribuído em", valor: (r) => r.distribuidoEm ?? "" },
  { key: "devolvido_em", rotulo: "Devolvido em", valor: (r) => r.devolvidoEm ?? "" },
  { key: "protocolo", rotulo: "Protocolo devolução", valor: (r) => r.protocoloDevolucao ?? "" },
  { key: "documento", rotulo: "Documento anexado", valor: (r) => (r.anexos.length > 0 ? "Sim" : "Não") },
  { key: "fase", rotulo: "Status", valor: (r) => ROTULO_FASE[r.fase] },
  { key: "atrasado", rotulo: "Atrasado", valor: (r) => (r.atrasado ? "Sim" : "Não") },
  {
    key: "anulado",
    rotulo: "Anulado",
    valor: (r) => (r.anuladoEm ? `Sim (${r.anuladoEm}) — ${r.anuladoMotivo ?? ""}` : "Não"),
  },
];

const GRUPOS_TOTALIZACAO: GrupoTotalizacao<RequerimentoDaLista>[] = [
  { chave: "fase", rotulo: "por Status", chavesDaLinha: (r) => [ROTULO_FASE[r.fase]] },
  {
    chave: "secretaria",
    rotulo: "por Secretaria",
    chavesDaLinha: (r) => (r.secretarias.length > 0 ? r.secretarias.map((s) => s.nomeSecretaria) : ["—"]),
  },
];

export function PainelRequerimentos({
  requerimentosIniciais,
  secretarias,
  vereadores,
  config,
  usuario,
  podeDistribuir,
}: {
  requerimentosIniciais: RequerimentoDaLista[];
  secretarias: Secretaria[];
  vereadores: Vereador[];
  config: ConfigPrazo;
  usuario: Usuario;
  podeDistribuir: boolean;
}) {
  const [busca, setBusca] = React.useState("");
  const [filtro, setFiltro] = React.useState<FiltroCartao>("todos");
  const [linhaExpandida, setLinhaExpandida] = React.useState<string | null>(null);
  const [modalNovoAberto, setModalNovoAberto] = React.useState(false);
  const [exportarAberto, setExportarAberto] = React.useState(false);
  const [mostrarMaisFiltros, setMostrarMaisFiltros] = React.useState(false);
  const [secretariaFiltro, setSecretariaFiltro] = React.useState("");
  const [vereadorFiltro, setVereadorFiltro] = React.useState("");
  const [dataInicio, setDataInicio] = React.useState("");
  const [dataFim, setDataFim] = React.useState("");

  const requerimentos = requerimentosIniciais;

  const contagens = React.useMemo(() => {
    return {
      todos: requerimentos.length,
      atrasados: requerimentos.filter((r) => r.atrasado).length,
      aguardando: requerimentos.filter((r) => r.fase === "aguardando").length,
      distribuido: requerimentos.filter((r) => r.fase === "distribuido").length,
      respondido: requerimentos.filter((r) => r.fase === "respondido").length,
      devolvido: requerimentos.filter((r) => r.fase === "devolvido").length,
      anulado: requerimentos.filter((r) => r.fase === "anulado").length,
    };
  }, [requerimentos]);

  const visiveis = React.useMemo(() => {
    let base = requerimentos;
    if (filtro === "atrasados") base = base.filter((r) => r.atrasado);
    else if (filtro !== "todos") base = base.filter((r) => r.fase === filtro);

    if (secretariaFiltro) {
      base = base.filter((r) => r.secretarias.some((s) => s.secretariaId === secretariaFiltro));
    }
    if (vereadorFiltro.trim()) {
      const v = vereadorFiltro.trim().toLowerCase();
      base = base.filter((r) => r.vereador.toLowerCase().includes(v));
    }
    if (dataInicio) base = base.filter((r) => r.recebidoEm >= dataInicio);
    if (dataFim) base = base.filter((r) => r.recebidoEm <= dataFim);

    const termo = busca.trim().toLowerCase();
    if (!termo) return base;
    return base.filter(
      (r) =>
        r.numero.toLowerCase().includes(termo) ||
        r.vereador.toLowerCase().includes(termo) ||
        r.assunto.toLowerCase().includes(termo)
    );
  }, [requerimentos, filtro, busca, secretariaFiltro, vereadorFiltro, dataInicio, dataFim]);

  function limparMaisFiltros() {
    setSecretariaFiltro("");
    setVereadorFiltro("");
    setDataInicio("");
    setDataFim("");
  }

  function resumoFiltros(): string {
    const partes: string[] = [];
    if (busca) partes.push(`Busca: "${busca}"`);
    if (filtro !== "todos") {
      partes.push(`Status: ${filtro === "atrasados" ? "Atrasados" : ROTULO_FASE[filtro as Fase]}`);
    }
    if (secretariaFiltro) {
      partes.push(`Secretaria: ${secretarias.find((s) => s.id === secretariaFiltro)?.nome ?? secretariaFiltro}`);
    }
    if (vereadorFiltro) partes.push(`Vereador: "${vereadorFiltro}"`);
    if (dataInicio) partes.push(`De: ${dataInicio}`);
    if (dataFim) partes.push(`Até: ${dataFim}`);
    return partes.length > 0 ? partes.join(" · ") : "Nenhum filtro aplicado — todos os requerimentos visíveis";
  }

  function nomeArquivoBase(): string {
    const data = dataNoFuso(new Date());
    return `requerimentos-camara-${data}`;
  }

  const cartoes: {
    chave: FiltroCartao;
    rotulo: string;
    cor: string;
    corNumero: string;
    valor: number;
    Icone: typeof FileStack;
  }[] = [
    { chave: "todos", rotulo: "Todos", cor: "#0C1D33", corNumero: "#0C1D33", valor: contagens.todos, Icone: FileStack },
    {
      chave: "atrasados",
      rotulo: "Atrasados",
      cor: COR_ATRASADO_VIVA,
      corNumero: COR_ATRASADO,
      valor: contagens.atrasados,
      Icone: AlertTriangle,
    },
    {
      chave: "aguardando",
      rotulo: ROTULO_FASE.aguardando,
      cor: COR_FASE_VIVA.aguardando,
      corNumero: COR_FASE.aguardando,
      valor: contagens.aguardando,
      Icone: Inbox,
    },
    {
      chave: "distribuido",
      rotulo: ROTULO_FASE.distribuido,
      cor: COR_FASE_VIVA.distribuido,
      corNumero: COR_FASE.distribuido,
      valor: contagens.distribuido,
      Icone: Hourglass,
    },
    {
      chave: "respondido",
      rotulo: ROTULO_FASE.respondido,
      cor: COR_FASE_VIVA.respondido,
      corNumero: COR_FASE.respondido,
      valor: contagens.respondido,
      Icone: ArrowRightCircle,
    },
    {
      chave: "devolvido",
      rotulo: ROTULO_FASE.devolvido,
      cor: COR_FASE_VIVA.devolvido,
      corNumero: COR_FASE.devolvido,
      valor: contagens.devolvido,
      Icone: CheckCheck,
    },
    {
      chave: "anulado",
      rotulo: ROTULO_FASE.anulado,
      cor: COR_FASE_VIVA.anulado,
      corNumero: COR_FASE.anulado,
      valor: contagens.anulado,
      Icone: Ban,
    },
  ];

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {cartoes.map((c) => {
          const ativo = filtro === c.chave;
          return (
            <button
              key={c.chave}
              type="button"
              onClick={() => setFiltro(c.chave)}
              aria-pressed={ativo}
              style={{
                borderColor: ativo ? `${c.cor}66` : "rgba(12,29,51,0.08)",
                boxShadow: ativo
                  ? `0 0 0 3px ${c.cor}22, 0 8px 20px rgba(12,29,51,0.1)`
                  : "0 2px 8px rgba(12,29,51,0.04)",
              }}
              className={cn(
                "group relative flex cursor-pointer flex-col items-start overflow-hidden rounded-2xl border p-3.5 text-left backdrop-blur-[10px] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cataguases-azul focus-visible:ring-offset-2",
                ativo ? "bg-white" : "bg-white/70 hover:-translate-y-0.5 hover:bg-white/95"
              )}
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px] transition-opacity duration-200"
                style={{ backgroundColor: c.cor, opacity: ativo ? 1 : 0 }}
              />
              <span
                className="flex h-8 w-8 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                style={{ backgroundColor: `${c.cor}1F`, color: c.corNumero }}
              >
                <c.Icone className="h-4 w-4" strokeWidth={2.1} aria-hidden />
              </span>
              <p
                className="mt-2.5 text-xl font-bold leading-none tracking-[-0.02em] tabular-nums"
                style={{ color: c.corNumero }}
              >
                {c.valor}
              </p>
              <p
                className={cn(
                  "mt-1.5 text-[11px] font-medium leading-tight",
                  ativo ? "text-cataguases-marinho" : "text-slate-500"
                )}
              >
                {c.rotulo}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2.5 sm:flex-row sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            placeholder="Buscar por nº, vereador ou assunto…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={`${ESTILO_CAMPO} w-full pl-8`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMostrarMaisFiltros((v) => !v)}
            className={cn(mostrarMaisFiltros && "border-cataguases-azul text-cataguases-azul")}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Mais filtros
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={visiveis.length === 0}
            onClick={() => setExportarAberto(true)}
          >
            Exportar
          </Button>
          {podeDistribuir && (
            <Button size="sm" onClick={() => setModalNovoAberto(true)} className="shrink-0">
              Novo requerimento
            </Button>
          )}
        </div>
      </div>

      {mostrarMaisFiltros && (
        <div className="mt-2 grid grid-cols-1 gap-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs text-slate-500">Secretaria</label>
            <select
              value={secretariaFiltro}
              onChange={(e) => setSecretariaFiltro(e.target.value)}
              className={`${ESTILO_CAMPO} mt-1 w-full`}
            >
              <option value="">Todas</option>
              {secretarias.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Vereador</label>
            <input
              value={vereadorFiltro}
              onChange={(e) => setVereadorFiltro(e.target.value)}
              placeholder="Nome do vereador"
              className={`${ESTILO_CAMPO} mt-1 w-full`}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Recebido de</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className={`${ESTILO_CAMPO} mt-1 w-full`}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Recebido até</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className={`${ESTILO_CAMPO} mt-1 w-full`}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button variant="ghost" size="sm" onClick={limparMaisFiltros}>
              Limpar filtros
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-3 py-2 font-medium">Nº</th>
              <th className="px-3 py-2 font-medium">Vereador</th>
              <th className="px-3 py-2 font-medium">Assunto</th>
              <th className="px-3 py-2 font-medium">Secretarias</th>
              <th className="px-3 py-2 font-medium">Prazo</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r) => {
              const expandida = linhaExpandida === r.id;
              const anulado = r.fase === "anulado";
              return (
                <React.Fragment key={r.id}>
                  <tr
                    role="button"
                    tabIndex={0}
                    onClick={() => setLinhaExpandida(expandida ? null : r.id)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setLinhaExpandida(expandida ? null : r.id);
                      }
                    }}
                    style={anulado ? { backgroundColor: "#F4F4F5" } : undefined}
                    className="cursor-pointer border-b border-slate-100 align-top last:border-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cataguases-azul"
                  >
                    <td className={cn("px-3 py-2.5 font-mono text-xs", anulado && "text-slate-400 line-through")}>
                      {r.numero}
                    </td>
                    <td className="px-3 py-2.5">{r.vereador}</td>
                    <td className="max-w-[260px] break-words px-3 py-2.5">{r.assunto}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {r.secretarias.length === 0 && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                        {r.secretarias.map((s) => (
                          <span
                            key={s.id}
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              s.respondidaEm
                                ? "border-semaforo-verde/40 bg-semaforo-verde/10 text-green-800"
                                : "border-slate-300 bg-slate-100 text-slate-600"
                            }`}
                          >
                            {s.respondidaEm ? "✓ " : ""}
                            {s.nomeSecretaria}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <BarraPrazo prazo={r.prazo} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                        style={{ backgroundColor: COR_FASE[r.fase] }}
                      >
                        {ROTULO_FASE[r.fase]}
                      </span>
                    </td>
                  </tr>
                  {expandida && (
                    <tr className="border-b border-slate-100 bg-slate-50/70 last:border-0">
                      <td colSpan={6} className="px-4 py-4">
                        <DetalheRequerimento
                          requerimento={r}
                          secretarias={secretarias}
                          usuario={usuario}
                          podeDistribuir={podeDistribuir}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">
                  Nenhum requerimento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        {visiveis.length} de {requerimentos.length} requerimentos · prazo padrão {config.prazo_padrao_dias} dias
      </p>

      {podeDistribuir && (
        <ModalNovoRequerimento
          aberto={modalNovoAberto}
          onFechar={() => setModalNovoAberto(false)}
          diasPadrao={config.prazo_padrao_dias}
          vereadores={vereadores}
        />
      )}

      <ModalExportar
        key={exportarAberto ? "aberto" : "fechado"}
        aberto={exportarAberto}
        onFechar={() => setExportarAberto(false)}
        tituloRelatorio="Requerimentos da Câmara — Prefeitura de Cataguases"
        colunas={EXPORT_COLS}
        linhasFiltradas={visiveis}
        linhasTodas={requerimentos}
        grupos={GRUPOS_TOTALIZACAO}
        nomeArquivoBase={nomeArquivoBase()}
        contextoAdicional={`Filtros aplicados: ${resumoFiltros()}`}
      />
    </div>
  );
}

function DetalheRequerimento({
  requerimento,
  secretarias,
  usuario,
  podeDistribuir,
}: {
  requerimento: RequerimentoDaLista;
  secretarias: Secretaria[];
  usuario: Usuario;
  podeDistribuir: boolean;
}) {
  const acaoDistribuir = useAcao();
  const acaoProrrogar = useAcao();
  const acaoDevolver = useAcao();
  const acaoAnular = useAcao();

  const [mostrarDistribuicao, setMostrarDistribuicao] = React.useState(false);
  const [mostrarProrrogacao, setMostrarProrrogacao] = React.useState(false);
  const [mostrarDevolucao, setMostrarDevolucao] = React.useState(false);
  const [mostrarAnulacao, setMostrarAnulacao] = React.useState(false);

  const anulado = requerimento.fase === "anulado";

  const idsJaDistribuidas = new Set(requerimento.secretarias.map((s) => s.secretariaId));
  const secretariasDisponiveis = secretarias.filter((s) => s.ativo && !idsJaDistribuidas.has(s.id));
  const pendentes = requerimento.secretarias.filter((s) => !s.respondidaEm).length;
  const todasResponderam = requerimento.secretarias.length > 0 && pendentes === 0;

  const motivoEnvioBloqueado =
    requerimento.secretarias.length === 0
      ? "Distribua a pelo menos uma secretaria antes"
      : !todasResponderam
        ? `Aguardando resposta de ${pendentes} secretaria${pendentes > 1 ? "s" : ""}`
        : undefined;

  return (
    <div>
      {anulado && (
        <div className="mb-3 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700">
          <span className="font-medium">Requerimento anulado</span> em {requerimento.anuladoEm}
          {requerimento.anuladoMotivo && <> — {requerimento.anuladoMotivo}</>}
        </div>
      )}

      {/* Ações de nível do requerimento — as 3 aqui, compactas; a de
          "marcar recebimento" fica junto de cada secretaria abaixo, porque
          pode haver mais de uma resposta a consolidar. */}
      {podeDistribuir && requerimento.fase !== "devolvido" && requerimento.fase !== "anulado" && (
        <div className="flex flex-wrap items-start gap-2 border-b border-slate-100 pb-3">
          {/* Distribuição é um ato único: uma vez `distribuidoEm` preenchido, o
              requerimento não pode ser distribuído de novo (nem para
              acrescentar mais secretarias) — a RPC também recusa, esta
              condição só evita o usuário chegar a tentar. */}
          {!requerimento.distribuidoEm &&
            secretariasDisponiveis.length > 0 &&
            (!mostrarDistribuicao ? (
              <Button size="sm" variant="outline" onClick={() => setMostrarDistribuicao(true)}>
                Distribuir
              </Button>
            ) : (
              <FormularioDistribuicao
                secretariasDisponiveis={secretariasDisponiveis}
                pendente={acaoDistribuir.pendente}
                erro={acaoDistribuir.erro}
                onCancelar={() => setMostrarDistribuicao(false)}
                onConfirmar={(ids) =>
                  acaoDistribuir.executar(
                    () => distribuirRequerimento(requerimento.id, ids),
                    () => setMostrarDistribuicao(false)
                  )
                }
              />
            ))}

          {!mostrarProrrogacao ? (
            <Button size="sm" variant="outline" onClick={() => setMostrarProrrogacao(true)}>
              Solicitar prorrogação
            </Button>
          ) : (
            <FormularioProrrogacao
              pendente={acaoProrrogar.pendente}
              erro={acaoProrrogar.erro}
              onCancelar={() => setMostrarProrrogacao(false)}
              onConfirmar={(dias, motivo) =>
                acaoProrrogar.executar(
                  () => solicitarProrrogacao(requerimento.id, dias, motivo),
                  () => setMostrarProrrogacao(false)
                )
              }
            />
          )}

          {!mostrarDevolucao ? (
            <Button
              size="sm"
              disabled={!!motivoEnvioBloqueado}
              title={motivoEnvioBloqueado}
              onClick={() => setMostrarDevolucao(true)}
            >
              Enviar à Câmara
            </Button>
          ) : (
            <FormularioDevolucao
              pendente={acaoDevolver.pendente}
              erro={acaoDevolver.erro}
              onCancelar={() => setMostrarDevolucao(false)}
              onConfirmar={(protocolo) =>
                acaoDevolver.executar(() => devolverACamara(requerimento.id, protocolo))
              }
            />
          )}
        </div>
      )}

      {/* Anular: separado das ações normais do ciclo, de propósito — é um
          ato de correção de cadastro (lançamento errado/duplicado), não um
          passo do fluxo. Disponível em qualquer fase (inclusive devolvido —
          um erro pode ser percebido depois), menos se já anulado. */}
      {podeDistribuir && !anulado && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          {!mostrarAnulacao ? (
            <button
              type="button"
              className="text-xs text-red-700 hover:underline"
              onClick={() => setMostrarAnulacao(true)}
            >
              Anular requerimento (lançamento incorreto/duplicado)
            </button>
          ) : (
            <FormularioAnulacao
              pendente={acaoAnular.pendente}
              erro={acaoAnular.erro}
              onCancelar={() => setMostrarAnulacao(false)}
              onConfirmar={(motivo) =>
                acaoAnular.executar(() => anularRequerimento(requerimento.id, motivo))
              }
            />
          )}
        </div>
      )}

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Secretarias
          </h3>
          <ul className="mt-2 space-y-1.5">
            {requerimento.secretarias.map((s) => {
              const souEu = usuario.perfil === "secretaria" && usuario.secretaria_id === s.secretariaId;
              return (
                <LinhaSecretaria
                  key={s.id}
                  requerimentoId={requerimento.id}
                  secretaria={s}
                  podeMarcar={souEu || podeDistribuir}
                  podeDarCiencia={souEu || podeDistribuir}
                  ehPeloGabinete={podeDistribuir && !souEu}
                />
              );
            })}
            {requerimento.secretarias.length === 0 && (
              <li className="text-sm text-slate-400">Ainda não distribuído.</li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prazo</h3>
          <p className="mt-2 text-sm text-slate-600">
            Recebido em {requerimento.recebidoEm} · prazo total {requerimento.diasTotal} dias
            {requerimento.distribuidoEm && <> · distribuído em {requerimento.distribuidoEm}</>}
            {requerimento.devolvidoEm && (
              <>
                {" "}
                · devolvido em {requerimento.devolvidoEm}
                {requerimento.protocoloDevolucao && <> ({requerimento.protocoloDevolucao})</>}
              </>
            )}
          </p>
        </div>

        <div className="sm:col-span-2">
          <DocumentoRequerimento
            requerimentoId={requerimento.id}
            anexos={requerimento.anexos}
            podeAnexar={podeDistribuir}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Documento do próprio requerimento (o PDF a ser enviado às secretarias) —
 * diferente do anexo de resposta de cada `LinhaSecretaria`. Só o Gabinete
 * pode anexar (`anexarDocumento`, sempre um append no servidor); qualquer
 * um que veja o requerimento pode baixar. Upload direto do navegador para o
 * Storage, mesmo padrão já usado em `LinhaSecretaria`.
 */
function DocumentoRequerimento({
  requerimentoId,
  anexos,
  podeAnexar,
}: {
  requerimentoId: string;
  anexos: AnexoDocumento[];
  podeAnexar: boolean;
}) {
  const acao = useAcao();
  const [arquivos, setArquivos] = React.useState<File[]>([]);
  const [avisoArquivo, setAvisoArquivo] = React.useState<string | null>(null);

  function selecionarArquivos(lista: FileList | null) {
    if (!lista) return;
    const aceitos: File[] = [];
    const rejeitados: string[] = [];
    for (const arquivo of Array.from(lista)) {
      if (arquivo.size > TAMANHO_MAXIMO_ANEXO) {
        rejeitados.push(arquivo.name);
      } else {
        aceitos.push(arquivo);
      }
    }
    setArquivos((prev) => [...prev, ...aceitos]);
    setAvisoArquivo(rejeitados.length > 0 ? `Maior que 5 MB, não enviado: ${rejeitados.join(", ")}` : null);
  }

  async function enviar(): Promise<ResultadoRequerimento> {
    if (arquivos.length === 0) {
      return { sucesso: false, erro: "Selecione ao menos um arquivo" };
    }
    const supabase = criarClienteNavegador();
    const caminhos: string[] = [];
    for (const arquivo of arquivos) {
      const caminho = `${requerimentoId}/documento/${Date.now()}-${arquivo.name}`;
      const { error } = await supabase.storage.from("requerimentos-anexos").upload(caminho, arquivo);
      if (error) {
        return { sucesso: false, erro: `Falha ao enviar ${arquivo.name}: ${error.message}` };
      }
      caminhos.push(caminho);
    }
    return anexarDocumento(requerimentoId, caminhos);
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Documento do requerimento
      </h3>
      {anexos.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {anexos.map((a) => (
            <li key={a.caminho}>
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-cataguases-azul hover:underline"
                >
                  <Paperclip className="h-3 w-3" aria-hidden />
                  {a.nomeArquivo}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-400">
                  <Paperclip className="h-3 w-3" aria-hidden />
                  {a.nomeArquivo} (link expirado)
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-400">Nenhum documento anexado ainda.</p>
      )}

      {podeAnexar && (
        <div className="mt-2">
          <input
            type="file"
            multiple
            accept="image/*,application/pdf,text/plain"
            onChange={(e) => {
              selecionarArquivos(e.target.files);
              e.target.value = "";
            }}
            className="block w-full text-xs text-slate-500"
          />
          {arquivos.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {arquivos.map((arquivo, i) => (
                <li
                  key={`${arquivo.name}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                >
                  {arquivo.name}
                  <button
                    type="button"
                    aria-label={`Remover ${arquivo.name}`}
                    onClick={() => setArquivos((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {avisoArquivo && <p className="mt-1 text-[11px] text-amber-700">{avisoArquivo}</p>}
          {acao.erro && <p className="mt-1.5 text-xs text-red-700">{acao.erro}</p>}
          {arquivos.length > 0 && (
            <div className="mt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={acao.pendente}
                onClick={() =>
                  acao.executar(enviar, () => {
                    setArquivos([]);
                    setAvisoArquivo(null);
                  })
                }
              >
                {acao.pendente ? "Enviando…" : "Anexar documento"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FormularioDistribuicao({
  secretariasDisponiveis,
  pendente,
  erro,
  onCancelar,
  onConfirmar,
}: {
  secretariasDisponiveis: Secretaria[];
  pendente: boolean;
  erro: string | null;
  onCancelar: () => void;
  onConfirmar: (ids: string[]) => void;
}) {
  const [selecionadas, setSelecionadas] = React.useState<string[]>([]);
  return (
    <div className="w-full rounded-md border border-slate-200 bg-white p-2.5">
      <p className="text-xs font-medium text-slate-600">Distribuir a secretarias</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {secretariasDisponiveis.map((s) => (
          <label
            key={s.id}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs"
          >
            <input
              type="checkbox"
              checked={selecionadas.includes(s.id)}
              onChange={(e) =>
                setSelecionadas((prev) =>
                  e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                )
              }
            />
            {s.nome}
          </label>
        ))}
      </div>
      {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          disabled={selecionadas.length === 0 || pendente}
          onClick={() => onConfirmar(selecionadas)}
        >
          Confirmar distribuição
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

const TAMANHO_MAXIMO_ANEXO = 5 * 1024 * 1024;

/**
 * Uma secretaria dentro do detalhe de um requerimento: mostra o estado
 * (pendente/respondida + anexos já enviados) e, para quem pode agir
 * (a própria secretaria, ou o Gabinete em seu lugar), o formulário de
 * marcar respondida com anexo opcional do ofício/documento de resposta.
 * Upload direto do navegador para o Storage (mesmo padrão já usado pelo
 * Feedback do App-Compras) — só os caminhos resultantes vão para a server
 * action, nunca o arquivo em si.
 */
function LinhaSecretaria({
  requerimentoId,
  secretaria,
  podeMarcar,
  podeDarCiencia,
  ehPeloGabinete,
}: {
  requerimentoId: string;
  secretaria: SecretariaDoRequerimento;
  podeMarcar: boolean;
  podeDarCiencia: boolean;
  ehPeloGabinete: boolean;
}) {
  const acao = useAcao();
  const acaoCiencia = useAcao();
  const [respondendo, setRespondendo] = React.useState(false);
  const [arquivos, setArquivos] = React.useState<File[]>([]);
  const [avisoArquivo, setAvisoArquivo] = React.useState<string | null>(null);

  function selecionarArquivos(lista: FileList | null) {
    if (!lista) return;
    const aceitos: File[] = [];
    const rejeitados: string[] = [];
    for (const arquivo of Array.from(lista)) {
      if (arquivo.size > TAMANHO_MAXIMO_ANEXO) {
        rejeitados.push(arquivo.name);
      } else {
        aceitos.push(arquivo);
      }
    }
    setArquivos((prev) => [...prev, ...aceitos]);
    setAvisoArquivo(rejeitados.length > 0 ? `Maior que 5 MB, não enviado: ${rejeitados.join(", ")}` : null);
  }

  async function enviarEConfirmar(): Promise<ResultadoRequerimento> {
    const caminhos: string[] = [];
    if (arquivos.length > 0) {
      const supabase = criarClienteNavegador();
      for (const arquivo of arquivos) {
        const caminho = `${requerimentoId}/${secretaria.secretariaId}/${Date.now()}-${arquivo.name}`;
        const { error } = await supabase.storage.from("requerimentos-anexos").upload(caminho, arquivo);
        if (error) {
          return { sucesso: false, erro: `Falha ao enviar ${arquivo.name}: ${error.message}` };
        }
        caminhos.push(caminho);
      }
    }
    return marcarRespondida(requerimentoId, secretaria.secretariaId, caminhos);
  }

  const rotuloBotao = ehPeloGabinete ? "Dar baixa (Gabinete)" : "Marcar respondida";
  const rotuloCiencia = ehPeloGabinete ? "Dar ciência (Gabinete)" : "Dar ciência";

  return (
    <li className="rounded-md border border-slate-100 bg-white p-1.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {secretaria.nomeSecretaria}
          {secretaria.cienciaEm ? (
            <span className="ml-2 text-xs text-cataguases-azul">ciência em {secretaria.cienciaEm}</span>
          ) : (
            <span className="ml-2 text-xs text-amber-700">aguardando ciência</span>
          )}
          {secretaria.respondidaEm ? (
            <span className="ml-2 text-xs text-green-700">respondida em {secretaria.respondidaEm}</span>
          ) : (
            <span className="ml-2 text-xs text-slate-400">pendente</span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {!secretaria.cienciaEm && podeDarCiencia && (
            <Button
              size="sm"
              variant="outline"
              disabled={acaoCiencia.pendente}
              onClick={() =>
                acaoCiencia.executar(() => darCiencia(requerimentoId, secretaria.secretariaId))
              }
            >
              {acaoCiencia.pendente ? "Confirmando…" : rotuloCiencia}
            </Button>
          )}
          {!secretaria.respondidaEm && podeMarcar && !respondendo && (
            <Button size="sm" variant="outline" onClick={() => setRespondendo(true)}>
              {rotuloBotao}
            </Button>
          )}
        </div>
      </div>
      {acaoCiencia.erro && <p className="mt-1 text-xs text-red-700">{acaoCiencia.erro}</p>}

      {secretaria.anexos.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {secretaria.anexos.map((a) => (
            <li key={a.caminho}>
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-cataguases-azul hover:underline"
                >
                  <Paperclip className="h-3 w-3" aria-hidden />
                  {a.nomeArquivo}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-400">
                  <Paperclip className="h-3 w-3" aria-hidden />
                  {a.nomeArquivo} (link expirado)
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {respondendo && (
        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
          <label className="text-xs text-slate-500">Anexar ofício/documento de resposta (opcional)</label>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf,text/plain"
            onChange={(e) => {
              selecionarArquivos(e.target.files);
              e.target.value = "";
            }}
            className="mt-1 block w-full text-xs text-slate-500"
          />
          {arquivos.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {arquivos.map((arquivo, i) => (
                <li
                  key={`${arquivo.name}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                >
                  {arquivo.name}
                  <button
                    type="button"
                    aria-label={`Remover ${arquivo.name}`}
                    onClick={() => setArquivos((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {avisoArquivo && <p className="mt-1 text-[11px] text-amber-700">{avisoArquivo}</p>}
          {acao.erro && <p className="mt-1.5 text-xs text-red-700">{acao.erro}</p>}
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={acao.pendente}
              onClick={() =>
                acao.executar(enviarEConfirmar, () => {
                  setRespondendo(false);
                  setArquivos([]);
                })
              }
            >
              {acao.pendente ? "Enviando…" : rotuloBotao}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={acao.pendente}
              onClick={() => {
                setRespondendo(false);
                setArquivos([]);
                setAvisoArquivo(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function FormularioProrrogacao({
  pendente,
  erro,
  onCancelar,
  onConfirmar,
}: {
  pendente: boolean;
  erro: string | null;
  onCancelar: () => void;
  onConfirmar: (dias: number, motivo: string) => void;
}) {
  const [dias, setDias] = React.useState(5);
  const [motivo, setMotivo] = React.useState("");
  return (
    <div className="w-full rounded-md border border-slate-200 bg-white p-2.5">
      <div className="flex items-end gap-2">
        <div>
          <label className="text-xs text-slate-500">Dias concedidos</label>
          <input
            type="number"
            min={1}
            value={dias}
            onChange={(e) => setDias(parseInt(e.target.value, 10) || 1)}
            className={`${ESTILO_CAMPO} mt-1 w-20`}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-500">Motivo</label>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: Câmara concedeu 5 dias a mais"
            className={`${ESTILO_CAMPO} mt-1 w-full`}
          />
        </div>
      </div>
      {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={pendente} onClick={() => onConfirmar(dias, motivo)}>
          Confirmar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function FormularioDevolucao({
  pendente,
  erro,
  onCancelar,
  onConfirmar,
}: {
  pendente: boolean;
  erro: string | null;
  onCancelar: () => void;
  onConfirmar: (protocolo: string) => void;
}) {
  const [protocolo, setProtocolo] = React.useState("");
  return (
    <div className="w-full rounded-md border border-slate-200 bg-white p-2.5">
      <label className="text-xs text-slate-500">Protocolo do ofício de devolução</label>
      <input
        value={protocolo}
        onChange={(e) => setProtocolo(e.target.value)}
        placeholder="Ex.: Ofício GP 045/2026"
        className={`${ESTILO_CAMPO} mt-1 w-full`}
      />
      {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={pendente} onClick={() => onConfirmar(protocolo)}>
          Confirmar devolução
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function FormularioAnulacao({
  pendente,
  erro,
  onCancelar,
  onConfirmar,
}: {
  pendente: boolean;
  erro: string | null;
  onCancelar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = React.useState("");
  return (
    <div className="w-full rounded-md border border-red-200 bg-red-50 p-2.5">
      <p className="text-xs font-medium text-red-800">
        Anular é permanente — não existe &ldquo;desanular&rdquo;. Use para lançamento errado ou duplicado.
      </p>
      <label className="mt-2 block text-xs text-slate-600">Motivo</label>
      <input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Ex.: Lançado em duplicidade, ver nº 046/2026"
        className={`${ESTILO_CAMPO} mt-1 w-full`}
      />
      {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={pendente || motivo.trim().length < 3}
          onClick={() => {
            if (window.confirm("Anular este requerimento? Esta ação é permanente.")) {
              onConfirmar(motivo);
            }
          }}
        >
          {pendente ? "Anulando…" : "Confirmar anulação"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

const OPCAO_OUTRO_VEREADOR = "__outro__";

/**
 * Lista suspensa alimentada pelo catálogo de vereadores (Configurações),
 * com fallback "Outro" para texto livre — cobre o caso comum (escolher da
 * lista) e o excepcional (nome ainda não cadastrado, suplente, correção
 * pontual). `valor` continua sendo o NOME (texto), não um id — o campo
 * `requerimentos.vereador` é texto livre no banco, sem FK, de propósito
 * (ver comentário na migration).
 */
function CampoVereador({
  vereadores,
  valor,
  onMudar,
}: {
  vereadores: Vereador[];
  valor: string;
  onMudar: (v: string) => void;
}) {
  const ativos = vereadores.filter((v) => v.ativo);
  const [modoLivre, setModoLivre] = React.useState(
    ativos.length === 0 || (valor !== "" && !ativos.some((v) => v.nome === valor))
  );

  if (modoLivre) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-500">Vereador</label>
          {ativos.length > 0 && (
            <button
              type="button"
              className="text-xs text-cataguases-azul hover:underline"
              onClick={() => setModoLivre(false)}
            >
              Escolher da lista
            </button>
          )}
        </div>
        <input
          value={valor}
          onChange={(e) => onMudar(e.target.value)}
          placeholder="Nome do vereador"
          className={`${ESTILO_CAMPO} mt-1 w-full`}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs text-slate-500">Vereador</label>
      <select
        value={valor}
        onChange={(e) => {
          if (e.target.value === OPCAO_OUTRO_VEREADOR) {
            setModoLivre(true);
            onMudar("");
          } else {
            onMudar(e.target.value);
          }
        }}
        className={`${ESTILO_CAMPO} mt-1 w-full`}
      >
        <option value="">Selecione…</option>
        {ativos.map((v) => (
          <option key={v.id} value={v.nome}>
            {v.nome}
          </option>
        ))}
        <option value={OPCAO_OUTRO_VEREADOR}>Outro (digitar nome)…</option>
      </select>
    </div>
  );
}

function ModalNovoRequerimento({
  aberto,
  onFechar,
  diasPadrao,
  vereadores,
}: {
  aberto: boolean;
  onFechar: () => void;
  diasPadrao: number;
  vereadores: Vereador[];
}) {
  const acao = useAcao();
  const [numero, setNumero] = React.useState("");
  const [vereador, setVereador] = React.useState("");
  const [assunto, setAssunto] = React.useState("");
  const [recebidoEm, setRecebidoEm] = React.useState(() => dataNoFuso(new Date()));
  const [diasTotal, setDiasTotal] = React.useState(diasPadrao);
  const [arquivos, setArquivos] = React.useState<File[]>([]);
  const [avisoArquivo, setAvisoArquivo] = React.useState<string | null>(null);

  function limpar() {
    setNumero("");
    setVereador("");
    setAssunto("");
    setRecebidoEm(dataNoFuso(new Date()));
    setDiasTotal(diasPadrao);
    setArquivos([]);
    setAvisoArquivo(null);
  }

  function selecionarArquivos(lista: FileList | null) {
    if (!lista) return;
    const aceitos: File[] = [];
    const rejeitados: string[] = [];
    for (const arquivo of Array.from(lista)) {
      if (arquivo.size > TAMANHO_MAXIMO_ANEXO) {
        rejeitados.push(arquivo.name);
      } else {
        aceitos.push(arquivo);
      }
    }
    setArquivos((prev) => [...prev, ...aceitos]);
    setAvisoArquivo(rejeitados.length > 0 ? `Maior que 5 MB, não enviado: ${rejeitados.join(", ")}` : null);
  }

  /**
   * Cria o requerimento e, se houver arquivos selecionados, anexa-os em
   * seguida — falha ao anexar não desfaz a criação (o requerimento já
   * existe; o usuário pode anexar depois pelo detalhe), só vira um aviso.
   */
  async function criarComAnexo() {
    const resultado = await criarRequerimento({ numero, vereador, assunto, recebidoEm, diasTotal });
    if (!resultado.sucesso || arquivos.length === 0) return resultado;

    const supabase = criarClienteNavegador();
    const caminhos: string[] = [];
    for (const arquivo of arquivos) {
      const caminho = `${resultado.id}/documento/${Date.now()}-${arquivo.name}`;
      const { error } = await supabase.storage.from("requerimentos-anexos").upload(caminho, arquivo);
      if (error) {
        return { ...resultado, aviso: `Requerimento criado, mas falha ao anexar ${arquivo.name}: ${error.message}` };
      }
      caminhos.push(caminho);
    }
    const anexoResultado = await anexarDocumento(resultado.id, caminhos);
    if (!anexoResultado.sucesso) {
      return { ...resultado, aviso: `Requerimento criado, mas falha ao anexar documento: ${anexoResultado.erro}` };
    }
    return resultado;
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo requerimento</DialogTitle>
        </DialogHeader>
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs text-slate-500">Número</label>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex.: 045/2026"
              className={`${ESTILO_CAMPO} mt-1 w-full`}
            />
          </div>
          <CampoVereador vereadores={vereadores} valor={vereador} onMudar={setVereador} />
          <div>
            <label className="text-xs text-slate-500">Assunto</label>
            <textarea
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              rows={3}
              className={`${ESTILO_CAMPO} mt-1 w-full`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Recebido em</label>
              <input
                type="date"
                value={recebidoEm}
                onChange={(e) => setRecebidoEm(e.target.value)}
                className={`${ESTILO_CAMPO} mt-1 w-full`}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Prazo (dias)</label>
              <input
                type="number"
                min={1}
                value={diasTotal}
                onChange={(e) => setDiasTotal(parseInt(e.target.value, 10) || 1)}
                className={`${ESTILO_CAMPO} mt-1 w-full`}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Documento do requerimento (opcional)</label>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf,text/plain"
              onChange={(e) => {
                selecionarArquivos(e.target.files);
                e.target.value = "";
              }}
              className="mt-1 block w-full text-xs text-slate-500"
            />
            {arquivos.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {arquivos.map((arquivo, i) => (
                  <li
                    key={`${arquivo.name}-${i}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                  >
                    {arquivo.name}
                    <button
                      type="button"
                      aria-label={`Remover ${arquivo.name}`}
                      onClick={() => setArquivos((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {avisoArquivo && <p className="mt-1 text-[11px] text-amber-700">{avisoArquivo}</p>}
          </div>
          {acao.erro && <p className="text-xs text-red-700">{acao.erro}</p>}
          {acao.aviso && <p className="text-xs text-amber-700">{acao.aviso}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              disabled={acao.pendente || !numero || !vereador || !assunto}
              onClick={() =>
                acao.executar(criarComAnexo, () => {
                  limpar();
                  onFechar();
                })
              }
            >
              {acao.pendente ? "Salvando…" : "Cadastrar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
