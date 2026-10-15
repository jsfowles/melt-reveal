// What agents read: llms.txt, llms-full.txt and the raw melt.ts, built from
// the README and the source so they can't drift.
import readme from "../README.md?raw";
import source from "./melt.ts?raw";

export const SITE = "https://melt-reveal.jsfowles.com";
const REPO = "https://github.com/jsfowles/melt-reveal";

const SUMMARY =
  "A scroll text reveal for the web: each line flips up out of a clip while its ink melts on the GPU from a halftone dot screen into crisp type, scrubbed by scroll or played once. One TypeScript file on GSAP.";

export const text = (body: string, type = "text/plain") =>
  new Response(body, { headers: { "Content-Type": `${type}; charset=utf-8` } });

export const brief = `# Melt reveal

> ${SUMMARY}

To use it, install GSAP 3.13 or later, copy melt.ts into the project, and point it at text once the fonts have loaded:

\`\`\`ts
import { meltReveal, DEFAULTS } from "./melt";

document.fonts.ready.then(() => {
  for (const el of document.querySelectorAll<HTMLElement>(".reveal")) {
    meltReveal(el, DEFAULTS);
  }
});
\`\`\`

## Docs

- [Full docs](${SITE}/llms-full.txt): the README and the source of melt.ts in one file
- [melt.ts](${SITE}/melt.ts): the file to copy
- [README](${REPO}#readme): the same docs on GitHub

## Optional

- [Playground](${SITE}): tune the settings, then copy them and the file
`;

// The README without its picture header and folds, with links that work
// from anywhere, then the file itself.
export const full = `# Melt reveal

> ${SUMMARY}

${readme
  .replace(/^<div align="center">[\s\S]*?<\/div>\n+/, "")
  .replace(/<details>\n<summary><b>(.+?)<\/b><\/summary>\n/g, "### $1\n")
  .replace(/\n<\/details>\n/g, "\n")
  .replace(/\]\((src|media)\//g, `](${REPO}/blob/main/$1/`)}
## Source: melt.ts

\`\`\`ts
${source}\`\`\`
`;

export { source };
