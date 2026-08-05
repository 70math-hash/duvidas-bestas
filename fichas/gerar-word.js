#!/usr/bin/env node
/**
 * Gera a versão Word do caderno do ensaio de pré-fermentos da QT.
 *
 * O caderno nasceu como HTML desenhado para impressão. O Word tem outro
 * modelo, então aqui o conteúdo é remontado em estilos, títulos e tabelas
 * de verdade, para o arquivo ficar editável em vez de ser um decalque.
 *
 * Uso:  NODE_PATH=<dir com node_modules do pacote docx> node gerar-word.js
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, HeadingLevel,
  PageBreak, Footer, PageNumber, LevelFormat, convertMillimetersToTwip,
} = require("docx");

const OUT = "/home/user/duvidas-bestas/fichas/QT-ensaio-pre-fermentos.docx";

const FONT = "Arial";
const INK = "1A1E1E", MUTED = "63696A", SHADE = "E4E1E0", RULE = "BFC4C3", PAPER = "FFFFFF";
const W = 9638;                       // largura útil em DXA (A4 com margens de 2 cm)
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const HAIR = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE };

/* ---------------- blocos de texto ---------------- */

const run = (text, o = {}) => new TextRun({
  text, font: FONT, size: o.size || 19, bold: !!o.bold,
  color: o.color || INK, allCaps: !!o.caps, characterSpacing: o.ls || 0,
});

const P = (text, o = {}) => new Paragraph({
  children: Array.isArray(text) ? text : [run(text, o)],
  spacing: { before: o.before ?? 0, after: o.after ?? 90, line: o.line || 250 },
  alignment: o.align, border: o.border, shading: o.shading,
  indent: o.indent, keepNext: !!o.keepNext,
});

const NOTE = (t) => P(t, { size: 17, color: MUTED, after: 70 });

const EYEBROW = (t) => P(t, { size: 15, bold: true, caps: true, color: MUTED, ls: 30, after: 40 });

const H1 = (t) => new Paragraph({
  children: [run(t, { size: 40, bold: true })],
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 0, after: 130 },
});

const H2 = (t) => new Paragraph({
  children: [run(t, { size: 19, bold: true, caps: true, ls: 26 })],
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 210, after: 90 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: INK } },
  keepNext: true,
});

const H3 = (t) => new Paragraph({
  children: [run(t, { size: 17, bold: true, caps: true, ls: 20, color: MUTED })],
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 150, after: 60 },
  keepNext: true,
});

// bloco preto, o equivalente do invertido do caderno
const INVERT = (titulo, paras) => new Table({
  width: { size: W, type: WidthType.DXA }, columnWidths: [W], borders: noBorders,
  rows: [new TableRow({
    children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: INK, color: "auto" },
      margins: { top: 140, bottom: 140, left: 170, right: 170 },
      borders: noBorders,
      children: [
        P(titulo, { size: 16, bold: true, caps: true, ls: 24, color: "C9CDCD", after: 70 }),
        ...paras.map((t, i) => P(t, { color: PAPER, after: i === paras.length - 1 ? 0 : 80 })),
      ],
    })],
  })],
});

// aviso com barra vertical à esquerda
const CALLOUT = (children) => P(children, {
  size: 17,
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: INK, space: 8 } },
  indent: { left: 100 }, before: 90, after: 90,
});

const b = (t) => run(t, { size: 17, bold: true });
const n = (t) => run(t, { size: 17 });

/* ---------------- tabelas ---------------- */

function TABLE(headers, rows, widths, o = {}) {
  const cols = widths || headers.map(() => Math.floor(W / headers.length));
  const cell = (txt, i, opts = {}) => new TableCell({
    width: { size: cols[i], type: WidthType.DXA },
    borders: { top: NONE, bottom: HAIR, left: NONE, right: NONE, ...(opts.borders || {}) },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" } : undefined,
    margins: { top: 50, bottom: 50, left: 0, right: 110 },
    children: (Array.isArray(txt) ? txt : [txt]).map((t, k) => P(t, {
      size: opts.size || 17, bold: opts.bold, color: opts.color,
      align: opts.align, after: 0, line: 230,
    })),
  });
  const head = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, i, {
      size: 15, bold: true, caps: true, color: MUTED,
      borders: { bottom: { style: BorderStyle.SINGLE, size: 6, color: INK } },
    })),
  });
  const body = rows.map((r) => {
    const meta = r.__ || {};
    return new TableRow({
      children: r.c.map((t, i) => cell(t, i, {
        bold: meta.bold || (meta.boldFirst && i === 0),
        fill: meta.fill, size: meta.size,
        align: meta.numFrom !== undefined && i >= meta.numFrom ? AlignmentType.RIGHT : undefined,
        borders: meta.top ? { top: { style: BorderStyle.SINGLE, size: 10, color: INK } } : undefined,
      })),
    });
  });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: cols,
    borders: noBorders, rows: [head, ...body],
  });
}

const SUBROW = (texto, span) => ({
  c: [texto, ...Array(span - 1).fill("")],
  __: { fill: SHADE, bold: true, size: 15 },
});

