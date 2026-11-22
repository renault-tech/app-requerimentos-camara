import { redirect } from "next/navigation";

import { listarRequerimentos, listarSecretarias, listarVereadores, obterConfigPrazo } from "@/lib/dados/requerimentos";
import { obterUsuarioAtual, usuarioAtuaComoGabinete } from "@/lib/auth/perfil";
import { AreaRequerimentos } from "@/components/requerimentos/area-requerimentos";
import { montarLinhas } from "@/lib/requerimentos/area-trabalho";

export const dynamic = "force-dynamic";

export default async function PaginaDashboard({ searchParams }: { searchParams: Promise<{ req?: string }> }) {
  const { req } = await searchParams;
  // `?req=<id>`: link dos avisos de antes. A tela agora guarda o requerimento aberto em `?e=<id>`.
  if (req && /^[0-9a-f-]{36}$/i.test(req)) redirect(`/dashboard?e=${req}`);
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
    <AreaRequerimentos
      linhas={montarLinhas(requerimentos)}
      secretarias={secretarias}
      vereadores={vereadores}
      config={config}
      usuario={usuario}
      podeDistribuir={gabinete}
    />
  );
}
