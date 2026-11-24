# Third-party components and licences

## Stockfish (engine)
- Component: Stockfish 19, "lite single-threaded" WASM build from the
  stockfish.js project (https://github.com/nmrugg/stockfish.js), itself a
  port of Stockfish (https://github.com/official-stockfish/Stockfish).
- Files: `public/engine/stockfish-19-lite-single.js`,
  `public/engine/stockfish-19-lite-single.wasm`.
- Licence: **GNU General Public License v3.0 (GPLv3)** — full text in
  `public/engine/STOCKFISH-LICENSE.txt`. The engine runs as a separate
  Web Worker process communicating over the UCI protocol; it is an
  independent program, used unmodified.
- Why single-threaded: it needs no cross-origin isolation
  (COOP/COEP headers), so it works on any static host.

## chess.js
- PGN parsing and move legality (https://github.com/jhlywa/chess.js).
- Licence: BSD-2-Clause.

## Firebase JavaScript SDK
- Firebase app, App Check and AI Logic client
  (https://github.com/firebase/firebase-js-sdk).
- Licence: Apache-2.0.

## This project's own code
- Licence: Apache-2.0 (see LICENSE).
