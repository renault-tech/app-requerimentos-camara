import Link from "next/link";
import { ArrowLeft, LogOut, Settings } from "lucide-react";

import { Brasao } from "@/components/brasao";
import { AlternarTema } from "@/components/layout/alternar-tema";
import { BotaoFeedback } from "@/components/feedback/botao-feedback";
import { CLASSE_LINK_CABECALHO } from "@/components/layout/cabecalho-estilos";
import { SinoRequerimentos } from "@/components/notificacoes/sino";
import { sair } from "@/lib/actions/auth";
import { URL_HUB } from "@/lib/hub/url";

export function CabecalhoRequerimentos({
  usuario,
  detalhe,
  podeConfigurar,
}: {
  usuario: { id: string; nome: string };
  /** Perfil (e "gabinete"), mostrado ao passar o mouse no nome. */
  detalhe: string;
  podeConfigurar: boolean;
}) {
  // Cabeçalho padrão da Central (o mesmo de todos os módulos): brasão, "← Central" e o nome do
  // módulo com a cor dele à esquerda; à direita, nesta ordem: links do app · avisos → feedback ·
  // usuário → Sair. Controles de 40 px (44 px no celular) e foco dourado.
  return (
    <header className="cabecalho-escuro tema-fixo sticky top-0 z-30 border-b border-t-[3px] border-b-slate-200 border-t-[#C63B22] bg-cataguases-marinho text-white">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/dashboard" aria-label="Requerimentos da Câmara, início" className="rounded-lg p-0.5 transition-opacity duration-200 hover:opacity-85">
            <Brasao tamanho={32} />
          </Link>
          <a href={URL_HUB} aria-label="Voltar para a Central" className={`${CLASSE_LINK_CABECALHO} border border-white/20 pl-2.5`}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Central
          </a>
          <span aria-hidden className="hidden h-6 w-px bg-white/20 sm:block" />
          <p className="flex min-w-0 items-center gap-2 text-base font-semibold leading-tight">
            <span aria-hidden className="h-2.5 w-2.5 flex-none rounded-full bg-[#C63B22]" />
            <span className="truncate sm:hidden">Requerimentos</span>
            <span className="hidden truncate sm:inline">Requerimentos da Câmara</span>
          </p>
        </div>
        <nav aria-label="Seções, avisos e conta" className="flex flex-wrap items-center justify-end gap-0.5 sm:gap-1">
          <Link href="/dashboard" className={CLASSE_LINK_CABECALHO}>
            Início
          </Link>
          {podeConfigurar && (
            <Link href="/configuracoes" className={CLASSE_LINK_CABECALHO}>
              <Settings className="h-5 w-5 md:hidden" aria-hidden strokeWidth={1.8} />
              <span className="sr-only md:not-sr-only">Configurações</span>
            </Link>
          )}
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
          <SinoRequerimentos usuarioId={usuario.id} />
          <BotaoFeedback />
          <AlternarTema />
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
          <span
            className="hidden max-w-[14rem] truncate px-2 text-sm text-slate-200 sm:inline"
            title={`${usuario.nome} · ${detalhe}`}
          >
            {usuario.nome}
          </span>
          <form action={sair}>
            <button type="submit" className={CLASSE_LINK_CABECALHO}>
              <LogOut className="h-5 w-5 sm:hidden" aria-hidden strokeWidth={1.8} />
              <span className="sr-only sm:not-sr-only">Sair</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
