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

## Result at f18a542 + phase 8

| Gate | Result |
|---|---|
| `check` | **pass** — 130/130 |
| `qa` | **pass** — 48/48 |
| `perf` | **fail on `/`** — see below |

### Performance, medians of five runs

| Route | LCP | CLS | TBT | Score | Transfer |
|---|---:|---:|---:|---:|---:|
| `/` | **3189ms** | 0.001 | 5ms | 88 | 568KB |
| `/decisions/raising-the-price-of-the-core-package/` | 2103ms | 0.034 | 0ms | 98 | 250KB |

Budgets: LCP ≤ 2200ms, CLS ≤ 0.05, TBT ≤ 150ms. CLS and TBT pass everywhere with
room to spare. The case route passes outright.

### Why `/` misses, measured rather than guessed

Lighthouse's mobile profile simulates 562ms of latency per request, 1.47Mbps and
a 4× CPU slowdown. Under it:

- first contentful paint is **2404ms** and is bounded by the document itself —
  88KB, of which 29KB is the inlined stylesheet and 24KB is three static
  crystals;
- LCP is the hero paragraph, which arrives **785ms later**, when IBM Plex Sans
  swaps in.

Things that were tried and measured, not assumed:

| Change | LCP |
|---|---:|
| starting point | 3392ms |
| `modulepreload` for the domain modules | 3364ms |
| smaller halftone plates (−120KB), body font preloaded | 3392ms |
| stylesheet inlined, one round trip removed | 3007ms |
| below-fold crystals deferred with `content-visibility` | 3007ms |
| preloading only the font the LCP text uses | **3189ms** with fonts working |

Disabling the cover changed nothing (FCP 2404 either way), so the cover is not
on the critical path.

### What would close the remaining 989ms

Each is a product decision, not an engineering one, and none is taken here:

1. **`font-display: optional` on the body font.** The first visit keeps the
   fallback and never swaps, so LCP collapses onto FCP (≈2400ms). Costs the
   brand typeface on a first, uncached visit.
2. **Cut the document.** The three crystals repeat their geometry; emitting the
   faces once and referencing them would save roughly 11KB. Worth ~200ms.
3. **Subset the fonts to the characters the page uses.** The Latin cuts carry
   the full Google range; a page-specific subset would be a fraction of 68KB.
4. **Accept the simulated figure.** These are Lantern projections against a
   local Python file server with no keep-alive and no compression. A real host
   with HTTP/2 and gzip will not look like this; the field target (LCP p75 ≤
   2.5s) should be read from real traffic once the site is deployed.

Nothing here is presented as passing. The gate reports FAIL on `/` and will keep
reporting it until one of the above is chosen.
