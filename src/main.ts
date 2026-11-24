import "./style.css";
import { loadPgn, startFen, SAMPLE_PGN, type LoadedGame } from "./chess/pgn";
import { StockfishEngine, toWhitePawns, type EvalResult } from "./chess/engine";
import { classifyMove, CLASS_MARK, type MoveClass } from "./chess/analysis";
import {
  deepReview,
  explainMove,
  explainMoveOffline,
  initDeviceModel,
  OnDeviceUnavailableError,
  type AIResult,
} from "./ai/hybrid";
import type { MoveContext } from "./ai/prompts";
import { renderBoard } from "./ui/board";
import { t, type Lang } from "./i18n";
import { Chess } from "chess.js";

// ---------- state ----------
let lang: Lang = "en";
let game: LoadedGame | null = null;
/** Selected ply index; -1 = starting position. */
let cursor = -1;
const engine = new StockfishEngine();
const evalCache = new Map<string, EvalResult>();
const classCache = new Map<number, MoveClass>();
let deviceReady = false;
let busy = false;

const $ = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`missing element #${id}`);
  return el;
};

// ---------- static layout ----------
function layout(): void {
  $("app").innerHTML = `
  <header>
    <div>
      <h1 data-i18n="appTitle"></h1>
      <p class="tagline" data-i18n="tagline"></p>
    </div>
    <div class="lang-toggle">
      <button id="lang-en" type="button">EN</button>
      <button id="lang-zh" type="button">中文</button>
    </div>
  </header>
  <div class="layout">
    <section class="panel">
      <h2 data-i18n="pgnLabel"></h2>
      <textarea id="pgn-input" spellcheck="false"></textarea>
      <div class="controls">
        <button id="load-pgn" type="button" data-i18n="loadPgn"></button>
        <button id="load-sample" type="button" data-i18n="loadSample"></button>
      </div>
      <div class="board-wrap" id="board"></div>
      <div class="controls">
        <button id="nav-first" type="button" data-i18n="first"></button>
        <button id="nav-prev" type="button" data-i18n="prev"></button>
        <button id="nav-next" type="button" data-i18n="next"></button>
        <button id="nav-last" type="button" data-i18n="last"></button>
      </div>
      <div class="eval-line" id="eval-line"></div>
      <h2 data-i18n="moves"></h2>
      <div class="moves" id="moves"></div>
    </section>
    <section class="panel">
      <h2>AI</h2>
      <button id="init-device" type="button" data-i18n="initDevice"></button>
      <div class="progress" id="device-progress" hidden><div></div></div>
      <p class="hint" data-i18n="deviceInitHint"></p>
      <div class="ai-actions controls">
        <button id="explain" type="button" data-i18n="explain"></button>
        <button id="explain-offline" type="button" data-i18n="explainOffline"></button>
        <button id="deep-review" type="button" data-i18n="deepReview"></button>
      </div>
      <div class="status" id="ai-status"></div>
      <div class="error" id="ai-error"></div>
      <div class="ai-output" id="ai-output"></div>
      <div id="ai-source"></div>
    </section>
  </div>
  <footer data-i18n="engineNote"></footer>`;
  applyI18n();
}

function applyI18n(): void {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n as Parameters<typeof t>[1];
    el.textContent = t(lang, key);
  });
  $("lang-en").classList.toggle("active", lang === "en");
  $("lang-zh").classList.toggle("active", lang === "zh");
  if (deviceReady) $("init-device").textContent = t(lang, "deviceReady");
}

// ---------- game rendering ----------
function currentFen(): string {
  if (!game) return new Chess().fen();
  if (cursor < 0) return startFen(game);
  return game.plies[cursor].fenAfter;
}

function renderGame(): void {
  if (!game) return;
  const fen = currentFen();
  const ply = cursor >= 0 ? game.plies[cursor] : null;
  renderBoard($("board"), fen, ply ? { from: ply.uci.slice(0, 2), to: ply.uci.slice(2, 4) } : null);

  const movesEl = $("moves");
  let html = "";
  game.plies.forEach((p, i) => {
    if (p.color === "white") html += `<span class="move-no">${p.moveNumber}.</span>`;
    const cls = classCache.get(i);
    const mark = cls ? CLASS_MARK[cls] : "";
    const clsName = cls === "blunder" || cls === "mistake" ? cls : "";
    html += `<button type="button" data-ply="${i}" class="${i === cursor ? "current" : ""} ${clsName}">${p.san}${mark}</button>`;
  });
  movesEl.innerHTML = html;
  movesEl.querySelectorAll<HTMLButtonElement>("button[data-ply]").forEach((b) => {
    b.addEventListener("click", () => {
      cursor = parseInt(b.dataset.ply ?? "0", 10);
      renderGame();
      void analyseCurrent();
    });
  });
  updateEvalLine(null);
}

