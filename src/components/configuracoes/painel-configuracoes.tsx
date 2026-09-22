"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { useAcao } from "@/lib/hooks/usar-acao";
import { ESTILO_CAMPO_PADRAO as ESTILO_CAMPO } from "@/lib/utils";
import {
  atualizarConfigPrazo,
  criarSecretaria,
  definirAcesso,
  definirAtuaComoGabinete,
} from "@/lib/actions/configuracoes";
import { RUTULO_PERFIL } from "@/lib/auth/rotulos";
import type { UsuarioComAcesso } from "@/lib/dados/configuracoes";
import type { ConfigPrazo, PerfilUsuario, Secretaria } from "@/types/database";

const PERFIS: PerfilUsuario[] = ["admin", "diretor", "gabinete", "secretaria"];

export function PainelConfiguracoes({
  config,
  secretarias,
  usuarios,
  souAdmin,
}: {
  config: ConfigPrazo;
  secretarias: Secretaria[];
  usuarios: UsuarioComAcesso[];
  souAdmin: boolean;
}) {
  return (
    <div className="mt-5 space-y-6">
      <SecaoPrazo config={config} />
      <SecaoSecretarias secretarias={secretarias} />
      {souAdmin && <SecaoUsuarios usuarios={usuarios} secretarias={secretarias} />}
    </div>
  );
}

function Cartao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-cataguases-marinho">{titulo}</h2>
      {descricao && <p className="mt-0.5 text-xs text-slate-500">{descricao}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SecaoPrazo({ config }: { config: ConfigPrazo }) {
  const acao = useAcao();
  const [prazoPadraoDias, setPrazoPadraoDias] = React.useState(config.prazo_padrao_dias);
  const [limiarVerdeDias, setLimiarVerdeDias] = React.useState(config.limiar_verde_dias);
  const [limiarAmareloDias, setLimiarAmareloDias] = React.useState(config.limiar_amarelo_dias);
  const [limiarLaranjaDias, setLimiarLaranjaDias] = React.useState(config.limiar_laranja_dias);

  return (
    <Cartao
      titulo="Prazo padrão"
      descricao="A barra de prazo enche até este número de dias e esvazia dia a dia; muda de cor nos limiares abaixo (em dias restantes, não em %)."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Campo rotulo="Prazo padrão (dias)" valor={prazoPadraoDias} onMudar={setPrazoPadraoDias} />
        <Campo rotulo="Verde a partir de" valor={limiarVerdeDias} onMudar={setLimiarVerdeDias} />
        <Campo rotulo="Amarelo a partir de" valor={limiarAmareloDias} onMudar={setLimiarAmareloDias} />
        <Campo rotulo="Laranja a partir de" valor={limiarLaranjaDias} onMudar={setLimiarLaranjaDias} />
      </div>
      {acao.erro && <p className="mt-2 text-xs text-red-700">{acao.erro}</p>}
      <Button
        size="sm"
        className="mt-3"
        disabled={acao.pendente}
        onClick={() =>
          acao.executar(() =>
            atualizarConfigPrazo({
              prazoPadraoDias,
              limiarVerdeDias,
              limiarAmareloDias,
              limiarLaranjaDias,
            })
          )
        }
      >
        {acao.pendente ? "Salvando…" : "Salvar"}
      </Button>
    </Cartao>
  );
}

function Campo({
  rotulo,
  valor,
  onMudar,
}: {
  rotulo: string;
  valor: number;
  onMudar: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-slate-500">{rotulo}</label>
      <input
        type="number"
        min={1}
        value={valor}
        onChange={(e) => onMudar(parseInt(e.target.value, 10) || 1)}
        className={`${ESTILO_CAMPO} mt-1 w-full`}
      />
    </div>
  );
}

function SecaoSecretarias({ secretarias }: { secretarias: Secretaria[] }) {
  const acao = useAcao();
  const [nome, setNome] = React.useState("");

  return (
    <Cartao titulo="Secretarias" descricao="Catálogo usado para distribuir requerimentos.">
      <ul className="flex flex-wrap gap-1.5">
        {secretarias.map((s) => (
          <li key={s.id} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
            {s.nome}
          </li>
        ))}
        {secretarias.length === 0 && <li className="text-xs text-slate-400">Nenhuma cadastrada.</li>}
      </ul>
      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs text-slate-500">Nova secretaria</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Obras"
            className={`${ESTILO_CAMPO} mt-1 w-full`}
          />
        </div>
        <Button
          size="sm"
          disabled={acao.pendente || nome.trim().length < 2}
          onClick={() => acao.executar(() => criarSecretaria({ nome }), () => setNome(""))}
        >
          Adicionar
        </Button>
      </div>
      {acao.erro && <p className="mt-2 text-xs text-red-700">{acao.erro}</p>}
    </Cartao>
  );
}

function SecaoUsuarios({
  usuarios,
  secretarias,
}: {
  usuarios: UsuarioComAcesso[];
  secretarias: Secretaria[];
}) {
  const [editando, setEditando] = React.useState<UsuarioComAcesso | null>(null);
  const [mostrarForm, setMostrarForm] = React.useState(false);

  return (
    <Cartao
      titulo="Usuários com acesso"
      descricao="A pessoa precisa já ter login em algum módulo da plataforma — aqui só se libera o acesso a este."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1.5 pr-3 font-medium">Nome</th>
              <th className="py-1.5 pr-3 font-medium">E-mail</th>
              <th className="py-1.5 pr-3 font-medium">Perfil</th>
              <th className="py-1.5 pr-3 font-medium">Secretaria</th>
              <th className="py-1.5 pr-3 font-medium">Ativo</th>
              <th className="py-1.5 pr-3 font-medium">Gabinete extra</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <LinhaUsuario key={u.id} usuario={u} secretarias={secretarias} onEditar={() => { setEditando(u); setMostrarForm(true); }} />
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-xs text-slate-400">
                  Nenhum usuário com acesso ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!mostrarForm ? (
        <Button size="sm" className="mt-3" onClick={() => { setEditando(null); setMostrarForm(true); }}>
          Conceder acesso
        </Button>
      ) : (
        <FormularioAcesso
          secretarias={secretarias}
          usuario={editando}
          onFechar={() => setMostrarForm(false)}
        />
      )}
    </Cartao>
  );
}

