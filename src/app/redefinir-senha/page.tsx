import type { Metadata } from "next";

import { MolduraAuth } from "@/components/auth/moldura-auth";
import { GuardaRecuperacao } from "@/components/auth/guarda-recuperacao";
import { FormularioRedefinir } from "@/components/redefinir-form";

export const metadata: Metadata = {
  title: "Redefinir senha · Requerimentos da Câmara",
  description: "Definição de nova senha da plataforma de requerimentos da Câmara de Cataguases.",
};

export const dynamic = "force-dynamic";

export default function PaginaRedefinirSenha() {
  return (
    <MolduraAuth
      titulo="Definir nova senha"
      subtitulo="Escolha uma nova senha para a sua conta"
    >
      <GuardaRecuperacao>
        <FormularioRedefinir />
      </GuardaRecuperacao>
    </MolduraAuth>
  );
}
