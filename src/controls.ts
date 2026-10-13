import type { Settings } from "./melt";

// The settings panel's controls, in page order.
export type Control =
  | {
      key: keyof Settings;
      label: string;
      min: number;
      max: number;
      step: number;
      unit?: string;
    }
  | { key: "ease"; label: string; options: string[] };

export type Group = {
  id: string;
  label: string;
  toggle?: "flip" | "melt";
  controls: Control[];
};

const range = (
  key: keyof Settings,
  label: string,
  min: number,
  max: number,
  step: number,
  unit?: string,
): Control => ({ key, label, min, max, step, unit });

export const GROUPS: Group[] = [
  {
    id: "flip",
    label: "Flip",
    toggle: "flip",
    controls: [
      range("angle", "Start angle", -180, 0, 1, "°"),
      range("travel", "Start offset", 0, 200, 5, "%"),
      range("depth", "Pivot depth", 0, 2, 0.05, "em"),
      range("perspective", "Perspective", 1, 30, 0.5, "em"),
      range("duration", "Duration", 0.1, 2, 0.05, "s"),
      {
        key: "ease",
        label: "Ease",
        options: [
          "power3.out",
          "power2.inOut",
          "expo.out",
          "back.out(1.7)",
          "sine.inOut",
          "none",
        ],
      },
    ],
  },
  {
    id: "melt",
    label: "Melt",
    toggle: "melt",
    controls: [
      range("amount", "Blur", 0, 1.5, 0.01, "em"),
      range("dots", "Dot strength", 0, 2, 0.01),
      range("dotSize", "Dot size", 0.03, 0.6, 0.01, "em"),
      range("hardness", "Edge hardness", 1, 60, 0.5),
      range("length", "Length", 0.3, 3, 0.05, "× flip"),
    ],
  },
  {
    id: "scroll",
    label: "Scroll",
    controls: [
      range("start", "Starts at", 20, 100, 1, "%"),
      range("end", "Finishes at", 0, 95, 1, "%"),
      range("smooth", "Scrub lag", 0, 2, 0.05, "s"),
    ],
  },
];
