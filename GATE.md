# Release gate

Three gates, all runnable. A release needs all three.

```bash
npm run serve   # a server that compresses and keeps the connection alive
npm run check   # build freshness + 130 domain and contract tests
npm run qa      # 48 browser checks
npm run perf    # 5 Lighthouse runs per route, medians against the budgets
```

`qa` and `perf` need `npm run serve` running in another shell.

## Result

| Gate | Result |
|---|---|
| `check` | **pass** — 130/130 |
| `qa` | **pass** — 48/48 |
| `perf` | **fail on `/` by 208ms** — see below |

### Performance, medians of five runs

| Route | LCP | CLS | TBT | Score | Transfer |
|---|---:|---:|---:|---:|---:|
| `/` | **2408ms** | 0.001 | 83ms | 95 | 276KB |
| `/decisions/raising-the-price-of-the-core-package/` | 1655ms | 0.034 | 0ms | 99 | 208KB |

Budgets: LCP ≤ 2200ms, CLS ≤ 0.05, TBT ≤ 150ms. Everything passes except LCP on
the homepage, which is over by 208ms.

## What the measurement was getting wrong

Two environment faults produced most of the earlier numbers, and both are fixed.

**The fonts were 404ing.** Inlining the stylesheet re-based its `url()`
references against the document, so every woff2 failed and the page fell back to
system faces. Runs from that period reported FCP 2404ms and read like progress.
They were measuring a broken page. `scripts/inline-css.mjs` now rebases the
paths on the way in, and the QA gate catches the whole class, because a failed
request is a console error and the console must be clean.

**The server was not a server.** Measurement ran against `python -m
http.server`: no compression, no keep-alive. It put an 84KB document on the wire
that a real host sends as 17KB. `scripts/serve.mjs` now serves the tree the way
a host does — gzip on text, keep-alive, cache headers — and `npm run perf`
points at it.

That single change is worth more than every code change attempted:

| Measured against | LCP on `/` | Transfer | Score |
|---|---:|---:|---:|
| naked file server | 3157ms | 568KB | 88 |
| a server that compresses | **2408ms** | 276KB | 95 |

## What each attempted optimisation was actually worth

Every row measured as a median of five, against a run-to-run spread of ~120ms.

| Change | Effect on LCP | Kept |
|---|---|---|
| `modulepreload` for the domain modules | none measurable | yes, harmless and correct |
| smaller halftone plates, −120KB | none measurable | yes, the bytes are real |
| stylesheet inlined | not separable from the font bug | yes, one fewer round trip |
| `content-visibility` on below-fold crystals | none measurable | reverted |
| preloading only the LCP text's face | none measurable | yes |
| shared crystal geometry, −3.1KB | 3261 with, 3267 without | yes, for the smaller document |
| `font-display: optional` | 2407 with, 2408 with `swap` | **reverted** |
| deferring the cover's font loads past first paint | 2409 vs 2407 | reverted |

Nothing in the page moved the number. Fixing how it was measured moved it by
749ms.

`optional` deserves its own line, because it was tried twice. It gives an
identical LCP to `swap` in both environments, which proves the 300ms between
first paint and largest paint is *not* the font arriving. It only ever bought a
CLS the page already had in hand — 0.001 and 0.034, against a budget of 0.05 —
and it costs the brand faces for the whole of a slow first visit. Reverted.

## Where the remaining 208ms is

| Phase | Simulated |
|---|---:|
| document arrives — 17KB gzipped behind 562ms of latency | ~620ms |
| main-thread work, 610ms observed at a 4× CPU slowdown | ~1490ms |
| **first contentful paint** | **2107ms** |
| the hero paragraph becomes the largest paint | +300ms |

First paint is already inside the budget. The gap is entirely the 300ms after
it, and it is not the webfont. The main thread is now the whole story: 284ms of
style and layout observed, multiplied by four.

## What is left, none of it taken here

1. **Cut the main thread.** The two below-fold crystals parse and lay out with
   the rest of the document. Keeping them out of it means giving up the
   guarantee that every crystal is correct without JavaScript — which is the
   reason they are static in the first place.
2. **Subset the fonts.** The Latin cuts carry the full Google range. A
   page-specific subset would be a fraction of 130KB.
3. **Read the field.** These are Lantern projections at 562ms latency,
   1.47Mbps and a 4× CPU slowdown. The field target — LCP p75 ≤ 2.5s — should
   be read from real traffic once the site is deployed. The lab number is
   already inside that.

The gate reports FAIL on `/` and will keep reporting it until one of these is
chosen. It is not presented as passing.
