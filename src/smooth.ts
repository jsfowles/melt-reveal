// Lenis wheel smoothing: mouse wheels only, off for touch and reduced motion.
// Master copy: shared/smooth.ts in the jsf standard. Edit it there, then copy
// it out; check-repo fails a project whose copy differs.
import type Lenis from "lenis";

const WHEEL = "(hover: hover) and (pointer: fine)";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

type Options = {
  lerp?: number;
  // Elements that scroll on their own, such as dialogs.
  prevent?: string;
  onScroll?: () => void;
  // Run the glide from your own loop (e.g. GSAP's ticker); step takes ms.
  drive?: (step: (ms: number) => void) => void;
};

let lenis: Lenis | null = null;

// Stop any glide in place, e.g. around a client-side page change.
export const settle = () =>
  lenis?.scrollTo(scrollY, { immediate: true, force: true });

export const startSmooth = async ({
  lerp = 0.14,
  prevent,
  onScroll,
  drive,
}: Options = {}) => {
  if (typeof document === "undefined" || lenis) return lenis;
  if (!matchMedia(WHEEL).matches || reduced()) return null;
  const { default: Glide } = await import("lenis");
  if (reduced()) return null;
  lenis = new Glide({
    lerp,
    autoRaf: !drive,
    prevent: prevent ? (node) => node.closest(prevent) !== null : undefined,
  });
  if (onScroll) lenis.on("scroll", onScroll);
  drive?.((ms) => lenis?.raf(ms));
  return lenis;
};
