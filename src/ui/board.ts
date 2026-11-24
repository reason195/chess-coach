import { placementFromFen } from "../chess/pgn";

const GLYPH: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

/**
 * Minimal self-drawn SVG chessboard (no external board library, so no
 * extra licence surface). Renders the placement of a FEN and highlights
 * the from/to squares of the last move.
 */
export function renderBoard(
  container: HTMLElement,
  fen: string,
  highlight?: { from: string; to: string } | null,
): void {
  const placement = placementFromFen(fen);
  const size = 400;
  const sq = size / 8;
  let cells = "";
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = `${FILES[file]}${8 - rank}`;
      const light = (file + rank) % 2 === 0;
      let fill = light ? "#ecd9b8" : "#b58863";
      if (highlight && (highlight.from === square || highlight.to === square)) {
        fill = light ? "#f5e27a" : "#d9b84a";
      }
      cells += `<rect x="${file * sq}" y="${rank * sq}" width="${sq}" height="${sq}" fill="${fill}"/>`;
      if (file === 0) {
        cells += `<text x="2" y="${rank * sq + 12}" font-size="10" fill="${light ? "#b58863" : "#ecd9b8"}">${8 - rank}</text>`;
      }
      if (rank === 7) {
        cells += `<text x="${file * sq + sq - 10}" y="${size - 3}" font-size="10" fill="${light ? "#b58863" : "#ecd9b8"}">${FILES[file]}</text>`;
      }
      const piece = placement.get(square);
      if (piece) {
        const glyph = GLYPH[`${piece.color}${piece.type}`];
        const color = piece.color === "w" ? "#fff" : "#111";
        const stroke = piece.color === "w" ? "#111" : "#fff";
        cells += `<text x="${file * sq + sq / 2}" y="${rank * sq + sq / 2 + 1}" font-size="34" text-anchor="middle" dominant-baseline="middle" fill="${color}" stroke="${stroke}" stroke-width="0.6">${glyph}</text>`;
      }
    }
  }
  container.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="100%" role="img" aria-label="chessboard">${cells}</svg>`;
}