// grade de campos para preencher: rótulo em cima, célula vazia embaixo
function FIELDS(labels, perRow = 4) {
  const colW = Math.floor(W / perRow);
  const rows = [];
  for (let i = 0; i < labels.length; i += perRow) {
    const slice = labels.slice(i, i + perRow);
    while (slice.length < perRow) slice.push("");
    rows.push(new TableRow({
      children: slice.map((l) => new TableCell({
        width: { size: colW, type: WidthType.DXA },
        borders: noBorders, margins: { top: 60, bottom: 0, left: 0, right: 110 },
        children: [P(l, { size: 14, bold: true, caps: true, color: MUTED, ls: 20, after: 0 })],
      })),
    }));
    rows.push(new TableRow({
      children: slice.map((l) => new TableCell({
        width: { size: colW, type: WidthType.DXA },
        borders: { top: NONE, bottom: l ? HAIR : NONE, left: NONE, right: NONE },
        margins: { top: 0, bottom: 90, left: 0, right: 110 },
        children: [P("", { after: 0 })],
      })),
    }));
  }
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: Array(perRow).fill(colW), borders: noBorders, rows,
  });
}

function CHECKS(items, perRow = 2) {
  const colW = Math.floor(W / perRow);
  const rows = [];
  for (let i = 0; i < items.length; i += perRow) {
    const slice = items.slice(i, i + perRow);
    while (slice.length < perRow) slice.push(null);
    rows.push(new TableRow({
      children: slice.map((t) => new TableCell({
        width: { size: colW, type: WidthType.DXA }, borders: noBorders,
        margins: { top: 30, bottom: 30, left: 0, right: 110 },
        children: [P(t === null ? "" : `☐  ${t}`, { size: 17, after: 0 })],
      })),
    }));
  }
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: Array(perRow).fill(colW), borders: noBorders, rows,
  });
}

// linha do tempo: hora à esquerda, etapa e campos à direita
function TIMELINE(items) {
  const c1 = 1100, c2 = W - c1;
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [c1, c2], borders: noBorders,
    rows: items.map((it) => new TableRow({
      children: [
        new TableCell({
          width: { size: c1, type: WidthType.DXA },
          borders: { top: NONE, bottom: HAIR, left: NONE, right: NONE },
          margins: { top: 70, bottom: 70, left: 0, right: 110 },
          children: [P(it.h, { size: 17, bold: true, after: 0 })],
        }),
        new TableCell({
          width: { size: c2, type: WidthType.DXA },
          borders: { top: NONE, bottom: HAIR, left: NONE, right: NONE },
          margins: { top: 70, bottom: 70, left: 0, right: 0 },
          children: [
            P(it.t, { size: 18, bold: true, after: it.d || it.f ? 40 : 0 }),
            ...(it.d ? [P(it.d, { size: 16, color: MUTED, after: it.f ? 40 : 0, line: 225 })] : []),
            ...(it.f ? [P(it.f.map((x) => `${x}  ______________`).join("     "),
              { size: 14, caps: true, bold: true, color: MUTED, ls: 16, after: 0 })] : []),
          ],
        }),
      ],
    })),
  });
}

// cartão preto com o número da variável, usado no topo das fichas de braço
const CODE = (rotulo, valor, corpo) => {
  const c1 = 1750, c2 = W - c1;
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [c1, c2], borders: noBorders,
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: c1, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: INK, color: "auto" },
          borders: noBorders, margins: { top: 140, bottom: 140, left: 150, right: 150 },
          children: [
            P(rotulo, { size: 14, bold: true, caps: true, ls: 22, color: "C9CDCD", after: 90 }),
            P(valor, { size: 60, bold: true, color: PAPER, after: 0 }),
          ],
        }),
        new TableCell({
          width: { size: c2, type: WidthType.DXA }, borders: noBorders,
          margins: { top: 60, bottom: 60, left: 220, right: 0 },
          children: corpo,
        }),
      ],
    })],
  });
};

const BREAK = () => new Paragraph({ children: [new PageBreak()] });

/* ================= conteúdo ================= */
const doc = [];
const add = (...xs) => xs.forEach((x) => doc.push(x));

