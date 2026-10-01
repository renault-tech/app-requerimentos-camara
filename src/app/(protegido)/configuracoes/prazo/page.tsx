import { obterConfigPrazo } from "@/lib/dados/requerimentos";
import { PainelPrazo } from "@/components/configuracoes/painel-configuracoes";

export const dynamic = "force-dynamic";

export default async function PaginaPrazo() {
  return <PainelPrazo config={await obterConfigPrazo()} />;
}
