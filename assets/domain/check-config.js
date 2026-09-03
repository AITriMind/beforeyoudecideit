/**
 * TM-03 — the Decision Check as data.
 *
 * The specification proposes replacing the six questions with six face-shaped
 * ones. The owner's questions stay: they are the product's own voice and they
 * already work. What this module adds is the machinery the spec asks for — the
 * questions become explicit data, every option carries signals, and the six
 * crystal faces are derived from the answers.
 *
 * The prompts and labels are not repeated here. Each question and option points
 * at its key in the page dictionary, so copy stays in one place and both
 * languages keep working.
 *
 * What the check can and cannot see:
 *   timing          — from "why now" and "is there a date"
 *   money, team,
 *   market,
 *   implementation  — from what is lost if it goes wrong
 *   personal-cost   — from what stands between you and a clear answer
 *
 * A face nobody's answer touches stays `untested`. That is the honest output of
 * a three-minute check, and it is the argument for the long one.
 */

/** @typedef {import('./decision.js').DecisionQuestion} DecisionQuestion */
/** @typedef {import('./decision.js').DecisionFaceId} DecisionFaceId */

export const CHECK_RULESET_VERSION = '2026-09-bydi';

/**
 * The wizard's existing DOM uses these input names. The config binds to them so
 * the server-rendered fieldsets, their labels and their no-JS behaviour stay
 * exactly as the owner wrote them.
 */
export const QUESTION_BY_INPUT_NAME = Object.freeze({
  business: 'q-business',
  decisionType: 'q-decision-type',
  whyNow: 'q-why-now',
  stakes: 'q-stakes',
  clarityBlock: 'q-clarity-block',
  deadline: 'q-deadline'
});

/**
 * The six questions, in the order the page presents them.
 * `faceId` is the face an answer speaks to first; options may carry signals for
 * other faces too, which is why derivation reads signals rather than faceId.
 * @type {readonly DecisionQuestion[]}
 */
