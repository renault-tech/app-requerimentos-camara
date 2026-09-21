import type { CategoriaPrazo } from "@/lib/requerimentos/status";

/**
 * Barra de prazo em dias absolutos: cheia e verde no início, esvazia e
 * muda de cor até quase vazia e vermelha no vencimento. Lógica e valores
 * já validados no mockup "Central Cataguases" antes deste app existir —
 * `min-width` garante uma lâmina visível mesmo em 0%.
 */
export function BarraPrazo({ prazo }: { prazo: CategoriaPrazo }) {
  return (
    <div className="flex min-w-[130px] flex-col gap-1">
      <span className="text-[11px] text-slate-500">{prazo.texto}</span>
      <span className="block h-2.5 overflow-hidden rounded-full bg-slate-200">
        <span
          className="block h-full min-w-[8px] rounded-full transition-[width,background-color] duration-200"
          style={{ width: `${prazo.pctBarra}%`, backgroundColor: prazo.cor }}
        />
      </span>
    </div>
  );
}
