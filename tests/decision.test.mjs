/**
 * TM-10 — domain test foundation for TM-01.
 * Run: node --test tests/
 * No test framework: node:test ships with the runtime, matching the
 * zero-dependency rule.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FACE_IDS,
  RULESET_VERSION,
  SCHEMA_VERSION,
  createDecision,
  decisionAdapter,
  isComplete,
  pruneInvalidAnswers,
  selectedOptionIds,
  untestedFaces,
  validateDecision,
  withAnswer
} from '../assets/domain/decision.js';

const NOW = '2026-09-03T00:00:00.000Z';

/** A two-question stand-in; the real six arrive with TM-03. */
const QUESTIONS = Object.freeze([
  {
    id: 'q-market-evidence',
    faceId: 'market',
    prompt: 'What evidence exists outside your own conviction?',
    required: true,
    options: [
      { id: 'market-validated', label: 'Repeated external demand or behavior', signals: ['market:evidence-validated'] },
      { id: 'market-none', label: 'No external evidence yet', signals: ['market:evidence-none'] }
    ]
  },
  {
    id: 'q-personal-state',
    faceId: 'personal-cost',
    prompt: 'Which statement is closest to the current decision state?',
    required: true,
    options: [
      { id: 'personal-open', label: 'I am still willing to discover a reason not to proceed', signals: ['personal:open'] },
      { id: 'personal-committed', label: 'I have effectively decided and need to execute', signals: ['personal:committed'] }
    ]
  }
]);

const fresh = () => createDecision({ id: 'd-test', questions: QUESTIONS, now: NOW });

test('a new decision starts at the documented baseline', () => {
  const d = fresh();
  assert.equal(d.schemaVersion, SCHEMA_VERSION);
  assert.equal(d.status, 'draft');
  assert.equal(d.disposition, 'continue-testing');
  assert.deepEqual(d.answers, []);
  assert.equal(d.derived.rulesetVersion, RULESET_VERSION);
  assert.deepEqual(d.derived.faceStates, untestedFaces());
  assert.deepEqual(d.derived.contradictions, []);
  assert.deepEqual(d.derived.findings, []);
  assert.equal(d.publication.isPublic, false);
  assert.equal(d.publication.anonymized, true);
  assert.equal(d.publication.consentForAggregate, false);
});

test('the six faces are fixed and ordered', () => {
  assert.deepEqual([...FACE_IDS], [
    'market',
    'money',
    'team',
    'timing',
    'implementation',
    'personal-cost'
  ]);
});

test('answering again replaces the record instead of appending a second one', () => {
  let d = fresh();
  d = withAnswer(d, 'q-market-evidence', 'market-none', NOW);
  d = withAnswer(d, 'q-market-evidence', 'market-validated', NOW);
  assert.equal(d.answers.length, 1);
  assert.equal(d.answers[0].optionId, 'market-validated');
  assert.deepEqual(validateDecision(d), []);
});

test('answers keep question order regardless of the order they arrive in', () => {
  let d = fresh();
  d = withAnswer(d, 'q-personal-state', 'personal-open', NOW);
  d = withAnswer(d, 'q-market-evidence', 'market-validated', NOW);
  assert.deepEqual(selectedOptionIds(d), ['market-validated', 'personal-open']);
});

test('an answer is rejected when the option does not belong to the question', () => {
  const d = fresh();
  assert.throws(() => withAnswer(d, 'q-market-evidence', 'personal-open', NOW), /does not belong/);
  assert.throws(() => withAnswer(d, 'q-nope', 'market-none', NOW), /unknown questionId/);
});

test('withAnswer does not mutate its input', () => {
  const d = fresh();
  const next = withAnswer(d, 'q-market-evidence', 'market-none', NOW);
  assert.equal(d.answers.length, 0);
  assert.equal(next.answers.length, 1);
  assert.notEqual(d, next);
});

test('completion needs every required question answered', () => {
  let d = fresh();
  assert.equal(isComplete(d), false);
  d = withAnswer(d, 'q-market-evidence', 'market-none', NOW);
  assert.equal(isComplete(d), false);
  d = withAnswer(d, 'q-personal-state', 'personal-open', NOW);
  assert.equal(isComplete(d), true);
});

test('answers pointing at options the config dropped are pruned', () => {
  let d = withAnswer(fresh(), 'q-market-evidence', 'market-none', NOW);
  const narrowed = {
    ...d,
    questions: [
      { ...QUESTIONS[0], options: [QUESTIONS[0].options[0]] },
      QUESTIONS[1]
    ]
  };
  const { decision, dropped } = pruneInvalidAnswers(narrowed);
  assert.deepEqual([...dropped], ['q-market-evidence']);
  assert.equal(decision.answers.length, 0);
});

test('validation rejects contact data on the decision', () => {
  const d = { ...fresh(), email: 'someone@example.com' };
  assert.ok(validateDecision(d).some((p) => p.includes('email')));
});

test('validation rejects an unknown face state and a duplicate answer', () => {
  const bad = fresh();
  bad.derived.faceStates.market = 'sparkling';
  bad.answers = [
    { questionId: 'q-market-evidence', optionId: 'market-none', answeredAt: NOW },
    { questionId: 'q-market-evidence', optionId: 'market-validated', answeredAt: NOW }
  ];
  const problems = validateDecision(bad);
  assert.ok(problems.some((p) => p.includes('faceStates.market')));
  assert.ok(problems.some((p) => p.includes('duplicate answer')));
});

test('the adapter round-trips a valid decision and refuses an invalid one', () => {
  const d = fresh();
  assert.deepEqual(decisionAdapter.fromPersisted(decisionAdapter.toPersisted(d)), d);
  assert.throws(() => decisionAdapter.fromPersisted({ schemaVersion: 99 }), /invalid persisted decision/);
});
