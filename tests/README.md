# Tests

No test framework and no `package.json`: the suites run on `node:test`, which
ships with the runtime.

```bash
node --test tests/*.test.mjs
```

Pass the files explicitly. `node --test tests/` fails on this Node/Windows
combination — the directory is resolved as a module and the run aborts with
`MODULE_NOT_FOUND` before any test is collected.

| Suite | Covers |
|---|---|
| `decision.test.mjs` | TM-01 — the canonical `Decision` model: baseline, answer replacement, ordering, pruning, completion, validation, the persistence adapter |
| `crystal.test.mjs` | TM-02 — the crystal: geometry, the state machine, and that every transition changes at least two serialized properties |
| `derive.test.mjs` | TM-03 — face derivation and the contradiction ruleset, with a fixture per rule and one clean vector |
| `decision-map.test.mjs` | TM-04 — the plate: determinism, the 1600×900 frame, the safe area, the render states, and that no browser file imports `sharp` |

## Build

```bash
npm ci                       # sharp, build-only
npm run build                # render the crystals, generate a Decision Map
npm run check                # crystal markup is current, then the suites
node scripts/generate-decision-map.mjs --fixture partner-split --lang ru
```
