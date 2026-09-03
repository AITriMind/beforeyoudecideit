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
| `perf` | **fail on `/` by 205ms** |

| Route | LCP | CLS | TBT | Score | Transfer |
|---|---:|---:|---:|---:|---:|
| `/` | **2405ms** | 0.001 | 1ms | 96 | 278KB |
| `/decisions/raising-the-price-of-the-core-package/` | 1654ms | 0.034 | 0ms | 99 | 208KB |

Budgets: LCP ≤ 2200ms, CLS ≤ 0.05, TBT ≤ 150ms.

## The measurement was wrong before any of this

Two environment faults produced the early numbers, and both are fixed.

**The fonts were 404ing.** Inlining the stylesheet re-based its `url()`
references against the document, so every woff2 failed and the page fell back to
system faces. Runs from that period read like progress. They were measuring a
broken page. `scripts/inline-css.mjs` rebases the paths now, and the QA gate
catches the whole class: a failed request is a console error, and the console
must be clean.

**The server was not a server.** Measurement ran against `python -m
http.server` — no compression, no keep-alive — putting an 84KB document on the
wire that a host sends as 17KB. `scripts/serve.mjs` serves the tree the way a
host does, and the gates point at it.

| Measured against | LCP on `/` | Transfer | Score |
|---|---:|---:|---:|
| naked file server | 3157ms | 568KB | 88 |
| a server that compresses | **2405ms** | 278KB | 96 |

749ms, from changing nothing in the page.

## Eight changes to the page. None of them moved it.

| Change | LCP | Kept |
|---|---:|---|
| baseline on the fixed setup | 2408 | |
| `modulepreload` for the domain modules | 2408 | reverted — it also promoted seven modules into the critical window |
| smaller halftone plates, −120KB | 2407 | yes, the bytes are real |
| stylesheet inlined, one round trip removed | 2408 | yes |
| shared crystal geometry, −3.1KB of document | 2407 | yes, for the smaller document |
| `font-display: optional` | 2407 | **reverted** |
| cover's font loads deferred past first paint | 2409 | reverted |
| the two below-fold crystals out of the first layout | 2405 | yes — **TBT 83ms → 0ms** |
| the four `color-mix()` inks precomputed | 2406 | yes, simpler |

Every result lies between 2405 and 2409, against a run-to-run spread of about
120ms. The number does not respond to the page.

Two of these earned their place on other grounds. Deferring the crystals took
TBT from 83ms to 0 — that is interactivity, and it is real. `optional` was
measured twice, in both environments, and gave the same LCP as `swap` both
times, which proves the gap between first paint and largest paint is not the
font arriving; all it bought was a CLS the page already had in hand.

## Why it is pinned

| | |
|---|---:|
| simulated request latency | 562.5ms |
| requests contending before paint | 18 |
| two sequential round trips, latency alone | 1125ms |
| the 17KB document's actual transfer | 92ms |
| first contentful paint | 2255ms |
| largest contentful paint | 2405ms |

Half of first paint is round-trip latency that no payload change touches: the
document is 92ms of transfer sitting behind 562ms of waiting. The rest is
main-thread work multiplied by four. Closing 205ms of simulated time needs about
50ms of observed work removed — and eight attempts at exactly that moved
nothing.

## What the deferred crystals cost, and what they do not

The two below-fold crystals are still in the document, inside `<noscript>`. A
reader without JavaScript and a crawler that does not run it both get the
finished SVG — `curl` on the homepage still returns all eighteen `data-face-id`
attributes. What changed is that a browser with scripting does not lay them out
before first paint; `assets/crystals.js` puts them back on idle, parsing the
build's own markup as SVG rather than through an HTML sink.

So the guarantee the spec asked for — a crystal correct without scripting —
survives. It was the thing I expected to have to trade, and it did not have to
be traded.

## What is left, none of it taken here

1. **Subset the fonts.** The Latin cuts carry the full Google range. A
   page-specific subset would be a fraction of 130KB. It is the last untried
   lever, and on this evidence it will not move the number either.
2. **Make the page shorter.** Not a tuning question. It removes content.
3. **Read the field.** These are Lantern projections at 562ms latency,
   1.47Mbps and a 4× CPU slowdown. The field target — LCP p75 ≤ 2.5s — already
   contains 2405ms. Once the site is deployed, that is the number worth reading.

The gate reports FAIL on `/` and will keep reporting it. It is not presented as
passing.