/* ---- 1. protocolo ---- */
add(
  EYEBROW("QT Pizza Bar · Ensaio controlado · Hidratação do pré-fermento"),
  H1("Três bigas, um forno, um horário"),
  P("Biga a 45%, 55% e 65%, todas a 4 °C, todas chegando ao mesmo ponto de maturação na mesma manhã para assarem com minutos de diferença. A hidratação é a variável. O fermento e o tempo de câmara são calibrados por braço justamente para que os três convirjam.", { size: 21, after: 150 }),
  INVERT("Regra número um", [
    "O relógio é previsão. O ponto é o critério. As horas de câmara deste caderno foram calculadas para cair em horários civilizados de cozinha, não para serem obedecidas cegamente. A biga sai quando atinge pH 5,0 a 5,2, e as três precisam sair no mesmo ponto. É melhor as três chegarem juntas um pouco imaturas do que uma no ponto e duas fora: o ensaio compara braços, não pizzas isoladas.",
  ]),
  H2("Hipótese"),
  P("Mais água no pré-fermento significa maior atividade de água: levedura e proteases trabalham mais soltas, a fração acética cai em favor da lática e o glúten chega menos condicionado à massa final."),
  P([b("Previsão. "), n("A mais cortante, mais forte, alvéolo grande e irregular. C mais doce, mais extensível, miolo mais regular. B entre as duas, com a melhor operação das três.")]),
  H2("Por que marinara"),
  P("Muçarela e molho pesado mascaram exatamente o que se está medindo. A pizza de prova de cada braço é marinara padronizada: 80 g de pelado triturado, 6 g de alho laminado, 0,4 g de orégano, 8 g de azeite, 0,8 g de sal. Mesma gramatura nas três, pesada na balança."),
  H2("Constantes · o que não pode variar entre A, B e C"),
  TABLE(["Parâmetro", "Valor fixo", "Registro do dia"],
    [
      ["Farinha", "Mesma marca e mesmo lote nos três braços"],
      ["Farinha por braço", "1000 g, ou 500 g em meia escala"],
      ["Fração em biga", "100% da farinha"],
      ["Sal", "2,8% = 28 g, só no rinfresco"],
      ["Hidratação final", "75% = 750 g de água no total"],
      ["Água da biga", "Mesma fonte, gelada a 2 a 4 °C"],
      ["Câmara fria", "4 °C, mesma geladeira, mesma prateleira"],
      ["Altura da massa na caixa", "10 cm nas três, caixas idênticas"],
      ["Masseira", "Mesma espiral, velocidade 1"],
      ["Temperatura de saída da biga", "18 a 20 °C"],
      ["Puntata e bolas", "1h30 · 6 × 290 g, ou 3 × 290 g"],
      ["Forno e pizza de prova", "Mesmo forno, marinara padronizada"],
    ].map((c) => ({ c: [...c, ""], __: { boldFirst: false } })),
    [2900, 4200, 2538]),
  H2("Critério de ponto"),
  P("Com pHmetro, o pH manda. Sem pHmetro, precisa de dois dos três sinais."),
  TABLE(["Sinal", "No ponto"],
    [["pH da biga", "5,0 a 5,2"], ["Aroma", "álcool, avelã, iogurte leve"],
     ["Estrutura", "cúpula cedeu, alvéolos na seção"]].map((c) => ({ c, __: {} })),
    [3400, 6238]),
  NOTE("Em C, a 65%, não se forma cúpula. A superfície passa de lisa a rendilhada e o toque afunda sem voltar. Nesse braço o pH é soberano."),
  H3("Ponto passado · aborte e registre a hora"),
  CHECKS(["Cheiro de acetona ou esmalte", "Massa pegajosa, com fiapos ao puxar", "pH abaixo de 4,8"], 2),
  H2("Material"),
  CHECKS(["pHmetro ou fita 4,0 a 7,0", "Termômetro espeto", "Balança de 0,1 g", "3 caixas idênticas",
          "Régua", "Etiquetas", "Cronômetro", "3 potes de 200 g"], 4),
  CALLOUT([b("Amostra testemunha. "), n("Separe 200 g de cada biga num pote pequeno, na mesma prateleira. Cheque o ponto no testemunho em vez de abrir e revolver o bloco principal a cada leitura.")]),
  CALLOUT([b("O erro que invalida o ensaio: "), n("caixas de alturas diferentes. O núcleo de um bloco alto fermenta quente por horas enquanto a borda já está fria. Iguale a altura, não o peso.")]),
  BREAK(),
);

/* ---- 2. farinha e fermento ---- */
add(
  EYEBROW("As duas variáveis que você precisa acertar antes de começar"),
  H1("Qual W e quanto fermento em cada braço"),
  INVERT("Decisão de partida", [
    "Rode o ensaio com uma farinha só, W 320 a 340, P/L em torno de 0,55, mesmo lote nos três braços. É a faixa de sobreposição onde os três funcionam. Se cada braço usar a farinha ideal dele, você passa a comparar farinha e hidratação ao mesmo tempo e perde a leitura. As faixas por braço da tabela abaixo servem para depois, quando o braço vencedor virar produção e você for especificar o saco certo.",
  ]),
  H2("Farinha indicada por braço · especificação de produção"),
  TABLE(["", "A · Fredda 45%", "B · Morbida 55%", "C · Umida 65%"],
    [
      { c: ["Tempo em câmara", "~47h40", "~26h", "~19h20"], __: {} },
      { c: ["W indicado", "330 a 360", "300 a 330", "290 a 320"], __: { bold: true } },
      { c: ["P/L", "0,50 a 0,60", "0,50 a 0,60", "0,45 a 0,55"], __: {} },
      { c: ["Piso absoluto", "W 300, e a 300 não passe de 36 h", "W 280", "W 270"], __: {} },
      { c: ["Por quê", "É a biga mais longa. Mesmo com a atividade de água baixa segurando a protease, 48 h cobram estrutura.", "Tempo quase pela metade compensa os 10 pontos de água a mais. Fica no meio.", "Curta demais para degradar. Precisa de W só para a massa final carregar 75%."], __: {} },
    ],
    [2100, 2600, 2500, 2438]),
  H3("Regra para transpor a outros tempos"),
  TABLE(["Mudança", "Efeito no W"],
    [["+10 pontos de hidratação, tempo igual", "+20 a 30 de W"],
     ["−12 h de câmara a 4 °C, hidratação igual", "−20 a 30 de W"]].map((c) => ({ c, __: {} })),
    [5400, 4238]),
  NOTE("Os dois termos puxam em sentidos opostos. C ganha 20 pontos de hidratação mas perde 28 h de câmara, então no líquido ela pede menos W que A. É por isso que a biga muito hidratada e curta é a saída de quem não tem farinha forte na casa."),
  H3("O que o W não conta"),
  NOTE("Duas farinhas W 330 não se comportam igual. Olhe o P/L, o falling number e as cinzas. O W da ficha é do lote, não da marca: peça a ficha do lote ao moinho e anote abaixo. Se a farinha for pobre em amilase, 0,3 a 0,5% de malte diastásico no rinfresco."),
  FIELDS(["marca", "lote", "W do lote", "P/L", "proteína %", "malte usado"], 3),
  H2("Fermento por braço · dose calculada para os três convergirem"),
  TABLE(["", "A · Fredda 45%", "B · Morbida 55%", "C · Umida 65%"],
    [
      { c: ["Fresco, % da farinha", "1,00%", "0,90%", "0,55%"], __: { bold: true } },
      { c: ["Fresco, escala 1000 g", "10,0 g", "9,0 g", "5,5 g"], __: {} },
      { c: ["Fresco, escala 500 g", "5,0 g", "4,5 g", "2,8 g"], __: {} },
      { c: ["Seco instantâneo, 1000 g", "3,3 g", "3,0 g", "1,8 g"], __: {} },
      { c: ["Seco instantâneo, 500 g", "1,7 g", "1,5 g", "0,9 g"], __: {} },
    ],
    [2900, 2246, 2246, 2246]),
  H3("A lógica da dose"),
  P([b("A leva a maior dose "), n("porque passa quase todas as 48 h com a levedura praticamente parada a 4 °C. A fermentação real acontece no arranque e no aquecimento, não na câmara, então o tempo longo não desconta fermento como descontaria a 18 °C.")], { size: 17 }),
  P([b("B corta o tempo quase pela metade "), n("mas ganha 10 pontos de atividade de água, e os dois efeitos quase se cancelam. A dose cai pouco.")], { size: 17 }),
  P([b("C cai de verdade "), n("porque a 65% a mesma população de levedura trabalha muito mais rápido e a janela de ponto fica estreita. Baixar o fermento é o que devolve largura à janela e torna o braço gerenciável.")], { size: 17 }),
  H3("Manuseio"),
  CHECKS([
    "Fermento sempre dissolvido na água gelada da biga, nunca seco sobre a farinha",
    "Pesar na balança de 0,1 g, não estimar",
    "Fresco dentro da validade e sem cheiro ácido",
    "Conversões: fresco × 0,33 = seco instantâneo; fresco × 0,40 = seco ativo, reidratado antes",
  ], 1),
  CALLOUT([n("Se você trocar de tipo de fermento no meio do ensaio, o ensaio acabou. Use o mesmo tipo e o mesmo tablete nos três braços.")]),
  BREAK(),
);

