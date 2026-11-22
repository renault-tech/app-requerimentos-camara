/** Esqueleto mostrado enquanto uma página dinâmica carrega (`loading.tsx`): a mesma estrutura da lista, sem dados. */
export function EsqueletoPagina() {
  return (
    <div className="px-4 sm:px-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-[6.25rem] animate-pulse rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <div className="mt-4 h-14 animate-pulse rounded-xl bg-slate-200/60" />
      <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
