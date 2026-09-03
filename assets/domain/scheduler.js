/**
 * TM-05 — the scheduling transition, as a state machine.
 *
 * The external scheduler is a third party. Nothing of theirs loads until a
 * person asks for it: the result is the product, the calendar is a second,
 * explicit step. Keeping the machine here, away from the DOM, is what lets the
 * "zero requests before activation" rule be tested rather than asserted.
 */

/** @typedef {'closed'|'transition'|'loading'|'open'|'error'} SchedulerState */
/** @typedef {'ACTIVATE'|'OPEN'|'READY'|'FAIL'|'RETRY'|'CLOSE'} SchedulerEvent */

/** How long the provider gets before the fallback link takes over. */
export const SCHEDULER_TIMEOUT_MS = 8000;

const TRANSITIONS = Object.freeze({
  closed: { ACTIVATE: 'transition' },
  transition: { OPEN: 'loading', CLOSE: 'closed' },
  loading: { READY: 'open', FAIL: 'error', CLOSE: 'closed' },
  open: { CLOSE: 'closed' },
  error: { RETRY: 'loading', CLOSE: 'closed' }
});

/**
 * @param {SchedulerState} state
 * @param {SchedulerEvent} event
 * @returns {SchedulerState}
 */
export function schedulerTransition(state, event) {
  const row = TRANSITIONS[state];
  return (row && row[event]) || state;
}

/**
 * The provider may only be fetched in these states. Anything else must have no
 * third-party script, iframe or request in the document.
 * @param {SchedulerState} state
 */
export function providerAllowed(state) {
  return state === 'loading' || state === 'open';
}

/**
 * The visitor's answers travel to the booking form as parameters, so the call
 * starts from what they already said. Nothing here identifies a person.
 *
 * @param {string} baseUrl
 * @param {Record<string, string>} answers
 * @returns {string}
 */
export function bookingUrl(baseUrl, answers) {
  if (!baseUrl || baseUrl.includes('{{')) return '';
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(answers)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}
