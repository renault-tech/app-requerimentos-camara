import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";

import { obterUsuarioAtual, usuarioAtuaComoGabinete, RUTULO_PERFIL } from "@/lib/auth/perfil";
import { Brasao } from "@/components/brasao";
import { sair } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { URL_HUB } from "@/lib/hub/url";

export default async function LayoutProtegido({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioAtual();
  if (!usuario) {
    redirect("/login");
  }
  if (!usuario.ativo) {
    redirect("/login?motivo=desativado");
  }

  const podeConfigurar = usuario.perfil === "admin" || usuario.perfil === "diretor";
  const gabinete = await usuarioAtuaComoGabinete(usuario);

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-cataguases-marinho px-4 py-3 text-white sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-85">
          <Brasao tamanho={32} />
          <div>
            <p className="text-sm font-semibold leading-tight">Requerimentos da Câmara</p>
            <p className="text-[11px] leading-tight text-slate-300">
              Prefeitura de Cataguases · Gabinete do Prefeito
            </p>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link
            href={URL_HUB}
            title="Central Cataguases"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Central Cataguases</span>
          </Link>
          <span className="mx-1 hidden h-4 w-px bg-white/15 sm:inline-block" aria-hidden />
          <Link
            href="/dashboard"
            className="rounded-md px-2.5 py-1.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            Início
          </Link>
          {podeConfigurar && (
            <Link
              href="/configuracoes"
              className="rounded-md px-2.5 py-1.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              Configurações
            </Link>
          )}
          <span className="ml-2 hidden text-xs text-slate-400 sm:inline">
            {usuario.nome} · {RUTULO_PERFIL[usuario.perfil]}
            {gabinete && usuario.perfil === "secretaria" ? " (gabinete)" : ""}
          </span>
          <form action={sair}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-slate-200 hover:bg-white/10 hover:text-white"
            >
              Sair
            </Button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-[min(94%,1400px)] py-6">{children}</main>
    </div>
  );
}
