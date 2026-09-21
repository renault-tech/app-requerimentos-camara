import { listarRequerimentos, listarSecretarias, obterConfigPrazo } from "@/lib/dados/requerimentos";
import { obterUsuarioAtual, usuarioAtuaComoGabinete } from "@/lib/auth/perfil";
import { PainelRequerimentos } from "@/components/requerimentos/painel-requerimentos";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PaginaRequerimentos() {
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
      <h1 className="text-xl font-semibold text-cataguases-marinho">Requerimentos da Câmara</h1>
      <p className="mt-1 text-sm text-slate-500">
        Recebidos da Câmara Municipal, distribuídos às secretarias e devolvidos após resposta.
      </p>

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
