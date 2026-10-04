// Guideline checks, built so that nothing is invented at run time.
//
// A "guideline pack" is a reviewed list of rules written from a guideline document (a person, or an AI model with a person
// checking, turns the document into rules BEFORE the app is used). At run time the app only checks the numbers against those
// rules and shows the matching rule with its citation. It never writes clinical advice of its own.
//
// Every rule must carry: a condition ("when"), the text to show, and a citation (page or section) with the exact quote.
// A rule without a citation does not load. A pack without a named reviewer is shown as a DRAFT.

export const VARIABLES = ['sys', 'dia', 'pulse', 'temp', 'weight', 'height', 'bmi', 'age', 'sex', 'dx'];

// ---------------------------------------------------------------- a tiny, safe expression language
//   numbers, 'strings', variables, > >= < <= == !=, and, or, not, ( ), missing(variable)
function tokenize(src) {
  const tokens = []; let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) { let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j += 1; tokens.push({ t: 'num', v: Number(src.slice(i, j)) }); i = j; continue; }
    if (ch === "'") { const j = src.indexOf("'", i + 1); if (j < 0) throw new Error('unterminated string'); tokens.push({ t: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue; }
    if (/[a-z_]/i.test(ch)) { let j = i; while (j < src.length && /[a-z0-9_]/i.test(src[j])) j += 1; tokens.push({ t: 'id', v: src.slice(i, j) }); i = j; continue; }
    const two = src.slice(i, i + 2);
    if (['>=', '<=', '==', '!='].includes(two)) { tokens.push({ t: 'op', v: two }); i += 2; continue; }
    if (['>', '<', '(', ')'].includes(ch)) { tokens.push({ t: ch === '(' || ch === ')' ? ch : 'op', v: ch }); i += 1; continue; }
    throw new Error(`unexpected character "${ch}"`);
  }
  return tokens;
}

export function parseExpression(src) {
  const tokens = tokenize(String(src)); let pos = 0;
  const peek = () => tokens[pos]; const take = () => tokens[pos++];
  const isKw = (t, kw) => t && t.t === 'id' && t.v.toLowerCase() === kw;
  function parseOr() { let left = parseAnd(); while (isKw(peek(), 'or')) { take(); left = { k: 'or', a: left, b: parseAnd() }; } return left; }
  function parseAnd() { let left = parseNot(); while (isKw(peek(), 'and')) { take(); left = { k: 'and', a: left, b: parseNot() }; } return left; }
  function parseNot() { if (isKw(peek(), 'not')) { take(); return { k: 'not', a: parseNot() }; } return parseCmp(); }
  function parseCmp() { const left = parseTerm(); const t = peek(); if (t && t.t === 'op') { take(); return { k: 'cmp', op: t.v, a: left, b: parseTerm() }; } return left; }
  function parseTerm() {
    const t = take(); if (!t) throw new Error('unexpected end');
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === '(') { const e = parseOr(); if (!peek() || peek().t !== ')') throw new Error('missing )'); take(); return e; }
    if (t.t === 'id') {
      if (t.v === 'missing') { if (!peek() || peek().t !== '(') throw new Error('missing( expects a variable'); take(); const v = take(); if (!v || v.t !== 'id') throw new Error('missing( expects a variable'); if (!peek() || peek().t !== ')') throw new Error('missing )'); take(); return { k: 'missing', name: v.v }; }
      if (['and', 'or', 'not'].includes(t.v.toLowerCase())) throw new Error(`unexpected "${t.v}"`);
      return { k: 'var', name: t.v };
    }
    throw new Error('unexpected token');
  }
  const ast = parseOr();
  if (pos < tokens.length) throw new Error('unexpected text after the condition');
  return ast;
}

function referenced(ast, acc = { used: new Set(), guarded: new Set() }) {
  if (!ast) return acc;
  if (ast.k === 'var') acc.used.add(ast.name);
  else if (ast.k === 'missing') acc.guarded.add(ast.name);
  else { referenced(ast.a, acc); referenced(ast.b, acc); }
  return acc;
}

