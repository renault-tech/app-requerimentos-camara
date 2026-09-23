"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { useAcao } from "@/lib/hooks/usar-acao";
import { ESTILO_CAMPO_PADRAO as ESTILO_CAMPO } from "@/lib/utils";
import {
  atualizarConfigPrazo,
  atualizarSecretaria,
  atualizarVereador,
  criarSecretaria,
  criarVereador,
  definirAcesso,
  definirAtuaComoGabinete,
  type ResultadoConfig,
} from "@/lib/actions/configuracoes";
import { RUTULO_PERFIL } from "@/lib/auth/rotulos";
import type { UsuarioComAcesso } from "@/lib/dados/configuracoes";
import type { ConfigPrazo, PerfilUsuario, Secretaria, Vereador } from "@/types/database";

const PERFIS: PerfilUsuario[] = ["admin", "diretor", "gabinete", "secretaria"];

export function PainelConfiguracoes({
  config,
  secretarias,
  vereadores,
  usuarios,
  souAdmin,
}: {
  config: ConfigPrazo;
  secretarias: Secretaria[];
  vereadores: Vereador[];
  usuarios: UsuarioComAcesso[];
  souAdmin: boolean;
}) {
  return (
    <div className="mt-5 space-y-6">
      <SecaoPrazo config={config} />
      <SecaoCatalogo
        titulo="Secretarias"
        descricao="Catálogo usado para distribuir requerimentos. Renomeie ao mudar o nome oficial de uma secretaria, ou desative uma extinta/fundida — nada é apagado, o histórico continua mostrando o nome normalmente."
        rotuloNovo="Nova secretaria"
        placeholderNovo="Ex.: Obras"
        itens={secretarias}
        onCriar={(nome) => criarSecretaria({ nome })}
        onAtualizar={(id, dados) => atualizarSecretaria(id, dados)}
      />
      <SecaoCatalogo
        titulo="Vereadores"
        descricao="Alimenta a lista suspensa do campo Vereador ao cadastrar um requerimento. Desative ao fim do mandato/afastamento — o cadastro sempre permite digitar um nome fora da lista (suplente, nome novo) via a opção Outro."
        rotuloNovo="Novo vereador"
        placeholderNovo="Ex.: Fulano de Tal"
        itens={vereadores}
        onCriar={(nome) => criarVereador({ nome })}
        onAtualizar={(id, dados) => atualizarVereador(id, dados)}
      />
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

type ItemCatalogo = { id: string; nome: string; ativo: boolean };

/**
 * CRUD genérico de catálogo (nome único + ativo) — reusado por Secretarias
 * e Vereadores, que têm exatamente a mesma forma e as mesmas regras
 * (renomear livre, desativar em vez de apagar). Regra da casa: nunca
 * duplicar a mesma UI entre dois catálogos quase idênticos.
 */
function SecaoCatalogo({
  titulo,
  descricao,
  rotuloNovo,
  placeholderNovo,
  itens,
  onCriar,
  onAtualizar,
}: {
  titulo: string;
  descricao: string;
  rotuloNovo: string;
  placeholderNovo: string;
  itens: ItemCatalogo[];
  onCriar: (nome: string) => Promise<ResultadoConfig>;
  onAtualizar: (id: string, dados: { nome: string; ativo: boolean }) => Promise<ResultadoConfig>;
}) {
  const acaoCriar = useAcao();
  const [nome, setNome] = React.useState("");
  const [editandoId, setEditandoId] = React.useState<string | null>(null);

  const ordenados = [...itens].sort((a, b) =>
    a.ativo === b.ativo ? a.nome.localeCompare(b.nome, "pt-BR") : a.ativo ? -1 : 1
  );

  return (
    <Cartao titulo={titulo} descricao={descricao}>
      <ul className="space-y-1.5">
        {ordenados.map((item) =>
          editandoId === item.id ? (
            <LinhaCatalogoEdicao
              key={item.id}
              item={item}
              onSalvar={onAtualizar}
              onFechar={() => setEditandoId(null)}
            />
          ) : (
            <LinhaCatalogo key={item.id} item={item} onEditar={() => setEditandoId(item.id)} />
          )
        )}
        {itens.length === 0 && <li className="text-xs text-slate-400">Nenhum cadastrado.</li>}
      </ul>
      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs text-slate-500">{rotuloNovo}</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={placeholderNovo}
            className={`${ESTILO_CAMPO} mt-1 w-full`}
          />
        </div>
        <Button
          size="sm"
          disabled={acaoCriar.pendente || nome.trim().length < 2}
          onClick={() => acaoCriar.executar(() => onCriar(nome), () => setNome(""))}
        >
          Adicionar
        </Button>
      </div>
      {acaoCriar.erro && <p className="mt-2 text-xs text-red-700">{acaoCriar.erro}</p>}
    </Cartao>
  );
}

function LinhaCatalogo({ item, onEditar }: { item: ItemCatalogo; onEditar: () => void }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-white px-2.5 py-1.5 text-sm">
      <span className={item.ativo ? "" : "text-slate-400 line-through"}>
        {item.nome}
        {!item.ativo && <span className="ml-2 text-[11px] font-normal no-underline text-amber-700">(inativo)</span>}
      </span>
      <Button size="sm" variant="outline" onClick={onEditar}>
        Editar
      </Button>
    </li>
  );
}

function LinhaCatalogoEdicao({
  item,
  onSalvar,
  onFechar,
}: {
  item: ItemCatalogo;
  onSalvar: (id: string, dados: { nome: string; ativo: boolean }) => Promise<ResultadoConfig>;
  onFechar: () => void;
}) {
  const acao = useAcao();
  const [nome, setNome] = React.useState(item.nome);
  const [ativo, setAtivo] = React.useState(item.ativo);

  return (
    <li className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="text-xs text-slate-500">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={`${ESTILO_CAMPO} mt-1 w-full`}
          />
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-600">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo
        </label>
      </div>
      {acao.erro && <p className="mt-1.5 text-xs text-red-700">{acao.erro}</p>}
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          disabled={acao.pendente || nome.trim().length < 2}
          onClick={() => acao.executar(() => onSalvar(item.id, { nome, ativo }), onFechar)}
        >
          {acao.pendente ? "Salvando…" : "Salvar"}
        </Button>
        <Button size="sm" variant="ghost" disabled={acao.pendente} onClick={onFechar}>
          Cancelar
        </Button>
      </div>
    </li>
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
              {secretarias
                .filter((s) => s.ativo || s.id === secretariaId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                    {!s.ativo ? " (inativa)" : ""}
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