/* ---- 3. cronograma mestre, revisão 2 ---- */
add(
  EYEBROW("Braço A fora do ensaio · massa final em câmara a 18 °C, receita QT"),
  H1("Cronograma revisado, dois braços"),
  P("Ancorado nas duas misturas de quarta 5/8, às 14h30 e às 22h15, e no forno de quinta 6/8 às 22h00. Hidratação final de 75% nos dois braços. As fases frias encurtaram para caber, e tudo que mudou está declarado abaixo.", { size: 21, after: 140 }),
  H2("Linha mestra"),
  TABLE(["Etapa", "Alvo", "B · Morbida 55%", "C · Umida 65%", "Anotação"],
    [
      { c: ["Mistura da biga", "v1, curta", "Qua 14h30", "Qua 22h15", ""], __: { bold: true } },
      { c: ["Arranque", "20 °C", "1h00, até 15h30", "0h45, até 23h00", ""], __: {} },
      { c: ["Entra na câmara", "4 °C", "Qua 15h30", "Qua 23h00", ""], __: {} },
      { c: ["Checagem 1", "pH", "Qua 23h00 · 7h30", "Qui 07h00 · 8h00", ""], __: {} },
      { c: ["Checagem 2", "pH", "Qui 08h00 · 16h30", "Qui 12h00 · 13h00", ""], __: {} },
      { c: ["Sai da câmara", "pH 5,0–5,2", "Qui 11h00 · 19h30", "Qui 14h00 · 15h00", ""], __: { bold: true } },
      { c: ["Risveglio", "21 °C", "3h00", "2h00", ""], __: {} },
      { c: ["Rinfresco", "TA 24–26 °C", "Qui 14h00", "Qui 16h00", ""], __: { bold: true } },
      { c: ["Puntata", "22–24 °C", "2h55, até 17h15", "0h55, até 17h15", ""], __: {} },
      { c: ["Staglio · 6 × 290 g", "", "Qui 17h15", "Qui 17h15", ""], __: { bold: true } },
      { c: ["Appretto", "18 °C", "4h45", "4h45", ""], __: {} },
      { c: ["Forno estabilizado", "", "Qui 21h45, pizza sacrificial", "", ""], __: {} },
      { c: ["Infornata", "marinara", "Qui 22h00", "Qui 22h04", ""], __: { bold: true, top: true } },
    ],
    [2100, 1250, 2300, 2200, 1788]),
  H2("O que mudou em relação ao desenho original"),
  TABLE(["", "Original", "Revisão 2"],
    [["Câmara B", "26h00", "19h30"], ["Câmara C", "19h20", "15h00"],
     ["Risveglio B", "2h00", "3h00"], ["Risveglio C", "1h00", "2h00"],
     ["Massa final", "20 °C", "18 °C, câmara"], ["Appretto", "6h15 / 6h00", "4h45 nos dois"],
     ["Fermento e hidratação", "0,9% / 0,55% · 75%", "inalterados"]].map((c) => ({ c, __: {} })),
    [3200, 3200, 3238]),
  NOTE("O risveglio mais longo recupera o pH, não o platô. Uma hora a 21 °C vale muitas horas a 4 °C para a levedura, então as duas chegam ao ponto. O que não volta é a maturação enzimática e a acidificação que só o tempo frio dá. As duas perdem profundidade aromática em proporção parecida, e é por isso que a comparação entre B e C continua de pé."),
  H2("As duas decisões desta revisão"),
  P([b("1. Appretto igual, puntata diferente. "), n("Os horários dão 8h para B e 6h para C depois do rinfresco. O appretto é onde a bola estrutura e onde o alvéolo se define, então appretto diferente entre os braços seria confundidor. As duas fazem staglio às 17h15 e 4h45 de appretto, e as duas horas de diferença ficam na puntata, que perdoa muito mais.")], { size: 17 }),
  P([b("2. Puntata a 22 a 24 °C, appretto a 18 °C. "), n("4h45 a 18 °C é curto para 75% de hidratação. Aquecer a puntata põe a massa em movimento antes de ela entrar na câmara e recupera o tempo sem mexer no appretto.")], { size: 17 }),
  CALLOUT([b("Se as bolas não estiverem prontas às 22h, atrase o forno. "), n("Não encurte o appretto para bater o horário, senão a única variável que você mediu deixa de ser a hidratação.")]),
  CALLOUT([b("Sem o braço A você perde uma ponta da curva. "), n("Anote os dados da biga a 50% que você já faz na folha de consolidação, na coluna A, como referência. Sem esse terceiro ponto você compara 55 contra 65 sem âncora.")]),
  H2("Regras de deriva"),
  ...[
    ["Chegou cedo ao ponto. ", "Baixe para 2 °C e desça a caixa para a prateleira mais fria. Segurar biga madura no frio é a manobra mais barata que existe."],
    ["Chegou muito cedo. ", "Encurte o risveglio e mantenha o rinfresco na hora marcada. Nesta revisão o risveglio é o amortecedor, porque os horários de rinfresco estão travados."],
    ["Está atrasada. ", "Suba o risveglio de 21 °C para 24 a 26 °C. Cada 3 °C a mais corta perto de um terço do tempo."],
    ["Passou do ponto, ou uma chegou e a outra não. ", "Passada, não tente salvar, registre a hora exata. Descompassadas, segure a pronta a 2 °C e espere: comparar em pontos diferentes é pior que atrasar o forno."],
  ].map(([t, d]) => P([b(t), n(d)], { size: 17, indent: { left: 200, hanging: 200 } })),
  H2("Checagens"),
  TABLE(["", "B · 55%", "C · 65%"],
    [
      SUBROW("Checagem 1", 3),
      { c: ["Hora real", "", ""], __: {} }, { c: ["pH em suspensão", "", ""], __: {} },
      { c: ["T núcleo", "", ""], __: {} },
      SUBROW("Checagem 2", 3),
      { c: ["Hora real", "", ""], __: {} }, { c: ["pH em suspensão", "", ""], __: {} },
      { c: ["Aroma", "", ""], __: {} },
      SUBROW("Saída da câmara", 3),
      { c: ["Hora real", "", ""], __: {} }, { c: ["pH em suspensão", "", ""], __: {} },
      { c: ["Tempo total de frio", "", ""], __: {} },
    ],
    [3838, 2900, 2900]),
  NOTE("pH sempre em suspensão de 10 g em 100 mL de água destilada a 20 °C, nunca espeto na massa."),
  BREAK(),
);

