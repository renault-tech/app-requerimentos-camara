"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";

import { URL_HUB } from "@/lib/hub/url";
import { criarClienteHubNavegador, type AvisoHub } from "@/lib/supabase/hub-navegador";
import { cn } from "@/lib/utils";

function haQuanto(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/**
 * Sino de avisos do Requerimentos, ao vivo (Supabase Realtime em
 * `hub.notificacoes`, a mesma tabela do sino da Central). Quando chega um
 * aviso, a lista de requerimentos também se atualiza sozinha
 * (`router.refresh()`) — a ciência/resposta aparece sem recarregar a página.
 */
export function SinoRequerimentos({ usuarioId }: { usuarioId: string }) {
  const router = useRouter();
  const [lista, setLista] = React.useState<AvisoHub[]>([]);
  const [aberto, setAberto] = React.useState(false);
  const [novo, setNovo] = React.useState<AvisoHub | null>(null);
  const caixa = React.useRef<HTMLDivElement>(null);
  const cliente = React.useMemo(() => criarClienteHubNavegador(), []);

  const recarregar = React.useCallback(async () => {
    const { data } = await cliente
      .from("notificacoes")
      .select("id, app, tipo, titulo, mensagem, link, criado_em, lida_em")
      .eq("app", "requerimentos")
      .order("criado_em", { ascending: false })
      .limit(30);
    setLista((data as AvisoHub[] | null) ?? []);
  }, [cliente]);

  React.useEffect(() => {
    let canal: ReturnType<typeof cliente.channel> | null = null;
    let ativo = true;
    (async () => {
      await recarregar();
      const { data } = await cliente.auth.getSession();
      if (!ativo) return;
      if (data.session) cliente.realtime.setAuth(data.session.access_token);
      canal = cliente
        .channel(`avisos-requerimentos-${usuarioId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "hub", table: "notificacoes", filter: `destinatario_id=eq.${usuarioId}` },
          (payload) => {
            const aviso = payload.new as AvisoHub;
            if (aviso.app !== "requerimentos") return;
            setNovo(aviso);
            void recarregar();
            router.refresh();
          }
        )
        .subscribe();
    })();
    return () => {
      ativo = false;
      if (canal) void cliente.removeChannel(canal);
    };
  }, [cliente, recarregar, router, usuarioId]);

  React.useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  React.useEffect(() => {
    if (!novo) return;
    const t = setTimeout(() => setNovo(null), 7000);
    return () => clearTimeout(t);
  }, [novo]);

  async function marcar(ids: string[] | null) {
    setLista((l) => l.map((n) => (!n.lida_em && (!ids || ids.includes(n.id)) ? { ...n, lida_em: new Date().toISOString() } : n)));
    await cliente.rpc("marcar_notificacoes_lidas", { p_ids: ids, p_app: "requerimentos" });
  }

  function abrir(n: AvisoHub) {
    void marcar([n.id]);
    setAberto(false);
    setNovo(null);
    if (n.link) router.push(n.link);
  }

  const naoLidas = lista.filter((n) => !n.lida_em).length;

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={naoLidas > 0 ? `Avisos: ${naoLidas} não lido(s)` : "Avisos"}
        aria-expanded={aberto}
      >
        <Bell className={cn("h-[18px] w-[18px]", novo && "animate-pulse")} aria-hidden />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C63B22] px-1 text-[10px] font-semibold text-white ring-2 ring-cataguases-marinho">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-cataguases-marinho">Avisos</p>
            {naoLidas > 0 && (
              <button type="button" onClick={() => void marcar(null)} className="text-xs font-medium text-cataguases-azul hover:underline">
                Marcar todas como lidas
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {lista.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Nenhum aviso por enquanto.</li>}
            {lista.map((n) => (
              <li key={n.id} className="border-b border-slate-100 last:border-0">
                <button
                  type="button"
                  onClick={() => abrir(n)}
                  className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50", !n.lida_em && "bg-amber-50/50")}
                >
                  <span className={cn("mt-1.5 h-2 w-2 flex-none rounded-full", n.lida_em ? "bg-slate-300" : "bg-[#C63B22]")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-500">{haQuanto(n.criado_em)}</span>
                    <span className={cn("mt-0.5 block text-[13px]", !n.lida_em ? "font-semibold text-cataguases-marinho" : "text-slate-700")}>
                      {n.titulo}
                    </span>
                    {n.mensagem && <span className="mt-0.5 block truncate text-xs text-slate-500">{n.mensagem}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <a href={URL_HUB} className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs text-cataguases-azul hover:bg-slate-50">
            Avisos de todos os módulos na Central →
          </a>
        </div>
      )}

      {novo && !aberto && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-slate-800 shadow-2xl"
        >
          <span className="mt-1 h-2.5 w-2.5 flex-none rounded-full bg-[#C63B22]" aria-hidden />
          <button type="button" onClick={() => abrir(novo)} className="min-w-0 flex-1 text-left">
            <span className="block text-[11px] font-semibold text-[#C63B22]">Novo aviso</span>
            <span className="mt-0.5 block text-sm font-semibold text-cataguases-marinho">{novo.titulo}</span>
            {novo.mensagem && <span className="mt-0.5 block truncate text-xs text-slate-500">{novo.mensagem}</span>}
          </button>
          <button type="button" onClick={() => setNovo(null)} className="text-slate-400 hover:text-slate-600" aria-label="Fechar aviso">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
