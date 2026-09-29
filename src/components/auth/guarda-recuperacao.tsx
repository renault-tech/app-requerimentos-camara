"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

import { criarClienteNavegador } from "@/lib/supabase/client";

type Estado = "verificando" | "pronto" | "invalido";

/**
 * Guarda a página `/redefinir-senha`: o link do e-mail chega com a sessão de
 * recuperação como FRAGMENTO da URL (`#access_token=...`), que só o
 * navegador consegue ler — nunca chega ao servidor (ver comentário em
 * `solicitarRecuperacao`, `src/lib/actions/auth.ts`). Mesma implementação
 * já validada no App-Compras e no centraltech: o cliente Supabase do
 * navegador (`criarClienteNavegador`, `detectSessionInUrl` ligado por
 * padrão) lê o fragmento sozinho ao montar — sincroniza a sessão nos
 * cookies, e daí em diante o servidor enxerga a sessão normalmente. Este
 * componente só espera esse processamento terminar antes de mostrar o
 * formulário.
 */
export function GuardaRecuperacao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>("verificando");

  useEffect(() => {
    const supabase = criarClienteNavegador();
    let ativo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (ativo && data.session) setEstado("pronto");
    });

    const { data: assinatura } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (!ativo) return;
      if (evento === "PASSWORD_RECOVERY" || (evento === "SIGNED_IN" && sessao)) {
        setEstado("pronto");
      }
    });

    const tempoLimite = setTimeout(() => {
      setEstado((atual) => (atual === "verificando" ? "invalido" : atual));
    }, 6000);

    return () => {
      ativo = false;
      assinatura.subscription.unsubscribe();
      clearTimeout(tempoLimite);
    };
  }, []);

  if (estado === "verificando") {
    return <p className="text-sm text-slate-400">Validando o link do e-mail…</p>;
  }

  if (estado === "invalido") {
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="rounded-md border border-semaforo-vermelho/40 bg-semaforo-vermelho/10 px-3 py-2 text-sm text-red-100"
        >
          Este link de recuperação é inválido ou já expirou.
        </p>
        <Link
          href="/recuperar-senha"
          className="inline-block text-sm font-medium text-cataguases-dourado underline underline-offset-2 hover:text-cataguases-dourado/80"
        >
          Solicitar um novo link
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
