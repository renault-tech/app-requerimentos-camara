import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * PDF institucional (papel timbrado): brasão, órgão, título do relatório,
 * metadados de geração e filtros aplicados, tabela e rodapé paginado.
 * Gerado inteiramente no navegador, sem round-trip ao servidor.
 */

const AZUL_MARINHO: [number, number, number] = [12, 29, 51];
const AZUL: [number, number, number] = [37, 99, 168];
const CINZA: [number, number, number] = [100, 116, 139];
const CINZA_CLARO: [number, number, number] = [245, 247, 250];

export type SecaoRelatorioPdf = {
  /** Ex.: "Processos por status". Omitido quando o PDF tem uma única tabela. */
  titulo?: string;
  colunas: string[];
  linhas: string[][];
};

export type OpcoesRelatorioPdf = {
  titulo: string;
  /** Ex.: "Filtros aplicados: Situação: Em andamento · Prioridade: P1" */
  filtrosResumo: string;
  secoes: SecaoRelatorioPdf[];
  nomeArquivo: string;
  orientacao?: "landscape" | "portrait";
};

/**
 * `/logo.png` é um brasão em alta resolução (~1,7 MB) — embedado sem
 * redução, um relatório de uma página passava de 3 MB por causa dele.
 * Redesenha num canvas pequeno antes de exportar: no PDF ele ocupa 15mm,
 * então uns 128px já rendem nítido.
 */
async function carregarLogoBase64(): Promise<string | null> {
  try {
    const resposta = await fetch("/logo.png");
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    const bitmap = await createImageBitmap(blob);
    const tamanho = 128;
    const canvas = document.createElement("canvas");
    canvas.width = tamanho;
    canvas.height = tamanho;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const escala = Math.min(tamanho / bitmap.width, tamanho / bitmap.height);
    const largura = bitmap.width * escala;
    const altura = bitmap.height * escala;
    ctx.drawImage(bitmap, (tamanho - largura) / 2, (tamanho - altura) / 2, largura, altura);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export async function gerarRelatorioPdf(opcoes: OpcoesRelatorioPdf): Promise<void> {
  const { titulo, filtrosResumo, secoes, nomeArquivo, orientacao = "landscape" } = opcoes;
  const doc = new jsPDF({ orientation: orientacao, unit: "mm", format: "a4" });
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const margem = 12;
  const totalRegistros = secoes.reduce((soma, s) => soma + s.linhas.length, 0);

  const logo = await carregarLogoBase64();

  let x = margem;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", x, 8, 15, 15);
      x += 19;
    } catch {
      // formato de imagem inesperado — segue sem o brasão
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(AZUL_MARINHO[0], AZUL_MARINHO[1], AZUL_MARINHO[2]);
  doc.text("PREFEITURA DE CATAGUASES", x, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
  doc.text("Gabinete do Prefeito · Requerimentos da Câmara Municipal", x, 18);

  doc.setDrawColor(AZUL[0], AZUL[1], AZUL[2]);
  doc.setLineWidth(0.6);
  doc.line(margem, 24, larguraPagina - margem, 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(AZUL_MARINHO[0], AZUL_MARINHO[1], AZUL_MARINHO[2]);
  doc.text(titulo, margem, 32);

  const geradoEm = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
  doc.text(
    `Gerado em ${geradoEm} · ${totalRegistros} ${totalRegistros === 1 ? "registro" : "registros"}`,
    margem,
    37.5
  );
  doc.text(filtrosResumo, margem, 42, { maxWidth: larguraPagina - margem * 2 });

  function desenharRodape() {
    const altura = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
    doc.text(
      "Documento gerado eletronicamente pelo sistema de Requerimentos da Câmara — Prefeitura de Cataguases.",
      margem,
      altura - 8
    );
  }

  let y = 47;
  for (const secao of secoes) {
    if (secao.titulo) {
      if (y > alturaPagina - 30) {
        doc.addPage();
        y = margem + 6;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(AZUL_MARINHO[0], AZUL_MARINHO[1], AZUL_MARINHO[2]);
      doc.text(secao.titulo, margem, y);
      y += 5;
    }

    autoTable(doc, {
      head: [secao.colunas],
      body: secao.linhas,
      startY: y,
      margin: { left: margem, right: margem, bottom: 16 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
      headStyles: { fillColor: AZUL_MARINHO, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: CINZA_CLARO },
      didDrawPage: desenharRodape,
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    const altura = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
    doc.text(`Página ${i} de ${totalPaginas}`, larguraPagina - margem, altura - 8, { align: "right" });
  }

  doc.save(nomeArquivo);
}
