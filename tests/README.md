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
