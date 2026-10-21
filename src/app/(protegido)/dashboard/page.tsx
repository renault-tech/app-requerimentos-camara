import { redirect } from "next/navigation";

import { listarRequerimentos, listarSecretarias, listarVereadores, obterConfigPrazo } from "@/lib/dados/requerimentos";
import { obterUsuarioAtual, usuarioAtuaComoGabinete } from "@/lib/auth/perfil";
import { PainelRequerimentos } from "@/components/requerimentos/painel-requerimentos";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";

export const dynamic = "force-dynamic";

export default async function PaginaDashboard({ searchParams }: { searchParams: Promise<{ req?: string }> }) {
  const { req } = await searchParams;
  // `?req=<id>`: vindo de um aviso — abre direto o requerimento.
  const abrirId = req && /^[0-9a-f-]{36}$/i.test(req) ? req : undefined;
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login?ssoFalhou=1");

  const [requerimentos, secretarias, vereadores, config, gabinete] = await Promise.all([
    listarRequerimentos(),
    listarSecretarias(),
    listarVereadores(),
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
        key={abrirId ?? "lista"}
        abrirId={abrirId}
        requerimentosIniciais={requerimentos}
        secretarias={secretarias}
        vereadores={vereadores}
        config={config}
        usuario={usuario}
        podeDistribuir={gabinete}
      />
    </div>
  );
}
