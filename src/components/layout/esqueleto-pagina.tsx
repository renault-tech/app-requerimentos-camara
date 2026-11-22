/** Esqueleto (`loading.tsx`) com a forma da tela de Requerimentos: faixa de números, gráficos à esquerda e a lista ao lado. */
export function EsqueletoPagina() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="h-7 w-64 max-w-full animate-pulse rounded-lg bg-slate-200" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="hidden h-[30rem] animate-pulse rounded-2xl border border-slate-200 bg-slate-100 lg:block" />
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-[4.5rem] animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
