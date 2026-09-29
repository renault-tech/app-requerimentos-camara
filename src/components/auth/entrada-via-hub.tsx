"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { criarClienteNavegador } from "@/lib/supabase/client";

type Estado = "entrando" | "invalido";

/**
 * Destino do link mágico de SSO gerado pelo Hub (`centraltech`,
 * `abrirModulo`/`generateLink({type:"magiclink"})`). O link entrega a
 * sessão como FRAGMENTO da URL (`#access_token=...`), que só o navegador lê
 * — por isso esta é uma página de CLIENTE, não uma rota de servidor. O
 * cliente do navegador (`criarClienteNavegador`, `detectSessionInUrl`
 * ligado por padrão) processa o fragmento sozinho ao montar e sincroniza a
 * sessão nos cookies; daí em diante o servidor enxerga a sessão
 * normalmente, sem passar senha alguma de novo. Mesmo componente já usado
 * no App-Compras (mesmo projeto Supabase, schema diferente).
 */
export function EntradaViaHub() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("entrando");

  useEffect(() => {
    const supabase = criarClienteNavegador();
    let ativo = true;

    function irParaOPainel() {
      if (ativo) router.replace("/dashboard");
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) irParaOPainel();
    });

    const { data: assinatura } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (!ativo) return;
      if (evento === "SIGNED_IN" && sessao) {
        irParaOPainel();
      }
    });

    const tempoLimite = setTimeout(() => {
      setEstado((atual) => (atual === "entrando" ? "invalido" : atual));
    }, 6000);

    return () => {
      ativo = false;
      assinatura.subscription.unsubscribe();
      clearTimeout(tempoLimite);
    };
  }, [router]);

  if (estado === "invalido") {
    return (
      <div className="space-y-3 text-center">
        <p
          role="alert"
          className="rounded-md border border-semaforo-vermelho/40 bg-semaforo-vermelho/10 px-3 py-2 text-sm text-red-100"
        >
          Não foi possível entrar automaticamente pela Central Cataguases. O link pode ter
          expirado.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-cataguases-dourado underline underline-offset-2 hover:text-cataguases-dourado/80"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return <p className="text-center text-sm text-slate-400">Entrando…</p>;
}
