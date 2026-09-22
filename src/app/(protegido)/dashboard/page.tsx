import { redirect } from "next/navigation";

import { listarRequerimentos, listarSecretarias, obterConfigPrazo } from "@/lib/dados/requerimentos";
import { obterUsuarioAtual, usuarioAtuaComoGabinete } from "@/lib/auth/perfil";
import { PainelRequerimentos } from "@/components/requerimentos/painel-requerimentos";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";

export const dynamic = "force-dynamic";

export default async function PaginaDashboard() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");

  const [requerimentos, secretarias, config, gabinete] = await Promise.all([
    listarRequerimentos(),
    listarSecretarias(),
    obterConfigPrazo(),
    usuarioAtuaComoGabinete(usuario),
  ]);

  return (
    <div className="px-4 sm:px-6">
      <CabecalhoPagina
        titulo="Requerimentos da Câmara"
        subtitulo="Recebidos da Câmara Municipal, distribuídos às secretarias e devolvidos após resposta."
        tamanho="grande"
      />

      <PainelRequerimentos
        requerimentosIniciais={requerimentos}
        secretarias={secretarias}
        config={config}
        usuario={usuario}
        podeDistribuir={gabinete}
      />
    </div>
  );
}