function evaluate(ast, env) {
  switch (ast.k) {
    case 'num': case 'str': return ast.v;
    case 'var': return env[ast.name] === undefined ? null : env[ast.name];
    case 'missing': return env[ast.name] === undefined || env[ast.name] === null || env[ast.name] === '';
    case 'not': return !evaluate(ast.a, env);
    case 'and': return Boolean(evaluate(ast.a, env)) && Boolean(evaluate(ast.b, env));
    case 'or': return Boolean(evaluate(ast.a, env)) || Boolean(evaluate(ast.b, env));
    case 'cmp': {
      const a = evaluate(ast.a, env); const b = evaluate(ast.b, env);
      if (a === null || b === null) return false;                                  // unknown never counts as a match
      switch (ast.op) { case '>': return a > b; case '>=': return a >= b; case '<': return a < b; case '<=': return a <= b; case '==': return a === b; default: return a !== b; }
    }
    default: return false;
  }
}

// ---------------------------------------------------------------- pack validation
export function validatePack(pack) {
  const errors = [];
  if (!pack || typeof pack !== 'object') return { ok: false, errors: ['The pack is not an object.'], pack: null };
  if (!pack.id) errors.push('pack: id is missing');
  if (!pack.title) errors.push('pack: title is missing');
  if (!pack.source || !pack.source.name || !pack.source.year) errors.push('pack: source.name and source.year are required');
  if (!Array.isArray(pack.rules)) errors.push('pack: rules must be a list');
  const ids = new Set(); const rules = [];
  for (const [i, rule] of (pack.rules || []).entries()) {
    const where = `rule ${rule && rule.id ? rule.id : `#${i + 1}`}`;
    const problems = [];
    if (!rule.id) problems.push('id is missing'); else if (ids.has(rule.id)) problems.push('id is used twice'); else ids.add(rule.id);
    if (!rule.text || !String(rule.text).trim()) problems.push('text is missing');
    if (!rule.cite || !(rule.cite.page || rule.cite.section)) problems.push('citation: page or section is required');
    if (!rule.cite || !rule.cite.quote || !String(rule.cite.quote).trim()) problems.push('citation: the exact quote is required');
    let ast = null;
    try {
      ast = parseExpression(rule.when);
      const { used, guarded } = referenced(ast);
      for (const name of [...used, ...guarded]) if (!VARIABLES.includes(name)) problems.push(`unknown variable "${name}" (allowed: ${VARIABLES.join(', ')})`);
    } catch (e) { problems.push(`condition cannot be read: ${e.message}`); }
    if (rule.severity && !['info', 'check'].includes(rule.severity)) problems.push('severity must be info or check');
    if (problems.length) errors.push(`${where}: ${problems.join('; ')}`);
    else rules.push({ ...rule, severity: rule.severity || 'check', _ast: ast, _needs: [...referenced(ast).used] });
  }
  if (errors.length) return { ok: false, errors, pack: null };
  return { ok: true, errors: [], pack: { ...pack, rules, draft: !pack.reviewedBy, diagnoses: pack.diagnoses || [] } };
}

/** values: { sys, dia, pulse, temp, weight, height, bmi, age, sex, dx }. Returns { fired, skipped }. */
export function evaluatePack(pack, values) {
  const fired = []; const skipped = [];
  for (const rule of pack.rules) {
    const unknown = rule._needs.filter((n) => values[n] === null || values[n] === undefined || values[n] === '');
    if (unknown.length) { skipped.push({ id: rule.id, why: `belum ada data: ${unknown.join(', ')}` }); continue; }
    if (evaluate(rule._ast, values)) fired.push({ id: rule.id, text: rule.text, severity: rule.severity, cite: rule.cite, source: pack.source });
  }
  return { fired, skipped };
}

/** Which diagnosis in the pack does a typed or chosen name belong to? Returns the diagnosis id or null. */
export function matchDiagnosis(pack, typed) {
  const t = String(typed || '').trim().toLowerCase();
  if (!t) return null;
  for (const d of pack.diagnoses || []) if ((d.names || []).some((n) => n.toLowerCase() === t) || d.id === t) return d.id;
  return null;
}

/** Load the pack the app ships with (public/guidelines/pack.json). Returns { ok, pack, errors, absent }. */
export async function loadShippedPack(fetchFn = fetch) {
  try {
    const res = await fetchFn('/guidelines/pack.json', { cache: 'no-cache' });
    if (!res.ok) return { ok: false, absent: true, errors: [], pack: null };
    const v = validatePack(await res.json());
    return { ...v, absent: false };
  } catch (e) { return { ok: false, absent: true, errors: [], pack: null }; }
}
