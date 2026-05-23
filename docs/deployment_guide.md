# Deployment & Developer Guide

This document describes how to deploy, test, and integrate the **AI Venture Capital DAO** Intelligent Contracts and React frontend on GenLayer.

---

## Prerequisites
* **Node.js**: `v18+` or later (tested on `v24.14.0`)
* **npm**: `v9+` or later
* **Python**: `v3.10` or later (for local linting or development outside Studio)
* **GenLayer Studio**: Access to [GenLayer Studio](https://studio.genlayer.com) or a running local node (`npx genlayer init`).

---

## Codebase Architecture
```text
C:\DEV Panda\venturedao
├── contracts
│   ├── VentureDAOMinimal.py   # Phase 1: Lightweight deployable contract
│   └── VentureDAO.py          # Phase 2 & 3: Production-ready AI & DAO contract
├── docs
│   └── deployment_guide.md    # This guide
├── frontend
│   ├── dist                   # Compiled build assets
│   ├── src                    # React JSX source files
│   │   ├── App.jsx            # Main app file
│   │   └── index.css          # Styling configurations
│   ├── tailwind.config.js     # Tailwind setup
│   └── vite.config.js         # Vite bundler config
└── scripts
    ├── example_prompts.json   # Mock prompt structures
    └── example_outputs.json   # Mock JSON schemas
```

---

## Contract Deployment Strategy

GenLayer Studio's parser can be sensitive. We use an **incremental deployment strategy** in 3 phases.

### Phase 1: Minimal Storage Verification
1. Open [GenLayer Studio](https://studio.genlayer.com/).
2. Create a new contract file and paste the contents of `contracts/VentureDAOMinimal.py`.
3. Check the schema inspector in the right-hand panel:
   * Confirm the schema parses without parser errors.
   * Verify the public methods list: `submit_proposal`, `get_proposal_count`, and `get_proposal_json`.
4. Click **Deploy** in the Studio interface:
   * Run a mock transaction by calling `submit_proposal` with test string arguments.
   * Verify that proposal storage increments and `get_proposal_json(0)` returns the serialized details correctly.

### Phase 2 & 3: Full AI Analyst & DAO features
Once Phase 1 successfully deploys, proceed to the full features:
1. Replace or create a new file in GenLayer Studio with the contents of `contracts/VentureDAO.py`.
2. Verify the schema. You should see the additional public methods:
   * `stake_tokens` (Payable)
   * `unstake_tokens`
   * `deposit_treasury` (Payable)
   * `evaluate_proposal` (AI integration)
   * `vote_on_proposal`
   * `finalize_proposal`
   * `get_staked_balance`
   * `get_total_staked`
   * `get_treasury_balance`
   * `get_proposal_votes`
3. Click **Deploy**.
4. Test the AI Analysist evaluation:
   * Submit a proposal with realistic URLs (e.g., `https://hyperion.earth` for website, and github/whitepaper links).
   * Call `evaluate_proposal(0)`. In the transaction logs, watch the non-deterministic scraper render the site in text mode, execute the LLM scoring prompt, run validator consensus check, and record the results into contract storage.
   * Verify that the proposal status updates to `1` (VotingActive) and that `get_proposal_json(0)` includes the nested `ai_memo` JSON.

---

## Frontend Integration & Run Guide

The frontend features both a **Mock Mode** (acts as a local blockchain emulator out-of-the-box for instant testing without a running node) and a **Live Mode** (connects directly to your deployed GenLayer contract).

### 1. Install & Build
Navigate to `/frontend` and install packages:
```bash
cd C:\DEV Panda\venturedao\frontend
npm install
```

To build production assets:
```bash
npm run build
```

### 2. Run Local Development Server
To start the hot-reloading development server:
```bash
npm run dev
```
Open `http://localhost:5173` (or the URL displayed in the terminal) in your browser.

### 3. Connect to Live GenLayer Studio Node
1. Navigate to the **Node RPC** tab in the dashboard.
2. Toggle the connection state to **Live GenLayer Studio Node**.
3. Set your contract details:
   * **JSON-RPC Provider Endpoint**: Set to `http://localhost:4000` (or your Studio RPC endpoint).
   * **Intelligent Contract Address**: Paste the deployed address of `VentureDAO.py` from your Studio.
4. Click **Connect & Verify Contract**. The dashboard will load active proposals directly from the GenLayer blockchain!
