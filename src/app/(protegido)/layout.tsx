import { redirect } from "next/navigation";

import { CabecalhoRequerimentos } from "@/components/layout/cabecalho-requerimentos";
import { obterUsuarioAtual, usuarioAtuaComoGabinete, RUTULO_PERFIL } from "@/lib/auth/perfil";

export default async function LayoutProtegido({ children }: { children: React.ReactNode }) {
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
  const gabinete = await usuarioAtuaComoGabinete(usuario);

  return (
    <div className="min-h-dvh bg-slate-50">
      <CabecalhoRequerimentos
        usuario={{ id: usuario.id, nome: usuario.nome }}
        detalhe={`${RUTULO_PERFIL[usuario.perfil]}${gabinete && usuario.perfil === "secretaria" ? " (gabinete)" : ""}`}
        podeConfigurar={podeConfigurar}
      />
      <main id="conteudo" className="mx-auto max-w-[min(94%,1400px)] py-6">{children}</main>
    </div>
  );
}
