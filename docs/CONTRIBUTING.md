# Contributing to FeelingWise

## Before You Start

Read these documents in order:
1. `docs/RESEARCH_FOUNDATION.md` — Understand WHY detection decisions are made
2. `MASTER_BUILD_GUIDE.md` — Understand HOW to implement

## Code Standards

- TypeScript strict mode
- Path aliases for all imports (@types/, @core/, @ai/, etc.)
- Every async function: typed Promise + try/catch
- Detection: Layer 1 confidence capped at 0.70, ambiguous = PASS
- Neutralization: must pass validateNeutralization() or original shown

## Testing

- Unit tests: `npm run test`
- E2E: `npm run test:e2e`
- Detection patterns: test against fixtures in tests/fixtures/

## Pull Request Requirements

1. All tests pass
2. tsc --noEmit = 0 errors
3. No new dependencies without justification
4. Detection changes include test cases (manipulative + benign)
