import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { enter, INSPECTOR_AT, TITLE_AT } from "./entrance";
import { DEFAULTS, meltReveal, screenHeight, type Settings } from "./melt";
import { startDock } from "./dock";
import source from "./melt.ts?raw";
import { startPanel } from "./panel";
import { startSmooth } from "./smooth";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const scrub = $<HTMLInputElement>("scrub");
const guides = $<HTMLInputElement>("guides");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const phone = matchMedia("(max-width: 899px)");

// Blur is the costly part of the melt, and a phone paints it on the CPU, so
// there it's capped in pixels. Desktop keeps the slider's full range.
const PHONE_BLUR = 8;
const capped = (settings: Settings, el: HTMLElement) =>
  phone.matches
    ? {
        ...settings,
        amount: Math.min(
          settings.amount,
          PHONE_BLUR / parseFloat(getComputedStyle(el).fontSize),
        ),
      }
    : settings;

// Mid-drag only the inspector rebuilds; the specimens wait for the release.
let inspector: gsap.core.Timeline | undefined;
let undoInspector: (() => void) | undefined;
let undoSpecimens: (() => void)[] = [];
const buildInspector = (settings: Settings, replay: boolean) => {
  undoInspector?.();
  const line = $("specimen");
  undoInspector = meltReveal(line, capped(settings, line), (tl) => {
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
        meltReveal(p, capped(settings, p)),
      );
};

// The start/end rules, shown only while the specimens are on screen. They're
// placed against the same screen height the lines' triggers are, which
// stays put when a phone's toolbar slides away.
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
    rule.style.top = label.style.top = `${(at / 100) * screenHeight()}px`;
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
}, source);

new IntersectionObserver(([entry]) => {
  specimensInView = entry.isIntersecting;
  placeRules(panel.settings());
}).observe(document.querySelector(".specimens")!);

scrub.addEventListener("input", () =>
  inspector?.pause().progress(Number(scrub.value)),
);
$("play").addEventListener("click", () => inspector?.play(0));
guides.addEventListener("change", () => placeRules(panel.settings()));
ScrollTrigger.addEventListener("refresh", () => placeRules(panel.settings()));

// On a phone the open dock covers the foot of the screen, so opening it
// brings the inspector up into the space above if it's hidden. Further down,
// the specimens are already in view and it leaves the scroll alone.
startDock({
  onOpen: (height) => {
    const box = document.querySelector(".inspector")!.getBoundingClientRect();
    const free = innerHeight - height;
    if (box.top < 0 || box.bottom <= free) return;
    scrollBy({
      top: box.top - Math.max(16, (free - box.height) / 2),
      behavior: reduced.matches ? "instant" : "smooth",
    });
  },
});
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
    // Cap the blur at 20px, or a phone's cap; more is slow to repaint, in
    // Safari especially.
    const title = $("title");
    const amount = Math.min(
      DEFAULTS.amount,
      (phone.matches ? PHONE_BLUR : 20) /
        parseFloat(getComputedStyle(title).fontSize),
    );
    // On the intro's own clock, so a re-split picks up where it has got to.
    // Once the intro is done the title goes back to plain text: a re-split
    // after that, on a resize, would rebuild it waiting, and hidden, for an
    // intro that has finished.
    const undoTitle = meltReveal(
      title,
      { ...DEFAULTS, duration: 0.9, length: 1.4, amount },
      (tl) => intro.add(tl.paused(false), TITLE_AT),
    );
    // The specimens' triggers were measured mid-intro, with the sheet and the
    // specimens still slid down, so they're measured again where they landed.
    intro.eventCallback("onComplete", () => {
      undoTitle();
      ScrollTrigger.refresh();
    });
    // The inspector's line plays through as it fades in.
    intro.call(() => void inspector?.play(0), undefined, INSPECTOR_AT);
    // Start a frame after the page first paints, so that heavy first frame
    // doesn't swallow the opening.
    requestAnimationFrame(() => requestAnimationFrame(() => intro.play()));
  } else if (!reduced.matches) {
    // The page was shown without its intro, the fonts having been slow.
    inspector?.play(0);
  }
  root.classList.add("ready");
});
