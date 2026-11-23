import type { CSSProperties } from "react";
import { redirect } from "next/navigation";

import { CabecalhoRequerimentos } from "@/components/layout/cabecalho-requerimentos";
import { AjusteDeRolagem } from "@/components/modulo/ajuste-de-rolagem";
import { AvisoConexao } from "@/components/modulo/estados-tela";
import { BoasVindasDesign } from "@/components/ajuda/boas-vindas-design";
import { SincronizarPreferencias } from "@/components/layout/sincronizar-preferencias";
import { lerPreferencias } from "@/lib/dados/preferencias";
import { obterUsuarioAtual, usuarioAtuaComoGabinete, RUTULO_PERFIL } from "@/lib/auth/perfil";

/** Cor do módulo (vermelho do Requerimentos) para os componentes compartilhados: faixa, botões, realces e seleção. */
const ESTILO_MODULO = {
  "--modulo": "#C63B22",
  "--modulo-texto": "#C63B22",
  "--modulo-tinta": "#C63B22",
  "--modulo-tinta-escuro": "#FF8A7A",
} as CSSProperties;

export default async function LayoutProtegido({ children }: { children: React.ReactNode }) {
  // As preferências de aparência não dependem de quem é a pessoa: começam já, junto com a leitura do perfil.
  const preferenciasPronto = lerPreferencias();
  const usuario = await obterUsuarioAtual();
  if (!usuario) {
    // ssoFalhou=1 é essencial: sem ele, /login tenta o SSO silencioso de
    // novo na hora — se a sessão do SSO não "pegar" neste layout (ex.:
    // cookie do Supabase ainda não sincronizado no momento do redirect), o
    // resultado é um loop infinito de magic link sem nunca mostrar o
    // formulário de login normal. Mesmo bug real encontrado em App-Compras
    // (usuário odomarribeiro@gmail.com, 30/09/2026) — corrigido aqui também
    // por ter exatamente o mesmo padrão de SSO. Mesmo guard já usado em
    // `sair()`.
    redirect("/login?ssoFalhou=1");
  }
  if (!usuario.ativo) {
    redirect("/login?motivo=desativado");
  }

  const podeConfigurar = usuario.perfil === "admin" || usuario.perfil === "diretor";
  const [gabinete, preferencias] = await Promise.all([usuarioAtuaComoGabinete(usuario), preferenciasPronto]);

  return (
    <div className="emd min-h-dvh bg-slate-50 print:bg-white" style={ESTILO_MODULO}>
      <SincronizarPreferencias salvas={preferencias} />
      <BoasVindasDesign app="requerimentos" jaVisto={!!preferencias?.boasVindasVistas} />
      <CabecalhoRequerimentos
        usuario={{ id: usuario.id, nome: usuario.nome }}
        detalhe={`${RUTULO_PERFIL[usuario.perfil]}${gabinete && usuario.perfil === "secretaria" ? " (gabinete)" : ""}`}
        podeConfigurar={podeConfigurar}
      />
      <div className="mx-auto max-w-[110rem] px-3 py-4 sm:px-5 sm:py-5 print:max-w-none print:p-0">
        <main id="conteudo" className="min-w-0">
          <AjusteDeRolagem />
          <AvisoConexao />
          {children}
        </main>
      </div>
    </div>
  );
}
