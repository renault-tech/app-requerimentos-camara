import { criarClienteServidor } from "@/lib/supabase/server";
import type { PerfilUsuario } from "@/types/database";

export type UsuarioComAcesso = {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  secretariaId: string | null;
  ativo: boolean;
  atuaComoGabinete: boolean;
};

export async function listarUsuariosComAcesso(): Promise<UsuarioComAcesso[]> {
  const supabase = await criarClienteServidor();
  const [{ data: usuarios, error: erroUsuarios }, { data: permissoes, error: erroPermissoes }] =
    await Promise.all([
      supabase.from("usuarios").select("*").order("nome"),
      supabase.from("permissoes").select("*").eq("chave", "atua_como_gabinete"),
    ]);

  if (erroUsuarios || erroPermissoes) {
    console.error("[listarUsuariosComAcesso] falha:", erroUsuarios ?? erroPermissoes);
    throw new Error("Não foi possível carregar os usuários.");
  }

  const gabineteExtra = new Set(
    (permissoes ?? []).filter((p) => p.valor).map((p) => p.usuario_id)
  );

  return (usuarios ?? []).map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    secretariaId: u.secretaria_id,
    ativo: u.ativo,
    atuaComoGabinete: gabineteExtra.has(u.id),
  }));
}
