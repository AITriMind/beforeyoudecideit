/**
 * TM-03 — derivation: answers to face states, contradictions, findings and the
 * next test. Pure and deterministic: the same answers always produce the same
 * output, and nothing is latched from a previous answer vector.
 *
 * The specification's default ruleset C-01..C-08 is written against its own six
 * questions. Ours are the owner's, so this ruleset is authored against them and
 * versioned separately (OD-01 allows exactly this). Finding codes are reused
 * from the specification wherever the semantics match, so the NEXT TEST mapping
 * in S4.7.1 keeps working.
 */

import { FACE_IDS, createDecision } from './decision.js?v=26';
import { CHECK_QUESTIONS, CHECK_RULESET_VERSION, categoryFor, signalsFor } from './check-config.js?v=26';

/** @typedef {import('./decision.js').DecisionFaceId} DecisionFaceId */
/** @typedef {import('./decision.js').DecisionFaceState} DecisionFaceState */
/** @typedef {import('./decision.js').DecisionSignal} DecisionSignal */

/**
 * A signal's baseline claim about its face. `tested` means the check actually
 * established something; `unresolved` means the face is in play and open.
 * @type {Readonly<Record<DecisionSignal, {face: DecisionFaceId, state: DecisionFaceState}>>}
 */
export const SIGNAL_BASELINE = Object.freeze({
  'market:evidence-validated': { face: 'market', state: 'tested' },
  'market:evidence-signal': { face: 'market', state: 'unresolved' },
  'market:evidence-none': { face: 'market', state: 'unresolved' },
  'money:downside-contained': { face: 'money', state: 'tested' },
  'money:downside-material-funded': { face: 'money', state: 'tested' },
  'money:downside-material-unfunded': { face: 'money', state: 'unresolved' },
  'team:aligned': { face: 'team', state: 'tested' },
  'team:mixed': { face: 'team', state: 'unresolved' },
  'team:opposed': { face: 'team', state: 'unresolved' },
  'timing:external': { face: 'timing', state: 'tested' },
  'timing:internal': { face: 'timing', state: 'unresolved' },
  'timing:none': { face: 'timing', state: 'unresolved' },
  'implementation:defined-reversible': { face: 'implementation', state: 'tested' },
  'implementation:defined-irreversible': { face: 'implementation', state: 'tested' },
  'implementation:undefined': { face: 'implementation', state: 'unresolved' },
  'personal:open': { face: 'personal-cost', state: 'tested' },
  'personal:committed': { face: 'personal-cost', state: 'tested' },
  'personal:confirmation': { face: 'personal-cost', state: 'unresolved' }
});

/** `tested` beats `untested`; `unresolved` beats both. */
const RANK = { untested: 0, tested: 1, unresolved: 2 };

/**
 * The contradiction ruleset. Each rule is a pure predicate over the selected
 * option ids; a rule that fires cracks exactly one face.
 */
export const RULES = Object.freeze([
  {
    id: 'R-01',
    faceId: 'timing',
    severity: 'break',
    findingCode: 'COMMITMENT_WITHOUT_TIMING_BASIS',
    test: (ids) =>
      (ids.includes('clarity-chosen-collecting') || ids.includes('clarity-stopped-checking')) &&
      ids.includes('deadline-no') &&
      ids.includes('why-long-time')
  },
  {
    id: 'R-02',
    faceId: 'money',
    severity: 'break',
    findingCode: 'COMMITMENT_EXCEEDS_FUNDED_DOWNSIDE',
    test: (ids) => ids.includes('clarity-already-invested') && ids.includes('stake-money')
  },
  {
    id: 'R-03',
    faceId: 'implementation',
    severity: 'break',
    findingCode: 'DEADLINE_WITHOUT_EXECUTABLE_NEXT_STEP',
    test: (ids) =>
      (ids.includes('clarity-chosen-collecting') || ids.includes('clarity-researching')) &&
      (ids.includes('deadline-yes') || ids.includes('why-deadline'))
  },
  {
    id: 'R-04',
    faceId: 'team',
    severity: 'break',
    findingCode: 'COMMITMENT_WITH_REQUIRED_TEAM_OPPOSITION',
    test: (ids) =>
      ids.includes('clarity-partner-differs') &&
      (ids.includes('why-push') || ids.includes('stake-partner') || ids.includes('stake-team'))
  },
  {
    id: 'R-05',
    faceId: 'personal-cost',
    severity: 'break',
    findingCode: 'CONFIRMATION_SEEKING_WITH_WEAK_EVIDENCE',
    test: (ids) =>
      ids.includes('clarity-stopped-checking') &&
      (ids.includes('stake-money') || ids.includes('stake-months'))
  },
  {
    id: 'R-06',
    faceId: 'personal-cost',
    severity: 'warning',
    findingCode: 'UNRESOLVED_STATE_WITH_BROAD_EXPOSURE',
    test: (ids) =>
      ids.includes('clarity-fear-excitement') &&
      ids.filter((id) => id.startsWith('stake-')).length >= 3
  }
]);