/* ---- 4 a 6. fichas de braço ---- */
const DEFEITOS = ["Pontos brancos de biga", "Cheiro de acetona", "Massa com fiapos",
  "Colapso na abertura", "Cornicione pálido", "Bolha gigante única",
  "Resistiu, não abriu", "Base mole ao sair"];
const REGISTRO = ["peso biga montagem", "peso biga saída", "perda %", "pH biga",
  "pH massa final", "peso bola crua", "peso pós forno", "perda assamento %"];

function ficha(a) {
  add(
    CODE("Hidratação da biga", a.hid, [
      P(a.eyebrow, { size: 15, bold: true, caps: true, color: MUTED, ls: 26, after: 50 }),
      // título de nível 1 mesmo dentro da célula, senão o braço some do painel de navegação
      new Paragraph({
        children: [run(a.nome, { size: 34, bold: true })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 0, after: 70 },
      }),
      P(a.resumo, { size: 17, color: MUTED, after: 0 }),
    ]),
    P("", { after: 60 }),
    FIELDS(["data", "responsável", "lote da farinha"], 3),
    H2("Fórmula"),
    TABLE(["Item", "1000 g", "500 g", "%"],
      [
        SUBROW("Biga", 4),
        { c: ["Farinha", "1000", "500", "100"], __: { numFrom: 1 } },
        { c: ["Água 2 a 4 °C", a.ag, a.ag2, a.hid.replace("%", ",0")], __: { numFrom: 1 } },
        { c: ["Fermento fresco", a.fe, a.fe2, a.fep], __: { numFrom: 1 } },
        SUBROW("Rinfresco", 4),
        { c: ["Biga inteira", a.bg, a.bg2, "—"], __: { numFrom: 1 } },
        { c: [a.aguaRinf, a.ar, a.ar2, a.arp], __: { numFrom: 1 } },
        { c: ["Sal", "28", "14", "2,8"], __: { numFrom: 1 } },
        { c: ["Massa total", a.tot, a.tot2, "75%"], __: { bold: true, top: true, numFrom: 1 } },
      ],
      [4238, 1800, 1800, 1800]),
    NOTE(`6 × 290 g, sobra ${a.sobra} g. Em meia escala, 3 × 290 g.`),
    H2("Aspecto alvo da biga"),
    P(a.aspecto),
    H2("Linha do tempo"),
    TIMELINE(a.tl),
    CALLOUT([b("Risco deste braço. "), n(a.risco)]),
    H2("Registro objetivo"),
    FIELDS(REGISTRO, 4),
    H2("Defeitos observados"),
    CHECKS(DEFEITOS, 2),
    BREAK(),
  );
}

