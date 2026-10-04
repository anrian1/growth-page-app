// The packs below are TEST FIXTURES with invented numbers. They are not clinical guidance and are never shipped.
import { parseExpression, validatePack, evaluatePack, matchDiagnosis, loadShippedPack } from '../src/guidelines.js';
let failures = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures += 1; console.log(`FAIL  ${name} ${detail}`); } };
const cite = { page: 3, quote: 'TEST QUOTE' };
const rule = (id, when, extra = {}) => ({ id, when, text: `text ${id}`, cite, ...extra });
const pack = (rules, extra = {}) => ({ id: 'test', title: 'TEST PACK', source: { name: 'TEST', year: 2026 }, rules, ...extra });

// ---- expression language ----
const run = (when, env) => { const p = validatePack(pack([rule('r', when)])); if (!p.ok) throw new Error(p.errors.join()); return evaluatePack(p.pack, env).fired.length === 1; };
check('simple comparison', run('sys >= 100', { sys: 100 }) && !run('sys >= 100', { sys: 99 }));
check('and / or / parentheses', run('(sys > 10 or dia > 10) and weight < 100', { sys: 5, dia: 20, weight: 50 }) && !run('(sys > 10 or dia > 10) and weight < 100', { sys: 5, dia: 5, weight: 50 }));
check('not', run('not sys < 10', { sys: 20 }) && !run('not sys < 10', { sys: 5 }));
check('strings: sex == \'L\'', run("sex == 'L' and age >= 18", { sex: 'L', age: 40 }) && !run("sex == 'L'", { sex: 'P' }));
check('decimals', run('bmi >= 22.5', { bmi: 22.9 }) && !run('bmi >= 22.5', { bmi: 22.4 }));
check('missing() lets a rule fire on absent data', run('sys >= 100 and missing(dx)', { sys: 120, dx: null }) && !run('sys >= 100 and missing(dx)', { sys: 120, dx: 'htn' }));
check('and binds tighter than or', run('sys > 100 or dia > 100 and pulse > 100', { sys: 120, dia: 0, pulse: 0 }));
for (const bad of ['sys >>= 3', 'sys >', '(sys > 3', 'sys > 3)', 'foo bar', "sex == 'L", 'and sys > 3', 'sys > 3 and', 'eval(1)']) {
  let threw = false; try { parseExpression(bad); } catch { threw = true; }
  check(`bad condition is rejected: ${bad}`, threw);
}
let t = false; try { parseExpression('constructor.constructor("x")()'); } catch { t = true; }
check('no way to run code from a condition', t);

// ---- validation: no citation, no rule ----
let v = validatePack(pack([{ id: 'a', when: 'sys > 1', text: 'x' }]));
check('a rule without a citation does not load', !v.ok && v.errors[0].includes('citation'), JSON.stringify(v.errors));
v = validatePack(pack([{ id: 'a', when: 'sys > 1', text: 'x', cite: { page: 2 } }]));
check('a rule without an exact quote does not load', !v.ok && v.errors[0].includes('quote'));
v = validatePack(pack([{ id: 'a', when: 'sys > 1', text: 'x', cite: { quote: 'a quote with no page and no section' } }]));
check('a quote without a page or section does not load (a person must be able to find it)', !v.ok && v.errors[0].includes('page or section'), JSON.stringify(v.errors));
v = validatePack(pack([{ id: 'a', when: 'sys > 1', text: 'x', cite: { section: 'Tabel 3', quote: 'q' } }]));
check('a section reference is as good as a page', v.ok);
v = validatePack(pack([rule('a', 'blood > 1')]));
check('an unknown variable is rejected', !v.ok && v.errors[0].includes('unknown variable'));
v = validatePack(pack([rule('a', 'sys > 1'), rule('a', 'dia > 1')]));
check('a repeated rule id is rejected', !v.ok && v.errors[0].includes('twice'));
v = validatePack(pack([rule('a', 'sys > 1', { text: '  ' })]));
check('empty text is rejected', !v.ok);
v = validatePack({ id: 'x', rules: [] });
check('a pack without a source is rejected', !v.ok && v.errors.some((e) => e.includes('source')));
v = validatePack(pack([rule('a', 'sys > 1')]));
check('a pack with no named reviewer is marked as a draft', v.ok && v.pack.draft === true);
v = validatePack(pack([rule('a', 'sys > 1')], { reviewedBy: 'dr. Example' }));
check('a pack with a named reviewer is not a draft', v.ok && v.pack.draft === false);

// ---- evaluation: unknown never matches; skipped rules are reported ----
const p = validatePack(pack([rule('high-sys', 'sys >= 160'), rule('both', 'sys >= 100 and dia >= 60'), rule('no-dx', 'sys >= 100 and missing(dx)')], { diagnoses: [{ id: 'htn', names: ['Hipertensi', 'HT'] }] })).pack;
let e = evaluatePack(p, { sys: 162, dia: 102, dx: null });
check('rules that match are returned with their citation and source', e.fired.map((f) => f.id).join() === 'high-sys,both,no-dx' && e.fired[0].cite.page === 3 && e.fired[0].source.name === 'TEST', JSON.stringify(e));
e = evaluatePack(p, { sys: 162, dia: null, dx: null });
check('a rule that needs a missing number is skipped and says so, never guessed', e.skipped.some((s) => s.id === 'both' && s.why.includes('dia')) && !e.fired.some((f) => f.id === 'both'), JSON.stringify(e));
check('a rule that does not need the missing number still works', e.fired.some((f) => f.id === 'high-sys'));
check('diagnosis names are matched ignoring case', matchDiagnosis(p, 'hipertensi') === 'htn' && matchDiagnosis(p, 'HT') === 'htn' && matchDiagnosis(p, 'flu') === null && matchDiagnosis(p, '') === null);

// ---- loading the shipped pack ----
(async () => {
  let r = await loadShippedPack(async () => ({ ok: false }));
  check('no shipped pack: reported as absent, nothing breaks', !r.ok && r.absent === true);
  r = await loadShippedPack(async () => { throw new Error('offline'); });
  check('a failing fetch is reported as absent', !r.ok && r.absent === true);
  r = await loadShippedPack(async () => ({ ok: true, json: async () => pack([{ id: 'a', when: 'sys > 1', text: 'x' }]) }));
  check('a shipped pack with an invalid rule is refused, with the reasons', !r.ok && r.absent === false && r.errors.length === 1);
  r = await loadShippedPack(async () => ({ ok: true, json: async () => pack([rule('a', 'sys > 1')]) }));
  check('a valid shipped pack loads', r.ok && r.pack.rules.length === 1);
  console.log(`Guidelines: ${pass} passed${failures ? `, ${failures} FAILED` : ''}`);
  process.exit(failures ? 1 : 0);
})();
