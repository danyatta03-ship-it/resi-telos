/**
 * Test end-to-end nel browser reale (setup -> generazione -> playback -> editing -> export -> PWA).
 *
 * Prerequisiti:
 *   npm run build && npm run preview      (in un altro terminale)
 *   npx playwright install chromium       (una tantum)
 *   npm run test:e2e
 *
 * Variabili: BASE (default http://localhost:4173), CHROME_PATH per un binario specifico.
 */
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch {
    console.error('Playwright non installato: esegui "npm i -D playwright && npx playwright install chromium".');
    process.exit(1);
  }
}

const BASE = process.env.BASE ?? 'http://localhost:4173';
let failures = 0;
const check = (cond, msg) => {
  console.log(cond ? `  ok   ${msg}` : `  FAIL ${msg}`);
  if (!cond) failures++;
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--use-gl=swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: 'networkidle' });
console.log('\n== Setup ==');
check(await page.getByText('Che beat vuoi creare?').isVisible(), 'schermata iniziale con la domanda mood');
const generateBtn = page.getByRole('button', { name: 'GENERATE BEAT' });
check(await generateBtn.isDisabled(), 'GENERATE BEAT disabilitato senza mood');

await page.getByRole('button', { name: /^Dark/ }).click();
const bpmInput = page.getByLabel('BPM', { exact: true }).first();
check((await bpmInput.inputValue()) !== '', 'BPM suggerito dal mood: ' + (await bpmInput.inputValue()));
await page.getByRole('button', { name: '142', exact: true }).count().then(() => {});
await bpmInput.fill('142');
await page.getByRole('button', { name: /^Melodic/ }).click();
check(!(await generateBtn.isDisabled()), 'GENERATE BEAT abilitato dopo mood + BPM');
await generateBtn.click();

console.log('\n== Studio ==');
await page.waitForSelector('text=Arrangement', { timeout: 10000 });
check(true, 'studio caricato');
const bpmTop = await page.getByLabel('BPM', { exact: true }).first().inputValue();
check(bpmTop === '142', `BPM mantenuto nello studio (${bpmTop})`);
const sections = await page.locator('button[title*="battute"]').count();
check(sections >= 5, `struttura generata con ${sections} sezioni`);
const steps = await page.locator('button[title*="step"]').count();
check(steps > 50, `step sequencer popolato (${steps} celle)`);

console.log('\n== Playback ==');
await page.getByRole('button', { name: 'Play' }).click();
await page.waitForTimeout(2500);
const audio = await page.evaluate(() => {
  const Tone = window.__tbg.Tone;
  return { state: Tone?.getTransport().state, ticks: Tone?.getTransport().ticks, ctx: Tone?.getContext().state };
});
check(audio.state === 'started', `transport in riproduzione (${audio.state})`);
check(audio.ticks > 0, `posizione avanzata: ${audio.ticks} ticks`);
const peak = await page.evaluate(() => {
  const values = window.__tbg.engine.analyser?.getValue();
  if (!values) return -1;
  let max = 0;
  for (const v of values) max = Math.max(max, Math.abs(v));
  return max;
});
check(peak > 0.0005, `livello audio in uscita: ${peak.toFixed(4)}`);
const pos = await page.locator('span.text-acid-400').first().innerText();
check(/\d{3}\.\d/.test(pos), `contatore posizione attivo (${pos})`);
await page.getByRole('button', { name: 'Pausa' }).click();
await page.waitForTimeout(200);
check((await page.evaluate(() => window.__tbg.Tone?.getTransport().state)) === 'paused', 'pausa funzionante');

console.log('\n== Mixer ==');
const mixer = page.locator('section:has(> header:has-text("Mixer"))');
const muteKick = mixer.locator('button[title="Mute"]').first();
await muteKick.click();
check(await page.evaluate(() => window.__tbg.store.getState().beat.mixer.kick.mute), 'mute kick attivo nello stato');
check(await page.evaluate(() => window.__tbg.engine.rackChannelMuted('kick')), 'mute applicato al canale audio');
await muteKick.click();
check(!(await page.evaluate(() => window.__tbg.store.getState().beat.mixer.kick.mute)), 'mute disattivato');
const soloHat = mixer.locator('button[title="Solo"]').nth(3);
await soloHat.click();
check(await page.evaluate(() => window.__tbg.store.getState().beat.mixer.hat.solo), 'solo hi-hat attivo nello stato');
await soloHat.click();
const master = page.getByLabel('Volume master').first();
await master.fill('-10');
check((await master.inputValue()) === '-10', 'master volume modificabile');

