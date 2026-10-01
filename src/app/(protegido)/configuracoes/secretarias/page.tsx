import { listarSecretarias } from "@/lib/dados/requerimentos";
import { PainelSecretarias } from "@/components/configuracoes/painel-configuracoes";

export const dynamic = "force-dynamic";

export default async function PaginaSecretarias() {
  return <PainelSecretarias secretarias={await listarSecretarias()} />;
}
