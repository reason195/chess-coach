/**
 * Prompt builders. On-device calls are single-turn and self-contained
 * (the on-device model supports neither chat history nor tools), so every
 * prompt carries the full context it needs.
 */

export interface MoveContext {
  moveNumber: number;
  san: string;
  color: "white" | "black";
  fenBefore: string;
  fenAfter: string;
  /** Engine eval of the position before the move, pawns, side-to-move POV. */
  evalBefore: number | null;
  /** Engine eval after the move, pawns, from White's POV. */
  evalAfterWhite: number | null;
  classification: string;
  bestMoveSan: string | null;
  opening?: string;
  lang: "en" | "zh";
}

export function moveExplanationPrompt(ctx: MoveContext): string {
  const langLine =
    ctx.lang === "zh"
      ? "请用简体中文回答，严格控制在 80 字以内（最多 2 句话），只讲要点，不要展开，不要分段或列举。"
      : "Answer in English, in at most 120 words.";
  return [
    "You are a friendly chess coach for amateur club players.",
    langLine,
    "Explain the move below: what it does, whether it was good, and one concrete idea to remember.",
    `Move: ${ctx.moveNumber}. ${ctx.san} (${ctx.color})`,
    `Position before (FEN): ${ctx.fenBefore}`,
    `Position after (FEN): ${ctx.fenAfter}`,
    ctx.evalBefore !== null
      ? `Engine eval before the move: ${ctx.evalBefore.toFixed(2)} pawns`
      : "Engine eval before the move: unknown",
    ctx.evalAfterWhite !== null
      ? `Engine eval after the move (White POV): ${ctx.evalAfterWhite.toFixed(2)} pawns`
      : "Engine eval after the move: unknown",
    `Move classification: ${ctx.classification}`,
    ctx.bestMoveSan ? `Engine's preferred move instead: ${ctx.bestMoveSan}` : "",
    ctx.opening ? `Opening: ${ctx.opening}` : "",
    "Do not invent variations that are not supported by the eval. Be encouraging but honest.",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface GameSummary {
  pgn: string;
  result: string;
  white: string;
  black: string;
  /** Per-move one-liners: "12. Nf3 — mistake, eval +1.2 -> -0.4" */
  moveDigest: string[];
  lang: "en" | "zh";
}

export function deepReviewPrompt(game: GameSummary): string {
  const langLine =
    game.lang === "zh"
      ? "请用简体中文填写各个字段的内容。"
      : "Write the field contents in English.";
  return [
    "You are an expert chess coach writing a post-game review for an amateur player.",
    langLine,
    "Return ONLY a JSON object with exactly these keys:",
    '{"overview": string, "turningPoints": [{"move": string, "comment": string}], "mistakePatterns": [string], "trainingPlan": [string]}',
    "- overview: 2-3 sentences summarising the game.",
    "- turningPoints: the 2-4 moves where the evaluation swung the most.",
    "- mistakePatterns: recurring kinds of mistakes you can infer from the digest.",
    "- trainingPlan: 3 concrete, short training suggestions.",
    `Game: ${game.white} vs ${game.black}, result ${game.result}`,
    "Per-move digest (move — classification, eval before -> after, White POV):",
    ...game.moveDigest,
  ].join("\n");
}