/** The finding copy, keyed by code. Both languages live in the page dictionary. */
export const FINDING_KEYS = Object.freeze({
  COMMITMENT_WITHOUT_TIMING_BASIS: 'finding.timingBasis',
  COMMITMENT_EXCEEDS_FUNDED_DOWNSIDE: 'finding.fundedDownside',
  DEADLINE_WITHOUT_EXECUTABLE_NEXT_STEP: 'finding.executableStep',
  COMMITMENT_WITH_REQUIRED_TEAM_OPPOSITION: 'finding.teamOpposition',
  CONFIRMATION_SEEKING_WITH_WEAK_EVIDENCE: 'finding.confirmationSeeking',
  UNRESOLVED_STATE_WITH_BROAD_EXPOSURE: 'finding.broadExposure'
});

/** S4.7.1 — one NEXT TEST per finding code. */
export const NEXT_TEST_BY_FINDING = Object.freeze({
  COMMITMENT_WITHOUT_TIMING_BASIS: 'nextTest.timingBasis',
  COMMITMENT_EXCEEDS_FUNDED_DOWNSIDE: 'nextTest.fundedDownside',
  DEADLINE_WITHOUT_EXECUTABLE_NEXT_STEP: 'nextTest.executableStep',
  COMMITMENT_WITH_REQUIRED_TEAM_OPPOSITION: 'nextTest.teamOpposition',
  CONFIRMATION_SEEKING_WITH_WEAK_EVIDENCE: 'nextTest.confirmationSeeking',
  UNRESOLVED_STATE_WITH_BROAD_EXPOSURE: 'nextTest.broadExposure'
});

/** S4.7.1 — fallback per unresolved face, walked in FACE_IDS order. */
export const NEXT_TEST_BY_FACE = Object.freeze({
  market: 'nextTest.faceMarket',
  money: 'nextTest.faceMoney',
  team: 'nextTest.faceTeam',
  timing: 'nextTest.faceTiming',
  implementation: 'nextTest.faceImplementation',
  'personal-cost': 'nextTest.facePersonalCost'
});

export const NEXT_TEST_CLEAN = 'nextTest.clean';

/**
 * Face states from the selected options alone. Recomputed from scratch every
 * time, so changing an earlier answer can only remove a contradiction.
 *
 * @param {readonly string[]} optionIds
 * @returns {Record<DecisionFaceId, DecisionFaceState>}
 */
export function deriveFaceStates(optionIds) {
  /** @type {Record<string, DecisionFaceState>} */
  const faces = {};
  for (const id of FACE_IDS) faces[id] = 'untested';

  for (const signal of signalsFor(optionIds)) {
    const baseline = SIGNAL_BASELINE[signal];
    if (!baseline) continue;
    if (RANK[baseline.state] > RANK[faces[baseline.face]]) faces[baseline.face] = baseline.state;
  }

  for (const rule of RULES) {
    if (rule.severity === 'break' && rule.test(optionIds)) faces[rule.faceId] = 'contradicted';
  }
  return /** @type {Record<DecisionFaceId, DecisionFaceState>} */ (faces);
}

/**
 * @param {readonly string[]} optionIds
 * @returns {readonly import('./decision.js').DecisionContradiction[]}
 */
export function deriveContradictions(optionIds) {
  return RULES.filter((rule) => rule.test(optionIds)).map((rule) => ({
    ruleId: rule.id,
    rulesetVersion: CHECK_RULESET_VERSION,
    faceId: rule.faceId,
    severity: rule.severity,
    evidenceOptionIds: evidenceFor(rule, optionIds),
    findingCode: rule.findingCode
  }));
}

