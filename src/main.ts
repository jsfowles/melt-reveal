import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { enter, TITLE_AT } from "./entrance";
import { DEFAULTS, meltReveal, type Settings } from "./melt";
import { startPanel } from "./panel";
import { startSmooth } from "./smooth";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const scrub = $<HTMLInputElement>("scrub");
const guides = $<HTMLInputElement>("guides");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

// Mid-drag only the inspector rebuilds; the specimens wait for the release.
let inspector: gsap.core.Timeline | undefined;
let undoInspector: (() => void) | undefined;
let undoSpecimens: (() => void)[] = [];
const buildInspector = (settings: Settings, replay: boolean) => {
  undoInspector?.();
  undoInspector = meltReveal($("specimen"), settings, (tl) => {
    inspector = tl.progress(Number(scrub.value));
    tl.eventCallback("onUpdate", () => (scrub.value = String(tl.progress())));
    if (replay && !reduced.matches) tl.play(0);
  });
};
const buildSpecimens = (settings: Settings) => {
  undoSpecimens.forEach((fn) => fn());
  undoSpecimens = reduced.matches
    ? []
    : [...document.querySelectorAll<HTMLElement>(".reveal")].map((p) =>
        meltReveal(p, settings),
      );
};

// The start/end rules, shown only while the specimens are on screen.
let specimensInView = false;
const placeRules = ({ start, end }: Settings) => {
  const finish = Math.min(end, start - 1);
  document.documentElement.style.setProperty("--finish", `${100 - finish}vh`);
  for (const [id, at, word] of [
    ["guide-start", start, "Start"],
    ["guide-end", finish, "End"],
  ] as const) {
    const rule = $(id);
    const label = $(`${id}-label`);
    rule.hidden = label.hidden =
      !guides.checked || reduced.matches || !specimensInView;
    rule.style.top = label.style.top = `${at}%`;
    label.textContent = `${word} ${at}%`;
  }
};

let timer = 0;
const panel = startPanel((settings, { replay, live }) => {
  placeRules(settings);
  clearTimeout(timer);
  timer = setTimeout(() => {
    buildInspector(settings, replay);
    if (!live) buildSpecimens(settings);
  }, 80);
});

new IntersectionObserver(([entry]) => {
  specimensInView = entry.isIntersecting;
  placeRules(panel.settings());
}).observe(document.querySelector(".specimens")!);

scrub.addEventListener("input", () =>
  inspector?.pause().progress(Number(scrub.value)),
);
$("play").addEventListener("click", () => inspector?.play(0));
guides.addEventListener("change", () => placeRules(panel.settings()));
reduced.addEventListener("change", panel.refresh);
// GSAP's ticker drives Lenis, so scroll and reveals share a frame.
void startSmooth({
  prevent: ".panel",
  onScroll: ScrollTrigger.update,
  drive: (step) => {
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add((time) => step(time * 1000));
  },
});

// Wait for the fonts (max 1.5s) so lines split at their real size.
void Promise.race([
  Promise.all([
    document.fonts.load('800 1em "Geist"'),
    document.fonts.load('500 1em "Geist Mono"'),
  ]),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]).then(() => {
  buildInspector(panel.settings(), false);
  buildSpecimens(panel.settings());
  const root = document.documentElement;
  if (!reduced.matches && !root.classList.contains("ready")) {
    const intro = enter();
    // Cap the blur at 20px; more is slow to repaint, in Safari especially.
    const title = $("title");
    const amount = Math.min(
      DEFAULTS.amount,
      20 / parseFloat(getComputedStyle(title).fontSize),
    );
    // On the intro's own clock, so a re-split picks up where it has got to.
    meltReveal(
      title,
      { ...DEFAULTS, duration: 0.9, length: 1.4, amount },
      (tl) => intro.add(tl.paused(false), TITLE_AT),
    );
    // Start a frame after the page first paints, so that heavy first frame
    // doesn't swallow the opening.
    requestAnimationFrame(() => requestAnimationFrame(() => intro.play()));
  }
  root.classList.add("ready");
});