console.log('\n== Step sequencer ==');
const cell = page.locator('button[title*="step 3"]').first();
const before = await page.evaluate(() => window.__tbg.store?.getState().beat.sections.find(s => s.id === window.__tbg.store.getState().selectedSectionId).clips.kick.length);
await cell.click();
const after = await page.evaluate(() => window.__tbg.store?.getState().beat.sections.find(s => s.id === window.__tbg.store.getState().selectedSectionId).clips.kick.length);
check(before !== after, `toggle step modifica il pattern (${before} -> ${after})`);

console.log('\n== Piano roll ==');
const rollNotesBefore = await page.evaluate(() => {
  const st = window.__tbg.store.getState();
  return st.beat.sections.find(s => s.id === st.selectedSectionId).clips[st.selectedTrack]?.length ?? 0;
});
const grid = page.locator('div.cursor-crosshair').first();
const countRoll = () => page.evaluate(() => {
  const st = window.__tbg.store.getState();
  return st.beat.sections.find(s => s.id === st.selectedSectionId).clips[st.selectedTrack]?.length ?? 0;
});
let rollNotesAfter = rollNotesBefore;
for (const spot of [[120, 40], [220, 80], [60, 120], [300, 150], [180, 200]]) {
  await grid.click({ position: { x: spot[0], y: spot[1] } });
  rollNotesAfter = await countRoll();
  if (rollNotesAfter > rollNotesBefore) break;
}
check(rollNotesAfter === rollNotesBefore + 1, `nota aggiunta nel piano roll (${rollNotesBefore} -> ${rollNotesAfter})`);

console.log('\n== Generatore ==');
const melodyBefore = await page.evaluate(() => JSON.stringify(window.__tbg.store.getState().beat.sections.map(s => s.clips.melody)));
const drumsBefore = await page.evaluate(() => JSON.stringify(window.__tbg.store.getState().beat.sections.map(s => s.clips.kick)));
await page.getByRole('button', { name: 'Drums', exact: true }).click();
await page.waitForTimeout(300);
const melodyAfter = await page.evaluate(() => JSON.stringify(window.__tbg.store.getState().beat.sections.map(s => s.clips.melody)));
const drumsAfter = await page.evaluate(() => JSON.stringify(window.__tbg.store.getState().beat.sections.map(s => s.clips.kick)));
check(melodyBefore === melodyAfter && drumsBefore !== drumsAfter, 'Regenerate Drums cambia solo le drums');

const keyBefore = await page.evaluate(() => window.__tbg.store.getState().beat.meta.rootPc);
await page.getByLabel('Nota fondamentale').selectOption(String((keyBefore + 3) % 12));
await page.waitForTimeout(200);
const keyAfter = await page.evaluate(() => window.__tbg.store.getState().beat.meta.rootPc);
check(keyAfter === (keyBefore + 3) % 12, `cambio tonalita' applicato (${keyBefore} -> ${keyAfter})`);


console.log('\n== Arrangement ==');
const sectionCount = () => page.evaluate(() => window.__tbg.store.getState().beat.sections.length);
const n0 = await sectionCount();
await page.getByRole('button', { name: 'Duplica' }).click();
check((await sectionCount()) === n0 + 1, 'duplica sezione');
const barsBefore = await page.evaluate(() => {
  const st = window.__tbg.store.getState();
  return st.beat.sections.find((s) => s.id === st.selectedSectionId).bars;
});
await page.locator('section:has(> header:has-text("Arrangement"))').getByRole('button', { name: '+', exact: true }).first().click();
const barsAfter = await page.evaluate(() => {
  const st = window.__tbg.store.getState();
  return st.beat.sections.find((s) => s.id === st.selectedSectionId).bars;
});
check(barsAfter === barsBefore + 1, `durata sezione modificata (${barsBefore} -> ${barsAfter} bar)`);
const orderBefore = await page.evaluate(() => window.__tbg.store.getState().beat.sections.map((s) => s.id).join(','));
await page.locator('button[title="Sposta a sinistra"]').click();
const orderAfter = await page.evaluate(() => window.__tbg.store.getState().beat.sections.map((s) => s.id).join(','));
check(orderBefore !== orderAfter, 'riordino sezioni');
await page.getByRole('button', { name: 'Elimina', exact: true }).click();
check((await sectionCount()) === n0, 'elimina sezione');
await page.getByRole('button', { name: '+ Sezione' }).click();
await page.getByRole('button', { name: 'BRIDGE', exact: true }).click();
check((await sectionCount()) === n0 + 1, 'aggiunta nuova sezione generata');
check(
  await page.evaluate(() => {
    const st = window.__tbg.store.getState();
    const s = st.beat.sections.find((x) => x.id === st.selectedSectionId);
    return Object.values(s.clips).some((c) => (c?.length ?? 0) > 0);
  }),
  'la nuova sezione contiene note generate',
);

