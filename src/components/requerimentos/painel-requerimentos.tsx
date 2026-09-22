"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarraPrazo } from "@/components/requerimentos/barra-prazo";
import { useAcao } from "@/lib/hooks/usar-acao";
import { ESTILO_CAMPO_PADRAO as ESTILO_CAMPO } from "@/lib/utils";
import {
  criarRequerimento,
  distribuirRequerimento,
  marcarRespondida,
  solicitarProrrogacao,
  devolverACamara,
} from "@/lib/actions/requerimentos";
import type { RequerimentoDaLista } from "@/lib/dados/requerimentos";
import type { Fase } from "@/lib/requerimentos/status";
import { COR_FASE, ROTULO_FASE, COR_ATRASADO } from "@/lib/requerimentos/cores-fase";
import { dataNoFuso } from "@/lib/fuso";
import type { ConfigPrazo, Secretaria, Usuario } from "@/types/database";

type FiltroCartao = "todos" | "atrasados" | Fase;

export function PainelRequerimentos({
  requerimentosIniciais,
  secretarias,
  config,
  usuario,
  podeDistribuir,
}: {
  requerimentosIniciais: RequerimentoDaLista[];
  secretarias: Secretaria[];
  config: ConfigPrazo;
  usuario: Usuario;
  podeDistribuir: boolean;
}) {
  const [busca, setBusca] = React.useState("");
  const [filtro, setFiltro] = React.useState<FiltroCartao>("todos");
  const [linhaExpandida, setLinhaExpandida] = React.useState<string | null>(null);
  const [modalNovoAberto, setModalNovoAberto] = React.useState(false);

  const requerimentos = requerimentosIniciais;

  const contagens = React.useMemo(() => {
    return {
      todos: requerimentos.length,
      atrasados: requerimentos.filter((r) => r.atrasado).length,
      aguardando: requerimentos.filter((r) => r.fase === "aguardando").length,
      distribuido: requerimentos.filter((r) => r.fase === "distribuido").length,
      respondido: requerimentos.filter((r) => r.fase === "respondido").length,
      devolvido: requerimentos.filter((r) => r.fase === "devolvido").length,
    };
  }, [requerimentos]);

  const visiveis = React.useMemo(() => {
    let base = requerimentos;
    if (filtro === "atrasados") base = base.filter((r) => r.atrasado);
    else if (filtro !== "todos") base = base.filter((r) => r.fase === filtro);

    const termo = busca.trim().toLowerCase();
    if (!termo) return base;
    return base.filter(
      (r) =>
        r.numero.toLowerCase().includes(termo) ||
        r.vereador.toLowerCase().includes(termo) ||
        r.assunto.toLowerCase().includes(termo)
    );
  }, [requerimentos, filtro, busca]);

  const cartoes: { chave: FiltroCartao; rotulo: string; cor: string; valor: number }[] = [
    { chave: "todos", rotulo: "Todos", cor: "#0C1D33", valor: contagens.todos },
    { chave: "atrasados", rotulo: "Atrasados", cor: COR_ATRASADO, valor: contagens.atrasados },
    { chave: "aguardando", rotulo: ROTULO_FASE.aguardando, cor: COR_FASE.aguardando, valor: contagens.aguardando },
    { chave: "distribuido", rotulo: ROTULO_FASE.distribuido, cor: COR_FASE.distribuido, valor: contagens.distribuido },
    { chave: "respondido", rotulo: ROTULO_FASE.respondido, cor: COR_FASE.respondido, valor: contagens.respondido },
    { chave: "devolvido", rotulo: ROTULO_FASE.devolvido, cor: COR_FASE.devolvido, valor: contagens.devolvido },
  ];

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {cartoes.map((c) => {
          const ativo = filtro === c.chave;
          return (
            <button
              key={c.chave}
              type="button"
              onClick={() => setFiltro(c.chave)}
              className="rounded-lg border bg-white p-3 text-left shadow-sm transition-colors"
              style={{
                borderColor: ativo ? `${c.cor}66` : undefined,
                boxShadow: ativo ? `0 0 0 1px ${c.cor}22` : undefined,
                borderTopColor: c.cor,
                borderTopWidth: 3,
              }}
            >
              <p className="text-xl font-semibold" style={{ color: c.cor }}>
                {c.valor}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{c.rotulo}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Buscar por nº, vereador ou assunto…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={`${ESTILO_CAMPO} w-full sm:max-w-sm`}
        />
        {podeDistribuir && (
          <Button onClick={() => setModalNovoAberto(true)} className="shrink-0">
            Novo requerimento
          </Button>
        )}
      </div>

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
                    className="cursor-pointer border-b border-slate-100 align-top last:border-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cataguases-azul"
                  >
                    <td className="px-3 py-2.5 font-mono text-xs">{r.numero}</td>
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
        />
      )}
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
  const acaoResponder = useAcao();
  const acaoProrrogar = useAcao();
  const acaoDevolver = useAcao();

  const [selecionadas, setSelecionadas] = React.useState<string[]>([]);
  const [mostrarProrrogacao, setMostrarProrrogacao] = React.useState(false);
  const [mostrarDevolucao, setMostrarDevolucao] = React.useState(false);

  const idsJaDistribuidas = new Set(requerimento.secretarias.map((s) => s.secretariaId));
  const secretariasDisponiveis = secretarias.filter((s) => !idsJaDistribuidas.has(s.id));
  const todasResponderam =
    requerimento.secretarias.length > 0 && requerimento.secretarias.every((s) => s.respondidaEm);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Secretarias
        </h3>
        <ul className="mt-2 space-y-1.5">
          {requerimento.secretarias.map((s) => {
            const souEu = usuario.perfil === "secretaria" && usuario.secretaria_id === s.secretariaId;
            return (
              <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {s.nomeSecretaria}
                  {s.respondidaEm ? (
                    <span className="ml-2 text-xs text-green-700">respondida em {s.respondidaEm}</span>
                  ) : (
                    <span className="ml-2 text-xs text-slate-400">pendente</span>
                  )}
                </span>
                {!s.respondidaEm && (souEu || podeDistribuir) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acaoResponder.pendente}
                    onClick={() =>
                      acaoResponder.executar(() => marcarRespondida(requerimento.id, s.secretariaId))
                    }
                  >
                    Marcar respondida
                  </Button>
                )}
              </li>
            );
          })}
          {requerimento.secretarias.length === 0 && (
            <li className="text-sm text-slate-400">Ainda não distribuído.</li>
          )}
        </ul>
        {acaoResponder.erro && (
          <p className="mt-2 text-xs text-red-700">{acaoResponder.erro}</p>
        )}

        {podeDistribuir && requerimento.fase !== "devolvido" && secretariasDisponiveis.length > 0 && (
          <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-600">Distribuir a mais secretarias</p>
            <div className="mt-2 flex flex-wrap gap-2">
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
            <Button
              size="sm"
              className="mt-2"
              disabled={selecionadas.length === 0 || acaoDistribuir.pendente}
              onClick={() =>
                acaoDistribuir.executar(
                  () => distribuirRequerimento(requerimento.id, selecionadas),
                  () => setSelecionadas([])
                )
              }
            >
              Distribuir
            </Button>
            {acaoDistribuir.erro && (
              <p className="mt-2 text-xs text-red-700">{acaoDistribuir.erro}</p>
            )}
          </div>
        )}
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

        {podeDistribuir && requerimento.fase !== "devolvido" && (
          <div className="mt-3 space-y-2">
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

            {todasResponderam &&
              (!mostrarDevolucao ? (
                <Button size="sm" onClick={() => setMostrarDevolucao(true)}>
                  Devolver à Câmara
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
              ))}
          </div>
        )}
      </div>
    </div>
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
    <div className="rounded-md border border-slate-200 bg-white p-3">
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
    <div className="rounded-md border border-slate-200 bg-white p-3">
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

function ModalNovoRequerimento({
  aberto,
  onFechar,
  diasPadrao,
}: {
  aberto: boolean;
  onFechar: () => void;
  diasPadrao: number;
}) {
  const acao = useAcao();
  const [numero, setNumero] = React.useState("");
  const [vereador, setVereador] = React.useState("");
  const [assunto, setAssunto] = React.useState("");
  const [recebidoEm, setRecebidoEm] = React.useState(() => dataNoFuso(new Date()));
  const [diasTotal, setDiasTotal] = React.useState(diasPadrao);

  function limpar() {
    setNumero("");
    setVereador("");
    setAssunto("");
    setRecebidoEm(dataNoFuso(new Date()));
    setDiasTotal(diasPadrao);
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
          <div>
            <label className="text-xs text-slate-500">Vereador</label>
            <input
              value={vereador}
              onChange={(e) => setVereador(e.target.value)}
              className={`${ESTILO_CAMPO} mt-1 w-full`}
            />
          </div>
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
          {acao.erro && <p className="text-xs text-red-700">{acao.erro}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              disabled={acao.pendente || !numero || !vereador || !assunto}
              onClick={() =>
                acao.executar(
                  () => criarRequerimento({ numero, vereador, assunto, recebidoEm, diasTotal }),
                  () => {
                    limpar();
                    onFechar();
                  }
                )
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
