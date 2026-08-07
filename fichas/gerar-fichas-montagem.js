const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, PageBreak,
  Table, TableRow, TableCell, WidthType, HeightRule,
  BorderStyle, TabStopType, VerticalAlign,
} = require("docx");

// ---- Marca QT ----------------------------------------------------------
const PRETO = "1A1E1E";
const CINZA = "A0A5A5";
const FONTE = "Helvetica"; // o Word substitui por Arial no Windows

// ---- Geometria A4 (twips: 1440 = 1 pol) --------------------------------
const PAG_L = 11906, PAG_A = 16838;
const MARGEM = 400;                       // ~7 mm
const LARG_UTIL = PAG_L - MARGEM * 2;     // 11106
const COLS = 3, ROWS = 5;
const COL_L = LARG_UTIL / COLS;           // 3702  (~65 mm)
const ROW_A = 3100;                       // ~54,7 mm — travado (EXACT)
const POR_PAGINA = COLS * ROWS;           // 15

const semBorda = { style: BorderStyle.NONE, size: 0, color: "auto" };

// ---- Conteudo ----------------------------------------------------------
// Ordem de montagem, exatamente como veio preenchido.
const PIZZAS = [
  ["ABOBRINHA",          ["Creme de abobrinha", "Abobrinha fatiada", "Fior di Latte"]],
  ["ÁCIDA",              ["Molho de Tomate", "Fior di Latte", "Queijo Canastra"]],
  ["AMARGA",             ["Fior di Latte", "Queijo Mendes", "Escarola", "Bacon"]],
  ["BIANCA",             ["Grana Padano", "Fior di latte", "Gorgonzola", "Alho em lâminas"]],
  ["BLUE CHEESE",        ["Fior di Latte", "Gorgonzola", "Cebola Roxa"]],
  ["BURRATA",            ["Molho de tomate"]],
  ["CALABRESA",          ["Molho de Tomate", "Calabresa", "Cebola Caramelizada"]],
  ["CARBONARA",          ["Fior di Latte", "Guanciale", "Ovo"]],
  ["CATU",               ["Molho de Tomate", "Catupiry", "Pepperoni", "Grana Padano"]],
  ["COG PORC",           ["Molho de Tomate", "Mix de Cogumelos", "Fior di Latte", "Guanciale"]],
  ["DIAVOLETE",          ["Pimenta Calabresa", "Boursin", "Pepperoni Fatiado"]],
  ["DOCE",               ["Abra a massa e passe o rolo"]],
  ["FANTASTICA",         ["Provola Affumicatta", "Guanciale", "Camarão"]],
  ["FRANGO COM AÇAFRÃO", ["Fior di Latte", "Grana Padano", "Frango Desfiado", "Creme de Açafrão", "Frango Desfiado"]],
  ["MARGHERITA",         ["Molho de Tomate", "Mozzarela de Bufala"]],
  ["MARINARA",           ["Molho de Tomate", "Alho Fatiado"]],
  ["MELADO",             ["Grana Padano", "Fior di Latte"]],
  ["MORTADELA",          ["Fondue de Queijo"]],
  ["PASTRAMI",           ["Grana Padano", "Fior di Latte", "Molho Bearneise"]],
  ["POMODORI",           ["Molho de Tomate", "Tomate Cereja Amarelo"]],
  ["QUEIJIN",            ["Grana Padano", "Fior di Latte", "Alecrim"]],
  ["RUCOLA",             ["Pesto de Rucula"]],
  ["SALGADA",            ["Queijo Pomerode", "Queijo Feta", "Speck"]],
  ["TRUFADA",            ["Grana Padano", "Fior di Latte"]],
  ["UMAMI",              ["Molho de Tomate", "Cogumelo Porcini hidratado", "Queijo La Madre"]],
  ["ZUCCA",              ["Creme de Abobora"]],
];

const TOTAL_PAGINAS = Math.ceil(PIZZAS.length / POR_PAGINA);
const dd = (n) => String(n).padStart(2, "0");

