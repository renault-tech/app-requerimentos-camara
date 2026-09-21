import { redirect } from "next/navigation";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { obterConfigPrazo, listarSecretarias } from "@/lib/dados/requerimentos";
import { listarUsuariosComAcesso } from "@/lib/dados/configuracoes";
import { PainelConfiguracoes } from "@/components/configuracoes/painel-configuracoes";

export const dynamic = "force-dynamic";

export default async function PaginaConfiguracoes() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  if (usuario.perfil !== "admin" && usuario.perfil !== "diretor") {
    redirect("/dashboard");
  }

  const [config, secretarias, usuarios] = await Promise.all([
    obterConfigPrazo(),
    listarSecretarias(),
    listarUsuariosComAcesso(),
  ]);

  return (
    <div className="px-4 sm:px-6">
      <h1 className="text-xl font-semibold text-cataguases-marinho">Configurações</h1>
      <p className="mt-1 text-sm text-slate-500">
        Prazo padrão, secretarias e quem tem acesso ao módulo.
      </p>

      <PainelConfiguracoes
        config={config}
        secretarias={secretarias}
        usuarios={usuarios}
        souAdmin={usuario.perfil === "admin"}
      />
    </div>
  );
}
