# Release gate

Three gates, all runnable. A release needs all three.

```bash
npm run serve   # a server that compresses and keeps the connection alive
npm run check   # build freshness + 131 domain and contract tests
npm run qa      # 48 browser checks
npm run perf    # 5 Lighthouse runs per route, medians against the budgets
```

`qa` and `perf` need `npm run serve` running in another shell.

## Result — all three pass

| Gate | Result |
|---|---|
| `check` | **pass** — 131/131 |
| `qa` | **pass** — 48/48 |
| `perf` | **pass** |

| Route | LCP | CLS | TBT | Score | Transfer |
|---|---:|---:|---:|---:|---:|
| `/` | **2155ms** | 0.001 | 4ms | 97 | 368KB |
| `/decisions/raising-the-price-of-the-core-package/` | **1504ms** | 0.034 | 0ms | 100 | 180KB |

Budgets: LCP ≤ 2200ms, CLS ≤ 0.05, TBT ≤ 150ms.

## How it got there

Three things moved the number. Ten did not, and each of those was measured
before it was believed.

| | LCP on `/` |
|---|---:|
| where it started | 3157ms |
| measuring against a server that compresses | 2405ms |
| fonts subset to the characters the site sets | 2227ms |
| the cover's italic cut off the critical path | **2155ms** |

### The measurement was wrong before anything else

**The fonts were 404ing.** Inlining the stylesheet re-based its `url()`
references against the document, so every woff2 failed and the page fell back to
system faces. Runs from that period read like progress; they were measuring a
broken page. `scripts/inline-css.mjs` rebases the paths now, and the QA gate
catches the whole class: a failed request is a console error, and the console
must be clean.

**The server was not a server.** Measurement ran against `python -m
http.server` — no compression, no keep-alive — putting an 84KB document on the
wire that a host sends as 17KB. `scripts/serve.mjs` serves the tree the way a
host does. That fix alone was worth 749ms, with nothing changed in the page.

### Subsetting was the real lever

The cuts came from Google's slices: 230 codepoints for latin, 105 for cyrillic.
The site sets 108 and 68. `scripts/subset-fonts.py` walks the markup, the
dictionary in both languages, the case content and the generated pages, and cuts
each face to what is actually used plus a margin of its own alphabet — so copy
can be edited without regenerating fonts.

| | before | after |
|---|---:|---:|
| all eight faces | 200KB | 138KB |
| first view (four latin cuts) | 127KB | 85KB |

Each `unicode-range` was narrowed to match its file exactly. That pairing is the
point, not an afterthought: a codepoint inside the declared range but missing
from the file renders as tofu, while one outside the range falls through to the
next family in the stack. A test asserts the ranges are no wider than the
subsets, and a check confirms every character the tree can render exists in one.
The originals stay in `assets/fonts/src/`.

### And then the cover's italic

32KB of italic Literata was being requested before first paint by the cover's
`document.fonts.load`, though nothing above the fold is set in it. Moved to
idle. 72ms.

Worth noting: this exact change was tried earlier and measured at 2409ms against
2407ms — nothing. It only became worth 72ms once the number stopped being pinned
by heavier costs. An optimisation that measures as noise is not always worthless;
it can be waiting behind a bigger one.

## The ten that did nothing

Every result between 2405 and 2409, against a run-to-run spread of ~120ms.

| Change | LCP | Kept |
|---|---:|---|
| `modulepreload` for the domain modules | 2408 | reverted — it also promoted seven modules into the critical window |
| smaller halftone plates, −120KB | 2407 | yes, the bytes are real |
| stylesheet inlined, one round trip removed | 2408 | yes |
| shared crystal geometry, −3.1KB | 2407 | yes, for the smaller document |
| `font-display: optional` | 2407 | **reverted** |
| below-fold crystals out of the first layout | 2405 | yes — **TBT 83ms → 0ms** |
| the four `color-mix()` inks precomputed | 2406 | yes, simpler |

`optional` was measured twice, in both environments, and gave the same LCP as
`swap` both times — which is what proved the gap between first paint and largest
paint was never the font arriving. All it bought was a CLS the page already had
in hand, against losing the brand faces for a whole slow first visit.

## What the deferred crystals cost — nothing

The two below-fold crystals are still in the document, inside `<noscript>`.
`curl` on the homepage returns all eighteen `data-face-id` attributes, so a
reader without JavaScript and a crawler that does not run it both get the
finished SVG. A browser with scripting simply does not lay them out before first
paint; `assets/crystals.js` puts them back on idle, parsing the build's own
markup as SVG rather than through an HTML sink.

The guarantee the specification asked for — a crystal correct without scripting
— survives intact. It was the thing expected to be traded, and it did not have
to be.

## Standing

Lab medians pass on both measured routes. The field target — LCP p75 ≤ 2.5s —
sits above the lab number, so real traffic should read comfortably. Once the
site is deployed, that field number is the one worth watching; these are Lantern
projections at 562ms latency, 1.47Mbps and a 4× CPU slowdown.
