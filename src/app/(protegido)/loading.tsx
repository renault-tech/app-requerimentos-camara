import { EsqueletoPagina } from "@/components/layout/esqueleto-pagina";
import { CarregandoLento } from "@/components/modulo/estados-tela";

export default function Carregando() {
  return (
    <>
      <CarregandoLento />
      <EsqueletoPagina />
    </>
  );
}
