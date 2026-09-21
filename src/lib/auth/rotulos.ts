import type { Usuario } from "@/types/database";

/**
 * Módulo sem dependências de servidor (sem next/headers), para poder ser
 * importado por Client Components. `src/lib/auth/perfil.ts` reexporta isto.
 */
export const RUTULO_PERFIL: Record<Usuario["perfil"], string> = {
  admin: "Admin",
  diretor: "Diretor",
  gabinete: "Gabinete do Prefeito",
  secretaria: "Secretaria",
};

/** Perfis sem `secretaria_id` (não pertencem a uma secretaria específica). */
export const PERFIS_SEM_SECRETARIA: Usuario["perfil"][] = ["admin", "diretor", "gabinete"];
