# Melt reveal

A scroll text reveal: each line flips up out of a clip while an SVG filter melts it from halftone ink into crisp type, scrubbed by your scroll.

**[Try the playground →](https://melt-reveal.jsfowles.com)**

This repo is the effect and a playground to tune it. The effect itself is one file, [`src/melt.ts`](src/melt.ts), and a few lines of CSS, [`src/styles/reveal.css`](src/styles/reveal.css). GSAP is the only dependency.

## Install

1. Add GSAP 3.13 or later, which includes SplitText for free.

   ```bash
   npm install gsap
   ```

2. Copy [`src/melt.ts`](src/melt.ts) and [`src/styles/reveal.css`](src/styles/reveal.css) into your project. The CSS keeps descenders from being clipped and hides the SVG filters.

## Use

Give `meltReveal` an element and a settings object. Each line then reveals as it scrolls between the start and end points.

```ts
import { meltReveal, DEFAULTS } from "./melt";
import "./reveal.css";

document.fonts.ready.then(() => {
  for (const el of document.querySelectorAll<HTMLElement>(".reveal")) {
    meltReveal(el, DEFAULTS);
  }
});
```

- **Wait for your fonts.** Lines are measured when they split, and a fallback font measures differently.
- **Undo.** `meltReveal` returns an undo function. Call it when the element goes away, for example before a client-side page change, so its triggers and filters go with it. Lines split again on their own when the element resizes.
- **Your own settings.** Tune the reveal in the playground, then use **Copy settings** to get them as code. It copies only what differs from the defaults, as `{ ...DEFAULTS, amount: 0.8 }`, ready to pass to `meltReveal`.

### Play it once

Pass a third argument to take the reveal off the scroll. Every line goes on one paused timeline, which the callback receives, and `duration` becomes real time in seconds. Lines land 80ms apart.

```ts
meltReveal(heading, { ...DEFAULTS, duration: 0.9 }, (tl) => tl.play());
```

## Settings

Ranges are the ones the playground offers; values outside them work too. Lengths in em scale with the text.

| Setting       | Default      | Range         | What it does                                                                                     |
| ------------- | ------------ | ------------- | ------------------------------------------------------------------------------------------------ |
| `start`       | `85`         | 20–100 (%)    | A line starts revealing when its top crosses this point, measured from the top of the viewport. |
| `end`         | `65`         | 0–95 (%)      | It finishes here. Kept at least one point above `start`.                                         |
| `smooth`      | `0`          | 0–2 (s)       | Seconds the reveal takes to catch up with the scroll. `0` follows it exactly.                    |
| `flip`        | `true`       |               | Words swing up out of their clips. Off: they stay put.                                           |
| `angle`       | `-90`        | −180–0 (°)    | How far each word starts tipped back, around the X axis.                                         |
| `travel`      | `150`        | 0–200 (%)     | How far below its clip each word starts, as a share of its own height.                          |
| `depth`       | `1`          | 0–2 (em)      | How far behind the text the pivot sits. Deeper swings wider.                                     |
| `perspective` | `3`          | 1–30 (em)     | Viewing distance for the flip. Closer makes it look more three-dimensional.                      |
| `duration`    | `0.4`        | 0.1–2 (s)     | The flip's length. On scroll only its ratio to the melt counts; played once, it is seconds.      |
| `ease`        | `power3.out` | any GSAP ease | The ease for both the flip and the melt.                                                         |
| `melt`        | `true`       |               | The ink settles from a dotted blur. Off: lines are crisp throughout.                             |
| `amount`      | `0.4`        | 0–1.5 (em)    | Starting blur. It also sets how wide the dotted edge is.                                         |
| `dots`        | `0.79`       | 0–2           | Strength of the dot grid in the blurred edge. Past 1 the dots break into solid ink.              |
| `dotSize`     | `0.09`       | 0.03–0.6 (em) | Size of each dot.                                                                                |
| `hardness`    | `27.5`       | 1–60          | How sharply the edge is cut. Low values leave soft clouds.                                       |
| `length`      | `1.3`        | 0.3–3 (×)     | The melt's length as a multiple of the flip's.                                                   |

## Smooth scrolling

The reveal works with plain scrolling. If you add [Lenis](https://github.com/darkroomengineering/lenis), run it on GSAP's ticker so the glide and the reveal step on the same frame:

```ts
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const lenis = new Lenis({ lerp: 0.14, autoRaf: false });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

## Good to know

- **Reduced motion.** The effect doesn't check it for you. Skip `meltReveal` when `prefers-reduced-motion` is set, and the text simply stays put.
- **Screen readers.** SplitText labels the element with its full text, so it is read as one paragraph.
- **Cost.** Every line carries its own SVG filter until it finishes, and blur gets costly past about 20px. Keep `amount × font size` under that on large type.
- **Content.** Built and tested on plain paragraphs in Chromium. Check Safari, Firefox and any inline markup in your own copy.

## The playground

```bash
npm install
npm run dev
npm run check   # typecheck and formatting
npm run build
```

The playground is an [Astro](https://astro.build) page that builds to static HTML.

- `src/melt.ts`, `src/styles/reveal.css`: the effect.
- `src/pages/index.astro`: the page, built from `src/components/`, each `Foo.astro` with its `Foo.scss` beside it.
- `src/main.ts`: starts the playground: reveals, inspector, rules.
- `src/panel.ts`, `src/controls.ts`, `src/presets.ts`: the settings panel, its controls and its presets.
- `src/entrance.ts`: the first-load animation.
- `src/smooth.ts`: Lenis smooth scrolling.
- `src/styles/`: the global styles (tokens, fonts, reset, sliders, the page frame) and the `phone` mixin.

## Licence

MIT, see [LICENSE](LICENSE). The fonts in `public/fonts`, Geist and Geist Mono, are under the SIL Open Font License.
