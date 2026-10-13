// Melt reveal, MIT. Needs gsap 3.13+ and reveal.css. Call after fonts load.
//   meltReveal(el, settings)                     scrubbed by scroll
//   meltReveal(el, settings, (tl) => tl.play())  played once
// Both return an undo.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

const SVG = "http://www.w3.org/2000/svg";

// Lengths in em; `start`/`end` in % of viewport; `travel` in % of word height.
export type Settings = {
  start: number;
  end: number;
  smooth: number;
  flip: boolean;
  angle: number;
  travel: number;
  depth: number;
  perspective: number;
  duration: number;
  ease: string;
  melt: boolean;
  amount: number;
  dots: number;
  dotSize: number;
  hardness: number;
  length: number;
};

export const DEFAULTS: Settings = {
  start: 85,
  end: 65,
  smooth: 0,
  flip: true,
  angle: -90,
  travel: 150,
  depth: 1,
  perspective: 3,
  duration: 0.4,
  ease: "power3.out",
  melt: true,
  amount: 0.4,
  dots: 0.79,
  dotSize: 0.09,
  hardness: 27.5,
  length: 1.3,
};

const edge = (a: number) =>
  `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${a} ${0.5 - 0.5 * a}`;

const STAGGER = 0.08;

let uid = 0;

// Blur the outline, add a dot grid, threshold it, and clip the ink to that.
// Written at rest, so a reveal only tweens from the melted values.
const meltFilter = (svg: SVGSVGElement, fontSize: number, s: Settings) => {
  const d = Math.max(2, s.dotSize * fontSize);
  const dot = `<svg xmlns="${SVG}" width="${d}" height="${d}"><radialGradient id="g"><stop offset="0"/><stop offset="1" stop-opacity="0"/></radialGradient><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="url(#g)"/></svg>`;
  const filter = document.createElementNS(SVG, "filter");
  filter.id = `melt-${++uid}`;
  filter.setAttribute("x", "-15%");
  filter.setAttribute("y", "-40%");
  filter.setAttribute("width", "130%");
  filter.setAttribute("height", "180%");
  filter.setAttribute("color-interpolation-filters", "sRGB");
  filter.innerHTML = `
    <feGaussianBlur in="SourceAlpha" stdDeviation="0" result="shape"/>
    <feImage href="data:image/svg+xml,${encodeURIComponent(dot)}" x="0" y="0" width="${d}" height="${d}"/>
    <feTile result="dots"/>
    <feComposite in="shape" in2="dots" operator="arithmetic" k2="1" k3="0" k4="0"/>
    <feColorMatrix type="matrix" values="${edge(1)}" result="edge"/>
    <feGaussianBlur in="SourceGraphic" stdDeviation="0"/>
    <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 60 0"/>
    <feComposite in2="edge" operator="in"/>`;
  svg.append(filter);
  return {
    url: `url(#${filter.id})`,
    blurs: filter.querySelectorAll("feGaussianBlur"),
    dots: filter.querySelector("feComposite")!,
    edge: filter.querySelector("feColorMatrix")!,
  };
};

// The filter comes off at the end: one per line is costly to paint.
const lineReveal = (
  line: HTMLElement,
  s: Settings,
  svg: SVGSVGElement,
  vars: gsap.TimelineVars,
) => {
  const fontSize = parseFloat(getComputedStyle(line).fontSize);
  const tl = gsap.timeline(vars);

  if (s.flip) {
    const words = line.querySelectorAll(".word");
    gsap.set(words, {
      transformPerspective: s.perspective * fontSize,
      transformOrigin: `50% 50% ${-s.depth * fontSize}px`,
    });
    tl.from(
      words,
      {
        yPercent: s.travel,
        rotationX: s.angle,
        duration: s.duration,
        ease: s.ease,
      },
      0,
    );
  }

  if (s.melt) {
    const f = meltFilter(svg, fontSize, s);
    const melt = { duration: s.duration * s.length, ease: s.ease };
    gsap.set(line, { filter: f.url });
    tl.from(
      f.blurs,
      { attr: { stdDeviation: s.amount * fontSize }, ...melt },
      0,
    )
      .from(f.dots, { attr: { k3: s.dots, k4: -s.dots / 2 }, ...melt }, 0)
      .from(
        f.edge,
        {
          attr: { values: edge(s.hardness) },
          ...melt,
          duration: melt.duration * 0.63,
        },
        melt.duration * 0.37,
      )
      .set(line, { filter: "none" });
  }

  return tl;
};

// Each line scrubs with its own ScrollTrigger, or, given `onBuild`, all lines go
// on one paused timeline for you to drive. Rebuilds when the text re-splits.
export const meltReveal = (
  el: HTMLElement,
  s: Settings,
  onBuild?: (tl: gsap.core.Timeline) => void,
) => {
  const svg = document.body.appendChild(document.createElementNS(SVG, "svg"));
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("melt-filters");
  let ctx: gsap.Context | undefined;

  const split = SplitText.create(el, {
    type: "lines,words",
    wordsClass: "word",
    mask: "words",
    autoSplit: true,
    onSplit: ({ lines }) => {
      ctx?.revert();
      svg.replaceChildren();
      ctx = gsap.context(() => {
        if (onBuild) {
          const tl = gsap.timeline({ paused: true });
          lines.forEach((line, i) =>
            tl.add(lineReveal(line as HTMLElement, s, svg, {}), i * STAGGER),
          );
          onBuild(tl);
          return;
        }
        for (const line of lines) {
          lineReveal(line as HTMLElement, s, svg, {
            scrollTrigger: {
              trigger: line,
              start: `top ${s.start}%`,
              end: `top ${Math.min(s.end, s.start - 1)}%`,
              scrub: s.smooth || true,
            },
          });
        }
      });
    },
  });

  return () => {
    ctx?.revert();
    split.revert();
    svg.remove();
  };
};
