// The settings panel: holds the settings and reports each change.
import { GROUPS } from "./controls";
import { DEFAULTS, type Settings } from "./melt";
import { PRESETS } from "./presets";

type Key = keyof Settings;

const UNITS = Object.fromEntries(
  GROUPS.flatMap((g) => g.controls).map((c) => [
    c.key,
    "unit" in c ? c.unit : "",
  ]),
) as Partial<Record<Key, string>>;

const print = (key: Key, value: unknown) =>
  `${value}${UNITS[key] ?? ""}`.replace(/^-/, "−");

const changes = (a: Settings, b: Settings) =>
  (Object.keys(a) as Key[]).filter((key) => a[key] !== b[key]);

// Only what differs from DEFAULTS, ready to paste into meltReveal.
const asCode = (settings: Settings) => {
  const lines = changes(settings, DEFAULTS).map(
    (key) => `  ${key}: ${JSON.stringify(settings[key])},`,
  );
  return lines.length
    ? `{\n  ...DEFAULTS,\n${lines.join("\n")}\n}`
    : "DEFAULTS";
};

// `live` means a slider is mid-drag.
type Change = (
  settings: Settings,
  how: { replay: boolean; live: boolean },
) => void;

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

// `source` is melt.ts itself, for Copy melt.ts.
export const startPanel = (onChange: Change, source: string) => {
  const form = $<HTMLFormElement>("settings");
  const list = document.querySelector<HTMLElement>(".presets")!;
  const presets = [...list.querySelectorAll<HTMLElement>("[data-preset]")];

  let baseName = "Default";
  let base = PRESETS[baseName].settings;
  let settings = { ...base };

  // The "was 0.4em" button on a changed field, which resets it.
  const mark = (key: Key) => {
    const input = form.elements.namedItem(key) as HTMLInputElement;
    const field = input.closest(".field");
    if (!field) return;
    let pen = field.querySelector<HTMLButtonElement>(".was");
    if (settings[key] === base[key]) return pen?.remove();
    if (!pen) {
      pen = Object.assign(document.createElement("button"), {
        type: "button",
        className: "was pen",
      });
      pen.dataset.reset = key;
      (field.querySelector("output") ?? input).before(pen);
    }
    const was = print(key, base[key]);
    pen.textContent = `was ${was}`;
    pen.ariaLabel = `Reset ${field.querySelector("label")!.textContent} to ${was}`;
  };

  const notePreset = (shown?: HTMLElement | null) => {
    shown ??= presets.find((b) => b.ariaPressed === "true");
    $("preset-note").textContent = shown
      ? `${shown.dataset.preset}: ${shown.dataset.note}`
      : `Marked up from ${baseName}`;
  };

  const show = () => {
    for (const [key, value] of Object.entries(settings) as [Key, unknown][]) {
      const input = form.elements.namedItem(key) as HTMLInputElement;
      if (input.type === "checkbox") input.checked = value as boolean;
      else input.value = String(value);
      const out = form.querySelector(`output[for="${key}"]`);
      if (out) out.textContent = print(key, value);
      mark(key);
    }
    for (const fs of form.querySelectorAll<HTMLFieldSetElement>("fieldset")) {
      const toggle = fs.dataset.toggle as "flip" | "melt" | undefined;
      if (toggle) fs.disabled = !settings[toggle];
      const marks = fs.querySelectorAll(".was").length;
      const count = fs.querySelector<HTMLElement>(".group-changed")!;
      count.hidden = !marks;
      count.textContent = `${marks} changed`;
    }
    const changed = changes(settings, base).length;
    $("changed").hidden = !changed;
    $("changed").textContent = `${changed} changed`;
    for (const b of presets) {
      const preset = PRESETS[b.dataset.preset!].settings;
      b.ariaPressed = String(!changes(settings, preset).length);
    }
    notePreset();
  };

  const update = (next: Settings, replay = true, live = false) => {
    settings = next;
    show();
    onChange(settings, { replay, live });
  };

  // A slider replays the line once, on release, not at every step.
  let dragging = false;
  form.addEventListener("pointerdown", (e) => {
    dragging = (e.target as HTMLInputElement).type === "range";
  });
  form.addEventListener("input", (e) => {
    const input = e.target as HTMLInputElement;
    const range = input.type === "range";
    const value =
      input.type === "checkbox"
        ? input.checked
        : range
          ? Number(input.value)
          : input.value;
    update({ ...settings, [input.name]: value }, !range, range);
  });
  form.addEventListener("change", (e) => {
    if ((e.target as HTMLInputElement).type === "range")
      onChange(settings, { replay: dragging, live: false });
    dragging = false;
  });
  form.addEventListener("click", (e) => {
    const key = (e.target as Element).closest<HTMLElement>(".was")?.dataset
      .reset as Key | undefined;
    if (key) update({ ...settings, [key]: base[key] });
  });

  const presetOf = (e: Event) =>
    (e.target as Element).closest<HTMLElement>("[data-preset]");
  list.addEventListener("click", (e) => {
    const b = presetOf(e);
    if (!b) return;
    baseName = b.dataset.preset!;
    base = PRESETS[baseName].settings;
    update({ ...base });
  });
  list.addEventListener("pointerover", (e) => notePreset(presetOf(e)));
  list.addEventListener("focusin", (e) => notePreset(presetOf(e)));
  list.addEventListener("pointerleave", () => notePreset());
  list.addEventListener("focusout", () => notePreset());

  // Copies settings or the whole effect. If the clipboard is blocked, the
  // text shows below to copy by hand.
  const copy = async (button: HTMLButtonElement, text: string) => {
    const label = button.querySelector(".approve-text")!;
    const failed = await navigator.clipboard.writeText(text).then(
      () => false,
      () => true,
    );
    $("copy-failed").hidden = $("code").hidden = !failed;
    $("code").textContent = failed ? text : "";
    if (failed) return;
    button.classList.add("done");
    label.textContent = "Copied";
    setTimeout(() => {
      button.classList.remove("done");
      label.textContent = button.dataset.label!;
    }, 1800);
  };
  $("copy-settings").addEventListener("click", (e) =>
    copy(e.currentTarget as HTMLButtonElement, asCode(settings)),
  );
  $("copy-file").addEventListener("click", (e) =>
    copy(e.currentTarget as HTMLButtonElement, source),
  );

  show();
  return { settings: () => settings, refresh: () => update(settings, false) };
};