/**
 * Findings, ordered: breaks before warnings, then by face order, so
 * `findings[0]` is stable for the same answers.
 *
 * @param {readonly import('./decision.js').DecisionContradiction[]} contradictions
 * @returns {readonly import('./decision.js').DecisionFinding[]}
 */
export function deriveFindings(contradictions) {
  return [...contradictions]
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'break' ? -1 : 1;
      return FACE_IDS.indexOf(a.faceId) - FACE_IDS.indexOf(b.faceId);
    })
    .map((c) => ({
      code: c.findingCode,
      faceId: c.faceId,
      priority: c.severity === 'break' ? 1 : 2,
      titleKey: `${FINDING_KEYS[c.findingCode]}.title`,
      bodyKey: `${FINDING_KEYS[c.findingCode]}.body`
    }));
}

/**
 * Exactly one next test. Priority: the first finding, else the first unresolved
 * face in fixed order, else the clean fallback.
 *
 * @param {object} derived
 * @param {readonly import('./decision.js').DecisionFinding[]} derived.findings
 * @param {Record<DecisionFaceId, DecisionFaceState>} derived.faceStates
 * @returns {string} a dictionary key
 */
export function deriveNextTest({ findings, faceStates }) {
  if (findings.length) return NEXT_TEST_BY_FINDING[findings[0].code] || NEXT_TEST_CLEAN;
  for (const id of FACE_IDS) {
    if (faceStates[id] === 'unresolved') return NEXT_TEST_BY_FACE[id];
  }
  return NEXT_TEST_CLEAN;
}

/**
 * Everything derived, in one pass.
 * @param {readonly string[]} optionIds
 */
export function derive(optionIds) {
  const faceStates = deriveFaceStates(optionIds);
  const contradictions = deriveContradictions(optionIds);
  const findings = deriveFindings(contradictions);
  return {
    rulesetVersion: CHECK_RULESET_VERSION,
    faceStates,
    contradictions,
    findings,
    nextTestKey: deriveNextTest({ findings, faceStates })
  };
}

/**
 * The options that made a rule fire, for the record.
 * @param {{test: (ids: readonly string[]) => boolean}} rule
 * @param {readonly string[]} optionIds
 */
function evidenceFor(rule, optionIds) {
  return optionIds.filter((id) => {
    const without = optionIds.filter((other) => other !== id);
    return !rule.test(without);
  });
}

/** Every option id the configuration knows, for test coverage assertions. */
export function allOptionIds() {
  return CHECK_QUESTIONS.flatMap((q) => q.options.map((o) => o.id));
}

/**
 * Build a complete Decision from selected option ids. The map, the OG plate and
 * the tests all use this, so a plate is never rendered from an ad-hoc object.
 *
 * @param {readonly string[]} optionIds
 * @param {object} init
 * @param {string} init.id
 * @param {string} init.title
 * @param {object} [init.copy] resolves finding codes to title/body
 * @param {string} [init.now] ISO-8601 UTC, injected to keep output deterministic
 * @param {string} [init.slug]
 * @returns {import('./decision.js').Decision}
 */
export function decisionFrom(optionIds, { id, title, copy = null, now = '2026-01-01T00:00:00.000Z', slug }) {
  const derived = derive(optionIds);
  const answers = [];
  for (const q of CHECK_QUESTIONS) {
    for (const option of q.options) {
      if (optionIds.includes(option.id)) answers.push({ questionId: q.id, optionId: option.id, answeredAt: now });
    }
  }
  const findings = derived.findings.map((finding) => ({
    code: finding.code,
    faceId: finding.faceId,
    priority: finding.priority,
    title: copy ? lookup(copy, finding.titleKey) : finding.titleKey,
    body: copy ? lookup(copy, finding.bodyKey) : finding.bodyKey
  }));
  const base = createDecision({ id, questions: CHECK_QUESTIONS, title, category: categoryFor(optionIds), slug, now });
  return {
    ...base,
    status: 'completed',
    answers,
    derived: {
      rulesetVersion: derived.rulesetVersion,
      faceStates: derived.faceStates,
      contradictions: derived.contradictions,
      findings
    }
  };
}

/** @param {object} source @param {string} path */
function lookup(source, path) {
  return path.split('.').reduce((value, key) => (value == null ? value : value[key]), source);
}
