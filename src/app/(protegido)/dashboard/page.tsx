import Link from "next/link";

import { listarRequerimentos } from "@/lib/dados/requerimentos";

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
    { rotulo: "Total", valor: total, cor: "#0C1D33" },
    { rotulo: "Atrasados", valor: atrasados, cor: "#E24B4A" },
    { rotulo: "Aguardando distribuição", valor: aguardando, cor: "#378ADD" },
    { rotulo: "Em andamento", valor: emAndamento, cor: "#EF9F27" },
    { rotulo: "Prontos p/ devolver", valor: respondidos, cor: "#639922" },
    { rotulo: "Devolvidos", valor: devolvidos, cor: "#94A3B8" },
  ];

  return (
    <div className="px-4 sm:px-6">
      <h1 className="text-xl font-semibold text-cataguases-marinho">Início</h1>
      <p className="mt-1 text-sm text-slate-500">
        Visão geral dos requerimentos enviados pela Câmara Municipal.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cartoes.map((c) => (
          <div
            key={c.rotulo}
            className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm"
            style={{ borderTopColor: c.cor, borderTopWidth: 3 }}
          >
            <p className="text-2xl font-semibold" style={{ color: c.cor }}>
              {c.valor}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{c.rotulo}</p>
          </div>
        ))}
      </div>

      <Link
        href="/requerimentos"
        className="mt-6 inline-block rounded-md bg-cataguases-marinho px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cataguases-marinho-2"
      >
        Ver todos os requerimentos
      </Link>
    </div>
  );
}
