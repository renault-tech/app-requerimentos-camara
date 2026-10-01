import { listarVereadores } from "@/lib/dados/requerimentos";
import { PainelVereadores } from "@/components/configuracoes/painel-configuracoes";

export const dynamic = "force-dynamic";

export default async function PaginaVereadores() {
  return <PainelVereadores vereadores={await listarVereadores()} />;
}
