# Ocean Network Compute Dashboard

A Next.js web application for monitoring and interacting with Ocean Network. It provides node operators, compute job consumers, and community members with tools to explore network health, run compute jobs, manage nodes, track rewards, and more.

**Live app:** [dashboard.oncompute.ai](https://dashboard.oncompute.ai/)

---

## Features

- **Node Explorer** – Browse and search all registered Ocean compute nodes with detailed stats, hardware specs, location, uptime, and benchmark history.
- **Run a Job** – Step-by-step wizard to select a compute environment, configure resources (CPU, RAM, disk, GPU, duration) and pay for the job. This flow ends by opening the user's editor of choice, and running the job with the help of Ocean Orchestrator extension.
- **Inference** – Launch model inference services from default models, custom Hugging Face models, or service templates, and manage running instances.
- **Run a Node** – Guided setup flow for starting up a new Ocean compute node.
- **Global Stats** – Network-wide analytics: total nodes, jobs, rewards, GPU popularity, and country distribution.
- **Account** – Per-wallet hub: compute consumer and node owner activity, escrow funds (deposit/withdraw), subsidy, access lists, remote storage, and node auth tokens.
- **Subsidy Flow** – Token subsidy mechanism backed by a Google Sheets ledger, Gemini AI verification, and an on-chain access list.
- **Web3 Wallet Support** – Two independent paths: native wallets connect via EIP-6963 discovery + Ethers.js, and email magic link / passkey / Google OAuth go through Privy + Alchemy Account Kit to a smart contract account.
- **ENS Resolution** – Display human-readable ENS names for wallet addresses.
- **Analytics** – Dedicated analytics layer (summaries, rewards history, GPU stats) from the `analytics` backend.
- **Onboarding** – Short questionnaire after first login (who you are, what you want to do, how you found us). Answers are stored in Postgres and decide where the user lands next.
- **Node Storage** – Per-node persistent storage for compute consumers to upload files for using in compute jobs. Browse and create buckets on a node, upload/delete files, and control access via reusable on-chain access lists.

---

## Tech Stack

| Layer           | Technology                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | [Next.js](https://nextjs.org/) 16 (Pages Router)                                                                                       |
| Language        | TypeScript                                                                                                                             |
| Styling         | SCSS / CSS Modules                                                                                                                     |
| Web3            | [Ethers.js](https://docs.ethers.org/) v6, EIP-6963, [Privy](https://privy.io/), [Alchemy Account Kit](https://accountkit.alchemy.com/) |
| Ocean SDK       | `@oceanprotocol/lib`, `@oceanprotocol/contracts`                                                                                       |
| P2P             | [libp2p](https://libp2p.io/)                                                                                                           |
| Data Fetching   | [TanStack Query](https://tanstack.com/query)                                                                                           |
| Charts          | [Recharts](https://recharts.org/)                                                                                                      |
| Map             | [Leaflet](https://leafletjs.com/)                                                                                                      |
| Forms           | [Formik](https://formik.org/) + [Yup](https://github.com/jquense/yup)                                                                  |
| AI              | [Google Generative AI](https://ai.google.dev/) (Gemini)                                                                                |
| Database        | [Neon](https://neon.com/) Postgres + [Drizzle ORM](https://orm.drizzle.team/)                                                          |
| Package Manager | Yarn 4 (Berry)                                                                                                                         |

---

## Getting Started

### Prerequisites

- Node.js version pinned in `.nvmrc`
- Yarn 4 – enabled via Corepack: `corepack enable`

### Install dependencies

```bash
yarn install
```

### Configure environment variables

Copy `.env.example` and fill in the required values (see [Environment Variables](#environment-variables) below):

```bash
cp .env.example .env.local
```

### Set up the database

Point `DB_DATABASE_URL` and `DB_DATABASE_URL_UNPOOLED` at a Neon branch of your own (see [Database](#database)), then create the tables:

```bash
yarn db:migrate
```

### Run the development server

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for production

```bash
yarn build
yarn start
```

---

## Scripts

| Script             | Description                                      |
| ------------------ | ------------------------------------------------ |
| `yarn dev`         | Start Next.js development server                 |
| `yarn build`       | Build for production (`NODE_ENV=production`)     |
| `yarn start`       | Start the production server                      |
| `yarn lint`        | Run ESLint                                       |
| `yarn lint:fix`    | Run ESLint with auto-fix                         |
| `yarn format`      | Run Prettier on all TS/TSX files                 |
| `yarn db:generate` | Generate a SQL migration from `src/db/schema.ts` |
| `yarn db:migrate`  | Apply pending migrations to the database         |
| `yarn db:studio`   | Open Drizzle Studio to browse the database       |

---

## Environment Variables

Create a `.env.local` file from [`.env.example`](.env.example) (or configure your deployment environment) with the following variables. Unless marked optional, a variable is required.

### App

| Variable                            | Description                                                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_ENV`               | `"production"` selects Base mainnet and production backends. Any other value (e.g. `"development"`) selects Ethereum Sepolia and dev backends.                                                  |
| `NEXT_PUBLIC_LEGACY_ESCROW_ADDRESS` | Optional. Address of the previous Escrow deployment on Base. When set, the escrow page shows a contract selector so users can view and withdraw funds left in it. Ignored on Sepolia.           |
| `NEXT_PUBLIC_OUTAGE_BANNER_ENABLED` | Optional. Set to `"true"` to show the outage banner on every page.                                                                                                                              |
| `NEXT_PUBLIC_OUTAGE_BANNER_MESSAGE` | Optional. Banner text. Supports headings (`#`, `##`, `###` at line start), `**bold**`, `*italic*`, `` `code` ``, `[link](https://...)` and line breaks (`\n`). Raw HTML is shown as plain text. |

### Auth & Wallets

| Variable                        | Description                                                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_PRIVY_APP_ID`      | Privy app ID used for login                                                                                                                        |
| `NEXT_PUBLIC_ALCHEMY_API_KEY`   | Alchemy API key for smart contract accounts                                                                                                        |
| `NEXT_PUBLIC_ALCHEMY_POLICY_ID` | Alchemy gas sponsorship policy ID                                                                                                                  |
| `NEXT_PUBLIC_APP_URL`           | Public app URL used as the Google login redirect (e.g. `http://localhost:3000`)                                                                    |
| `ALCHEMY_RPC_URL`               | Production only. Base mainnet Alchemy RPC URL, used server-side and behind the `/api/rpc` proxy. In development the app uses a public Sepolia RPC. |

### Database

| Variable                   | Description                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DB_DATABASE_URL`          | Neon Postgres pooled connection string. Used by API routes (onboarding).                                  |
| `DB_DATABASE_URL_UNPOOLED` | Optional. Neon direct (non-pooled) connection string, used by `yarn db:*`. Defaults to `DB_DATABASE_URL`. |

### Fiat On-Ramp

| Variable                                | Description                                                         |
| --------------------------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_RAMP_API_KEY`              | Ramp host API key for card top-ups                                  |
| `NEXT_PUBLIC_RAMP_GET_STATUS_INTERVAL`  | Optional. Top-up status polling interval in ms. Defaults to `5000`. |
| `NEXT_PUBLIC_RAMP_GET_STATUS_MAX_TRIES` | Optional. Max top-up status polls. Defaults to `20`.                |

### Subsidy Flow

| Variable                                      | Description                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                              | Google Gemini API key used in the subsidy AI flow                                 |
| `SUBSIDY_GSHEETS_SERVICE_ACCOUNT_EMAIL`       | Google service account email for Sheets access                                    |
| `SUBSIDY_GSHEETS_SERVICE_ACCOUNT_PRIVATE_KEY` | Private key for the Google service account, with line breaks escaped as `\n`      |
| `SUBSIDY_GSHEETS_SPREADSHEET_ID`              | Google Sheets spreadsheet ID for the subsidy ledger                               |
| `SUBSIDY_GSHEETS_SHEET_NAME`                  | Sheet/tab name within the spreadsheet                                             |
| `SUBSIDY_GMAIL_ADDRESS`                       | Gmail address used to send subsidy confirmation emails                            |
| `SUBSIDY_GMAIL_OAUTH_CLIENT_ID`               | Gmail OAuth client ID                                                             |
| `SUBSIDY_GMAIL_OAUTH_CLIENT_SECRET`           | Gmail OAuth client secret                                                         |
| `SUBSIDY_GMAIL_OAUTH_REFRESH_TOKEN`           | Gmail OAuth refresh token                                                         |
| `SUBSIDY_ACCESS_LIST_ADDRESS`                 | Subsidy AccessList contract on the active chain that claimed wallets are added to |
| `SUBSIDY_ACCESS_LIST_PRIVATE_KEY`             | Private key of a wallet allowed to mint on that access list                       |
| `NEXT_PUBLIC_SUBSIDY_PROVIDERS`               | Comma-separated subsidy provider addresses for the active chain                   |

### Compute & Inference

| Variable                             | Description                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_GPU_LIST`               | Comma-separated list of supported GPU models shown in the job and inference wizards                                                                                                            |
| `NEXT_PUBLIC_DEFAULT_MODEL_PEER_IDS` | Optional. Comma-separated node peer IDs whose service templates populate the default-model quick-start packages. When unset, the quick-start list is empty.                                    |
| `NEXT_PUBLIC_TEMPLATES_NODE_URL`     | Optional. HTTP URL of the node that serves the service template catalogue. Defaults to the built-in default node.                                                                              |
| `NEXT_PUBLIC_VLLM_TAG`               | Optional. Fallback Docker tag for `vllm/vllm-openai`. Defaults to pinned stable `v0.28.0`; models that require a newer architecture use their official model-specific image tag automatically. |
| `NEXT_PUBLIC_LLAMACPP_IMAGE`         | Optional. llama.cpp Docker image. Defaults to `ghcr.io/ggml-org/llama.cpp`.                                                                                                                    |
| `NEXT_PUBLIC_LLAMACPP_TAG`           | Optional. llama.cpp CPU image tag. Defaults to `server`.                                                                                                                                       |
| `NEXT_PUBLIC_LLAMACPP_TAG_CUDA`      | Optional. llama.cpp CUDA image tag. Defaults to `server-cuda`.                                                                                                                                 |

The Custom Models configuration keeps the fallback per deployment but also exposes a per-model
vLLM runtime selector. Its automatic setting selects `qwen38-flash-next` for
`Qwen/Qwen3.8-Flash-Next`, `glm53-flash` for `zai-org/GLM-5.3-Flash`, and the configured fallback
for other models.

> **Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. All others are server-side only and must never be committed or exposed publicly.

---

## Database

Onboarding answers are stored in [Neon](https://neon.com/) Postgres, provisioned through the Vercel Neon integration and accessed with [Drizzle ORM](https://orm.drizzle.team/).

- **Schema:** `src/db/schema.ts`. **Client:** `getDb()` in `src/db/index.ts`, for API routes only.
- **Migrations:** generated SQL in `drizzle/`, including `drizzle/meta/`. Commit these files and never edit them by hand.

### Changing the schema

1. Edit `src/db/schema.ts`.
2. Run `yarn db:generate --name <change>` to create a migration in `drizzle/`.
3. Run `yarn db:migrate` to apply it to the branch in your env.
4. Commit the schema and the generated files together.

### Branches and environments

Each Neon branch is a separate database with its own connection strings. Get them from the Neon Console (**Connect** → pick the branch; pooled for `DB_DATABASE_URL`, unpooled for `DB_DATABASE_URL_UNPOOLED`).

| Branch      | Used by                                         |
| ----------- | ----------------------------------------------- |
| `main`      | Production                                      |
| `preview/*` | Vercel preview deployments, copied from `main`  |
| your own    | Local development; don't develop against `main` |

Migrations are **not** applied on deploy. Run `yarn db:migrate` against `main` before deploying a schema change, and against any existing branch you keep using.

---

## Onboarding

New users answer three questions after their first login. The flow is driven by `src/lib/onboarding-questions.json`: profile options, goals grouped into tabs, and "how did you find us" sources.

- **Redirect:** each goal has a `destination`, a node id in the navigation tree (`src/lib/navigation-tree.ts`). The user lands on the deepest node shared by all their picked goals. For example, two template goals go to `/inference/templates`; a template goal plus a service goal goes to `/inference`; inference plus compute goals go to `/`.
- **API:** `GET` and `POST` on `/api/onboarding` store answers in the `onboarding_answers` table, keyed by lowercased wallet address. Responses contain only `{ onboarded, destination }`, so the destination is always computed on the server.
- **Override:** a valid `?next=` on `/login` wins over the computed destination.

To change routing, edit a goal's `destination` in the JSON, or add a node to `NAV_TREE`. To move a page, update its path in `src/config.ts` or `INFERENCE_PATHS` and the tree follows.

---

## API Backends

The app connects to two backend environments, selected automatically via `NEXT_PUBLIC_APP_ENV`:

| Environment   | (Incentive) API                | Analytics API                        |
| ------------- | ------------------------------ | ------------------------------------ |
| `development` | `https://api-dev.oncompute.ai` | `https://analytics-dev.oncompute.ai` |
| `production`  | `https://api.oncompute.ai`     | `https://analytics.oncompute.ai`     |

ENS resolution always uses: `https://ens-proxy.oceanprotocol.com/api`

---

## Networks & Tokens

The active chain is determined by `NEXT_PUBLIC_APP_ENV`:

| Environment   | Chain            | Chain ID   |
| ------------- | ---------------- | ---------- |
| `development` | Ethereum Sepolia | `11155111` |
| `production`  | Base Mainnet     | `8453`     |

Token contracts:

| Token | Sepolia (dev)                                | Base (prod)                                  |
| ----- | -------------------------------------------- | -------------------------------------------- |
| USDC  | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

---

## Project Structure

```
src/
├── pages/          # Next.js pages (routes)
│   ├── index.tsx           # Home
│   ├── nodes/              # Node detail
│   ├── nodes/[nodeId]/storage/ # Node persistent storage (buckets & files)
│   ├── compute/            # Compute landing
│   ├── run-job/            # Compute job wizard
│   ├── inference/          # Inference models, templates, services & instances
│   ├── run-node/           # Node setup wizard
│   ├── stats.tsx           # Global network stats
│   ├── leaderboard.tsx     # Leaderboard
│   ├── account/            # Per-wallet account hub (activity, escrow, subsidy, access)
│   ├── subsidy/            # Subsidy flow
│   └── api/                # Next.js API routes (RPC proxy, Docker tags, subsidy, onboarding)
├── components/     # Reusable UI components
├── db/             # Postgres schema and Drizzle client (server-only)
├── context/        # React context providers
├── contexts/       # React context providers
├── hooks/          # Custom React hooks
├── data/           # Static data (e.g. inference quick-start packages)
├── services/       # Custom service functions
├── api-services/   # BFF API service functions
├── utils/          # Utility functions
├── types/          # TypeScript type definitions
├── constants/      # App-wide constants
├── styles/         # Global SCSS styles & design tokens
├── assets/         # Static assets (SVGs, images)
├── lib/            # Web3-specific wrappers & configs
└── config.ts       # App config, routes, and API route helpers
drizzle/            # Generated SQL migrations + Drizzle metadata
```

---

## Links

- [Ocean Protocol](https://oceanprotocol.com/)
- [Ocean Node GitHub](https://github.com/oceanprotocol/ocean-node)
- [Ocean Network Docs](https://docs.oncompute.ai/)
- [Discord](https://discord.gg/CjdsWngg47)
- [X / Twitter](https://x.com/ONcompute)
- [Support](mailto:help@oncompute.ai)
