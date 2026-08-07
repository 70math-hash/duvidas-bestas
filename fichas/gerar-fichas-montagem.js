const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, PageBreak,
  Table, TableRow, TableCell, WidthType, HeightRule,
  BorderStyle, TabStopType, VerticalAlign,
} = require("docx");

// ---- Marca QT ----------------------------------------------------------
const PRETO  = "1A1E1E";
const CINZA  = "A0A5A5";
const FONTE  = "Helvetica"; // fallback automatico p/ Arial no Windows

// ---- Geometria A4 (twips: 1440 = 1 pol) --------------------------------
const PAG_L = 11906, PAG_A = 16838;
const MARGEM = 400;                       // ~7 mm
const LARG_UTIL = PAG_L - MARGEM * 2;     // 11106
const COLS = 3, ROWS = 5;
const COL_L = LARG_UTIL / COLS;           // 3702  (~65 mm)
const ROW_A = 3100;                       // ~54,7 mm — travado (EXACT)
const LINHAS_ESCRITA = 8;
const ALT_LINHA = 310;

const semBorda = { style: BorderStyle.NONE, size: 0, color: "auto" };

// Cabecalho compacto da pagina
function cabecalho(pagina) {
  return new Paragraph({
    spacing: { before: 0, after: 140, line: 260, lineRule: "exact" },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRETO, space: 4 } },
    tabStops: [{ type: TabStopType.RIGHT, position: LARG_UTIL }],
    children: [
      new TextRun({ text: "QT PIZZA BAR", font: FONTE, size: 18, bold: true, color: PRETO, characterSpacing: 24 }),
      new TextRun({ text: "   FICHAS DE MONTAGEM", font: FONTE, size: 14, color: CINZA, characterSpacing: 20 }),
      new TextRun({ text: `\t0${pagina} / 02`, font: FONTE, size: 14, color: CINZA, characterSpacing: 20 }),
    ],
  });
}

// Conteudo de uma ficha: faixa do nome + linhas pautadas
function conteudoFicha(demo) {
  const filhos = [
    new Paragraph({
      spacing: { before: 0, after: 60, line: 250, lineRule: "exact" },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRETO, space: 1 } },
      children: [new TextRun({
        text: demo ? demo.nome : "NOME DA PIZZA",
        font: FONTE, size: 18, bold: true, color: demo ? PRETO : CINZA, characterSpacing: 16,
      })],
    }),
  ];
  for (let i = 0; i < LINHAS_ESCRITA; i++) {
    // 'between' e obrigatorio: paragrafos consecutivos com bordas identicas
    // sao fundidos num unico bloco, e so a borda externa seria desenhada.
    filhos.push(new Paragraph({
      // space: 0 — qualquer padding aqui e multiplicado por 8 e estoura a celula
      spacing: { before: 0, after: 0, line: ALT_LINHA, lineRule: "exact" },
      border: {
        bottom:  { style: BorderStyle.SINGLE, size: 2, color: CINZA, space: 0 },
        between: { style: BorderStyle.SINGLE, size: 2, color: CINZA, space: 0 },
      },
      children: [new TextRun({
        text: demo && demo.linhas[i] ? demo.linhas[i] : "",
        font: FONTE, size: 16, color: PRETO,
      })],
    }));
  }
  return filhos;
}

// Preenchimento de teste (nao entra no arquivo entregue)
const DEMO = process.argv[3] === "demo" ? {
  nome: "MARGHERITA",
  linhas: [
    "Molho de tomate  80 g",
    "Fior di latte  90 g",
    "Grana Padano  5 g",
    "Manjericao fresco  4 folhas",
    "Azeite EVO  4 ml (pos-forno)",
    "Forno 450 C / 90 s",
    "Girar aos 45 s",
    "Manjericao entra na saida",
  ],
} : null;

function grade() {
  const linhas = [];
  for (let r = 0; r < ROWS; r++) {
    const celulas = [];
    for (let c = 0; c < COLS; c++) {
      celulas.push(new TableCell({
        width: { size: COL_L, type: WidthType.DXA },
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 85, bottom: 57, left: 113, right: 113 },
        borders: {
          top:    { style: BorderStyle.SINGLE, size: r === 0 ? 6 : 4, color: r === 0 ? PRETO : CINZA },
          bottom: { style: BorderStyle.SINGLE, size: r === ROWS - 1 ? 6 : 4, color: r === ROWS - 1 ? PRETO : CINZA },
          left:   { style: BorderStyle.SINGLE, size: c === 0 ? 6 : 4, color: c === 0 ? PRETO : CINZA },
          right:  { style: BorderStyle.SINGLE, size: c === COLS - 1 ? 6 : 4, color: c === COLS - 1 ? PRETO : CINZA },
        },
        children: conteudoFicha(DEMO),
      }));
    }
    linhas.push(new TableRow({
      height: { value: ROW_A, rule: HeightRule.EXACT },
      cantSplit: true,
      children: celulas,
    }));
  }
  return new Table({
    width: { size: LARG_UTIL, type: WidthType.DXA },
    columnWidths: [COL_L, COL_L, COL_L],
    borders: {
      top: semBorda, bottom: semBorda, left: semBorda, right: semBorda,
      insideHorizontal: semBorda, insideVertical: semBorda,
    },
    rows: linhas,
  });
}

const doc = new Document({
  creator: "QT Pizza Bar",
  title: "QT — Fichas de Montagem",
  description: "Grade em branco: 15 fichas por pagina, 2 paginas.",
  styles: {
    default: {
      document: { run: { font: FONTE, size: 16, color: PRETO }, paragraph: { spacing: { after: 0, line: 240, lineRule: "auto" } } },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAG_L, height: PAG_A },
        margin: { top: MARGEM, right: MARGEM, bottom: MARGEM, left: MARGEM, header: 0, footer: 0, gutter: 0 },
      },
    },
    children: [
      cabecalho(1),
      grade(),
      new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: "exact" }, children: [new PageBreak()] }),
      cabecalho(2),
      grade(),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.argv[2], buf);
  console.log("ok:", process.argv[2]);
});
