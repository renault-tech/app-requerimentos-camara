import { redirect } from "next/navigation";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { listarSecretarias } from "@/lib/dados/requerimentos";
import { listarUsuariosComAcesso } from "@/lib/dados/configuracoes";
import { PainelUsuarios } from "@/components/configuracoes/painel-configuracoes";

export const dynamic = "force-dynamic";

export default async function PaginaUsuarios() {
  const usuario = await obterUsuarioAtual();
  if (usuario?.perfil !== "admin") redirect("/configuracoes");

  const [usuarios, secretarias] = await Promise.all([listarUsuariosComAcesso(), listarSecretarias()]);
  return <PainelUsuarios usuarios={usuarios} secretarias={secretarias} />;
}
