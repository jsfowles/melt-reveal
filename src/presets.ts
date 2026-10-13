import { DEFAULTS, type Settings } from "./melt";

// A 1s flip only slows played reveals; on scroll the pace comes from scrolling.
const PLAYED: Settings = { ...DEFAULTS, duration: 1 };

export const PRESETS: Record<string, { note: string; settings: Settings }> = {
  Default: { note: "The defaults, with a 1s flip", settings: PLAYED },
  Wordmark: {
    note: "Coarser 0.28em dots, lighter blur",
    settings: { ...PLAYED, amount: 0.3, dotSize: 0.28 },
  },
  Halftone: {
    note: "Coarse dots, softer edge",
    settings: {
      ...DEFAULTS,
      amount: 0.7,
      dots: 1.2,
      dotSize: 0.32,
      hardness: 18,
      length: 2,
    },
  },
  "Flip only": { note: "Melt off", settings: { ...PLAYED, melt: false } },
  "Ink only": {
    note: "Flip off, heavier blur",
    settings: { ...PLAYED, flip: false, amount: 0.6, length: 1 },
  },
};