console.log('\n== Loop e BPM ==');
await page.locator('button[title="Loop sulla sezione selezionata"]').click();
check(await page.evaluate(() => window.__tbg.store.getState().loopSection), 'loop di sezione attivo');
await page.locator('button[title="Loop sulla sezione selezionata"]').click();
await page.getByLabel('BPM', { exact: true }).first().fill('90');
await page.waitForTimeout(500);
const bpmApplied = await page.evaluate(() => window.__tbg.Tone.getTransport().bpm.value);
check(Math.round(bpmApplied) === 90, `BPM applicato al transport (${Math.round(bpmApplied)})`);
await page.getByLabel('BPM', { exact: true }).first().fill('142');
await page.waitForTimeout(300);

console.log('\n== Export ==');
const [zip] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.getByRole('button', { name: 'Scarica ZIP completo' }).click(),
]);
check(/TrapBeat_\d+BPM_.*\.zip/.test(zip.suggestedFilename()), `ZIP scaricato: ${zip.suggestedFilename()}`);
const [mid] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.getByRole('button', { name: /full_beat\.mid/ }).click(),
]);
check(mid.suggestedFilename().endsWith('full_beat.mid'), `MIDI scaricato: ${mid.suggestedFilename()}`);

console.log('\n== WAV ==');
check(await page.getByRole('button', { name: /Esporta WAV/ }).isVisible(), 'export WAV completo disponibile');
const wavBtn = page.getByRole('button', { name: /^Solo .*\(~/ });
const [wav] = await Promise.all([
  page.waitForEvent('download', { timeout: 300000 }),
  wavBtn.click(),
]);
const wavPath = await wav.path();
const { statSync } = await import('node:fs');
const wavSize = wavPath ? statSync(wavPath).size : 0;
check(wavSize > 100000, `WAV di sezione renderizzato: ${(wavSize / 1048576).toFixed(2)} MB`);

console.log('\n== Progetti ==');
await page.getByRole('button', { name: 'Progetti' }).click();
await page.getByPlaceholder('Dark Tony Beat').fill('Dark Tony Beat');
await page.getByRole('button', { name: 'Salva beat' }).click();
await page.waitForTimeout(700);
const saved = await page.locator('li:has-text("Dark Tony Beat")').count();
check(saved > 0, 'progetto salvato e visibile nella lista');
await page.getByRole('button', { name: 'Chiudi', exact: true }).last().click();

console.log('\n== PWA ==');
const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return { registered: !!reg, scope: reg?.scope };
});
check(sw.registered, `service worker registrato (${sw.scope})`);
const manifest = await page.evaluate(async () => {
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return null;
  const res = await fetch(link.href);
  return res.ok ? await res.json() : null;
});
check(!!manifest && manifest.icons.length >= 2 && manifest.display === 'standalone', 'manifest valido e installabile');

console.log('\n== Responsive ==');
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow <= 2, `nessun overflow orizzontale su mobile (${overflow}px)`);
if (process.env.SHOT_MOBILE) await page.screenshot({ path: process.env.SHOT_MOBILE });
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(300);
if (process.env.SHOT_DESKTOP) await page.screenshot({ path: process.env.SHOT_DESKTOP });

console.log('\n== Offline ==');
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const offlineOk = await page.evaluate(() => !!document.querySelector('#root')?.children.length);
check(offlineOk, 'app funzionante offline dopo il primo caricamento');
await context.setOffline(false);

const realErrors = errors.filter((e) => !/favicon|Download the React DevTools|autoplay/i.test(e));
check(realErrors.length === 0, `nessun errore di console (${realErrors.length})`);
if (realErrors.length) console.log(realErrors.slice(0, 8).join('\n'));

await browser.close();
console.log(failures === 0 ? '\nTUTTI I TEST BROWSER PASSATI' : `\n${failures} TEST FALLITI`);
process.exit(failures === 0 ? 0 : 1);
