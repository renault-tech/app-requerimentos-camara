/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Cache do roteador no navegador: voltar a uma tela já aberta (Início ↔ Configurações) aparece na hora em vez de refazer as
    // consultas. Toda gravação (Server Action com revalidatePath) e todo `router.refresh()` (inclusive o dos avisos ao vivo)
    // esvaziam esse cache; o prazo curto só limita quanto uma mudança feita por OUTRA pessoa sem aviso demora a aparecer.
    staleTimes: { dynamic: 30, static: 300 },
  },
};

export default nextConfig;
