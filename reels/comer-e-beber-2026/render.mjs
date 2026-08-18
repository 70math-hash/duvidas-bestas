/**
 * Renderiza previz.html quadro a quadro e codifica o MP4 vertical.
 *
 *   node render.mjs <saida.mp4> [trilha.wav] [--html previz.html] [--fps 30] [--jobs 4]
 *
 * O previz expoe window.__render(t, frame), deterministico: cada quadro
 * depende so do tempo. Isso deixa o render reproduzivel e permite dividir
 * os quadros entre varias abas em paralelo sem nenhuma sincronizacao.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i > -1 ? process.argv[i+1] : padrao;
};
const posicionais = process.argv.slice(2).filter(a => !a.startsWith('--') &&
  !['30','25','24','60','1','2','3','4','5','6','7','8'].includes(a));

const SAIDA  = path.resolve(posicionais[0] || 'reel-previz.mp4');
const TRILHA = posicionais[1] ? path.resolve(posicionais[1]) : null;
const FPS    = Number(arg('--fps', 30));
const JOBS   = Number(arg('--jobs', 4));
const PREVIZ = 'file://' + path.resolve(arg('--html','previz.html'));

const tmp = mkdtempSync(path.join(tmpdir(), 'previz-'));
const navegador = await chromium.launch();

const primeira = await navegador.newPage({ viewport:{width:1080,height:1920}, deviceScaleFactor:1 });
await primeira.goto(PREVIZ);
const TOTAL = await primeira.evaluate(() => window.__TOTAL);
const QUADROS = Math.round(TOTAL * FPS);
console.log(`previz: ${TOTAL}s · ${FPS}fps · ${QUADROS} quadros · 1080x1920 · ${JOBS} abas`);

let feitos = 0;
const t0 = Date.now();

async function trabalhador(id, pagina) {
  pagina.on('pageerror', e => { console.error('ERRO NA PAGINA:', e.message); process.exit(1); });
  for (let f = id; f < QUADROS; f += JOBS) {
    await pagina.evaluate(([t,f]) => window.__render(t,f), [f/FPS, f]);
    const buf = await pagina.screenshot({ type:'jpeg', quality:94 });
    writeFileSync(path.join(tmp, String(f).padStart(5,'0') + '.jpg'), buf);
    if (++feitos % 120 === 0 || feitos === QUADROS) {
      const s = (Date.now()-t0)/1000;
      console.log(`  ${String(feitos).padStart(4)}/${QUADROS} quadros · ` +
                  `${s.toFixed(0)}s decorridos · ~${(s/feitos*(QUADROS-feitos)).toFixed(0)}s restantes`);
    }
  }
}

const paginas = [primeira];
for (let i = 1; i < JOBS; i++) {
  const p = await navegador.newPage({ viewport:{width:1080,height:1920}, deviceScaleFactor:1 });
  await p.goto(PREVIZ);
  paginas.push(p);
}
await Promise.all(paginas.map((p,i) => trabalhador(i, p)));
await navegador.close();

console.log('codificando...');
const args = ['-y','-loglevel','error',
  '-framerate', String(FPS), '-i', path.join(tmp,'%05d.jpg')];
if (TRILHA) args.push('-i', TRILHA);
args.push(
  '-c:v','libx264','-preset','slow','-crf','19',
  '-pix_fmt','yuv420p','-profile:v','high','-level','4.2',
  '-x264-params','keyint=60:min-keyint=30',
);
if (TRILHA) args.push('-c:a','aac','-b:a','160k','-ar','44100','-shortest');
args.push('-movflags','+faststart', SAIDA);

const ff = spawn('ffmpeg', args, { stdio:'inherit' });
const [code] = await once(ff, 'close');
rmSync(tmp, { recursive:true, force:true });
if (code !== 0) { console.error('ffmpeg falhou:', code); process.exit(code); }
console.log('pronto:', SAIDA);