function updateEvalLine(evalWhite: number | null): void {
  const el = $("eval-line");
  if (!game || cursor < 0) {
    el.textContent = game ? `${game.white} vs ${game.black} · ${game.result}` : "";
    return;
  }
  const ply = game.plies[cursor];
  const cls = classCache.get(cursor);
  const cached = evalCache.get(ply.fenAfter);
  const best = cached?.bestMoveUci ? uciToSan(ply.fenAfter, cached.bestMoveUci) : null;
  el.textContent =
    `${ply.moveNumber}. ${ply.san}` +
    (cls ? ` (${cls})` : "") +
    (evalWhite !== null
      ? ` · ${t(lang, "evalLabel")}: ${evalWhite >= 0 ? "+" : ""}${evalWhite.toFixed(2)}`
      : "") +
    (best ? ` · ${t(lang, "bestMove")}: ${best}` : "");
}

function uciToSan(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.slice(4) || undefined,
    });
    return move ? move.san : uci;
  } catch {
    return uci;
  }
}

// ---------- engine analysis ----------
async function getEval(fen: string): Promise<EvalResult> {
  const hit = evalCache.get(fen);
  if (hit) return hit;
  const result = await engine.evaluate(fen, 14);
  evalCache.set(fen, result);
  return result;
}

async function analyseCurrent(): Promise<void> {
  if (!game || cursor < 0) return;
  const plyIndex = cursor;
  const ply = game.plies[plyIndex];
  try {
    const [before, after] = await Promise.all([
      getEval(ply.fenBefore),
      getEval(ply.fenAfter),
    ]);
    if (cursor !== plyIndex) return; // user navigated away
    const evalAfterWhite = toWhitePawns(after, ply.fenAfter);
    const evalBeforeWhite = toWhitePawns(before, ply.fenBefore);
    const playedBest = before.bestMoveUci === ply.uci;
    classCache.set(
      plyIndex,
      classifyMove(evalBeforeWhite, evalAfterWhite, ply.color, playedBest),
    );
    renderGame();
    updateEvalLine(evalAfterWhite);
  } catch (err) {
    console.warn("[engine] analysis failed:", err);
  }
}

async function analyseAll(): Promise<void> {
  if (!game) return;
  for (let i = 0; i < game.plies.length; i++) {
    const ply = game.plies[i];
    try {
      const [before, after] = await Promise.all([
        getEval(ply.fenBefore),
        getEval(ply.fenAfter),
      ]);
      classCache.set(
        i,
        classifyMove(
          toWhitePawns(before, ply.fenBefore),
          toWhitePawns(after, ply.fenAfter),
          ply.color,
          before.bestMoveUci === ply.uci,
        ),
      );
    } catch {
      /* engine unavailable: classifications stay unknown */
    }
  }
  renderGame();
  if (cursor >= 0) void analyseCurrent();
}

// ---------- AI ----------
function setStatus(text: string): void {
  $("ai-status").textContent = text;
}
function setError(text: string): void {
  $("ai-error").textContent = text;
}
function showResult(result: AIResult): void {
  $("ai-output").textContent = result.text;
  const badgeKey =
    result.source === "on_device"
      ? "sourceOnDevice"
      : result.source === "in_cloud"
        ? "sourceCloud"
        : "sourceUnknown";
  $("ai-source").innerHTML = `<span class="badge ${result.source}">${t(lang, badgeKey)}</span>`;
}

function moveContext(): MoveContext | null {
  if (!game || cursor < 0) return null;
  const ply = game.plies[cursor];
  const before = evalCache.get(ply.fenBefore);
  const after = evalCache.get(ply.fenAfter);
  return {
    moveNumber: ply.moveNumber,
    san: ply.san,
    color: ply.color,
    fenBefore: ply.fenBefore,
    fenAfter: ply.fenAfter,
    evalBefore: before ? toWhitePawns(before, ply.fenBefore) : null,
    evalAfterWhite: after ? toWhitePawns(after, ply.fenAfter) : null,
    classification: classCache.get(cursor) ?? "unknown",
    bestMoveSan: before?.bestMoveUci
      ? uciToSan(ply.fenBefore, before.bestMoveUci)
      : null,
    lang,
  };
}

