/**
 * The two below-fold crystals, kept out of the first layout.
 *
 * They are still in the document, inside `<noscript>`: a reader without
 * JavaScript and a crawler that does not run it both get the finished SVG, and
 * the guarantee that a crystal is correct without scripting survives. What
 * changes is that a browser with scripting does not parse or lay them out
 * before first paint — and style and layout is what the homepage's remaining
 * budget goes on.
 *
 * The markup is the string the build wrote; nothing is regenerated, so the
 * result is identical to the static page. It is parsed as SVG rather than
 * handed to an HTML sink: `parseFromString` with an XML type builds an inert
 * document, `importNode` copies element nodes into this one, and neither runs
 * anything. The parse is rejected unless it yields exactly one `<svg>` root.
 */

const deferred = [...document.querySelectorAll('[data-crystal-defer]')];

if (deferred.length) {
  const parser = new DOMParser();

  /**
   * @param {string} markup
   * @returns {SVGElement|null}
   */
  function parseCrystal(markup) {
    const doc = parser.parseFromString(markup, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return null;
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg') return null;
    return /** @type {SVGElement} */ (document.importNode(root, true));
  }

  const inject = () => {
    for (const host of deferred) {
      const source = host.querySelector('noscript');
      if (!source) continue;
      // inside <noscript> with scripting on, the markup is text, not DOM
      const crystal = parseCrystal(source.textContent.trim());
      source.remove();
      if (crystal) host.insertBefore(crystal, host.firstChild);
      host.removeAttribute('data-crystal-defer');
    }
    document.dispatchEvent(new CustomEvent('bydi:crystals-ready'));
  };

  // after the first paint, and after anything the browser still owes the user
  if ('requestIdleCallback' in window) {
    requestIdleCallback(inject, { timeout: 1200 });
  } else {
    requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(inject, 0)));
  }
}
