/**
 * Template (recriado a cada navegação): reinicia a animação de entrada das seções da tela, como nos demais módulos.
 * As seções (filhas do elemento raiz de cada tela) entram em sequência (CSS `.emd-pagina`), respeitando `prefers-reduced-motion`.
 */
export default function TemplateProtegido({ children }: { children: React.ReactNode }) {
  return <div className="emd-pagina">{children}</div>;
}
