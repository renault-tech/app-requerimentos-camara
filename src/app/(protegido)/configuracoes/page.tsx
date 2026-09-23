import { redirect } from "next/navigation";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { obterConfigPrazo, listarSecretarias, listarVereadores } from "@/lib/dados/requerimentos";
import { listarUsuariosComAcesso } from "@/lib/dados/configuracoes";
import { PainelConfiguracoes } from "@/components/configuracoes/painel-configuracoes";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";

export const dynamic = "force-dynamic";

export default async function PaginaConfiguracoes() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  if (usuario.perfil !== "admin" && usuario.perfil !== "diretor") {
    redirect("/dashboard");
  }

  const [config, secretarias, vereadores, usuarios] = await Promise.all([
    obterConfigPrazo(),
    listarSecretarias(),
    listarVereadores(),
    listarUsuariosComAcesso(),
  ]);

  return (
    <div className="px-4 sm:px-6">
      <CabecalhoPagina
        titulo="Configurações"
        subtitulo="Prazo padrão, secretarias, vereadores e quem tem acesso ao módulo."
      />

      <PainelConfiguracoes
        config={config}
        secretarias={secretarias}
        vereadores={vereadores}
        usuarios={usuarios}
        souAdmin={usuario.perfil === "admin"}
      />
    </div>
  );
}
