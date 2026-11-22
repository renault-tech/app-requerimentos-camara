"use client";

import { Button } from "@/components/ui/button";

/** Falha ao carregar uma tela: mensagem clara e "Tentar de novo" sem perder o cabeçalho. O texto da exceção só aparece em desenvolvimento. */
export default function ErroDaTela({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="px-4 py-12 text-center sm:px-6" role="alert">
      <h1 className="text-xl font-semibold text-cataguases-marinho">Não foi possível carregar esta tela</h1>
      <p className="mt-2 text-sm text-slate-600">Confira a conexão e tente de novo. Se continuar, avise a coordenação.</p>
      {error.digest && <p className="mt-1 text-xs text-slate-400">ERR-{error.digest}</p>}
      {process.env.NODE_ENV === "development" && <p className="mt-2 text-xs text-slate-500">{error.message}</p>}
      <Button className="mt-5" onClick={reset}>
        Tentar de novo
      </Button>
    </div>
  );
}