export const CHECK_QUESTIONS = Object.freeze([
  {
    id: 'q-business',
    faceId: 'market',
    prompt: 'q.business',
    required: true,
    inputName: 'business',
    multiple: false,
    options: [
      { id: 'business-yes', label: 'option.yes', value: 'Yes', signals: [] },
      { id: 'business-no', label: 'option.no', value: 'No', signals: [] }
    ]
  },
  {
    id: 'q-decision-type',
    faceId: 'market',
    prompt: 'q.decisionType',
    required: true,
    inputName: 'decisionType',
    multiple: false,
    // this question names the decision; it sets Decision.category, not a face
    options: [
      { id: 'type-pivot', label: 'decision.pivot', value: 'pivot', signals: [] },
      { id: 'type-new-direction', label: 'decision.newDirection', value: 'new direction', signals: [] },
      { id: 'type-key-hire', label: 'decision.keyHire', value: 'key hire', signals: [] },
      { id: 'type-partner-change', label: 'decision.partnerChange', value: 'partner change', signals: [] },
      { id: 'type-pricing-change', label: 'decision.pricingChange', value: 'pricing change', signals: [] },
      { id: 'type-new-market', label: 'decision.newMarket', value: 'new market', signals: [] },
      { id: 'type-more-money', label: 'decision.moreMoney', value: 'more money into an existing product', signals: [] },
      { id: 'type-closing-line', label: 'decision.closingLine', value: 'closing a line', signals: [] },
      { id: 'type-automation', label: 'decision.automation', value: 'automation with AI', signals: [] },
      { id: 'type-agent-autonomy', label: 'decision.agentAutonomy', value: 'giving AI agents more autonomy', signals: [] },
      { id: 'type-other', label: 'decision.other', value: 'other', signals: [] }
    ]
  },
  {
    id: 'q-why-now',
    faceId: 'timing',
    prompt: 'q.whyNow',
    required: true,
    inputName: 'whyNow',
    multiple: false,
    options: [
      { id: 'why-deadline', label: 'why.deadline', value: 'deadline', signals: ['timing:external'] },
      { id: 'why-opportunity', label: 'why.opportunity', value: 'an opportunity that will not wait', signals: ['timing:external'] },
      { id: 'why-hurting', label: 'why.hurting', value: 'something is already hurting', signals: ['timing:internal'] },
      { id: 'why-push', label: 'why.push', value: 'people around me push for it', signals: ['timing:internal', 'team:mixed'] },
      { id: 'why-long-time', label: 'why.longTime', value: 'it has been on my mind for a long time', signals: ['timing:none'] }
    ]
  },
  {
    id: 'q-stakes',
    faceId: 'money',
    prompt: 'q.stakes',
    required: false,
    inputName: 'stakes',
    multiple: true,
    // naming a stake puts that face in play: examined, not resolved
    options: [
      { id: 'stake-money', label: 'stake.money', value: 'money', signals: ['money:downside-material-unfunded'] },
      { id: 'stake-team', label: 'stake.team', value: 'team', signals: ['team:mixed'] },
      { id: 'stake-months', label: 'stake.months', value: 'months of work', signals: ['implementation:undefined'] },
      { id: 'stake-market', label: 'stake.market', value: 'a market or a client', signals: ['market:evidence-signal'] },
      { id: 'stake-partner', label: 'stake.partner', value: 'a partner relationship', signals: ['team:mixed'] },
      { id: 'stake-missed', label: 'stake.missed', value: 'a missed opportunity', signals: ['market:evidence-signal'] }
    ]
  },
  {
    id: 'q-clarity-block',
    faceId: 'personal-cost',
    prompt: 'q.clarity',
    required: true,
    inputName: 'clarityBlock',
    multiple: false,
    options: [
      { id: 'clarity-chosen-collecting', label: 'clarity.chosenCollecting', value: 'chosenCollecting', signals: ['personal:confirmation'] },
      { id: 'clarity-researching', label: 'clarity.researching', value: 'researching', signals: ['personal:open'] },
      { id: 'clarity-partner-differs', label: 'clarity.partnerDiffers', value: 'partnerDiffers', signals: ['personal:open', 'team:opposed'] },
      { id: 'clarity-stopped-checking', label: 'clarity.stoppedChecking', value: 'stoppedChecking', signals: ['personal:confirmation'] },
      { id: 'clarity-fear-excitement', label: 'clarity.fearExcitement', value: 'fearExcitement', signals: ['personal:open'] },
      { id: 'clarity-already-invested', label: 'clarity.alreadyInvested', value: 'alreadyInvested', signals: ['personal:confirmation', 'money:downside-material-unfunded'] }
    ]
  },
  {
    id: 'q-deadline',
    faceId: 'timing',
    prompt: 'q.deadline',
    required: true,
    inputName: 'deadline',
    multiple: false,
    options: [
      { id: 'deadline-yes', label: 'option.yes', value: 'Yes', signals: ['timing:external'] },
      { id: 'deadline-no', label: 'option.no', value: 'No', signals: ['timing:none'] }
    ]
  }
]);

/** @type {Readonly<Record<string, DecisionQuestion>>} */
const BY_ID = Object.freeze(Object.fromEntries(CHECK_QUESTIONS.map((q) => [q.id, q])));

/**
 * @param {string} questionId
 * @returns {DecisionQuestion|undefined}
 */
export function question(questionId) {
  return BY_ID[questionId];
}

/**
 * Resolve a DOM value back to its option id.
 * @param {string} inputName
 * @param {string} value
 * @returns {string|undefined}
 */
export function optionIdFor(inputName, value) {
  const q = BY_ID[QUESTION_BY_INPUT_NAME[inputName]];
  if (!q) return undefined;
  return q.options.find((o) => o.value === value)?.id;
}

/**
 * @param {readonly string[]} optionIds
 * @returns {readonly import('./decision.js').DecisionSignal[]}
 */
export function signalsFor(optionIds) {
  const set = [];
  for (const q of CHECK_QUESTIONS) {
    for (const option of q.options) {
      if (optionIds.includes(option.id)) set.push(...option.signals);
    }
  }
  return set;
}

/**
 * The decision's category comes from the second question rather than a face.
 * @param {readonly string[]} optionIds
 * @returns {string}
 */
export function categoryFor(optionIds) {
  const q = BY_ID['q-decision-type'];
  const chosen = q.options.find((o) => optionIds.includes(o.id));
  return chosen ? chosen.value : '';
}
