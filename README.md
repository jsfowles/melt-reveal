# Melt reveal

A scroll text reveal. Each line flips up out of a clip while an SVG filter melts it from halftone ink into crisp type, scrubbed by your scroll.

**[Play with it →](https://melt-reveal.jsfowles.com)**

It's one file, [`src/melt.ts`](src/melt.ts). GSAP is the only dependency.

## Quick start

Install GSAP 3.13 or later. SplitText comes with it now, for free.

```bash
npm install gsap
```

Copy [`src/melt.ts`](src/melt.ts) into your project, or hit **Copy melt.ts** in the playground. It adds the little CSS it needs itself.

Then point it at some text:

```ts
import { meltReveal, DEFAULTS } from "./melt";

document.fonts.ready.then(() => {
  for (const el of document.querySelectorAll<HTMLElement>(".reveal")) {
    meltReveal(el, DEFAULTS);
  }
});
```

Wait for your fonts first. The lines get measured when they split, and a fallback font measures differently.

## Recipes

### Your own settings

Tune it in the playground and hit **Copy settings**. You only get what you changed:

```ts
meltReveal(el, { ...DEFAULTS, amount: 0.8 });
```

### Play it once

Pass a third argument and it comes off the scroll. You get a paused timeline, and `duration` is in real seconds.

```ts
meltReveal(heading, { ...DEFAULTS, duration: 0.9 }, (tl) => tl.play());
```

### Clean up

`meltReveal` returns an undo. Call it when the element goes away, like before a client-side page change. Resizing is handled for you.

### Smooth scrolling

It works fine with plain scrolling. If you add [Lenis](https://github.com/darkroomengineering/lenis), run it on GSAP's ticker so they stay in sync:

```ts
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const lenis = new Lenis({ lerp: 0.14, autoRaf: false });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

## Settings

| Setting       | Default      | Range      | Does                                                       |
| ------------- | ------------ | ---------- | ---------------------------------------------------------- |
| `start`       | `85`         | 20–100%    | Where on screen a line starts revealing, from the top.     |
| `end`         | `65`         | 0–95%      | Where it finishes.                                         |
| `smooth`      | `0`          | 0–2s       | How long it lags behind your scroll. `0` follows exactly.  |
| `flip`        | `true`       |            | Words swing up out of their clips.                         |
| `angle`       | `-90`        | −180–0°    | How far back each word starts tipped.                      |
| `travel`      | `150`        | 0–200%     | How far below its clip each word starts.                   |
| `depth`       | `1`          | 0–2em      | How far behind the text it pivots. Deeper swings wider.    |
| `perspective` | `3`          | 1–30em     | Closer looks more 3D.                                      |
| `duration`    | `0.4`        | 0.1–2s     | The flip. Only matters as a ratio unless you play it once. |
| `ease`        | `power3.out` | any GSAP   | Used for both the flip and the melt.                       |
| `melt`        | `true`       |            | The ink settles out of a dotted blur.                      |
| `amount`      | `0.4`        | 0–1.5em    | How blurry it starts.                                      |
| `dots`        | `0.79`       | 0–2        | How strong the dot grid is. Past 1 it breaks into blobs.   |
| `dotSize`     | `0.09`       | 0.03–0.6em | Size of each dot.                                          |
| `hardness`    | `27.5`       | 1–60       | How sharp the edge is. Low gets cloudy.                    |
| `length`      | `1.3`        | 0.3–3×     | How long the melt runs compared to the flip.               |

## Good to know

- It doesn't check reduced motion for you. Skip `meltReveal` when `prefers-reduced-motion` is set and the text just sits there.
- SplitText labels the element with its full text, so screen readers read it as one paragraph.
- Each line carries its own SVG filter until it's done, and blur gets expensive past about 20px. Keep `amount × font size` under that on big type.
- I built it on plain paragraphs in Chrome. Check Safari, Firefox and any inline markup you've got.

## The playground

```bash
npm install
npm run dev
```

It's an Astro page. `npm run check` typechecks and formats. The effect is `src/melt.ts`; everything else is the playground.

## License

MIT. Geist and Geist Mono are under the SIL Open Font License.
