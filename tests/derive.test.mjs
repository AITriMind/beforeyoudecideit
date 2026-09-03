/**
 * TM-03 — derivation and the contradiction ruleset, with the fixtures the
 * specification requires: every rule has one that fires it, and one answer
 * vector produces no contradiction at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_IDS } from '../assets/domain/decision.js';
import {
  CHECK_QUESTIONS,
  CHECK_RULESET_VERSION,
  categoryFor,
  optionIdFor,
  signalsFor
} from '../assets/domain/check-config.js';
import {
  NEXT_TEST_BY_FACE,
  NEXT_TEST_BY_FINDING,
  NEXT_TEST_CLEAN,
  RULES,
  SIGNAL_BASELINE,
  allOptionIds,
  derive,
  deriveFaceStates
} from '../assets/domain/derive.js';

/** A clean baseline: a running business, a real deadline, still open. */
const CLEAN = Object.freeze([
  'business-yes',
  'type-pricing-change',
  'why-deadline',
  'stake-money',
  'clarity-fear-excitement',
  'deadline-yes'
]);

/** Which question an option belongs to — so a swap replaces its own answer. */
const questionOf = (optionId) =>
  CHECK_QUESTIONS.find((q) => q.options.some((o) => o.id === optionId));

/** CLEAN with one answer swapped per question; multi-select options are added. */
const withOptions = (...swaps) => {
  const ids = [...CLEAN];
  for (const swap of swaps) {
    const q = questionOf(swap);
    assert.ok(q, `unknown option in fixture: ${swap}`);
    if (q.multiple) {
      if (!ids.includes(swap)) ids.push(swap);
      continue;
    }
    const siblings = q.options.map((o) => o.id);
    const at = ids.findIndex((id) => siblings.includes(id));
    if (at === -1) ids.push(swap);
    else ids[at] = swap;
  }
  return ids;
};

/* ---------- configuration ---------- */

test('the check keeps the owner\'s six questions', () => {
  assert.equal(CHECK_QUESTIONS.length, 6);
  assert.deepEqual(
    CHECK_QUESTIONS.map((q) => q.inputName),
    ['business', 'decisionType', 'whyNow', 'stakes', 'clarityBlock', 'deadline']
  );
});

test('every option id is unique and every signal is a known one', () => {
  const ids = allOptionIds();
  assert.equal(new Set(ids).size, ids.length);
  for (const q of CHECK_QUESTIONS) {
    for (const option of q.options) {
      for (const signal of option.signals) {
        assert.ok(SIGNAL_BASELINE[signal], `${option.id} carries unknown signal ${signal}`);
      }
    }
  }
});

test('DOM values resolve back to option ids', () => {
  assert.equal(optionIdFor('whyNow', 'deadline'), 'why-deadline');
  assert.equal(optionIdFor('stakes', 'months of work'), 'stake-months');
  assert.equal(optionIdFor('deadline', 'No'), 'deadline-no');
  assert.equal(optionIdFor('clarityBlock', 'alreadyInvested'), 'clarity-already-invested');
  assert.equal(optionIdFor('whyNow', 'nonsense'), undefined);
});

test('the decision type sets the category, not a face', () => {
  assert.equal(categoryFor(CLEAN), 'pricing change');
  assert.deepEqual([...signalsFor(['type-pivot'])], []);
});

/* ---------- face derivation ---------- */

test('a face nothing speaks to stays untested', () => {
  const faces = deriveFaceStates(['business-yes', 'type-pivot']);
  for (const id of FACE_IDS) assert.equal(faces[id], 'untested');
});

test('an external deadline tests timing; no deadline leaves it unresolved', () => {
  assert.equal(deriveFaceStates(['why-deadline', 'deadline-yes']).timing, 'tested');
  assert.equal(deriveFaceStates(['why-long-time', 'deadline-no']).timing, 'unresolved');
});

test('unresolved outranks tested on the same face', () => {
  // an external deadline says tested, "on my mind a long time" says unresolved
  const faces = deriveFaceStates(['why-long-time', 'deadline-yes']);
  assert.equal(faces.timing, 'unresolved');
});

test('named stakes put their faces in play without claiming they are resolved', () => {
  const faces = deriveFaceStates(['stake-money', 'stake-team', 'stake-months', 'stake-market']);
  assert.equal(faces.money, 'unresolved');
  assert.equal(faces.team, 'unresolved');
  assert.equal(faces.implementation, 'unresolved');
  assert.equal(faces.market, 'unresolved');
  assert.equal(faces['personal-cost'], 'untested');
});

test('implementation stays dark unless months of work are at stake', () => {
  assert.equal(deriveFaceStates(CLEAN).implementation, 'untested');
  assert.equal(deriveFaceStates(withOptions('stake-months')).implementation, 'unresolved');
});

/* ---------- the ruleset ---------- */

