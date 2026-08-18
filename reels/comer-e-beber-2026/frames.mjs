import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const OUT = process.argv[2] || '/tmp/claude-0/-home-user-duvidas-bestas/a71004ea-5bd4-5364-aedd-38d8d5917fc2/scratchpad';
const times = (process.argv[3] || '1.5,4.5,7,15,25.5,29.5,38,49').split(',').map(Number);
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1080,height:1920}, deviceScaleFactor:1 });
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
p.on('console', m => { if(m.type()==='error') console.log('CONSOLE:', m.text()); });
await p.goto('file://' + process.cwd() + '/previz.html');
console.log('META', JSON.stringify(await p.evaluate(()=>window.__META), null, 1));
for (const t of times) {
  await p.evaluate(([t,f]) => window.__render(t, f), [t, Math.round(t*30)]);
  await p.screenshot({ path: `${OUT}/chk_${String(t).replace('.','_')}.png` });
}
await b.close();
console.log('frames de teste prontos');