function LinhaUsuario({
  usuario,
  secretarias,
  onEditar,
}: {
  usuario: UsuarioComAcesso;
  secretarias: Secretaria[];
  onEditar: () => void;
}) {
  const acaoGabinete = useAcao();
  const nomeSecretaria = secretarias.find((s) => s.id === usuario.secretariaId)?.nome ?? "—";

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-1.5 pr-3">{usuario.nome}</td>
      <td className="py-1.5 pr-3 text-slate-500">{usuario.email}</td>
      <td className="py-1.5 pr-3">{RUTULO_PERFIL[usuario.perfil]}</td>
      <td className="py-1.5 pr-3">{usuario.perfil === "secretaria" ? nomeSecretaria : "—"}</td>
      <td className="py-1.5 pr-3">{usuario.ativo ? "Sim" : "Não"}</td>
      <td className="py-1.5 pr-3">
        {usuario.perfil === "secretaria" ? (
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={usuario.atuaComoGabinete}
              disabled={acaoGabinete.pendente}
              onChange={(e) =>
                acaoGabinete.executar(() => definirAtuaComoGabinete(usuario.id, e.target.checked))
              }
            />
            atua como gabinete
          </label>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="py-1.5 pr-3">
        <Button size="sm" variant="outline" onClick={onEditar}>
          Editar
        </Button>
      </td>
    </tr>
  );
}

function FormularioAcesso({
  secretarias,
  usuario,
  onFechar,
}: {
  secretarias: Secretaria[];
  usuario: UsuarioComAcesso | null;
  onFechar: () => void;
}) {
  const acao = useAcao();
  const [email, setEmail] = React.useState(usuario?.email ?? "");
  const [nome, setNome] = React.useState(usuario?.nome ?? "");
  const [perfil, setPerfil] = React.useState<PerfilUsuario>(usuario?.perfil ?? "secretaria");
  const [secretariaId, setSecretariaId] = React.useState<string | null>(usuario?.secretariaId ?? null);
  const [ativo, setAtivo] = React.useState(usuario?.ativo ?? true);

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-600">
        {usuario ? `Editando acesso de ${usuario.nome}` : "Conceder novo acesso"}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-xs text-slate-500">E-mail (já cadastrado na plataforma)</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!usuario}
            className={`${ESTILO_CAMPO} mt-1 w-full disabled:bg-slate-100`}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={`${ESTILO_CAMPO} mt-1 w-full`} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Perfil</label>
          <select
            value={perfil}
            onChange={(e) => setPerfil(e.target.value as PerfilUsuario)}
            className={`${ESTILO_CAMPO} mt-1 w-full`}
          >
            {PERFIS.map((p) => (
              <option key={p} value={p}>
                {RUTULO_PERFIL[p]}
              </option>
            ))}
          </select>
        </div>
        {perfil === "secretaria" && (
          <div>
            <label className="text-xs text-slate-500">Secretaria</label>
            <select
              value={secretariaId ?? ""}
              onChange={(e) => setSecretariaId(e.target.value || null)}
              className={`${ESTILO_CAMPO} mt-1 w-full`}
            >
              <option value="">Selecione…</option>
              {secretarias.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo
        </label>
      </div>
      {acao.erro && <p className="mt-2 text-xs text-red-700">{acao.erro}</p>}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={acao.pendente || !email || !nome}
          onClick={() =>
            acao.executar(
              () => definirAcesso({ email, nome, perfil, secretariaId, ativo }),
              onFechar
            )
          }
        >
          {acao.pendente ? "Salvando…" : "Salvar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