ficha({
  hid: "45%", nome: "Biga Fredda", eyebrow: "Braço A · fermento 1,0% · W 330 a 360",
  resumo: "A biga clássica levada ao frio. Menor atividade de água das três, portanto a mais acética, a mais estruturante e a mais difícil de dissolver no rinfresco.",
  ag: "450", ag2: "225", fe: "10,0", fe2: "5,0", fep: "1,00",
  bg: "1460", bg2: "730", aguaRinf: "Água", ar: "300", ar2: "150", arp: "30,0",
  tot: "1788", tot2: "894", sobra: "48",
  aspecto: "Farofa grossa, farinha seca ainda visível. Se saiu lisa, virou outra coisa. Mistura de 3 a 4 min em velocidade 1, saída entre 18 e 20 °C.",
  risco: "Biga a 45% saída do frio é um tijolo. Se não dissolver por completo, aparecem pontos brancos no miolo e você vai culpar a farinha. Não foi a farinha, foi aqui.",
  tl: [
    { h: "Qui 07h30", t: "Mistura da biga", d: "3 a 4 min, v1. Fermento dissolvido na água gelada.", f: ["hora real", "T saída", "altura cx"] },
    { h: "Qui 09h00", t: "Entra na câmara a 4 °C", d: "1h30 de arranque a 20 °C antes. Não pule: é ela que dá o impulso antes de a levedura travar.", f: ["hora real", "T núcleo 2h"] },
    { h: "Sex 21h00", t: "Checagem 1 · 36 h", d: "No testemunho de 200 g. Ainda deve estar aquém do ponto.", f: ["pH", "aroma"] },
    { h: "Sáb 07h00", t: "Checagem 2 · 46 h", f: ["pH", "cúpula"] },
    { h: "Sáb 08h40", t: "Sai da câmara · 47h40", d: "pH 5,0 a 5,2, cúpula cedida, alvéolos na seção, aroma de álcool e avelã.", f: ["tempo real", "pH"] },
    { h: "Sáb 08h40", t: "Risveglio a 21 °C · 3h00", d: "O braço mais frio precisa do risveglio mais longo. Sem ele a puntata arrasta e você compensa com fermento, que estraga tudo que veio antes.", f: ["T ao fim"] },
    { h: "Sáb 11h40", t: "Rinfresco", d: "Quebre em pedaços de punho, rode 2 min com 45 g da água só para soltar. Resto a fio em 3 adições, sal na última. TA final 24 a 26 °C.", f: ["tempo mix", "TA final", "pH massa"] },
    { h: "Sáb 13h30", t: "Staglio · 6 × 290 g", d: "Puntata de 1h30 antes. Appretto de 6h30 a 20 °C.", f: ["T appretto"] },
    { h: "Sáb 20h00", t: "Infornata · primeira do rodízio", f: ["T piso", "T teto", "tempo"] },
  ],
});

ficha({
  hid: "55%", nome: "Biga Morbida", eyebrow: "Braço B · fermento 0,9% · W 300 a 330",
  resumo: "Deixa de ser farofa e vira massa. Resolve o problema operacional de A: sai da câmara manejável e incorpora na metade do tempo, com menos oxidação da massa final.",
  ag: "550", ag2: "275", fe: "9,0", fe2: "4,5", fep: "0,90",
  bg: "1559", bg2: "780", aguaRinf: "Água", ar: "200", ar2: "100", arp: "20,0",
  tot: "1787", tot2: "894", sobra: "47",
  aspecto: "Massa grosseira e coesa, superfície irregular, sem véu de glúten. 4 a 5 min em v1. Ela vai querer virar massa lisa: pare antes.",
  risco: "Cronometre o tempo total de mistura da massa final em A e em B e anote a diferença. Se B entregar quase o mesmo perfil de A com metade da dor de cabeça no rinfresco, esse número é o argumento que coloca ela no serviço.",
  tl: [
    { h: "Qua 14h30", t: "Mistura da biga", d: "4 a 5 min, v1. Fermento dissolvido na água gelada.", f: ["hora real", "T saída", "altura cx"] },
    { h: "Qua 15h30", t: "Entra na câmara a 4 °C", d: "1h00 de arranque a 20 °C antes. Mais curto que A: com mais água a levedura arranca mais rápido.", f: ["hora real", "T núcleo 2h"] },
    { h: "Qua 23h00", t: "Checagem 1 · 7h30", f: ["pH", "aroma"] },
    { h: "Qui 08h00", t: "Checagem 2 · 16h30", d: "A cúpula ainda se forma, mas cede mais cedo e mais fundo que em A.", f: ["pH", "cúpula"] },
    { h: "Qui 11h00", t: "Sai da câmara · 19h30", f: ["tempo real", "pH"] },
    { h: "Qui 11h00", t: "Risveglio a 21 °C · 3h00", f: ["T ao fim"] },
    { h: "Qui 14h00", t: "Rinfresco", d: "A biga já entra dócil. 1 min para soltar, depois os 200 g de água a fio em 2 adições, sal na última. TA final 24 a 26 °C.", f: ["tempo mix", "TA final", "pH massa"] },
    { h: "Qui 17h15", t: "Staglio · 6 × 290 g", d: "Puntata de 2h55 a 22 a 24 °C antes. Appretto de 4h45 a 18 °C.", f: ["T appretto"] },
    { h: "Qui 22h00", t: "Infornata · primeira do rodízio", f: ["T piso", "T teto", "tempo"] },
  ],
});

