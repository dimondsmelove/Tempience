# Surface: Life

|            |                                                                |
| ---------- | -------------------------------------------------------------- |
| Route      | `/life`                                                        |
| Data plane | local Triplit projection (`traces`, `scopes`, `scopeSegments`) |
| Tool       | собственный CSS grid (нет OSS viz)                             |
| Import     | `$lib/surfaces/life`                                           |

## Files

| File                    | Role                                                    |
| ----------------------- | ------------------------------------------------------- |
| `LifeGridView.svelte`   | virtualized grid                                        |
| `life-grid.ts`          | cell model + drill actions                              |
| `triplit-projection.ts` | local Trace/Scope/segment projection and density rollup |
| `life-view.svelte.ts`   | period/scale/generic scope state                        |

## Edit rules

- Main Life Map reads stay in `triplit-projection.ts` and the Triplit repository.
- Scope focus uses generic `scope_id`; do not reintroduce `Scope.kind`.
- Legacy backend density endpoints remain available only to external/legacy consumers; `/life` does not call them.
