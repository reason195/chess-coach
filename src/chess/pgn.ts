import { Chess } from "chess.js";

export interface PlyInfo {
  /** 0-based ply index */
  index: number;
  san: string;
  color: "white" | "black";
  moveNumber: number;
  fenBefore: string;
  fenAfter: string;
  uci: string;
}

export interface LoadedGame {
  headers: Record<string, string>;
  plies: PlyInfo[];
  result: string;
  white: string;
  black: string;
}

/** Parse a PGN string into navigable plies with FENs on both sides. */
export function loadPgn(pgn: string): LoadedGame {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const headers = chess.getHeaders();
  const history = chess.history({ verbose: true });

  const replay = new Chess();
  const plies: PlyInfo[] = history.map((move, i) => {
    const fenBefore = replay.fen();
    replay.move(move.san);
    return {
      index: i,
      san: move.san,
      color: move.color === "w" ? "white" : "black",
      moveNumber: Math.floor(i / 2) + 1,
      fenBefore,
      fenAfter: replay.fen(),
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
    };
  });

  return {
    headers,
    plies,
    result: headers.Result ?? "*",
    white: headers.White ?? "White",
    black: headers.Black ?? "Black",
  };
}

/** FEN of the starting position (before any ply). */
export function startFen(game: LoadedGame): string {
  return game.plies.length > 0
    ? game.plies[0].fenBefore
    : new Chess().fen();
}

/** Board placement map for a FEN: square -> piece char (e.g. "wP", "bK"). */
export function placementFromFen(
  fen: string,
): Map<string, { color: "w" | "b"; type: string }> {
  const board = new Chess(fen).board();
  const map = new Map<string, { color: "w" | "b"; type: string }>();
  for (const row of board) {
    for (const cell of row) {
      if (cell) map.set(cell.square, { color: cell.color, type: cell.type });
    }
  }
  return map;
}

export const SAMPLE_PGN = `[Event "Opera Game"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6
7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7
12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8
17. Rd8# 1-0`;