// Cabecalho compacto da pagina
function cabecalho(pagina) {
  return new Paragraph({
    spacing: { before: 0, after: 140, line: 260, lineRule: "exact" },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRETO, space: 4 } },
    tabStops: [{ type: TabStopType.RIGHT, position: LARG_UTIL }],
    children: [
      new TextRun({ text: "QT PIZZA BAR", font: FONTE, size: 18, bold: true, color: PRETO, characterSpacing: 24 }),
      new TextRun({ text: "   FICHAS DE MONTAGEM", font: FONTE, size: 14, color: CINZA, characterSpacing: 20 }),
      new TextRun({
        text: `\t${dd(pagina)} / ${dd(TOTAL_PAGINAS)}`,
        font: FONTE, size: 14, color: CINZA, characterSpacing: 20,
      }),
    ],
  });
}

// Uma ficha: faixa do nome + sequencia numerada de montagem.
// pizza === null => ficha vazia (vaga para uma pizza nova).
function conteudoFicha(pizza) {
  const filhos = [
    new Paragraph({
      spacing: { before: 0, after: 140, line: 300, lineRule: "exact" },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: PRETO, space: 1 } },
      children: [new TextRun({
        text: pizza ? pizza[0] : "",
        font: FONTE, size: 24, bold: true, color: PRETO, characterSpacing: 14,
      })],
    }),
  ];
  if (pizza) {
    pizza[1].forEach((item, i) => {
      filhos.push(new Paragraph({
        spacing: { before: 0, after: 0, line: 400, lineRule: "exact" },
        indent: { left: 260, hanging: 260 },   // numero pendurado: quebra de linha alinha no texto
        tabStops: [{ type: TabStopType.LEFT, position: 260 }],
        children: [
          new TextRun({ text: `${i + 1}\t`, font: FONTE, size: 20, color: CINZA }),
          new TextRun({ text: item, font: FONTE, size: 22, color: PRETO }),
        ],
      }));
    });
  }
  return filhos;
}

function grade(pagina) {
  const base = (pagina - 1) * POR_PAGINA;
  const linhas = [];
  for (let r = 0; r < ROWS; r++) {
    const celulas = [];
    for (let c = 0; c < COLS; c++) {
      const pizza = PIZZAS[base + r * COLS + c] || null;
      celulas.push(new TableCell({
        width: { size: COL_L, type: WidthType.DXA },
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 100, bottom: 57, left: 130, right: 130 },
        borders: {
          top:    { style: BorderStyle.SINGLE, size: r === 0 ? 6 : 4, color: r === 0 ? PRETO : CINZA },
          bottom: { style: BorderStyle.SINGLE, size: r === ROWS - 1 ? 6 : 4, color: r === ROWS - 1 ? PRETO : CINZA },
          left:   { style: BorderStyle.SINGLE, size: c === 0 ? 6 : 4, color: c === 0 ? PRETO : CINZA },
          right:  { style: BorderStyle.SINGLE, size: c === COLS - 1 ? 6 : 4, color: c === COLS - 1 ? PRETO : CINZA },
        },
        children: conteudoFicha(pizza),
      }));
    }
    linhas.push(new TableRow({
      height: { value: ROW_A, rule: HeightRule.EXACT },  // trava as 2 folhas
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

const corpo = [];
for (let p = 1; p <= TOTAL_PAGINAS; p++) {
  if (p > 1) {
    corpo.push(new Paragraph({
      spacing: { before: 0, after: 0, line: 20, lineRule: "exact" },
      children: [new PageBreak()],
    }));
  }
  corpo.push(cabecalho(p), grade(p));
}

const doc = new Document({
  creator: "QT Pizza Bar",
  title: "QT — Fichas de Montagem",
  description: `${PIZZAS.length} pizzas em ${TOTAL_PAGINAS} paginas A4.`,
  styles: {
    default: {
      document: {
        run: { font: FONTE, size: 22, color: PRETO },
        paragraph: { spacing: { after: 0, line: 240, lineRule: "auto" } },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAG_L, height: PAG_A },
        margin: { top: MARGEM, right: MARGEM, bottom: MARGEM, left: MARGEM, header: 0, footer: 0, gutter: 0 },
      },
    },
    children: corpo,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.argv[2], buf);
  console.log(`ok: ${process.argv[2]} — ${PIZZAS.length} pizzas / ${TOTAL_PAGINAS} paginas`);
});