async function withBusy<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (busy) return undefined;
  busy = true;
  setError("");
  setStatus(t(lang, "thinking"));
  try {
    return await fn();
  } finally {
    busy = false;
    setStatus("");
  }
}

// ---------- wiring ----------
function loadFromTextarea(): void {
  const text = $<HTMLTextAreaElement>("pgn-input").value.trim();
  if (!text) return;
  try {
    game = loadPgn(text);
    cursor = -1;
    classCache.clear();
    renderGame();
    void analyseAll();
  } catch (err) {
    setError(`PGN: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function wire(): void {
  $("lang-en").addEventListener("click", () => { lang = "en"; applyI18n(); });
  $("lang-zh").addEventListener("click", () => { lang = "zh"; applyI18n(); });
  $("load-pgn").addEventListener("click", loadFromTextarea);
  $("load-sample").addEventListener("click", () => {
    $<HTMLTextAreaElement>("pgn-input").value = SAMPLE_PGN;
    loadFromTextarea();
  });
  const nav = (fn: () => void) => () => {
    if (!game) return;
    fn();
    renderGame();
    void analyseCurrent();
  };
  $("nav-first").addEventListener("click", nav(() => { cursor = -1; }));
  $("nav-prev").addEventListener("click", nav(() => { cursor = Math.max(-1, cursor - 1); }));
  $("nav-next").addEventListener("click", nav(() => { cursor = Math.min(game!.plies.length - 1, cursor + 1); }));
  $("nav-last").addEventListener("click", nav(() => { cursor = game!.plies.length - 1; }));

  // On-device initialisation MUST start from a user gesture.
  $("init-device").addEventListener("click", async () => {
    const bar = $("device-progress");
    const fill = bar.querySelector<HTMLDivElement>("div")!;
    bar.hidden = false;
    await initDeviceModel((fraction) => {
      fill.style.width = `${Math.round(fraction * 100)}%`;
    });
    bar.hidden = true;
    deviceReady = true;
    $("init-device").textContent = t(lang, "deviceReady");
  });

  $("explain").addEventListener("click", async () => {
    const ctx = moveContext();
    if (!ctx) { setError(t(lang, game ? "selectMove" : "noGame")); return; }
    await withBusy(async () => {
      try {
        showResult(await explainMove(ctx));
      } catch (err) {
        setError(t(lang, "aiError") + (err instanceof Error ? err.message : String(err)));
      }
    });
  });

  $("explain-offline").addEventListener("click", async () => {
    const ctx = moveContext();
    if (!ctx) { setError(t(lang, game ? "selectMove" : "noGame")); return; }
    await withBusy(async () => {
      try {
        showResult(await explainMoveOffline(ctx));
      } catch (err) {
        if (err instanceof OnDeviceUnavailableError) {
          setError(t(lang, "offlineUnavailable"));
        } else {
          setError(t(lang, "aiError") + (err instanceof Error ? err.message : String(err)));
        }
      }
    });
  });

  $("deep-review").addEventListener("click", async () => {
    if (!game) { setError(t(lang, "noGame")); return; }
    const g = game;
    await withBusy(async () => {
      try {
        await analyseAll();
        const digest = g.plies.map((ply, i) => {
          const before = evalCache.get(ply.fenBefore);
          const after = evalCache.get(ply.fenAfter);
          const b = before ? toWhitePawns(before, ply.fenBefore).toFixed(2) : "?";
          const a = after ? toWhitePawns(after, ply.fenAfter).toFixed(2) : "?";
          return `${ply.moveNumber}. ${ply.san} — ${classCache.get(i) ?? "unknown"}, eval ${b} -> ${a}`;
        });
        showResult(
          await deepReview({
            pgn: $<HTMLTextAreaElement>("pgn-input").value,
            result: g.result,
            white: g.white,
            black: g.black,
            moveDigest: digest,
            lang,
          }),
        );
      } catch (err) {
        setError(t(lang, "aiError") + (err instanceof Error ? err.message : String(err)));
      }
    });
  });
}

// ---------- boot ----------
layout();
wire();
$<HTMLTextAreaElement>("pgn-input").value = SAMPLE_PGN;
loadFromTextarea();
