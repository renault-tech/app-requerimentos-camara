import type { Metadata } from "next";
import { Suspense } from "react";

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
      <Suspense fallback={<p className="text-center text-sm text-slate-400">Entrando…</p>}>
        <EntradaViaHub />
      </Suspense>
    </MolduraAuth>
  );
}
