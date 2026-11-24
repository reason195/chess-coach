export type MoveClass =
  | "best"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "unknown";

/** Win probability (0..1) for White from an eval in pawns (White POV). */
export function winProbWhite(evalWhitePawns: number): number {
  return 1 / (1 + Math.exp(-evalWhitePawns / 1.6));
}

/**
 * Classify a move by how much win probability the mover lost.
 * evals are in pawns from White's POV, before and after the move.
 */
export function classifyMove(
  evalBeforeWhite: number | null,
  evalAfterWhite: number | null,
  mover: "white" | "black",
  playedBestMove: boolean,
): MoveClass {
  if (evalBeforeWhite === null || evalAfterWhite === null) return "unknown";
  if (playedBestMove) return "best";
  const before = winProbWhite(evalBeforeWhite);
  const after = winProbWhite(evalAfterWhite);
  const loss = mover === "white" ? before - after : after - before;
  if (loss <= 0.02) return "good";
  if (loss <= 0.05) return "inaccuracy";
  if (loss <= 0.12) return "mistake";
  return "blunder";
}

export const CLASS_MARK: Record<MoveClass, string> = {
  best: "★",
  good: "",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
  unknown: "",
};
