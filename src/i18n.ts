export type Lang = "en" | "zh";

const dict = {
  appTitle: { en: "Chess Coach — Hybrid AI Review", zh: "国际象棋教练 — 混合 AI 复盘" },
  tagline: {
    en: "Import a PGN. A local engine scores every move; Gemini Nano explains moves on-device, Gemini in the cloud writes the deep review.",
    zh: "导入 PGN,本地引擎逐手评分;Gemini Nano 在端侧讲解每一步,云端 Gemini 做整局深度复盘。",
  },
  pgnLabel: { en: "Paste a PGN", zh: "粘贴 PGN 棋谱" },
  loadSample: { en: "Load sample game", zh: "载入示例对局" },
  loadPgn: { en: "Load game", zh: "载入对局" },
  moves: { en: "Moves", zh: "走法" },
  first: { en: "⏮ Start", zh: "⏮ 开局" },
  prev: { en: "◀ Prev", zh: "◀ 上一步" },
  next: { en: "Next ▶", zh: "下一步 ▶" },
  last: { en: "End ⏭", zh: "终局 ⏭" },
  initDevice: { en: "Enable on-device AI (Gemini Nano)", zh: "启用端侧 AI(Gemini Nano)" },
  deviceReady: { en: "On-device AI ready", zh: "端侧 AI 已就绪" },
  deviceInitHint: {
    en: "Click once to initialise the on-device model (may download it). Explanations then run locally — private and offline-capable.",
    zh: "点一次初始化端侧模型(可能需要下载)。之后讲解在本机运行,隐私且可离线。",
  },
  explain: { en: "Explain this move", zh: "讲解这一步" },
  explainOffline: { en: "Explain offline (on-device only)", zh: "离线讲解(仅端侧)" },
  deepReview: { en: "Deep review (cloud)", zh: "整局深度复盘(云端)" },
  thinking: { en: "Thinking…", zh: "思考中…" },
  engineAnalysing: { en: "Engine analysing…", zh: "引擎分析中…" },
  evalLabel: { en: "Eval", zh: "评分" },
  bestMove: { en: "Engine best", zh: "引擎最佳" },
  sourceOnDevice: { en: "on-device · Gemini Nano", zh: "端侧 · Gemini Nano" },
  sourceCloud: { en: "cloud · Gemini", zh: "云端 · Gemini" },
  sourceUnknown: { en: "source unknown", zh: "来源未知" },
  offlineUnavailable: {
    en: "On-device AI is not available in this browser/device right now. Use “Explain this move” (falls back to the cloud) or try desktop Chrome 139+ with Gemini Nano enabled.",
    zh: "当前浏览器/设备上端侧 AI 不可用。请用「讲解这一步」(会自动回退云端),或在桌面版 Chrome 139+ 并启用 Gemini Nano 后重试。",
  },
  aiError: { en: "AI request failed: ", zh: "AI 请求失败:" },
  noGame: { en: "Load a game first.", zh: "请先载入对局。" },
  selectMove: { en: "Select a move to explain it.", zh: "点选一步来讲解。" },
  engineNote: {
    en: "Evaluation by Stockfish 19 (lite, single-threaded WASM) running locally in your browser.",
    zh: "评分来自浏览器本地运行的 Stockfish 19(精简版,单线程 WASM)。",
  },
} as const;

export type I18nKey = keyof typeof dict;

export function t(lang: Lang, key: I18nKey): string {
  return dict[key][lang];
}
