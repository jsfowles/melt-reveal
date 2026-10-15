import { gsap } from "gsap";

// The first-load animation, returned paused. The title's reveal goes in at
// TITLE_AT.
export const TITLE_AT = 0.3;

export const enter = () => {
  const tl = gsap.timeline({
    paused: true,
    defaults: {
      duration: 0.6,
      ease: "expo.out",
      clearProps: "transform,opacity,filter",
    },
  });

  tl.from(".sheet", { y: 24, opacity: 0 }, 0)
    .from(
      ".crop",
      {
        x: (_: number, el: Element) => (el.matches(".tl, .bl") ? -12 : 12),
        y: (_: number, el: Element) => (el.matches(".tl, .tr") ? -12 : 12),
        opacity: 0,
      },
      0.1,
    )
    .fromTo(
      ".marks-bar i",
      { clipPath: "inset(0 100% 0 0)" },
      {
        clipPath: "inset(0 0% 0 0)",
        duration: 0.25,
        ease: "power2.out",
        stagger: 0.035,
        clearProps: "clipPath",
      },
      0.12,
    )
    .from(
      ".marks-target",
      { rotation: -90, scale: 0.8, opacity: 0, duration: 0.7 },
      0.12,
    )
    .from(
      [".lede", ".inspector"],
      { y: 14, opacity: 0, filter: "blur(6px)", stagger: 0.08 },
      0.5,
    )
    .from(".specimens", { y: 14, opacity: 0 }, 0.65);

  if (matchMedia("(min-width: 900px)").matches) {
    tl.from(".panel", { x: 24, opacity: 0 }, 0.35).from(
      ".panel-head, .presets, .preset-note, fieldset, .copies",
      { y: 8, opacity: 0, duration: 0.4, stagger: 0.03 },
      0.45,
    );
  } else {
    tl.from(".panel", { yPercent: 100 }, 0.55);
  }

  return tl.from(
    ".rule, .rule-label",
    { opacity: 0, duration: 0.4, clearProps: "opacity" },
    0.8,
  );
};