ficha({
  hid: "65%", nome: "Biga Umida", eyebrow: "Braço C · fermento 0,55% · W 290 a 320",
  resumo: "Território semissólido, sem nome consagrado e sem padronização. Segura parte da estruturação da biga e já pega parte da suavidade lática do poolish. O braço mais experimental e o de janela mais estreita.",
  ag: "650", ag2: "325", fe: "5,5", fe2: "2,8", fep: "0,55",
  bg: "1656", bg2: "828", aguaRinf: "Água com o sal", ar: "100", ar2: "50", arp: "10,0",
  tot: "1784", tot2: "892", sobra: "44",
  aspecto: "Massa mole que escorre devagar e não segura forma. 4 a 5 min em v1. Não tente dar estrutura: aqui ela vem sozinha na câmara.",
  risco: "A janela é a mais curta das três e passa rápido, por isso a dose de fermento é quase metade da de A. Se este for o braço que passar do ponto, não jogue a informação fora: anote em quantas horas passou, porque esse número é o dado mais útil que C tem a dar.",
  tl: [
    { h: "Qua 22h15", t: "Mistura da biga", d: "4 a 5 min, v1. Fermento dissolvido na água gelada.", f: ["hora real", "T saída", "altura cx"] },
    { h: "Qua 23h00", t: "Entra na câmara a 4 °C", d: "45 min de arranque a 20 °C antes. O mais curto dos três: passou disso, você perdeu o controle da janela.", f: ["hora real", "T núcleo 2h"] },
    { h: "Qui 07h00", t: "Checagem 1 · 8h00", f: ["pH", "aroma"] },
    { h: "Qui 12h00", t: "Checagem 2 · 13h00", d: "Sem cúpula. A superfície passa de lisa a rendilhada e o toque afunda sem voltar.", f: ["pH", "superfície"] },
    { h: "Qui 14h00", t: "Sai da câmara · 15h00", d: "Aqui o pH é soberano. Se já estiver em 5,0, tire e segure a 2 °C.", f: ["tempo real", "pH"] },
    { h: "Qui 14h00", t: "Risveglio a 21 °C · 2h00", f: ["T ao fim"] },
    { h: "Qui 16h00", t: "Rinfresco", d: "Só 100 g de água entram. Dissolva o sal nessa água antes, senão ele cai seco sobre glúten já formado e não distribui. Mix curto. TA final 24 a 26 °C.", f: ["tempo mix", "TA final", "pH massa"] },
    { h: "Qui 17h15", t: "Staglio · 6 × 290 g", d: "Puntata de 0h55 a 22 a 24 °C antes. Appretto de 4h45 a 18 °C.", f: ["T appretto"] },
    { h: "Qui 22h04", t: "Infornata · segunda do rodízio", f: ["T piso", "T teto", "tempo"] },
  ],
});

/* ---- 7. forno e painel ---- */
const ATRIB = [
  ["Acidez percebida", "neutra · cortante"],
  ["Aroma de fermentação", "farinha crua · cerveja e avelã"],
  ["Cor e doçura de crosta", "pálida · caramelizada"],
  ["Alveolatura do cornicione", "fechada · aberta e irregular"],
  ["Crocância no 1º minuto", "mole · quebradiça"],
  ["Sustentação aos 3 min", "dobra · firme"],
  ["Mastigabilidade", "borrachuda · dissolve"],
  ["Aroma em três palavras", "texto livre"],
];
add(
  EYEBROW("Um piso, três massas"),
  H1("Sequência de infornata"),
  P("Três pizzas não entram juntas no mesmo piso. O que o cronograma entrega é melhor do que isso: as massas no mesmo ponto, na mesma janela, saindo do forno em minutos e sendo provadas quentes lado a lado. Duas rodadas com a ordem invertida para que a deriva do piso não vire resultado.", { size: 21, after: 140 }),
  H2("Protocolo de forno"),
  TABLE(["Hora", "Ação", "T piso", "Observação"],
    [
      { c: ["21h00", "Forno em regime, piso estabilizado", "", ""], __: {} },
      { c: ["21h45", "Pizza sacrificial, nivela o piso e queima resíduo", "", ""], __: {} },
      { c: ["21h55", "Aferir piso e teto, anotar antes de começar", "", "teto"], __: {} },
      SUBROW("Rodada 1 · ordem B, C", 4),
      { c: ["22h00", "B · marinara padronizada", "", "tempo"], __: {} },
      { c: ["22h04", "C · marinara padronizada", "", "tempo"], __: {} },
      { c: ["22h08", "Corte e serviço às cegas, dentro de 90 segundos", "—", ""], __: {} },
      SUBROW("Rodada 2 · ordem invertida C, B", 4),
      { c: ["22h20", "C", "", "tempo"], __: {} },
      { c: ["22h24", "B", "", "tempo"], __: {} },
    ],
    [1200, 4638, 1900, 1900]),
  H3("Constantes de forno"),
  CHECKS([
    "Mesma posição no piso, mesmo giro, mesmo tempo",
    "Aferir o piso antes de cada infornata, não só no início",
    "4 min entre pizzas para o piso recuperar",
    "Mesma gramatura de molho, pesada",
    "Mesmo pizzaiolo abrindo as duas",
  ], 1),
  H3("Na abertura, antes de enfornar"),
  NOTE("Metade da leitura do pré-fermento acontece com a massa ainda crua. Registre, para cada braço, se a bola resistiu ou cedeu, se o disco voltou depois de aberto e se o cornicione ficou cheio ou murcho."),
  FIELDS(["B · abertura", "C · abertura"], 2),
  H2("Painel sensorial às cegas · uma folha por provador"),
  TABLE(["Atributo", "Âncora 1 · 5", "Amostra 1", "Amostra 2"],
    [...ATRIB.map(([a, anc]) => ({ c: [a, anc, "1 2 3 4 5", "1 2 3 4 5"], __: {} })),
     { c: ["Preferência geral", "", "1 2 3 4 5", "1 2 3 4 5"], __: { bold: true, top: true } }],
    [2900, 2938, 1900, 1900]),
  NOTE("Circule a nota. Mínimo de três provadores, cada um preenche sem comentar em voz alta."),
  FIELDS(["provador", "data"], 2),
  CALLOUT([b("Destacável · chave da prova cega. "), n("Preencher antes de servir, dobrar e só abrir depois que todas as fichas estiverem preenchidas.")]),
  FIELDS(["amostra 1 = braço", "amostra 2 = braço", "quem serviu"], 3),
  BREAK(),
);

