import type { Metadata } from "next";

import { MolduraAuth } from "@/components/auth/moldura-auth";
import { FormularioRecuperacao } from "@/components/recuperar-form";

export const metadata: Metadata = {
  title: "Recuperar senha · Requerimentos da Câmara",
  description: "Recuperação de senha da plataforma de requerimentos da Câmara de Cataguases.",
};

export const dynamic = "force-dynamic";

export default function PaginaRecuperarSenha() {
  return (
    <MolduraAuth
      titulo="Recuperar senha"
      subtitulo="Enviaremos um link de redefinição para o seu e-mail"
    >
      <FormularioRecuperacao />
    </MolduraAuth>
  );
}
