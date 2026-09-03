/**
 * The Decision Cases.
 *
 * Two rules govern this file. A case is built from a real answer vector, so its
 * six faces and its findings are whatever the rules actually produce — nobody
 * writes a face state by hand. And nothing here invents a client: the one
 * published entry is a worked example and says so on the page, in its dek and
 * in its own label. Real client cases arrive here only with the owner's
 * consent, anonymized, and they replace nothing.
 */

import { decisionFrom, derive } from '../assets/domain/derive.js';
import { strings } from '../assets/domain/strings.js';

const NEXT_TESTS = strings.en.nextTest;
const nextTestFor = (optionIds) => {
  const key = derive(optionIds).nextTestKey.split('.')[1];
  return NEXT_TESTS[key];
};

const PRICE_CHANGE = [
  'business-yes',
  'type-pricing-change',
  'why-deadline',
  'stake-market',
  'clarity-fear-excitement',
  'deadline-yes'
];

const SUNK_COST = [
  'business-yes',
  'type-more-money',
  'why-hurting',
  'stake-money',
  'stake-months',
  'clarity-already-invested',
  'deadline-no'
];

/** @type {readonly import('../assets/domain/decision-case.js').DecisionCaseContent[]} */
export const CASES = Object.freeze([
  {
    status: 'published',
    kind: 'example',
    decision: {
      ...decisionFrom(PRICE_CHANGE, {
        id: 'example-price-change',
        slug: 'raising-the-price-of-the-core-package',
        title: 'Raising the price of the core package',
        copy: strings.en
      }),
      status: 'published',
      publication: { isPublic: true, anonymized: true, consentForAggregate: false, tags: ['pricing', 'example'] }
    },
    dek: 'A worked example: a studio raising the price of its core package with a real deadline, and the two faces the three-minute check could not reach.',
    situation:
      'A studio charges the same price it set three years ago. The owner has a date — the new season opens in six weeks — and the best clients already ask for the deeper package rather than the cheapest one. Nothing about the money is in doubt; what is in doubt is whether the market has been read or only assumed.',
    evidence: [
      {
        plateId: 'PL.02',
        title: 'The map this answer vector produces',
        caption: 'Six faces, the finding, and the one test to run next, rendered from the same rules the check uses.',
        assetUrl: '/public/generated/decision-maps/price-change-en.png',
        sourceLabel: 'Generated from the answers below.'
      }
    ],
    nextTest: nextTestFor(PRICE_CHANGE),
    followUp:
      'The check leaves money, team and implementation dark. That is not a gap in the answers; it is the boundary of a three-minute test. Those three faces are what the long one is for.'
  },
  {
    // Kept unpublished on purpose: it has no owner consent behind it, so the
    // publishing rules have something real to refuse.
    status: 'draft',
    kind: 'example',
    decision: {
      ...decisionFrom(SUNK_COST, {
        id: 'example-sunk-cost',
        slug: 'more-money-into-the-existing-product',
        title: 'More money into the existing product',
        copy: strings.en
      }),
      publication: { isPublic: false, anonymized: true, consentForAggregate: false, tags: ['sunk-cost'] }
    },
    dek: 'A worked example of the commonest break the check finds: what has already been spent arguing for what has not been spent yet, with no date in sight.',
    situation:
      'Months of work and real money are already in the product, and it is hurting. There is no deadline. The reason given for continuing is what continuing has already cost.',
    evidence: [],
    confidentialityNote: 'Evidence unavailable: this example carries no client material.',
    nextTest: nextTestFor(SUNK_COST)
  }
]);
