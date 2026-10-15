// Melt reveal, MIT. Needs gsap 3.13+. Call after fonts load.
//   meltReveal(el, settings)                     scrubbed by scroll
//   meltReveal(el, settings, (tl) => tl.play())  played once
// Both return an undo.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

const SVG = "http://www.w3.org/2000/svg";

// The CSS the effect needs, added once. Each word's clip reaches a little
// past it so descenders aren't cut. A line that hasn't started has its words
// out of sight below their clips, so they wait flat, unfiltered and hidden
// rather than each as a 3D layer, and the line waits unfiltered too. A line
// the GPU is drawing hides its own text until it lands.
const CSS = `
.melt-word-mask { overflow: visible !important; clip-path: inset(-0.15em -0.08em); }
.melt-waiting { filter: none !important; }
.melt-waiting .melt-word { visibility: hidden; transform: none !important; }
.melt-drawn { visibility: hidden; }
`;
let styled = false;
const addStyles = () => {
  if (styled) return;
  styled = true;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);
};

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

// How far the melt may spill past a line, as a share of its size: the same
// region the SVG filter is cut to.
const SPILL = { x: 0.15, y: 0.4 };

// Safari's engine, which every browser on an iPhone uses.
const webkit =
  typeof navigator !== "undefined" &&
  /AppleWebKit/.test(navigator.userAgent) &&
  !/(Chrome|Chromium|Edg)\//.test(navigator.userAgent);

let uid = 0;