const FIXTURES = [
  {
    name: 'F-01 chosen but no deadline and no urgency',
    ids: withOptions('clarity-chosen-collecting', 'why-long-time', 'deadline-no'),
    rules: ['R-01'],
    faces: { timing: 'contradicted' }
  },
  {
    name: 'F-02 sunk cost driving more money',
    ids: withOptions('clarity-already-invested'),
    rules: ['R-02'],
    faces: { money: 'contradicted' }
  },
  {
    name: 'F-03 a deadline runs while research continues',
    ids: withOptions('clarity-researching'),
    rules: ['R-03'],
    faces: { implementation: 'contradicted' }
  },
  {
    name: 'F-04 pushed toward a decision a required person opposes',
    ids: withOptions('clarity-partner-differs', 'why-push', 'deadline-no'),
    rules: ['R-04'],
    faces: { team: 'contradicted' }
  },
  {
    name: 'F-05 certainty with real exposure and no checking',
    ids: withOptions('clarity-stopped-checking'),
    rules: ['R-05'],
    faces: { 'personal-cost': 'contradicted' }
  },
  {
    name: 'F-06 fear or excitement across broad exposure',
    ids: withOptions('stake-team', 'stake-months'),
    rules: ['R-06'],
    // a warning does not crack a face: "fear or excitement" still tested it
    faces: { 'personal-cost': 'tested' }
  },
  {
    name: 'F-07 several rules at once',
    ids: ['business-yes', 'type-pivot', 'why-long-time', 'stake-money', 'stake-months', 'clarity-stopped-checking', 'deadline-no'],
    rules: ['R-01', 'R-05'],
    faces: { timing: 'contradicted', 'personal-cost': 'contradicted' }
  },
  {
    name: 'F-08 clean',
    ids: CLEAN,
    rules: [],
    faces: {}
  }
];

for (const fixture of FIXTURES) {
  test(`fixture ${fixture.name}`, () => {
    const result = derive(fixture.ids);
    assert.deepEqual(
      result.contradictions.map((c) => c.ruleId),
      fixture.rules,
      `rules for ${fixture.name}`
    );
    for (const [face, state] of Object.entries(fixture.faces)) {
      assert.equal(result.faceStates[face], state, `${face} in ${fixture.name}`);
    }
    assert.equal(result.rulesetVersion, CHECK_RULESET_VERSION);
    for (const c of result.contradictions) {
      assert.equal(c.rulesetVersion, CHECK_RULESET_VERSION);
      assert.ok(c.evidenceOptionIds.length > 0, `${c.ruleId} recorded no evidence`);
      for (const id of c.evidenceOptionIds) assert.ok(fixture.ids.includes(id));
    }
  });
}

test('every rule has a fixture that fires it', () => {
  const fired = new Set(FIXTURES.flatMap((f) => f.rules));
  for (const rule of RULES) assert.ok(fired.has(rule.id), `${rule.id} is never exercised`);
});

test('a warning cracks nothing; only a break does', () => {
  const result = derive(withOptions('stake-team', 'stake-months'));
  assert.equal(result.contradictions[0].severity, 'warning');
  assert.notEqual(result.faceStates['personal-cost'], 'contradicted');
});

test('removing the answer that caused a contradiction removes the contradiction', () => {
  const broken = withOptions('clarity-already-invested');
  assert.equal(derive(broken).contradictions.length, 1);
  const fixed = broken.filter((id) => id !== 'stake-money');
  assert.equal(derive(fixed).contradictions.length, 0);
  assert.notEqual(derive(fixed).faceStates.money, 'contradicted');
});

test('derivation is pure: the same answers always give the same result', () => {
  const a = derive(withOptions('clarity-stopped-checking'));
  const b = derive(withOptions('clarity-stopped-checking'));
  assert.deepEqual(a, b);
  assert.deepEqual(derive([...CLEAN].reverse()).faceStates, derive(CLEAN).faceStates);
});

/* ---------- next test ---------- */

test('the next test comes from the first finding when there is one', () => {
  const result = derive(withOptions('clarity-already-invested'));
  assert.equal(result.nextTestKey, NEXT_TEST_BY_FINDING.COMMITMENT_EXCEEDS_FUNDED_DOWNSIDE);
});

test('breaks are ordered before warnings, so findings[0] is the break', () => {
  const ids = withOptions('clarity-fear-excitement', 'stake-team', 'stake-months');
  const result = derive([...ids, 'clarity-already-invested'].filter((id) => id !== 'clarity-fear-excitement'));
  assert.equal(result.findings[0].priority, 1);
});

test('with no finding, the first unresolved face in fixed order supplies the next test', () => {
  const result = derive(['business-yes', 'stake-market', 'stake-money']);
  assert.equal(result.findings.length, 0);
  assert.equal(result.faceStates.market, 'unresolved');
  assert.equal(result.nextTestKey, NEXT_TEST_BY_FACE.market);
});

test('a clean result falls back to the clean next test', () => {
  const result = derive(['business-yes', 'why-deadline', 'deadline-yes', 'clarity-fear-excitement']);
  assert.equal(result.findings.length, 0);
  assert.ok(!Object.values(result.faceStates).includes('unresolved'));
  assert.equal(result.nextTestKey, NEXT_TEST_CLEAN);
});

test('every finding code maps to a next test', () => {
  for (const rule of RULES) {
    assert.ok(NEXT_TEST_BY_FINDING[rule.findingCode], `${rule.findingCode} has no next test`);
  }
});
