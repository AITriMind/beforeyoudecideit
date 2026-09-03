# Release gate

Three gates, all runnable. A release needs all three.

```bash
npm run check   # build freshness + 130 domain and contract tests
npm run qa      # 48 browser checks; needs a static server on the repo root
npm run perf    # 5 Lighthouse runs per route, medians against the budgets
```

`qa` and `perf` need a server:

```bash
python -m http.server 4174 --bind 127.0.0.1
```

## Result

| Gate | Result |
|---|---|
| `check` | **pass** — 130/130 |
| `qa` | **pass** — 48/48 |
| `perf` | **fail on `/`** — see below |

### Performance, medians of five runs

| Route | LCP | CLS | TBT | Score | Transfer |
|---|---:|---:|---:|---:|---:|
| `/` | **3261ms** | 0.001 | 3ms | 87 | 567KB |
| `/decisions/raising-the-price-of-the-core-package/` | 2103ms | 0.034 | 0ms | 98 | 250KB |

Budgets: LCP ≤ 2200ms, CLS ≤ 0.05, TBT ≤ 150ms. CLS and TBT pass everywhere with
room to spare. The case route passes outright.

### Read the numbers with this correction in hand

An earlier round of tuning was measured against a page whose fonts were
silently 404ing: inlining the stylesheet had re-based its `url()` references
against the document, so every woff2 failed and the page fell back to system
faces. Those runs reported FCP 2404ms and looked like progress. They were
measuring a broken page.

With the fonts actually loading, the honest figures are FCP ≈ 3004ms and LCP
≈ 3260ms, and the run-to-run spread on `/` is about 120ms. Anything smaller
than that is noise, not a result.

The 404 is fixed and the QA gate now catches its whole class, because a failed
request is a console error and the console must be clean.

### What was tried, and what it was actually worth

| Change | Effect on LCP |
|---|---|
| `modulepreload` for the domain modules | none measurable |
| smaller halftone plates (−120KB of transfer) | none measurable |
| stylesheet inlined, one round trip removed | not separable from the font bug; kept, it is sound on its own terms |
| below-fold crystals deferred with `content-visibility` | none measurable |
| preloading only the font the LCP text uses | none measurable |
| shared crystal geometry, −3.1KB of document | **none measurable** — 3261 with it, 3267 without, inside a 120ms spread |

Disabling the cover changed nothing either, so the cover is not on the critical
path. What is on it: the document itself, and the webfont the hero paragraph is
set in.

The shared-geometry change is kept — the document is smaller and the geometry is
no longer written three times — but it is kept on its own merits, not as a
performance win. It was estimated at ~200ms and delivered nothing.

### What would actually close the remaining 1061ms

Each is a product decision, and none is taken here:

1. **`font-display: optional` on the body font.** LCP is the hero paragraph
   swapping into IBM Plex Sans, roughly 260ms after first paint. With
   `optional` the first, uncached visit keeps the fallback and never swaps.
   Costs the brand face on that visit; would bring LCP down to about FCP.
2. **Get FCP below 2200 at all.** FCP is 3004ms for an 85KB document under
   562ms simulated latency, 1.47Mbps and a 4× CPU slowdown. That means cutting
   the page, not tuning it.
3. **Subset the fonts to the characters actually used.** The Latin cuts carry
   the full Google range; a page-specific subset would be a fraction of 68KB.
4. **Read the field instead of the lab.** These are Lantern projections against
   a local Python file server with no keep-alive and no compression. A real host
   with HTTP/2 and gzip will not look like this. The field target — LCP p75 ≤
   2.5s — should be read from real traffic once the site is deployed.

Nothing here is presented as passing. The gate reports FAIL on `/` and will keep
reporting it until one of the above is chosen.
