# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

`nodes-dashboard` — the Next.js dashboard for Ocean Network. It shows node stats, and leaderboards, and hosts wallet-connected flows: running compute jobs, running/configuring your own node, profile/escrow management, token grants, and swapping tokens.

## Stack at a glance

- **Next.js 16**, Pages Router (`src/pages`, no `src/app`), React 18, TypeScript.
- **Yarn 4** (Berry, `node-modules` linker) — use `yarn`, not `npm`. Node version is pinned by `.nvmrc` (see gotchas — don't trust the README or CI on this).
- **UI**: MUI v7 + Emotion are dependencies, but most components actually style via co-located CSS Modules (`*.module.css`), not MUI's `sx` prop.
- **Server state**: TanStack Query, one `QueryClient` created via `useRef` in `src/pages/_app.tsx`.
- **Domain state**: ~15 React Context providers nested in `_app.tsx` (nodes, stats, profile, grant, run-job, run-node, P2P, node-auth, node-storage, etc.) rather than Redux/Zustand. Order in the provider tree matters — several inner providers depend on `useOceanAccount()`, which depends on Privy, so don't reorder casually.
- **Wallet stack**, layered — use `src/lib/use-ocean-account.tsx`'s `useOceanAccount()` for "current wallet" state, not a lower-level library directly: Privy (`@privy-io/react-auth`) handles login/auth → `@privy-io/alchemy-migration` bridges to an Alchemy smart-contract account → `useOceanAccount()` branches between an `SCAHandler` (smart-account path) and an `EOAHandler` (plain wallet path, e.g. MetaMask).
- **Direct Ocean Node calls** (bypassing the incentive-backend proxy) go through `@oceanprotocol/lib`'s `ProviderInstance` in `src/services/nodeService.ts`.
- **Charts**: `recharts`, in `src/components/chart/`.

## Commands

```bash
yarn dev         # next dev
yarn build       # next build --webpack (NODE_OPTIONS max-old-space-size=4096, see gotchas)
yarn start       # next start
yarn lint        # eslint --ext .ts,.tsx .
yarn lint:fix
yarn format      # prettier --write
```

**There is no test script and no automated test suite.** CI (`.github/workflows/ci.yml`) only runs `yarn lint` — a green CI run does not mean the app builds or works.

## Architecture, briefly

- `src/pages/` — routes, plus API routes under `src/pages/api/` (`rpc.ts`, and the server-side Grant flow under `api/grant/*`).
- `src/context/` and `src/contexts/` — domain state providers (note the split across two similarly-named folders; both are wired into `_app.tsx`).
- `src/lib/` — wallet/web3 hooks and adapters (see stack section above), plus the query client.
- `src/services/` and `src/api-services/` — backend integration. `src/config.ts` defines `API_ROOTS`/`apiRoutes`, switching between dev/prod URLs for the incentive-backend and analytics services based on `NEXT_PUBLIC_APP_ENV`. `src/api-services/*` backs the server-only Grant flow (Google Sheets, Gmail, Gemini).
- `src/components/` — ~35 feature folders. Filenames are kebab-case (`pie-chart.tsx`), exported components are PascalCase. Styling is co-located CSS Modules per component.

## Environment

Env vars live in `.env`/`.env.local` (never commit real values). Notable ones: `NEXT_PUBLIC_APP_ENV` (dev vs prod — picks backend URLs and chain: Sepolia vs Base), Alchemy/Privy keys (`NEXT_PUBLIC_ALCHEMY_API_KEY`, `NEXT_PUBLIC_ALCHEMY_POLICY_ID`, `NEXT_PUBLIC_PRIVY_APP_ID`), Grant-flow server secrets (`GEMINI_API_KEY`, `GRANT_GSHEETS_*`, `GRANT_GMAIL_*`, `GRANT_FAUCET_PRIVATE_KEY`), `NEXT_PUBLIC_GPU_LIST`.

## Known gotchas

- **`.eslintrc` vs `.eslintrc.json`**: ESLint's config precedence means `.eslintrc.json` (which only extends `next/core-web-vitals`) wins over `.eslintrc` (which adds `require-await: error`, `no-unused-vars: error`, etc.) — the stricter rules are currently inactive. Worth consolidating; don't assume those rules are enforced.
- **Node version disagreement**: `.nvmrc` pins `v24.15.0`, but README and `ci.yml` both say `20.16.0`. Trust `.nvmrc`.
- **Wagmi is not actually used**, despite being a dependency and mentioned in the README's stack table — there are no `from 'wagmi'` imports anywhere in `src/`. The real wallet abstraction is `src/lib/use-ocean-account.tsx`.
- **`src/lib/config.ts` exports an unused second `QueryClient`** — the one actually wired into the app is created separately in `_app.tsx`. Likely dead code; don't build on the one in `lib/config.ts`.
- **`src/lib/alchemy-provider.tsx` installs a "TEMP DIAGNOSTIC" fetch logger** (`installPrivyAlchemyFetchLogger()`) at module load — leftover debug instrumentation from a Privy/Alchemy migration, not something to extend.
- `tsconfig.json` declares `@Types/*` → `src/shared/types/*` and `@utils/*` → `src/shared/utils/*`, but only `src/shared/consts/` actually exists — those two aliases don't currently resolve to anything.
- Production builds require `NODE_OPTIONS=--max-old-space-size=4096` (already set in the `build` script) — the build is memory-constrained.

## Verifying changes

Since there's no automated test suite, this is the actual bar: run `yarn lint` and fix anything it flags, then run `yarn dev` and manually exercise the affected page or flow in a browser — including loading/empty/error states, and if the change touches wallet code, check it against both the SCA and EOA account paths where relevant. Don't report a change as working without having done this.

## AI tooling

This repo pulls shared Codex hooks and agents from the `ai-instructions` git submodule — see [`.Codex/HOOKS.md`](.Codex/HOOKS.md) for how that's wired up.
