import Link from "next/link";
import { AlertTriangle, ArrowRightCircle, CheckCheck, FileStack, Hourglass, Inbox } from "lucide-react";

import { listarRequerimentos } from "@/lib/dados/requerimentos";
import {
  COR_FASE,
  COR_FASE_VIVA,
  ROTULO_FASE,
  COR_ATRASADO,
  COR_ATRASADO_VIVA,
} from "@/lib/requerimentos/cores-fase";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";

export const dynamic = "force-dynamic";

export default async function PaginaDashboard() {
  const requerimentos = await listarRequerimentos();

  const total = requerimentos.length;
  const aguardando = requerimentos.filter((r) => r.fase === "aguardando").length;
  const emAndamento = requerimentos.filter((r) => r.fase === "distribuido").length;
  const respondidos = requerimentos.filter((r) => r.fase === "respondido").length;
  const devolvidos = requerimentos.filter((r) => r.fase === "devolvido").length;
  const atrasados = requerimentos.filter((r) => r.atrasado).length;

  const cartoes = [
    { rotulo: "Total", valor: total, cor: "#0C1D33", corNumero: "#0C1D33", Icone: FileStack },
    {
      rotulo: "Atrasados",
      valor: atrasados,
      cor: COR_ATRASADO_VIVA,
      corNumero: COR_ATRASADO,
      Icone: AlertTriangle,
    },
    {
      rotulo: ROTULO_FASE.aguardando,
      valor: aguardando,
      cor: COR_FASE_VIVA.aguardando,
      corNumero: COR_FASE.aguardando,
      Icone: Inbox,
    },
    {
      rotulo: ROTULO_FASE.distribuido,
      valor: emAndamento,
      cor: COR_FASE_VIVA.distribuido,
      corNumero: COR_FASE.distribuido,
      Icone: Hourglass,
    },
    {
      rotulo: ROTULO_FASE.respondido,
      valor: respondidos,
      cor: COR_FASE_VIVA.respondido,
      corNumero: COR_FASE.respondido,
      Icone: ArrowRightCircle,
    },
    {
      rotulo: ROTULO_FASE.devolvido,
      valor: devolvidos,
      cor: COR_FASE_VIVA.devolvido,
      corNumero: COR_FASE.devolvido,
      Icone: CheckCheck,
    },
  ];

  return (
    <div className="space-y-5 px-4 sm:px-6">
      <CabecalhoPagina
        titulo="Início"
        subtitulo="Visão geral dos requerimentos enviados pela Câmara Municipal."
        tamanho="grande"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cartoes.map((c) => (
          <div
            key={c.rotulo}
            className="group relative flex flex-col items-start overflow-hidden rounded-2xl border border-[rgba(12,29,51,0.08)] bg-white/70 p-4 text-left shadow-[0_2px_8px_rgba(12,29,51,0.04)] backdrop-blur-[10px]"
          >
            <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: c.cor }} />
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${c.cor}1F`, color: c.corNumero }}
            >
              <c.Icone className="h-[18px] w-[18px]" strokeWidth={2.1} aria-hidden />
            </span>
            <p
              className="mt-3 text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums"
              style={{ color: c.corNumero }}
            >
              {c.valor}
            </p>
            <p className="mt-1.5 text-[12.5px] font-medium leading-snug text-slate-500">{c.rotulo}</p>
          </div>
        ))}
      </div>

      <Link
        href="/requerimentos"
        className="inline-block rounded-md bg-cataguases-marinho px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cataguases-marinho-2"
      >
        Ver todos os requerimentos
      </Link>
    </div>
  );
}