// Blur the outline, add a dot grid, threshold it, and clip the ink to that.
// Written at rest, so a reveal only tweens from the melted values.
const meltFilter = (svg: SVGSVGElement, fontSize: number, s: Settings) => {
  const d = Math.max(2, s.dotSize * fontSize);
  const dot = `<svg xmlns="${SVG}" width="${d}" height="${d}"><radialGradient id="g"><stop offset="0"/><stop offset="1" stop-opacity="0"/></radialGradient><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="url(#g)"/></svg>`;
  const filter = document.createElementNS(SVG, "filter");
  filter.id = `melt-${++uid}`;
  filter.setAttribute("x", `${-SPILL.x * 100}%`);
  filter.setAttribute("y", `${-SPILL.y * 100}%`);
  filter.setAttribute("width", `${100 + SPILL.x * 200}%`);
  filter.setAttribute("height", `${100 + SPILL.y * 200}%`);
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
  const words = line.querySelectorAll<HTMLElement>(".melt-word");

  if (s.flip && !webkit) {
    // Perspective sits on each word's clip, not in the word's transform, so a
    // word at rest is flat. A 3D word is its own layer, and hundreds of layers
    // are slow to composite on every scroll frame.
    gsap.set(
      [...words].map((word) => word.parentElement),
      { perspective: s.perspective * fontSize },
    );
    gsap.set(words, { transformOrigin: `50% 50% ${-s.depth * fontSize}px` });
  }

  if (s.flip) {
    // Before a line starts its words are out of sight below their clips, so
    // they wait flat and hidden (see CSS) rather than tipped in 3D.
    const wait = () =>
      line.classList.toggle("melt-waiting", tl.progress() === 0);
    tl.eventCallback("onUpdate", wait);
    wait();
    // Safari drops the line's filter over 3D words, so there the tip is
    // drawn flat: each word starts squashed by as much as the angle would
    // foreshorten it, and stays 2D.
    const tip = webkit
      ? {
          scaleY: Math.abs(Math.cos((s.angle * Math.PI) / 180)),
          force3D: false,
        }
      : { rotationX: s.angle };
    tl.from(
      words,
      { yPercent: s.travel, ...tip, duration: s.duration, ease: s.ease },
      0,
    );
  }

  if (s.melt) {
    const f = meltFilter(svg, fontSize, s);
    const melt = { duration: s.duration * s.length, ease: s.ease };
    // On the line, outside the words' clips, the melt spills softly past them.
    // Safari's engine places the dot grid wrongly on an untransformed block
    // and draws nothing, so there the line gets a shift too small to see.
    gsap.set(line, { filter: f.url });
    if (webkit) line.style.transform = "translateX(0.01px)";
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

// ---------------------------------------------------------------------------
// The GPU melt. The SVG filter is painted on the CPU in Safari, so a few lines
// melting at once cost a phone half its frame. Here one WebGL canvas draws
// every line mid-reveal instead: each line's text is drawn once into a
// texture, then each frame its words are tipped in 3D, blurred, screened with
// dots and cut, all in shaders. The real text stays in the page for layout,
// selection and screen readers, hidden while its line melts.

// A line's state mid-reveal: the flip (travel in % of word height, angle in
// degrees) and the melt (blur in px, dot strength, edge hardness).
type Melt = {
  travel: number;
  angle: number;
  blur: number;
  dots: number;
  hard: number;
};

// A word and its clip, in CSS px from the line's corner.
type Word = {
  mx: number;
  my: number;
  mw: number;
  mh: number;
  wx: number;
  wy: number;
  ww: number;
  wh: number;
};

// The line's text, drawn at rest: `x`/`y` its corner in CSS px from the
// line's, `fx`/`fy` the fraction of a device pixel it was drawn offset by.
type Picture = {
  texture: WebGLTexture;
  x: number;
  y: number;
  width: number;
  height: number;
  fx: number;
  fy: number;
  dpr: number;
  lineWidth: number;
  lineHeight: number;
  words: Word[];
};

type Line = {
  root: HTMLElement;
  line: HTMLElement;
  tl: gsap.core.Timeline;
  s: Settings;
  em: number;
  m: Melt;
  picture: Picture | null;
  drawn: string;
};

type Gpu = {
  add: (line: Line) => void;
  touch: (line: Line) => void;
  drop: (line: Line) => void;
};

const VERTEX = `#version 300 es
in vec2 corner;
uniform vec4 quad;
uniform vec3 toPx;
uniform vec2 target;
out vec2 p;
void main() {
  p = mix(quad.xy, quad.zw, corner);
  vec2 px = p * toPx.x + toPx.yz;
  gl_Position = vec4(px.x / target.x * 2.0 - 1.0, 1.0 - px.y / target.y * 2.0, 0.0, 1.0);
}`;

const FULL = `#version 300 es
in vec2 corner;
out vec2 uv;
void main() {
  uv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const HEADER = `#version 300 es
precision highp float;
out vec4 color;`;

// A word, tipped: each point of its clip is traced back through the 3D
// transform to the word's own point, and read from the line's picture.
const WORD = `${HEADER}
in vec2 p;
uniform sampler2D text;
uniform mat3 unproject;
uniform vec3 depth;
uniform vec2 clipCorner;
uniform vec4 box;
uniform vec3 place;
uniform vec2 textSize;
void main() {
  vec3 h = unproject * vec3(p - clipCorner, 1.0);
  vec2 q = h.xy / h.z;
  float inside = step(0.0, dot(depth, vec3(q, 1.0))) *
    step(box.x, q.x) * step(q.x, box.z) * step(box.y, q.y) * step(q.y, box.w);
  color = texture(text, (q * place.x + place.yz) / textSize) * inside;
}`;

// One direction of a Gaussian blur, of premultiplied colour.
const BLUR = `${HEADER}
in vec2 uv;
uniform sampler2D field;
uniform vec2 uvScale, uvMax, direction;
uniform float sigma;
vec4 at(vec2 p) { return texture(field, clamp(p, vec2(0.0), uvMax)); }
void main() {
  vec2 here = uv * uvScale;
  vec4 sum = at(here);
  float total = 1.0, falloff = -0.5 / (sigma * sigma);
  int reach = int(ceil(sigma * 3.0));
  for (int i = 1; i <= 16; i++) {
    if (i > reach) break;
    float weight = exp(float(i * i) * falloff);
    vec2 shift = direction * float(i);
    sum += weight * (at(here + shift) + at(here - shift));
    total += 2.0 * weight;
  }
  color = sum / total;
}`;

// The filter's last steps: the blurred outline plus the dot grid, cut hard,
// and the blurred ink clipped to that cut.
const CUT = `${HEADER}
in vec2 p;
uniform sampler2D field;
uniform vec2 fieldScale, regionSize;
uniform vec3 toRegion;
uniform float dotSize, k3, k4, hardness, opacity;
void main() {
  vec2 px = p * toRegion.x + toRegion.yz;
  vec4 ink = texture(field, vec2(px.x, regionSize.y - px.y) * fieldScale);
  float dots = max(0.0, 1.0 - 2.0 * length(fract(p / dotSize) - 0.5));
  float shape = clamp(ink.a + k3 * dots + k4, 0.0, 1.0);
  float cut = clamp(hardness * (shape - 0.5) + 0.5, 0.0, 1.0);
  float alpha = min(1.0, ink.a * 60.0) * cut * opacity;
  color = vec4(ink.rgb / max(ink.a, 1e-5) * alpha, alpha);
}`;

// Compiles a shader into a function that binds its textures, sets its
// uniforms, and draws a quad.
const createPass = (
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string,
) => {
  const program = gl.createProgram()!;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, "corner");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  const locations = new Map<string, WebGLUniformLocation | null>();
  const at = (name: string) => {
    if (!locations.has(name))
      locations.set(name, gl.getUniformLocation(program, name));
    return locations.get(name) ?? null;
  };

  return (
    textures: Record<string, WebGLTexture>,
    uniforms: Record<string, number | number[]>,
  ) => {
    gl.useProgram(program);
    Object.entries(textures).forEach(([name, texture], unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(at(name), unit);
    });
    for (const [name, v] of Object.entries(uniforms)) {
      if (typeof v === "number") gl.uniform1f(at(name), v);
      else if (v.length === 2) gl.uniform2f(at(name), v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(at(name), v[0], v[1], v[2]);
      else if (v.length === 4) gl.uniform4f(at(name), v[0], v[1], v[2], v[3]);
      else gl.uniformMatrix3fv(at(name), false, v);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
};

// Where a word's own point lands in its clip, as rows giving x·w, y·w and w:
// the CSS 3D the DOM flip uses, with perspective on the clip and the word
// tipped about a point `depth` behind its middle.
const project = (word: Word, m: Melt, perspective: number, depth: number) => {
  const a = (m.angle * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const oy = word.wh / 2;
  const ty = (m.travel / 100) * word.wh;
  const w = [
    0,
    -s / perspective,
    1 + (s * oy - c * depth + depth) / perspective,
  ];
  const y = [0, c, -c * oy - s * depth + oy + ty + word.wy];
  const cx = word.mw / 2;
  const cy = word.mh / 2;
  return [
    [cx * w[0] + 1, cx * w[1], cx * w[2] + word.wx - cx],
    [cy * w[0] + y[0], cy * w[1] + y[1], cy * w[2] + y[2] - cy],
    w,
  ];
};

// The inverse of a 3×3, column-major for GLSL.
const invert = ([[a, b, c], [d, e, f], [g, h, i]]: number[][]) => {
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!det) return null;
  return [
    A,
    B,
    C,
    c * h - b * i,
    a * i - c * g,
    b * g - a * h,
    b * f - c * e,
    c * d - a * f,
    a * e - b * d,
  ].map((n) => n / det);
};

// The ink of one text node, as the page sets it.
const textOf = (node: Text, transform: string) => {
  const text = node.data;
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize")
    return text.replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  return text;
};

// One 2D canvas the lines' text is drawn on, in the page so its text is
// smoothed the way the page's is.
let scratchPad:
  | {
      scratch: HTMLCanvasElement;
      ink: CanvasRenderingContext2D;
      spaced: boolean;
    }
  | undefined;
const getScratch = () => {
  if (scratchPad) return scratchPad;
  const scratch = document.createElement("canvas");
  scratch.setAttribute("aria-hidden", "true");
  scratch.style.cssText =
    "position: absolute; width: 0; height: 0; visibility: hidden";
  document.body.append(scratch);
  const ink = scratch.getContext("2d")!;
  // Older Safari can't space letters on a canvas.
  const spaced = typeof ink.letterSpacing === "string";
  return (scratchPad = { scratch, ink, spaced });
};

// A canvas in `host`, the layer the text paints in, or in the page.
const createGpu = (host: HTMLElement | null): Gpu | null => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) return null;
  const word = createPass(gl, VERTEX, WORD);
  const blur = createPass(gl, FULL, BLUR);
  const cut = createPass(gl, VERTEX, CUT);
  if (!word || !blur || !cut) return null;

  canvas.setAttribute("aria-hidden", "true");
  // In the page rather than fixed to the screen, so it scrolls with the text
  // even when the browser scrolls ahead of the page's own frames, as a phone
  // does. It's moved along when the lines it draws would leave it.
  canvas.style.cssText =
    "position: absolute; left: 0; top: 0; pointer-events: none; display: none";
  (host ?? document.body).append(canvas);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  // Two scratch targets the blur goes back and forth between, grown as
  // needed. Half floats where they can be drawn to, so the hard cut doesn't
  // band.
  const half = !!gl.getExtension("EXT_color_buffer_float");
  const targets = [0, 1].map(() => {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { texture, buffer: gl.createFramebuffer()!, width: 0, height: 0 };
  });
  const fit = (width: number, height: number) => {
    for (const t of targets) {
      if (t.width >= width && t.height >= height) continue;
      t.width = Math.max(t.width, width);
      t.height = Math.max(t.height, height);
      gl.bindTexture(gl.TEXTURE_2D, t.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        half ? gl.RGBA16F : gl.RGBA8,
        t.width,
        t.height,
        0,
        gl.RGBA,
        half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        null,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.buffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        t.texture,
        0,
      );
    }
  };

  const lines = new Set<Line>();
  const dirty = new Set<Line>();
  const drawing = new Set<Line>();
  // Pictures kept for lines that have landed, in case you scroll back.
  const kept: Line[] = [];
  const KEEP = 24;
  const { scratch, ink, spaced } = getScratch();
  const range = document.createRange();

  let lost = false;
  let awake = false;
  let shown = false;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let tallest = 0;
  let left = 0;
  let top = 0;
  let areaHeight = 0;

  // Where the page puts the baseline below the top of a run of text, found
  // once per font with an empty box sat on it: a canvas measures it a little
  // differently.
  const ascents = new Map<string, number>();
  const ascentOf = (text: Text, font: string, top: number) => {
    let ascent = ascents.get(font);
    if (ascent === undefined) {
      const probe = document.createElement("span");
      probe.style.cssText = "display: inline-block; width: 0; height: 0";
      text.after(probe);
      ascent = probe.getBoundingClientRect().top - top;
      probe.remove();
      ascents.set(font, ascent);
    }
    return ascent;
  };

  const forget = (line: Line) => {
    if (line.picture) gl.deleteTexture(line.picture.texture);
    line.picture = null;
  };

  // Draws the line's text at rest, as the page lays it out, into a texture.
  const paint = (line: Line, box: DOMRect, fx: number, fy: number) => {
    forget(line);
    const words: Word[] = [];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const wordEls = line.line.querySelectorAll<HTMLElement>(".melt-word");
    for (const el of wordEls) {
      const clip = (el.parentElement ?? el).getBoundingClientRect();
      const own = el.getBoundingClientRect();
      const w = {
        mx: clip.left - box.left,
        my: clip.top - box.top,
        mw: clip.width,
        mh: clip.height,
        wx: own.left - clip.left,
        wy: own.top - clip.top,
        ww: own.width,
        wh: own.height,
      };
      words.push(w);
      x0 = Math.min(x0, w.mx);
      y0 = Math.min(y0, w.my);
      x1 = Math.max(x1, w.mx + w.mw);
      y1 = Math.max(y1, w.my + w.mh);
    }
    if (!words.length) return;
    // A margin wide enough for descenders and overhangs, starting on a whole
    // device pixel so at rest each texel lands on one.
    const margin = 0.3 * line.em;
    const x = Math.floor((x0 - margin) * dpr) / dpr;
    const y = Math.floor((y0 - margin) * dpr) / dpr;
    scratch.width = Math.ceil((x1 + margin - x) * dpr) + 1;
    scratch.height = Math.ceil((y1 + margin - y) * dpr) + 1;
    ink.setTransform(dpr, 0, 0, dpr, fx - x * dpr, fy - y * dpr);

    for (const el of wordEls) {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node: Node | null; (node = walk.nextNode());) {
        const text = node as Text;
        const css = getComputedStyle(text.parentElement!);
        const content = textOf(text, css.textTransform);
        if (!content.trim()) continue;
        const smoothing = css.getPropertyValue("-webkit-font-smoothing");
        if (
          smoothing &&
          scratch.style.getPropertyValue("-webkit-font-smoothing") !== smoothing
        ) {
          scratch.style.setProperty("-webkit-font-smoothing", smoothing);
          ink.font = "10px serif";
        }
        ink.font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
        ink.fillStyle = css.color;
        const spacing =
          css.letterSpacing === "normal" ? "0px" : css.letterSpacing;
        if (spaced) ink.letterSpacing = spacing;
        range.selectNodeContents(text);
        const at = range.getBoundingClientRect();
        // On a whole device pixel, as the page draws it.
        const baseline =
          (Math.round(
            (at.top - box.top + ascentOf(text, ink.font, at.top) - y) * dpr +
              fy,
          ) -
            fy) /
            dpr +
          y;
        if (spaced || parseFloat(spacing) === 0) {
          ink.fillText(content, at.left - box.left, baseline);
          continue;
        }
        // No letter spacing on a canvas here, so each letter goes where the
        // page put it.
        for (let i = 0; i < text.length;) {
          const size = text.data.codePointAt(i)! > 0xffff ? 2 : 1;
          range.setStart(text, i);
          range.setEnd(text, i + size);
          const letter = range.getBoundingClientRect();
          ink.fillText(
            content.slice(i, i + size),
            letter.left - box.left,
            baseline,
          );
          i += size;
        }
      }
    }

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      scratch,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    line.picture = {
      texture,
      x,
      y,
      width: scratch.width,
      height: scratch.height,
      fx,
      fy,
      dpr,
      lineWidth: box.width,
      lineHeight: box.height,
      words,
    };
  };

  // Draws one line onto the canvas, its corner at (lx, ly) device px.
  const draw = (line: Line, lx: number, ly: number, opacity: number) => {
    const { s, m, em, picture } = line;
    if (!picture) return;
    const { lineWidth: w, lineHeight: h } = picture;
    const perspective = s.perspective * em;
    const depth = s.depth * em;
    // The region the melt may spill into, in device px from the canvas.
    const rx = Math.floor(lx - SPILL.x * w * dpr);
    const ry = Math.floor(ly - SPILL.y * h * dpr);
    const rw = Math.ceil((1 + 2 * SPILL.x) * w * dpr) + 2;
    const rh = Math.ceil((1 + 2 * SPILL.y) * h * dpr) + 2;
    // Blurred, it's drawn smaller, and the blur with it.
    const sigma = m.blur * dpr;
    const shrink = Math.max(1, sigma / 4);
    const lw = Math.ceil(rw / shrink);
    const lh = Math.ceil(rh / shrink);
    fit(lw, lh);
    const [a, b] = targets;

    gl.bindFramebuffer(gl.FRAMEBUFFER, a.buffer);
    gl.viewport(0, 0, lw, lh);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    const toRegion = [dpr, lx - rx, ly - ry];
    const padX = 0.08 * em;
    const padY = 0.15 * em;
    let any = false;
    for (const wd of picture.words) {
      const forward = project(wd, m, perspective, depth);
      const unproject = invert(forward);
      if (!unproject) continue;
      // Skip a word whose every corner lands outside its clip.
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      let behind = false;
      for (const [cx, cy] of [
        [0, 0],
        [wd.ww, 0],
        [0, wd.wh],
        [wd.ww, wd.wh],
      ]) {
        const [X, Y, W] = forward.map((r) => r[0] * cx + r[1] * cy + r[2]);
        if (W <= 0) behind = true;
        x0 = Math.min(x0, X / W);
        y0 = Math.min(y0, Y / W);
        x1 = Math.max(x1, X / W);
        y1 = Math.max(y1, Y / W);
      }
      if (
        !behind &&
        (x1 < -padX || x0 > wd.mw + padX || y1 < -padY || y0 > wd.mh + padY)
      )
        continue;
      any = true;
      word(
        { text: picture.texture },
        {
          quad: [
            wd.mx - padX,
            wd.my - padY,
            wd.mx + wd.mw + padX,
            wd.my + wd.mh + padY,
          ],
          toPx: toRegion,
          target: [rw, rh],
          unproject,
          depth: forward[2],
          clipCorner: [wd.mx, wd.my],
          box: [-padX, -0.3 * em, wd.ww + padX, wd.wh + 0.3 * em],
          place: [
            picture.dpr,
            (wd.mx + wd.wx - picture.x) * picture.dpr + picture.fx,
            (wd.my + wd.wy - picture.y) * picture.dpr + picture.fy,
          ],
          textSize: [picture.width, picture.height],
        },
      );
    }
    if (!any) return;
    gl.disable(gl.BLEND);

    const scale = [lw / a.width, lh / a.height];
    const max = [(lw - 0.5) / a.width, (lh - 0.5) / a.height];
    if (sigma / shrink > 0.2) {
      for (const [from, to, direction] of [
        [a, b, [1 / a.width, 0]],
        [b, a, [0, 1 / a.height]],
      ] as const) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, to.buffer);
        blur(
          { field: from.texture },
          {
            uvScale: scale,
            uvMax: max,
            direction: [...direction],
            sigma: sigma / shrink,
          },
        );
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    cut(
      { field: a.texture },
      {
        quad: [
          -SPILL.x * w,
          -SPILL.y * h,
          (1 + SPILL.x) * w,
          (1 + SPILL.y) * h,
        ],
        toPx: [dpr, lx, ly],
        target: [canvas.width, canvas.height],
        toRegion,
        regionSize: [rw, rh],
        fieldScale: [lw / rw / a.width, lh / rh / a.height],
        dotSize: Math.max(2, s.dotSize * em),
        k3: m.dots,
        k4: -m.dots / 2,
        hardness: m.hard,
        opacity,
      },
    );
  };

  const opacityOf = (el: HTMLElement) => {
    let opacity = 1;
    for (let at: Element | null = el; at; at = at.parentElement)
      opacity *= parseFloat(getComputedStyle(at).opacity);
    return opacity;
  };

  const hide = () => {
    if (!shown) return;
    shown = false;
    canvas.style.display = "none";
  };

  const frame = () => {
    // A line shows its own text once it lands, the same frame the canvas
    // stops drawing it.
    for (const line of dirty) {
      const progress = line.tl.progress();
      line.line.classList.toggle("melt-drawn", progress < 1);
      // A line that hasn't started has its words out of sight below their
      // clips; without the flip it waits melted.
      if (progress < 1 && (progress > 0 || !line.s.flip)) drawing.add(line);
      else drawing.delete(line);
      line.drawn = "";
    }
    const changed = dirty.size > 0;
    dirty.clear();
    if (!drawing.size) {
      hide();
      gsap.ticker.remove(frame);
      awake = false;
      return;
    }

    const visible: [Line, DOMRect][] = [];
    let above = Infinity;
    let below = -Infinity;
    for (const line of drawing) {
      const box = line.line.getBoundingClientRect();
      const spillY = SPILL.y * box.height;
      if (
        !box.width ||
        box.bottom + spillY < 0 ||
        box.top - spillY > innerHeight
      )
        continue;
      visible.push([line, box]);
      above = Math.min(above, Math.max(0, box.top - spillY));
      below = Math.max(below, Math.min(innerHeight, box.bottom + spillY));
    }
    if (!visible.length) {
      hide();
      return;
    }

    // As wide as the page, and as tall as the screen has been.
    const ratio = devicePixelRatio || 1;
    const areaWidth = document.documentElement.clientWidth;
    let redraw = changed;
    if (
      !shown ||
      areaWidth !== width ||
      ratio !== dpr ||
      innerHeight > tallest ||
      Math.min(tallest, areaHeight) !== height
    ) {
      if (areaWidth !== width || ratio !== dpr) tallest = 0;
      tallest = Math.max(tallest, innerHeight);
      dpr = ratio;
      width = areaWidth;
      canvas.style.display = "none";
      areaHeight = document.documentElement.scrollHeight;
      height = Math.min(tallest, areaHeight);
      // A pixel short, for the nudge onto whole device pixels below.
      canvas.width = Math.max(1, Math.floor((width - 1) * dpr));
      canvas.height = Math.max(1, Math.floor((height - 1) * dpr));
      canvas.style.width = `${canvas.width / dpr}px`;
      canvas.style.height = `${canvas.height / dpr}px`;
      canvas.style.display = "block";
      shown = true;
      redraw = true;
    }

    // Kept over the lines it draws, without ever reaching past the page,
    // and on whole device pixels so the text lands on the page's.
    let at = canvas.getBoundingClientRect();
    const snap = (n: number) => Math.ceil(n * dpr - 0.01) / dpr;
    const moved = above < at.top || below > at.bottom;
    if (moved || snap(at.top) !== at.top || snap(at.left) !== at.left) {
      const want = moved ? (above + below) / 2 - height / 2 : at.top;
      const y = snap(
        Math.max(-scrollY, Math.min(want, areaHeight - height - scrollY)),
      );
      left += snap(-scrollX) - at.left;
      top += y - at.top;
      canvas.style.left = `${left}px`;
      canvas.style.top = `${top}px`;
      at = canvas.getBoundingClientRect();
      redraw = true;
    }

    const opacities = new Map<HTMLElement, number>();
    const spots = visible.map(([line, box]) => {
      if (!opacities.has(line.root))
        opacities.set(line.root, opacityOf(line.root));
      const lx = (box.left - at.left) * dpr;
      const ly = (box.top - at.top) * dpr;
      const opacity = opacities.get(line.root)!;
      const { m } = line;
      const state = `${lx} ${ly} ${box.width} ${box.height} ${opacity} ${m.travel} ${m.angle} ${m.blur} ${m.dots} ${m.hard}`;
      if (state !== line.drawn) redraw = true;
      line.drawn = state;
      return { line, box, lx, ly, opacity };
    });
    if (!redraw) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (const { line, box, lx, ly, opacity } of spots) {
      const p = line.picture;
      if (
        !p ||
        p.dpr !== dpr ||
        Math.abs(p.lineWidth - box.width) > 0.5 ||
        Math.abs(p.lineHeight - box.height) > 0.5
      ) {
        paint(line, box, lx - Math.floor(lx), ly - Math.floor(ly));
        const i = kept.indexOf(line);
        if (i >= 0) kept.splice(i, 1);
        kept.push(line);
        while (kept.length > KEEP) {
          const old = kept.findIndex((k) => !drawing.has(k));
          if (old < 0) break;
          forget(kept.splice(old, 1)[0]);
        }
      }
      draw(line, lx, ly, opacity);
    }
  };

  const wake = () => {
    if (awake || lost) return;
    awake = true;
    gsap.ticker.add(frame);
  };

  // If the GPU goes away, every line shows its own text, still.
  canvas.addEventListener("webglcontextlost", () => {
    lost = true;
    hide();
    gsap.ticker.remove(frame);
    for (const line of lines) line.line.classList.remove("melt-drawn");
  });

  return {
    add: (line) => {
      lines.add(line);
      dirty.add(line);
      wake();
    },
    touch: (line) => {
      dirty.add(line);
      wake();
    },
    drop: (line) => {
      lines.delete(line);
      dirty.delete(line);
      drawing.delete(line);
      line.line.classList.remove("melt-drawn");
      forget(line);
      const i = kept.indexOf(line);
      if (i >= 0) kept.splice(i, 1);
      // Redraw without it.
      for (const other of drawing) other.drawn = "";
      if (drawing.size) wake();
      else hide();
    },
  };
};

// One canvas for each layer the text sits in, so the melt paints over the
// text and under whatever covers it: in the nearest positioned ancestor with
// a z-index, or the page.
const gpus = new Map<HTMLElement | null, Gpu | null>();
const getGpu = (el: HTMLElement) => {
  let host = el.parentElement;
  for (; host && host !== document.body; host = host.parentElement) {
    const css = getComputedStyle(host);
    if (css.position !== "static" && css.zIndex !== "auto") break;
  }
  if (host === document.body) host = null;
  if (!gpus.has(host)) gpus.set(host, createGpu(host));
  return gpus.get(host)!;
};

// The same reveal, tweening plain numbers for the GPU to draw from. The words
// never move in the page, so their text stays where it reads.
const gpuReveal = (
  root: HTMLElement,
  el: HTMLElement,
  s: Settings,
  gpu: Gpu,
  vars: gsap.TimelineVars,
) => {
  const em = parseFloat(getComputedStyle(el).fontSize);
  const m: Melt = { travel: 0, angle: 0, blur: 0, dots: 0, hard: 1 };
  const tl = gsap.timeline(vars);
  const line: Line = { root, line: el, tl, s, em, m, picture: null, drawn: "" };
  const melt = { duration: s.duration * s.length, ease: s.ease };
  if (s.flip)
    tl.from(
      m,
      { travel: s.travel, angle: s.angle, duration: s.duration, ease: s.ease },
      0,
    );
  tl.from(m, { blur: s.amount * em, dots: s.dots, ...melt }, 0).from(
    m,
    { hard: s.hardness, ...melt, duration: melt.duration * 0.63 },
    melt.duration * 0.37,
  );
  tl.eventCallback("onUpdate", () => gpu.touch(line));
  gpu.add(line);
  return line;
};

// Each line scrubs with its own ScrollTrigger, or, given `onBuild`, all lines go
// on one paused timeline for you to drive. Rebuilds when the text re-splits.
export const meltReveal = (
  el: HTMLElement,
  s: Settings,
  onBuild?: (tl: gsap.core.Timeline) => void,
) => {
  addStyles();
  const svg = document.body.appendChild(document.createElementNS(SVG, "svg"));
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position: absolute; width: 0; height: 0";
  // The melt goes to the GPU where there is one; the flip alone stays in the
  // page.
  const gl = s.melt ? getGpu(el) : null;
  let ctx: gsap.Context | undefined;
  let drawn: Line[] = [];
  const undraw = () => {
    drawn.forEach((line) => gl?.drop(line));
    drawn = [];
  };

  const reveal = (line: HTMLElement, vars: gsap.TimelineVars) => {
    if (!gl) return lineReveal(line, s, svg, vars);
    const drawnLine = gpuReveal(el, line, s, gl, vars);
    drawn.push(drawnLine);
    return drawnLine.tl;
  };

  const split = SplitText.create(el, {
    type: "lines,words",
    wordsClass: "melt-word",
    mask: "words",
    autoSplit: true,
    onSplit: ({ lines }) => {
      ctx?.revert();
      undraw();
      svg.replaceChildren();
      ctx = gsap.context(() => {
        if (onBuild) {
          const tl = gsap.timeline({ paused: true });
          lines.forEach((line, i) =>
            tl.add(reveal(line as HTMLElement, {}), i * STAGGER),
          );
          onBuild(tl);
          return;
        }
        for (const line of lines) {
          reveal(line as HTMLElement, {
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
    undraw();
    split.revert();
    svg.remove();
  };
};
