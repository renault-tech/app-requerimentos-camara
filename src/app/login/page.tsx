import type { Metadata } from "next";
import { Suspense } from "react";

import { MolduraAuth } from "@/components/auth/moldura-auth";
import { FormularioLogin } from "@/components/login-form";
import { criarClienteHub } from "@/lib/supabase/hub-cliente";

const URL_CENTRAL_CATAGUASES = "https://centraltech-liard.vercel.app";

export const metadata: Metadata = {
  title: "Entrar · Requerimentos da Câmara",
  description: "Acesso à plataforma de requerimentos da Câmara Municipal de Cataguases.",
};

export const dynamic = "force-dynamic";

const MENSAGENS: Record<string, string> = {
  desativado: "Sua conta foi desativada. Contate o administrador da plataforma.",
  link_invalido: "O link de recuperação é inválido ou expirou. Solicite um novo abaixo.",
  senha_redefinida: "Senha redefinida com sucesso. Entre com a sua nova senha.",
};

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const bloqueado = await loginDiretoBloqueado();

  return (
    <MolduraAuth
      titulo="Entrar na plataforma"
      subtitulo="Prefeitura de Cataguases · Gabinete do Prefeito"
    >
      {bloqueado ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-200">
            O login direto foi desativado. Acesse pela Central Cataguases.
          </p>
          <a
            href={`${URL_CENTRAL_CATAGUASES}?origem=requerimentos`}
            className="inline-block w-full rounded-md bg-cataguases-dourado px-4 py-2.5 text-sm font-medium text-cataguases-marinho transition-colors hover:bg-cataguases-dourado/90"
          >
            Ir para a Central Cataguases
          </a>
        </div>
      ) : (
        <Suspense fallback={<div className="h-[220px] w-full" />}>
          <MensagemMotivo searchParams={searchParams} />
          <FormularioLogin />
        </Suspense>
      )}
    </MolduraAuth>
  );
}

/** Central Cataguases → Configurações → Login direto por aplicativo. Nunca
 * bloqueia o próprio login se a checagem falhar OU demorar (rede, schema
 * hub fora do ar) — o padrão seguro é continuar permitindo o login direto.
 * Timeout curto de propósito: esta checagem roda em TODA tentativa de
 * login, então uma lentidão no projeto compartilhado nunca pode travar o
 * login de ninguém aqui. */
async function loginDiretoBloqueado(): Promise<boolean> {
  try {
    const consulta = criarClienteHub().rpc("esta_bloqueado_login_direto", { p_modulo: "requerimentos" });
    const resultado = await Promise.race([
      consulta,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    if (!resultado) {
      console.error("[loginDiretoBloqueado] timeout ao checar — seguindo com login direto liberado");
      return false;
    }
    const { data, error } = resultado;
    if (error) {
      console.error("[loginDiretoBloqueado] falha ao checar:", error);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("[loginDiretoBloqueado] falha inesperada:", e);
    return false;
  }
}

async function MensagemMotivo({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const mensagem = motivo ? MENSAGENS[motivo] : undefined;

  if (!mensagem) {
    return null;
  }

  const ehSucesso = motivo === "senha_redefinida";
  return (
    <p
      role="alert"
      className={
        ehSucesso
          ? "mb-4 rounded-md border border-semaforo-verde/40 bg-semaforo-verde/10 px-3 py-2 text-sm text-green-100"
          : "mb-4 rounded-md border border-semaforo-vermelho/40 bg-semaforo-vermelho/10 px-3 py-2 text-sm text-red-100"
      }
    >
      {mensagem}
    </p>
  );
}
