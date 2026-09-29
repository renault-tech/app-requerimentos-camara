import type { Metadata } from "next";

import { MolduraAuth } from "@/components/auth/moldura-auth";
import { EntradaViaHub } from "@/components/auth/entrada-via-hub";

export const metadata: Metadata = {
  title: "Entrando… · Requerimentos da Câmara",
  description: "Entrada via Central Cataguases.",
};

export const dynamic = "force-dynamic";

export default function PaginaEntrarViaHub() {
  return (
    <MolduraAuth
      titulo="Entrando pela Central Cataguases"
      subtitulo="Aguarde um instante, você já está sendo autenticado"
    >
      <EntradaViaHub />
    </MolduraAuth>
  );
}
