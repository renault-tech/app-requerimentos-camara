import Link from "next/link";
import { Building2, Gauge, Landmark, Users, type LucideIcon } from "lucide-react";

import { obterUsuarioAtual } from "@/lib/auth/perfil";

export const dynamic = "force-dynamic";

type CardConfig = {
  href: string;
  titulo: string;
  descricao: string;
  Icone: LucideIcon;
  cor: string;
};

/** Índice de Configurações: um card por área (mesmo padrão do Hub e do
 * Compras). O portão de acesso já é feito no `layout.tsx`. */
export default async function PaginaConfiguracoes() {
  const usuario = await obterUsuarioAtual();
  const ehAdmin = usuario?.perfil === "admin";

  const cards: CardConfig[] = [
    {
      href: "/configuracoes/prazo",
      titulo: "Prazo padrão",
      descricao: "Dias do prazo e os limiares de cor da barra de prazo.",
      Icone: Gauge,
      cor: "#D98614",
    },
    {
      href: "/configuracoes/secretarias",
      titulo: "Secretarias",
      descricao: "Catálogo usado para distribuir requerimentos.",
      Icone: Building2,
      cor: "#0D9488",
    },
    {
      href: "/configuracoes/vereadores",
      titulo: "Vereadores",
      descricao: "Lista suspensa do campo Vereador ao cadastrar.",
      Icone: Landmark,
      cor: "#7C3AED",
    },
    ...(ehAdmin
      ? [
          {
            href: "/configuracoes/usuarios",
            titulo: "Usuários",
            descricao: "Perfil, secretaria e gabinete de quem tem acesso. O acesso em si é concedido no Hub.",
            Icone: Users,
            cor: "#639922",
          },
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group rounded-[20px] border border-[rgba(12,29,51,0.07)] bg-white/75 p-[18px] shadow-[0_2px_10px_rgba(12,29,51,0.04)] backdrop-blur-[10px] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cataguases-azul focus-visible:ring-offset-2"
        >
          <span
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px]"
            style={{ backgroundColor: `${card.cor}1F`, color: card.cor }}
          >
            <card.Icone className="h-5 w-5" strokeWidth={1.9} aria-hidden />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-cataguases-marinho">{card.titulo}</p>
          <p className="mt-1 text-[13px] leading-[1.4] text-slate-500">{card.descricao}</p>
        </Link>
      ))}
    </div>
  );
}
