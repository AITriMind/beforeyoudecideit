/**
 * TM-07 — the plate registry.
 *
 * Every non-functional visual on the page carries exactly one role: it is a
 * `test` (a question the site is asking), `evidence` (something that happened,
 * shown as it is), or a `finding` (a conclusion the system produced). Anything
 * that is none of those is decoration and does not belong on the sheet.
 *
 * The registry exists so the roles can be checked rather than trusted: ids stay
 * unique, every plate in the markup is declared here, and every declared plate
 * is in the markup.
 */

/** @typedef {'test'|'evidence'|'finding'} PlateRole */
/** @typedef {'halftone-photo'|'technical-line'|'none'} PlateTreatment */

/**
 * @typedef {object} Plate
 * @property {`PL.${string}`} id
 * @property {PlateRole} role
 * @property {PlateTreatment} treatment
 * @property {string} titleKey
 * @property {string} captionKey
 * @property {string} [sourceKey] shown when the evidence is external or anonymized
 * @property {boolean} [risk] a finding that names a break
 */

/** @type {readonly Plate[]} */
export const PLATES = Object.freeze([
  {
    id: 'PL.01',
    role: 'test',
    treatment: 'technical-line',
    titleKey: 'plate.crystalTitle',
    captionKey: 'plate.crystalCaption'
  },
  {
    id: 'PL.02',
    role: 'finding',
    treatment: 'none',
    titleKey: 'plate.mapTitle',
    captionKey: 'plate.mapCaption',
    sourceKey: 'plate.mapSource'
  },
  {
    id: 'PL.03',
    role: 'test',
    treatment: 'technical-line',
    titleKey: 'plate.wizardTitle',
    captionKey: 'plate.wizardCaption'
  },
  {
    id: 'PL.04',
    role: 'evidence',
    treatment: 'halftone-photo',
    titleKey: 'plate.gameTitle',
    captionKey: 'plate.gameCaption',
    sourceKey: 'plate.gameSource'
  },
  {
    id: 'PL.05',
    role: 'evidence',
    treatment: 'halftone-photo',
    titleKey: 'plate.eventTitle',
    captionKey: 'plate.eventCaption',
    sourceKey: 'plate.eventSource'
  },
  {
    id: 'PL.06',
    role: 'evidence',
    treatment: 'halftone-photo',
    titleKey: 'plate.portraitTitle',
    captionKey: 'plate.portraitCaption',
    sourceKey: 'plate.portraitSource'
  }
]);

/** The states a plate can be in, as the specification names them. */
export const PLATE_STATES = Object.freeze([
  'test-neutral',
  'test-contradicted',
  'evidence-normal',
  'evidence-anonymized',
  'finding-normal',
  'finding-risk'
]);

/**
 * Only two image treatments are approved. A photograph is reduced to paper and
 * ink offline; a diagram is drawn in ink on paper. Nothing is filtered at
 * runtime, because a filter is device-dependent and a plate is not.
 */
export const PLATE_TREATMENTS = Object.freeze(['halftone-photo', 'technical-line', 'none']);

/** @param {string} id */
export function plate(id) {
  return PLATES.find((entry) => entry.id === id);
}

/**
 * @param {Plate} entry
 * @returns {string} the state this plate renders in
 */
export function plateState(entry) {
  if (entry.role === 'finding') return entry.risk ? 'finding-risk' : 'finding-normal';
  if (entry.role === 'evidence') return entry.sourceKey ? 'evidence-normal' : 'evidence-normal';
  return 'test-neutral';
}
