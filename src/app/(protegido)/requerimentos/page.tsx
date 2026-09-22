import { redirect } from "next/navigation";

/**
 * A lista de requerimentos passou a ser o próprio Início (/dashboard) —
 * não faz mais sentido um clique a mais para "ver todos". Rota mantida
 * só como redirecionamento, para não quebrar links/favoritos antigos.
 */
export default function PaginaRequerimentos() {
  redirect("/dashboard");
}
