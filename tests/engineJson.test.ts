import assert from 'node:assert/strict';
import { EngineOutputError, parseEngineJson, readCohorts, repairTruncatedJson } from '../lib/engineJson';
import { buildEngineInput, isSeenTitle, titleKeys } from '../lib/engineInput';
import { selectTasteSignals } from '../lib/tasteSignals';
import { thinkingConfigFor, allowsCustomTemperature, isThinkingConfigError } from '../lib/geminiModels';
import { ENGINE_ERROR_MESSAGES, ENGINE_ERROR_STATUS, classifyGeminiFailure } from '../lib/engineErrors';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name); };

const sample = {
  taste_profile_summary: 'S',
  masterpiece_cohort: [{ title: 'A', note: 'has "quotes", commas and } braces {' }, { title: 'B' }],
  excellent_cohort: [{ title: 'C' }, { title: 'D' }],
};
const full = JSON.stringify(sample);

t('strict JSON and fenced JSON both parse without repair', () => {
  assert.equal(parseEngineJson(full).repaired, false);
  assert.equal(parseEngineJson('```json\n' + full + '\n```').repaired, false);
});

t('truncation anywhere keeps every complete film and never throws on valid prefixes', () => {
  let repairedCount = 0;
  for (let cut = 20; cut < full.length - 1; cut++) {
    try {
      const out = parseEngineJson(full.slice(0, cut));
      repairedCount++;
      const c = readCohorts(out.data);
      assert.ok(c.masterpiece.length <= 2 && c.excellent.length <= 2);
    } catch (e) {
      assert.ok(e instanceof EngineOutputError); // only allowed failure mode
    }
  }
  assert.ok(repairedCount > 20);
  const mid = full.slice(0, full.indexOf('"C"') + 2); // cut inside the 3rd film
  const c = readCohorts(parseEngineJson(mid).data);
  assert.deepEqual(c.masterpiece.map((f) => f.title), ['A', 'B']);
});

t('strings containing brackets and quotes do not confuse the repair', () => {
  const cut = full.slice(0, full.indexOf('"B"') - 2);
  const fixed = repairTruncatedJson(cut);
  assert.ok(fixed);
  assert.equal((JSON.parse(fixed!) as typeof sample).masterpiece_cohort[0].title, 'A');
});

t('garbage and empty text raise EngineOutputError', () => {
  assert.throws(() => parseEngineJson(''), EngineOutputError);
  assert.throws(() => parseEngineJson('Sorry, I cannot help with that.'), EngineOutputError);
});

t('readCohorts accepts camelCase and drops entries without a title', () => {
  const c = readCohorts({ tasteProfileSummary: 'x', masterpieceCohort: [{ title: 'A' }, { year: 1 }, null, { title: '  ' }], excellentCohort: 'nope' });
  assert.equal(c.summary, 'x');
  assert.equal(c.masterpiece.length, 1);
  assert.equal(c.excellent.length, 0);
});

t('thinking is minimised per model family and temperature is left alone on gemini-3', () => {
  assert.equal(String(thinkingConfigFor('gemini-3.8-flash')?.thinkingLevel).toLowerCase(), 'low');
  assert.equal(String(thinkingConfigFor('gemini-3.8-pro')?.thinkingLevel).toLowerCase(), 'low');
  assert.equal(thinkingConfigFor('gemini-2.5-flash')?.thinkingBudget, 0);
  assert.equal(thinkingConfigFor('gemini-2.5-flash-lite')?.thinkingBudget, 0);
  assert.ok((thinkingConfigFor('gemini-2.5-pro')?.thinkingBudget ?? 0) >= 128); // pro cannot be switched off
  assert.equal(thinkingConfigFor('gemini-flash-latest'), undefined);
  assert.equal(allowsCustomTemperature('gemini-3.8-flash'), false);
  assert.equal(allowsCustomTemperature('gemini-2.5-flash'), true);
  assert.equal(isThinkingConfigError(new Error('400 INVALID_ARGUMENT: thinking level not supported')), true);
  assert.equal(isThinkingConfigError(new Error('400 INVALID_ARGUMENT: API key not valid')), false);
});

t('every error code has a message and an HTTP status; failures are classified', () => {
  for (const code of Object.keys(ENGINE_ERROR_MESSAGES) as Array<keyof typeof ENGINE_ERROR_MESSAGES>) {
    assert.ok(ENGINE_ERROR_MESSAGES[code].length > 10);
    assert.ok(ENGINE_ERROR_STATUS[code] >= 400);
  }
  assert.equal(classifyGeminiFailure(new Error('429 RESOURCE_EXHAUSTED quota')), 'quota');
  assert.equal(classifyGeminiFailure(new Error('API key not valid')), 'invalid_api_key');
  assert.equal(classifyGeminiFailure(new Error('503 UNAVAILABLE')), 'busy');
  assert.equal(classifyGeminiFailure(new Error('weird')), 'internal');
});

t('engine input: release year (not log date), unrated is not a signal, one count per film', () => {
  const csv = [
    'Date,Name,Year,Letterboxd URI,Rating',
    '2024-05-01,"Cure",1997,https://boxd.it/a,4.5',
    '2024-05-02,"The Thing",1982,https://boxd.it/b,',
    '2024-05-03,"Hail, Caesar!",2016,https://boxd.it/c,3.0',
    '2024-05-04,"Amélie",2001,https://boxd.it/d,5.0',
  ].join('\n');
  const input = buildEngineInput(csv, [
    { title: 'Stalker', year: '1979', rating: undefined, watchedDate: '2024-06-01', letterboxdUrl: '' }, // unrated RSS entry
  ]);
  assert.equal(input.watchedCount, 5);
  assert.deepEqual(input.signals.map((s) => [s.name, s.year, s.rating]).sort(), [['Amélie', '2001', 5], ['Cure', '1997', 4.5]]);
  assert.ok(input.watchedKeys.size > input.watchedCount); // the key set is larger, the count is not
  assert.equal(isSeenTitle('Thing', input.watchedKeys), true);
  assert.equal(isSeenTitle('Amelie', input.watchedKeys), true);
  assert.equal(isSeenTitle('Hail Caesar', input.watchedKeys), true);
  assert.equal(isSeenTitle('Stalker', input.watchedKeys), true);
  assert.equal(isSeenTitle('Burning', input.watchedKeys), false);
  assert.deepEqual(titleKeys('The Thing'), ['thething', 'thing']);
});

t('scale: 5,000 films build + select in well under a second with a bounded payload', () => {
  const rows = ['Date,Name,Year,Letterboxd URI,Rating'];
  for (let i = 0; i < 5000; i++) rows.push(`2023-01-01,Film ${i},${1930 + (i % 90)},https://boxd.it/${i},${['4', '4.5', '5', '3', ''][i % 5]}`);
  const started = Date.now();
  const input = buildEngineInput(rows.join('\n'), []);
  const sel = selectTasteSignals(input.signals);
  assert.ok(Date.now() - started < 1500);
  assert.equal(input.watchedCount, 5000);
  assert.equal(sel.count, 300);
  assert.ok(sel.payload.length < 12_000);
});

console.log(`\n${n} engine json/input tests passed`);
