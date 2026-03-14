# Ocean Network Compute Dashboard

A Next.js web application for monitoring and interacting with Ocean Network. It provides node operators, compute job consumers, and community members with tools to explore network health, run compute jobs, manage nodes, track rewards, and more.

**Live app:** [dashboard.oncompute.ai](https://dashboard.oncompute.ai/)

---

## Features

- **Node Explorer** – Browse and search all registered Ocean compute nodes with detailed stats, hardware specs, location, uptime, and benchmark history.
- **Run a Job** – Step-by-step wizard to select a compute environment, configure resources (CPU, RAM, disk, GPU, duration) and pay for the job. This flow ends by opening the user's editor of choice, and running the job with the help of Ocean Orchestrator extension.
- **Run a Node** – Guided setup flow for starting up a new Ocean compute node.
- **Global Stats** – Network-wide analytics: total nodes, jobs, rewards, GPU popularity, and country distribution.
- **Profile** – Per-wallet view of owned nodes, rewards history, and associated jobs.
- **Grant Flow** – Token grant mechanism backed by a Google Sheets ledger and Gemini AI integration.
- **Swap Tokens / Withdraw** – Utility pages for token operations using Alchemy and Wagmi/Coinbase wallet integrations.
- **Web3 Wallet Support** – Alchemy Account Kit + Wagmi for seamless wallet connection. Supports email magic link, passkey, Google OAuth (popup), and external wallets (MetaMask, WalletConnect, etc.).
- **ENS Resolution** – Display human-readable ENS names for wallet addresses.
- **Analytics** – Dedicated analytics layer (summaries, rewards history, GPU stats) from the `analytics` backend.

---

## Tech Stack

| Layer           | Technology                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | [Next.js](https://nextjs.org/) 16 (Pages Router)                                                                                |
| Language        | TypeScript                                                                                                                      |
| Styling         | SCSS / CSS Modules                                                                                                              |
| Web3            | [Wagmi](https://wagmi.sh/) v3, [Ethers.js](https://docs.ethers.org/) v6, [Alchemy Account Kit](https://accountkit.alchemy.com/) |
| Ocean SDK       | `@oceanprotocol/lib`, `@oceanprotocol/contracts`                                                                                |
| P2P             | [libp2p](https://libp2p.io/)                                                                                                    |
| Data Fetching   | [TanStack Query](https://tanstack.com/query)                                                                                    |
| Charts          | [Recharts](https://recharts.org/)                                                                                               |
| Map             | [Leaflet](https://leafletjs.com/)                                                                                               |
| Forms           | [Formik](https://formik.org/) + [Yup](https://github.com/jquense/yup)                                                           |
| AI              | [Google Generative AI](https://ai.google.dev/) (Gemini)                                                                         |
| Package Manager | Yarn 4 (Berry)                                                                                                                  |

---

## Getting Started

### Prerequisites

- Node.js `20.16.0` (see `.nvmrc`)
- Yarn 4 – enabled via Corepack: `corepack enable`

### Install dependencies

```bash
yarn install
```

### Configure environment variables

Copy `.env` and fill in the required values (see [Environment Variables](#environment-variables) below):

```bash
cp .env .env.local
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

| Script          | Description                                  |
| --------------- | -------------------------------------------- |
| `yarn dev`      | Start Next.js development server             |
| `yarn build`    | Build for production (`NODE_ENV=production`) |
| `yarn start`    | Start the production server                  |
| `yarn lint`     | Run ESLint                                   |
| `yarn lint:fix` | Run ESLint with auto-fix                     |
| `yarn format`   | Run Prettier on all TS/TSX files             |

---

## Environment Variables

Create a `.env.local` file (or configure your deployment environment) with the following variables.

### App

| Variable              | Description                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_ENV` | `"development"` or `"production"`. Controls which backend URLs are used and which chain tokens are on (ETH Sepolia or BASE). |

### Alchemy

| Variable                        | Description                                                            |
| ------------------------------- | ---------------------------------------------------------------------- |
| `ALCHEMY_RPC_URL`               | Alchemy RPC endpoint (Ethereum mainnet for dev, Base mainnet for prod) |
| `NEXT_PUBLIC_ALCHEMY_API_KEY`   | Alchemy API key                                                        |
| `NEXT_PUBLIC_ALCHEMY_POLICY_ID` | Alchemy gas policy ID                                                  |

### Grant Flow

| Variable                                    | Description                                                      |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `GEMINI_API_KEY`                            | Google Gemini API key used in the grant AI flow                  |
| `GRANT_GSHEETS_SERVICE_ACCOUNT_EMAIL`       | Google service account email for Sheets access                   |
| `GRANT_GSHEETS_SERVICE_ACCOUNT_PRIVATE_KEY` | Private key for the Google service account                       |
| `GRANT_GSHEETS_SPREADSHEET_ID`              | Google Sheets spreadsheet ID for grant ledger                    |
| `GRANT_GSHEETS_SHEET_NAME`                  | Sheet/tab name within the spreadsheet                            |
| `GRANT_GMAIL_ADDRESS`                       | Gmail address used to send grant confirmation emails             |
| `GRANT_GMAIL_OAUTH_CLIENT_ID`               | Gmail OAuth client ID                                            |
| `GRANT_GMAIL_OAUTH_CLIENT_SECRET`           | Gmail OAuth client secret                                        |
| `GRANT_GMAIL_OAUTH_REFRESH_TOKEN`           | Gmail OAuth refresh token                                        |
| `NEXT_PUBLIC_GRANT_AMOUNT`                  | Token grant amount distributed per grant                         |
| `NEXT_PUBLIC_GRANT_TOKEN_ADDRESS`           | ERC-20 token contract address for grants                         |
| `GRANT_FAUCET_ADDRESS`                      | Faucet wallet address funding grants                             |
| `GRANT_FAUCET_PRIVATE_KEY`                  | Private key of the faucet wallet (server-side only, keep secret) |

### Compute

| Variable               | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_GPU_LIST` | Comma-separated list of supported GPU models shown in the job wizard |

> **Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. All others are server-side only and must never be committed or exposed publicly.

---

## API Backends

The app connects to two backend environments, selected automatically via `NEXT_PUBLIC_APP_ENV`:

| Environment   | (Incentive) API                              | Analytics API                              |
| ------------- | -------------------------------------------- | ------------------------------------------ |
| `development` | `https://incentive-backend.oceanprotocol.io` | `https://analytics.nodes.oceanprotocol.io` |
| `production`  | `https://api.oncompute.ai`                   | `https://analytics.oncompute.ai`           |

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
| COMPY | `0x973e69303259B0c2543a38665122b773D28405fB` | `0x298f163244e0c8cc9316D6E97162e5792ac5d410` |
| USDC  | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

---

## Project Structure

```
src/
├── pages/          # Next.js pages (routes)
│   ├── index.tsx           # Home / node map
│   ├── nodes/              # Node explorer & detail
│   ├── run-job/            # Compute job wizard
│   ├── run-node/           # Node setup wizard
│   ├── stats.tsx           # Global network stats
│   ├── leaderboard.tsx     # Leaderboard
│   ├── profile/            # Per-wallet profile
│   ├── grant/              # Grant flow
│   ├── swap-tokens.tsx     # Token swap
│   ├── withdraw.tsx        # Token withdrawal
│   └── api/                # Next.js API routes (server-side)
├── components/     # Reusable UI components
├── context/        # React context providers
├── hooks/          # Custom React hooks
├── services/       # Custom service functions
├── api-services/   # BFF API service functions
├── utils/          # Utility functions
├── types/          # TypeScript type definitions
├── constants/      # App-wide constants
├── styles/         # Global SCSS styles & design tokens
├── assets/         # Static assets (SVGs, images)
├── lib/            # Web3-specific wrappers & configs
└── config.ts       # App config, routes, and API route helpers
```

---

## Links

- [Ocean Protocol](https://oceanprotocol.com/)
- [Ocean Node GitHub](https://github.com/oceanprotocol/ocean-node)
- [Ocean Network Docs](https://docs.oncompute.ai/)
- [Discord](https://discord.gg/CjdsWngg47)
- [X / Twitter](https://x.com/ONcompute)
- [Support](mailto:help@oncompute.ai)
