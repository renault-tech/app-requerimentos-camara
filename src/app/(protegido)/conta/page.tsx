import { redirect } from "next/navigation";

import { FormularioMudarSenha } from "@/components/conta/formulario-mudar-senha";
import { PreferenciasAparencia } from "@/components/conta/preferencias-aparencia";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { obterUsuarioAtual } from "@/lib/auth/perfil";

export const dynamic = "force-dynamic";
export const metadata = { title: "Minha conta · Requerimentos" };

/** Minha conta — a mesma tela dos outros módulos: aparência e troca de senha. */
export default async function PaginaMinhaConta() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login?ssoFalhou=1");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6">
      <CabecalhoPagina titulo="Minha conta" subtitulo={`Olá, ${usuario.nome}.`} />

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900">Aparência</h2>
          <p className="text-sm text-slate-600">Escolha o estilo e o modo de cor. A preferência fica guardada neste navegador.</p>
        </div>
        <PreferenciasAparencia />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="font-semibold text-slate-900">Alterar senha</h2>
          <p className="text-sm text-slate-600">Informe a senha atual e a nova senha duas vezes. Você permanece conectado depois de trocar.</p>
        </div>
        <FormularioMudarSenha />
      </div>
    </div>
  );
}
