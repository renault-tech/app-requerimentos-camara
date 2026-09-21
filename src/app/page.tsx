import { redirect } from "next/navigation";

import { criarClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PaginaRaiz() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
