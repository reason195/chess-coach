# Chess Coach — Hybrid AI Game Review

An offline-capable chess game reviewer built for the **#BuildHybridAI 2026**
hackathon. Paste a PGN and get:

- **Per-move engine scores** from Stockfish running *locally in your
  browser* (no server), with blunders and mistakes flagged in the move list.
- **Per-move explanations** from **Firebase AI Logic in hybrid mode**
  (`PREFER_ON_DEVICE`): Gemini Nano on-device first — private, offline,
  zero-cost — with automatic fallback to cloud Gemini. An "on-device only"
  mode is available for a fully offline explanation.
- **A whole-game deep review** from cloud Gemini (`ONLY_IN_CLOUD`) with
  structured output: overview, turning points, mistake patterns and a
  training plan.
- A bilingual UI (English / 简体中文). Every AI answer carries a badge
  showing whether it was produced **on-device** or **in the cloud**.

## How the hybrid inference is wired

All AI goes through Firebase AI Logic (Gemini Developer API backend);
no model API is called directly.

| Feature | Firebase AI Logic mode | Why |
|---|---|---|
| Explain this move | `PREFER_ON_DEVICE` | Instant, private, works offline once the model is downloaded; cloud fallback keeps it available everywhere |
| Explain offline | `ONLY_ON_DEVICE` | Proves the offline story; the UI says honestly when Nano is unavailable instead of silently using the cloud |
| Deep review | `ONLY_IN_CLOUD` | Needs long context over the whole game and structured JSON output |

On-device initialisation is triggered from a button click
(`initializeDeviceModel()`), as required by the Chrome Prompt API user-gesture
rule. On-device inference needs desktop Chrome 139+ with Gemini Nano
available; everywhere else the hybrid mode falls back to the cloud.

## Run it locally

```bash
npm install
npm run dev
```

Then open the printed URL (default http://localhost:5173).

### App Check (required for AI calls)

Firebase AI Logic requires App Check. For local development:

1. Copy `.env.example` to `.env.local` (git-ignored — never commit it).
2. Start the dev server once. With no token configured, the app enables
   the App Check debug provider and the SDK prints a debug token in the
   browser console.
3. Register that token in Firebase Console → **App Check → Manage debug
   tokens**, paste it into `.env.local` as `VITE_APPCHECK_DEBUG_TOKEN`,
   and restart the dev server.

For production, set `VITE_RECAPTCHA_SITE_KEY` instead (reCAPTCHA v3
provider) and leave the debug token unset.

### Configuration

- Firebase web config lives in `src/ai/firebase-config.ts` (public client
  identifiers for project `chess-coach-7361f`, not secrets).
- Cloud model: `VITE_CLOUD_MODEL` (default `gemini-2.5-flash`).

## Build

```bash
npm run build   # type-checks, then bundles into dist/
npm run preview # serve the production build locally
```

## Project layout

```
src/
  chess/  PGN loading (chess.js), Stockfish worker wrapper, move grading
  ai/     Firebase init + App Check, hybrid inference wrappers, prompts
  ui/     Self-drawn SVG chessboard
  i18n.ts English / Chinese strings
public/engine/  Stockfish WASM (single-threaded lite build)
```

## Licences

- This project's code: Apache-2.0 (see LICENSE).
- Stockfish is **GPLv3** and ships unmodified as a separate worker
  program; see `NOTICE.md` and `public/engine/STOCKFISH-LICENSE.txt`.
- chess.js: BSD-2-Clause. Firebase JS SDK: Apache-2.0.
