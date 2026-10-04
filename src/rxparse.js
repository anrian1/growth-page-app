// Prescription reader: free text (from the Asessemen and Planning areas) -> malaria type, test result, drug amounts and days.
// It matches words from a FIXED LIST (a letter or two wrong is tolerated: "Primakuim" still counts as primakuin) and converts shorthand to numbers.
// It never guesses: two different values, an amount that is not on the tablet list, or a missing frequency all leave the field BLANK,
// and the screen shows the handwriting next to what was understood so a person can confirm or correct it.

export const TABLET_VALUES = ['1/4', '1/3', '1/2', '3/4', '1', '3/2', '2', '3', '4', '5'];   // same list as the dose card
const FRAC_VALUE = { '1/4': 0.25, '1/3': 1 / 3, '1/2': 0.5, '3/4': 0.75, '1': 1, '3/2': 1.5, '2': 2, '3': 3, '4': 4, '5': 5 };

// ---------------------------------------------------------------- normalising text
const NUMBER_WORDS = { satu: '1', dua: '2', tiga: '3', empat: '4', lima: '5', setengah: '1/2', seperempat: '1/4', sepertiga: '1/3' };

export function normalise(text) {
  let s = String(text ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/\u00bd/g, ' 1/2 ').replace(/\u00bc/g, ' 1/4 ').replace(/\u00be/g, ' 3/4 ').replace(/\u2153/g, ' 1/3 ').replace(/\u2154/g, ' 2/3 ');
  s = s.replace(/[\u00d7\u2715\u2716*]/g, 'x');
  s = s.replace(/(\d),(\d)/g, '$1.$2');                              // decimal comma (digits touching the comma only: "1x1, 3 hari" is a list, not 1.3)
  s = s.replace(/,/g, ' ');
  s = s.replace(/(^|[^a-z])[li]\s*\/\s*(\d)/g, '$11/$2');             // "l/2" or "I/2" read for 1/2
  s = s.replace(/(\d)\s*\/\s*(\d)/g, '$1/$2');
  s = s.replace(/(?<=\d)o(?=\d|\b)/g, '0');                          // "1o" for 10
  s = s.replace(/\b(satu|dua|tiga|empat|lima|setengah|seperempat|sepertiga)\b/g, (w) => ` ${NUMBER_WORDS[w]} `);
  s = s.replace(/[;:()\[\]{}"'`]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function compactWithMap(spaced) {
  let compact = ''; const map = [];
  for (let i = 0; i < spaced.length; i += 1) { const ch = spaced[i]; if (/[a-z0-9]/.test(ch)) { compact += ch; map.push(i); } }
  return { compact, map };
}

// ---------------------------------------------------------------- approximate substring search (a few wrong letters allowed)
export function approxFind(hay, needle, k) {
  const m = needle.length; const n = hay.length;
  let prevD = Array.from({ length: m + 1 }, (_, i) => i); let prevS = new Array(m + 1).fill(0);
  let best = null;
  for (let j = 1; j <= n; j += 1) {
    const curD = new Array(m + 1); const curS = new Array(m + 1);
    curD[0] = 0; curS[0] = j;
    for (let i = 1; i <= m; i += 1) {
      const cost = needle[i - 1] === hay[j - 1] ? 0 : 1;
      let d = prevD[i - 1] + cost; let s = prevS[i - 1];
      if (curD[i - 1] + 1 < d) { d = curD[i - 1] + 1; s = curS[i - 1]; }
      if (prevD[i] + 1 < d) { d = prevD[i] + 1; s = prevS[i]; }
      curD[i] = d; curS[i] = s;
    }
    if (curD[m] <= k && (!best || curD[m] < best.dist)) best = { dist: curD[m], start: curS[m], end: j };
    prevD = curD; prevS = curS;
  }
  return best;
}
const allowed = (len) => (len <= 5 ? 0 : len <= 8 ? 1 : len <= 12 ? 2 : 3);

// ---------------------------------------------------------------- vocabulary (fixed lists)
const SPECIES_WORDS = {
  falciparum: [['falciparum', 1], ['falsiparum', 1], ['falcifarum', 1], ['tropika', 1], ['tropicana', 1], ['tropica', 0]],
  vivax: [['vivax', 1], ['vivaks', 1], ['tertiana', 1], ['tersiana', 1], ['tertian', 0]],
  ovale: [['ovale', 1]],
  mixed: [['campuran', 2], ['campur', 1], ['mixed', 0], ['mix', 0]],
  malariae: [['malariae', 0], ['kuartana', 1], ['quartana', 1]],       // exact only: with one wrong letter "malaria" itself would match
  knowlesi: [['knowlesi', 1]],
};
const SPECIES_TOKENS = { pf: 'falciparum', pv: 'vivax' };
const DRUG_WORDS = {
  dhp: [['dihidroartemisininpiperakuin', 4], ['dihidroartemisinin', 3], ['piperakuin', 2], ['piperaquine', 2], ['dhp', 0]],
  pq: [['primakuin', 2], ['primaquine', 2], ['primakin', 1]],
  art: [['artesunate', 2], ['artesunat', 1]],
};
const DRUG_TOKENS = { pq: ['pq'] };

function findWord(compact, entries) {
  let best = null;
  for (const [word, k] of entries) {
    const hit = approxFind(compact, word, k === undefined ? allowed(word.length) : k);
    if (hit && (!best || hit.dist < best.dist || (hit.dist === best.dist && word.length > best.word.length))) best = { ...hit, word };
  }
  return best;
}

// ---------------------------------------------------------------- amounts
const FRAC_RE = '(?:\\d+\\s+\\d\\/\\d|\\d\\/\\d|\\d+(?:\\.\\d+)?)';
export function toTablets(raw) {
  const t = String(raw).trim();
  let v;
  let m = /^(\d+)\s+(\d)\/(\d)$/.exec(t);
  if (m) v = Number(m[1]) + Number(m[2]) / Number(m[3]);
  else if ((m = /^(\d)\/(\d)$/.exec(t))) v = Number(m[1]) / Number(m[2]);
  else if (/^\d+(\.\d+)?$/.test(t)) v = Number(t);
  else return { value: null, raw };
  const hit = TABLET_VALUES.find((k) => Math.abs(FRAC_VALUE[k] - v) < 0.012);
  return { value: hit ?? null, raw, number: v };
}
const mul = (a, b) => a * b;

/** one drug's text -> { tablets, days, times, flags } (all null/empty when not understood) */
export function parseDrugText(segment) {
  const out = { tablets: null, tabletsRaw: null, days: null, times: null, flags: [] };
  let t = ` ${segment} `;
  // days: "selama 3 hari", "x 3 hari", "14 hari" (a second, different number of days is a conflict)
  const dayHits = [...t.matchAll(/(\d{1,2})\s*(?:[hk]a[rn][il1]|hr)\b/g)];
  const dayValues = [...new Set(dayHits.map((h) => Number(h[1])))].filter((d) => d >= 1 && d <= 30);
  if (dayValues.length === 1) out.days = dayValues[0]; else if (dayValues.length > 1) out.flags.push('hari: lebih dari satu angka');
  for (const h of dayHits) t = t.replace(h[0], ' ');
  // frequency x amount: "1x1", "1x3", "3x1", "1 x 1/2", "1 dd 1"
  let perDayFromProduct = null;
  const prod = new RegExp(`(\\d+)\\s*(?:x|dd)\\s*(${FRAC_RE})`).exec(t);
  let prodIndex = null; let prodBefore = '';
  if (prod) {
    prodIndex = prod.index; prodBefore = t.slice(0, prod.index);
    t = t.replace(prod[0], ' ');
    const times = Number(prod[1]); const per = toTablets(prod[2]);
    if (per.number !== undefined && times >= 1 && times <= 6) { out.times = times; perDayFromProduct = { value: mul(times, per.number), raw: `${prod[1]}x${prod[2]}` }; }
  }
  // "3x sehari": times only
  const timesOnly = /(\d)\s*x\s*(?:sehari|\/hari|per hari)/.exec(t);
  if (timesOnly) { out.times = out.times ?? Number(timesOnly[1]); t = t.replace(timesOnly[0], ' '); }
  // an explicit amount with a tablet word: "1/2 tab", "2 tablet"; or per day: "2 tablet sehari", "1.5 /hari"
  let lead = new RegExp(`(${FRAC_RE})\\s*(?:tab\\w*|tb\\b)`).exec(t);
  if (!lead && prodIndex !== null) {                                   // the unit word may be garbled ("+ab"): a number right before the product is still the amount
    const before = prodBefore;
    const nums = [...before.matchAll(new RegExp(FRAC_RE, 'g'))];
    const last = nums[nums.length - 1];
    if (last) { const after = before.slice(last.index + last[0].length); if (/^[^0-9]{0,6}$/.test(after) && !/^\s*mg/.test(after)) lead = [last[0], last[0]]; }
  }
  const perDay = new RegExp(`(${FRAC_RE})\\s*(?:tab\\w*|tb\\b)?\\s*(?:sehari|\\/hari|per hari)`).exec(t);
  let number = null; let raw = null;
  if (perDayFromProduct) {
    const amt = lead ? toTablets(lead[1]) : null;
    if (lead && amt.number === undefined) { out.flags.push('jumlah tidak terbaca'); }
    else { number = perDayFromProduct.value * (amt ? amt.number : 1); raw = (lead ? `${lead[1]} tab ` : '') + perDayFromProduct.raw; }
  } else if (perDay) { const amt = toTablets(perDay[1]); if (amt.number !== undefined) { number = amt.number; raw = `${perDay[1]} tab sehari`; } }
  else if (lead) out.flags.push('jumlah per hari tidak jelas (frekuensi tidak ditulis)');
  if (number !== null) {
    out.tabletsRaw = raw;
    const hit = TABLET_VALUES.find((k) => Math.abs(FRAC_VALUE[k] - number) < 0.012);
    if (hit) out.tablets = hit; else out.flags.push(`jumlah ${Math.round(number * 100) / 100} tablet/hari tidak ada di daftar`);
  }
  return out;
}

// ---------------------------------------------------------------- one reading -> everything it says
export function parseRx(text) {
  const spaced = normalise(text);
  const { compact, map } = compactWithMap(spaced);
  const r = { species: null, speciesWeak: false, speciesConflict: false, testResult: null, severe: false, dispersible: false, dhp: null, pq: null, art: null, spaced };

  // species
  const found = new Set(); let fromWords = false;
  for (const [sp, entries] of Object.entries(SPECIES_WORDS)) if (findWord(compact, entries)) { found.add(sp); fromWords = true; }
  for (const tok of spaced.split(' ')) { const t = tok.replace(/\./g, ''); if (SPECIES_TOKENS[t]) found.add(SPECIES_TOKENS[t]); }
  if (found.has('mixed') || (found.has('falciparum') && (found.has('vivax') || found.has('ovale')))) { found.delete('falciparum'); found.delete('vivax'); found.delete('ovale'); found.delete('mixed'); found.add('mixed'); }
  if (found.size === 1) r.species = [...found][0]; else if (found.size > 1) r.speciesConflict = true;
  r.speciesWeak = r.species !== null && !fromWords;

  // blood test result
  const neg = findWord(compact, [['negatif', 1], ['negative', 1]]) || /\(\s*-\s*\)|\b(?:rdt|sd)\s*-(?!\d)/.test(String(text).toLowerCase());
  const pos = findWord(compact, [['positif', 1], ['positive', 1]]) || /\(\s*\+\s*\)/.test(String(text));
  if (neg && !pos) r.testResult = 'negative'; else if (pos && !neg) r.testResult = 'positive';

  // severe malaria (the word "berat" followed by a number is a body weight, not "severe")
  r.severe = /\bberat\b(?!\s*[:=]?\s*\d)/.test(spaced) || !!findWord(compact, [['severe', 0], ['serebral', 1], ['cerebral', 1], ['komplikasi', 1]]);
  r.dispersible = !!findWord(compact, [['dispersibel', 2], ['dispersible', 2]]);

  // drugs and the text that belongs to each
  const mentions = [];
  for (const [drug, entries] of Object.entries(DRUG_WORDS)) {
    const hit = findWord(compact, entries);
    if (hit) mentions.push({ drug, start: map[hit.start], end: map[hit.end - 1] + 1 });
  }
  let pos0 = 0;
  for (const tok of spaced.split(' ')) { const start = spaced.indexOf(tok, pos0); pos0 = start + tok.length; if ((DRUG_TOKENS.pq || []).includes(tok.replace(/\./g, '')) && !mentions.some((m) => m.drug === 'pq')) mentions.push({ drug: 'pq', start, end: pos0 }); }
  mentions.sort((a, b) => a.start - b.start);
  mentions.forEach((m, i) => {
    const next = mentions.slice(i + 1).find((x) => x.drug !== m.drug);
    const segment = spaced.slice(m.end, next ? next.start : spaced.length);
    if (m.drug === 'art') {
      const mg = [...segment.matchAll(/(\d+(?:\.\d+)?)\s*mg\b/g)].map((h) => Number(h[1]));
      const distinct = [...new Set(mg)];
      r.art = { mentioned: true, mg: distinct.length === 1 ? distinct[0] : null, flags: distinct.length > 1 ? ['mg: lebih dari satu angka'] : [], segment };
      r.severe = true;
    } else if (!r[m.drug]) r[m.drug] = { mentioned: true, ...parseDrugText(segment), segment };
  });
  return r;
}

// ---------------------------------------------------------------- several readings of the same page -> one answer per field
function tally(values) {
  const present = values.filter((v) => v !== null && v !== undefined);
  const counts = new Map();
  for (const v of present) counts.set(v, (counts.get(v) || 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return { ranked, present };
}

/**
 * voteRx({ assess: [text, ...], plan: [text, ...] }) -> { fields, notes }
 * Each reading is parsed on its own. A value is accepted only when it appears in at least 2 readings and no other value ties it:
 *   votes == readings  -> 'ok'; votes == readings - 1 (and at least 2) -> 'check'; anything else -> 'none' (not found) or 'unclear' (conflict or too few).
 * fields: { species, testResult, treatment, formulation, dhpTablets, dhpDays, dhpTimes, pqTablets, pqDays, artesunateMg }  each { value, status, votes, of, candidates, evidence }
 */
export function voteRx({ assess = [], plan = [] }) {
  const groups = [{ name: 'assess', texts: assess }, { name: 'plan', texts: plan }].filter((g) => g.texts.length);
  const parsed = groups.flatMap((g) => g.texts.map((text) => ({ group: g.name, text, p: parseRx(text) })));
  const field = (key, pick) => {
    const per = parsed.map((x) => ({ group: x.group, text: x.text, v: pick(x.p) }));
    const { ranked, present } = tally(per.map((x) => x.v));
    // N = number of readings in the group where this field was found most often (the page may use one area for everything)
    const byGroup = {};
    for (const x of per) if (x.v !== null && x.v !== undefined) byGroup[x.group] = (byGroup[x.group] || 0) + 1;
    const bestGroup = Object.entries(byGroup).sort((a, b) => b[1] - a[1])[0];
    const n = bestGroup ? groups.find((g) => g.name === bestGroup[0]).texts.length : (groups[0] ? groups[0].texts.length : 0);
    const out = { value: null, status: 'none', votes: 0, of: n, candidates: ranked.map((r2) => r2[0]), evidence: null };
    if (!present.length) return out;
    const [top, topVotes] = ranked[0]; const second = ranked[1] ? ranked[1][1] : 0;
    out.votes = topVotes;
    if (topVotes >= 2 && topVotes > second) {
      out.value = top; out.status = topVotes >= n ? 'ok' : topVotes >= n - 1 ? 'check' : 'unclear';
      if (out.status === 'unclear') out.value = null;
      out.evidence = per.find((x) => x.v === top).text;
      if (key === 'species' && parsed.filter((x) => x.p.species === top).every((x) => x.p.speciesWeak) && out.status === 'ok') out.status = 'check';
    } else out.status = 'unclear';
    return out;
  };
  const fields = {
    species: field('species', (p) => p.species),
    testResult: field('testResult', (p) => p.testResult),
    treatment: field('treatment', (p) => (p.severe ? 'severe' : p.dhp || p.pq || p.species ? 'uncomplicated' : null)),
    formulation: field('formulation', (p) => (p.dispersible ? 'dispersible' : null)),
    dhpTablets: field('dhpTablets', (p) => (p.dhp ? p.dhp.tablets : null)),
    dhpDays: field('dhpDays', (p) => (p.dhp ? p.dhp.days : null)),
    dhpTimes: field('dhpTimes', (p) => (p.dhp ? p.dhp.times : null)),
    pqTablets: field('pqTablets', (p) => (p.pq ? p.pq.tablets : null)),
    pqDays: field('pqDays', (p) => (p.pq ? p.pq.days : null)),
    artesunateMg: field('artesunateMg', (p) => (p.art ? p.art.mg : null)),
  };
  const mentions = (pick) => parsed.filter((x) => pick(x.p)).length;
  const notes = [];
  if (fields.species.status === 'unclear' && parsed.some((x) => x.p.speciesConflict)) notes.push('jenis malaria: dua jenis berbeda tertulis');
  if (fields.dhpTimes.value !== null && fields.dhpTimes.value > 1) notes.push(`DHP ditulis ${fields.dhpTimes.value}x sehari; pedoman: DHP sekali sehari`);
  const dhpSeen = mentions((p) => p.dhp); const pqSeen = mentions((p) => p.pq);
  return { fields, notes, parsed: parsed.map((x) => ({ group: x.group, text: x.text })), dhpMentioned: dhpSeen >= 2, pqMentioned: pqSeen >= 2, readings: parsed.length };
}
