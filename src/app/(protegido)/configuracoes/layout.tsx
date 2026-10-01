import { redirect } from "next/navigation";

import { AbasNavegacao } from "@/components/layout/abas-navegacao";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { obterUsuarioAtual } from "@/lib/auth/perfil";

export const dynamic = "force-dynamic";

/**
 * Área de Configurações: admin e diretor. Usuários é só do admin. Antes era
 * uma única página com tudo empilhado (prazo, secretarias, vereadores,
 * usuários) — para ver os usuários era preciso rolar a tela inteira. Agora
 * segue o mesmo padrão do Hub e do Compras: índice em cards + faixa de
 * abas, uma sub-rota por área.
 */
export default async function LayoutConfiguracoes({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login?ssoFalhou=1");
  if (usuario.perfil !== "admin" && usuario.perfil !== "diretor") redirect("/dashboard");

  const ehAdmin = usuario.perfil === "admin";

  return (
    <div className="space-y-6 px-4 sm:px-6">
      <CabecalhoPagina
        titulo="Configurações"
        subtitulo={`Prazo padrão, secretarias, vereadores${ehAdmin ? " e quem tem acesso" : ""} deste módulo.`}
      />

      <AbasNavegacao
        label="Configurações"
        abas={[
          { href: "/configuracoes/prazo", rotulo: "Prazo padrão" },
          { href: "/configuracoes/secretarias", rotulo: "Secretarias" },
          { href: "/configuracoes/vereadores", rotulo: "Vereadores" },
          ...(ehAdmin ? [{ href: "/configuracoes/usuarios", rotulo: "Usuários" }] : []),
        ]}
      />

      {children}
    </div>
  );
}