/* ---- 8. consolidação ---- */
add(
  EYEBROW("Uma página para a parede da cozinha"),
  H1("Os braços lado a lado"),
  TABLE(["", "A · Fredda", "B · Morbida", "C · Umida"],
    [
      { c: ["Hidratação da biga", "45%", "55%", "65%"], __: { bold: true } },
      { c: ["Fermento fresco", "1,00% · 10,0 g", "0,90% · 9,0 g", "0,55% · 5,5 g"], __: { bold: true } },
      { c: ["W indicado em produção", "330 a 360", "300 a 330", "290 a 320"], __: { bold: true } },
      { c: ["Água biga / rinfresco", "450 / 300 g", "550 / 200 g", "650 / 100 g com o sal"], __: {} },
      { c: ["Mistura da biga", "3 a 4 min", "4 a 5 min", "4 a 5 min"], __: {} },
      { c: ["Aspecto", "farofa grossa", "massa grosseira", "massa mole"], __: {} },
      { c: ["Arranque a 20 °C", "1h30", "1h00", "0h45"], __: {} },
      { c: ["Câmara a 4 °C", "47h40", "19h30", "15h00"], __: {} },
      { c: ["Risveglio a 21 °C", "3h00", "3h00", "2h00"], __: {} },
      { c: ["Sinal de ponto dominante", "cúpula cedida", "cúpula cede cedo", "pH, sem cúpula"], __: {} },
      { c: ["Previsão de perfil", "acético, força, alvéolo grande", "intermediário", "lático, extensível, alvéolo fino"], __: {} },
      { c: ["Risco principal", "não dissolve, ponto branco", "virar massa lisa na mistura", "janela curta, passa do ponto"], __: {} },
      { c: ["Tempo real em câmara", "", "", ""], __: { top: true } },
      { c: ["pH real na saída", "", "", ""], __: {} },
      { c: ["Tempo de mistura da massa final", "", "", ""], __: {} },
      { c: ["Média de preferência do painel", "", "", ""], __: {} },
    ],
    [2900, 2246, 2246, 2246]),
  H2("Como ler o resultado"),
  P("A leitura esperada é um gradiente limpo: A mais ácida, mais estruturada, alvéolo maior. C mais doce, mais extensível, miolo mais regular. B entre as duas."),
  P([b("Se o gradiente não aparecer, não conclua nada sobre hidratação ainda. "), n("Confira primeiro se as bigas saíram no mesmo pH. Diferença de maturação explica mais resultado estranho do que diferença de hidratação, e é o erro mais comum neste tipo de ensaio.")], { size: 17 }),
  NOTE("Empate em sabor se decide pela operação: tempo de mistura da massa final, largura da janela de ponto e encaixe na semana."),
  H2("Decisão"),
  FIELDS(["vai para o cardápio", "repete com ajuste", "descartada"], 3),
  H3("Próximos ensaios"),
  CHECKS([
    "Vencedor a 50% e 60% para achar o ponto fino",
    "Vencedor com biga em 50% da farinha, não 100%",
    "Massa velha a 20%, com o sal descontado",
    "Vencedor com integral, corrigindo a hidratação",
    "Iso-tempo: as duas com 24 h de câmara",
    "C a 65% e 14 °C, para separar hidratação de temperatura",
  ], 1),
  INVERT("O princípio por trás do ensaio", [
    "Hidratação e temperatura do pré-fermento controlam a razão entre acético e lático. A firmeza controla quanto glúten você condiciona antes de a massa final existir. Todo o resto é consequência dessas duas alavancas.",
  ]),
  H2("Observações gerais"),
  P("", { after: 0 }),
  new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: W, type: WidthType.DXA },
        borders: { top: HAIR, bottom: HAIR, left: HAIR, right: HAIR },
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
        children: [P(""), P(""), P(""), P("", { after: 0 })],
      })],
    })],
  }),
);

/* ================= documento ================= */
const document = new Document({
  creator: "QT Pizza Bar",
  title: "Ensaio de pré-fermentos",
  description: "Caderno do ensaio controlado de hidratação de pré-fermento",
  styles: {
    default: {
      document: { run: { font: FONT, size: 19, color: INK }, paragraph: { spacing: { line: 250 } } },
      heading1: { run: { font: FONT, size: 40, bold: true, color: INK } },
      heading2: { run: { font: FONT, size: 19, bold: true, color: INK } },
      heading3: { run: { font: FONT, size: 17, bold: true, color: MUTED } },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertMillimetersToTwip(18), bottom: convertMillimetersToTwip(16),
          left: convertMillimetersToTwip(20), right: convertMillimetersToTwip(20),
        },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: HAIR },
          spacing: { before: 100 },
          children: [
            run("QT Pizza Bar · Ensaio de pré-fermentos", { size: 14, bold: true, caps: true, ls: 24, color: MUTED }),
            new TextRun({ children: ["\t"], font: FONT }),
            new TextRun({ children: ["", PageNumber.CURRENT], font: FONT, size: 14, bold: true, color: MUTED }),
          ],
          tabStops: [{ type: "right", position: W }],
        })],
      }),
    },
    children: doc,
  }],
});

Packer.toBuffer(document).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("gerado:", OUT, `(${(buf.length / 1024).toFixed(0)} KB)`);
});
