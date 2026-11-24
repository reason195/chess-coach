/**
 * Stockfish (lite, single-threaded WASM build) running in a Web Worker.
 *
 * The engine files live in /public/engine/ and are the stockfish.js
 * "lite-single" flavour: single-threaded, so NO cross-origin isolation
 * (COOP/COEP headers) is required. Stockfish is GPLv3 — see NOTICE.md
 * and public/engine/STOCKFISH-LICENSE.txt.
 */

export interface EvalResult {
  /** Centipawns from the side-to-move's point of view; null if mate score. */
  cp: number | null;
  /** Mate in N from side-to-move POV (positive = side to move mates). */
  mate: number | null;
  depth: number;
  bestMoveUci: string | null;
}

const ENGINE_URL = "/engine/stockfish-19-lite-single.js";

export class StockfishEngine {
  private worker: Worker | null = null;
  private ready = false;
  private queue: Promise<unknown> = Promise.resolve();
  private pending: {
    resolve: (v: EvalResult) => void;
    reject: (e: Error) => void;
    best: EvalResult;
  } | null = null;

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(ENGINE_URL);
    worker.onmessage = (ev: MessageEvent) => this.onLine(String(ev.data));
    worker.onerror = () => {
      this.pending?.reject(new Error("Stockfish worker failed to load"));
      this.pending = null;
    };
    this.worker = worker;
    worker.postMessage("uci");
    worker.postMessage("isready");
    return worker;
  }

  private onLine(line: string): void {
    if (line === "readyok") {
      this.ready = true;
      return;
    }
    const pending = this.pending;
    if (!pending) return;
    const info = line.match(
      /^info depth (\d+).*?score (cp|mate) (-?\d+)(?:.*?\bpv ([a-h][1-8][a-h][1-8][qrbn]?))?/,
    );
    if (info) {
      const [, depth, kind, value, pv] = info;
      pending.best = {
        cp: kind === "cp" ? parseInt(value, 10) : null,
        mate: kind === "mate" ? parseInt(value, 10) : null,
        depth: parseInt(depth, 10),
        bestMoveUci: pv ?? pending.best.bestMoveUci,
      };
      return;
    }
    const best = line.match(/^bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
    if (best) {
      pending.best.bestMoveUci = best[1];
      this.pending = null;
      pending.resolve(pending.best);
    }
  }

  /** Evaluate a FEN at a fixed depth. Calls are serialised. */
  evaluate(fen: string, depth = 14): Promise<EvalResult> {
    const task = this.queue.then(() => this.evaluateNow(fen, depth));
    this.queue = task.catch(() => undefined);
    return task;
  }

  private async evaluateNow(fen: string, depth: number): Promise<EvalResult> {
    const worker = this.ensureWorker();
    // Wait until the engine answered `isready` once.
    for (let i = 0; i < 100 && !this.ready; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return new Promise<EvalResult>((resolve, reject) => {
      this.pending = {
        resolve,
        reject,
        best: { cp: null, mate: null, depth: 0, bestMoveUci: null },
      };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }
}

/** Convert an engine eval (side-to-move POV) to White's POV in pawns. */
export function toWhitePawns(result: EvalResult, fen: string): number {
  const sideToMove = fen.split(" ")[1] ?? "w";
  let pawns: number;
  if (result.mate !== null) {
    pawns = result.mate > 0 ? 100 : -100;
  } else {
    pawns = (result.cp ?? 0) / 100;
  }
  return sideToMove === "b" ? -pawns : pawns;
}
