// The settings panel as a dock on a phone: a row of tabs at the foot of the
// screen and one pane above them at a time. A tab opens its pane; the open
// tab, a tap outside or Escape shuts the dock. CSS shows the panes from
// `data-dock` on <html> and the `active` pane. On a wider screen the panel
// stays in its column, its groups folding as usual.

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

// `onOpen` gets the dock's height once open, before it has finished growing.
export const startDock = ({ onOpen }: { onOpen: (height: number) => void }) => {
  const root = document.documentElement;
  const panel = $("panel");
  const body = $("panel-body");
  const panes = panel.querySelector<HTMLElement>(".panes")!;
  const tabs = [
    ...panel.querySelectorAll<HTMLButtonElement>(".dock-tabs button"),
  ];
  const folds = [...panel.querySelectorAll<HTMLButtonElement>(".group-fold")];
  const phone = matchMedia("(max-width: 899px)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const token = (name: string) =>
    getComputedStyle(root).getPropertyValue(name).trim();

  // From one pane to another the dock eases to the new height, from wherever
  // it is mid-switch, and the new pane rises in.
  const glide = (from: number, pane: HTMLElement) => {
    const to = panes.offsetHeight;
    panes.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 320,
      easing: token("--ease-sheet"),
    });
    pane.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: 240,
        delay: 60,
        easing: token("--ease-out"),
        fill: "backwards",
      },
    );
  };

  let open = "";
  const show = (name: string) => {
    const opening = !open && name;
    const switching = open && name && open !== name;
    const from = panes.getBoundingClientRect().height;
    for (const animation of panes.getAnimations({ subtree: true }))
      animation.cancel();
    open = name;
    root.dataset.dock = name ? "open" : "";
    body.inert = phone.matches && !name;
    for (const tab of tabs) tab.ariaExpanded = String(tab.dataset.for === name);
    // Shutting keeps the last pane showing while the dock folds away.
    let shown: HTMLElement | undefined;
    if (name)
      for (const pane of panel.querySelectorAll<HTMLElement>("[data-pane]")) {
        pane.classList.toggle("active", pane.dataset.pane === name);
        if (pane.dataset.pane === name) shown = pane;
      }
    if (switching && shown && !reduced.matches) glide(from, shown);
    if (opening) onOpen(panel.offsetHeight + panes.scrollHeight);
  };

  for (const tab of tabs)
    tab.addEventListener("click", () =>
      show(open === tab.dataset.for ? "" : tab.dataset.for!),
    );
  // A tap anywhere else shuts it, and still does what it tapped. Scrolling
  // isn't a click, so the page can scroll under an open dock.
  document.addEventListener("click", (e) => {
    if (phone.matches && open && !panel.contains(e.target as Node)) show("");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && phone.matches && open) {
      const tab = tabs.find((t) => t.dataset.for === open)!;
      show("");
      tab.focus();
    }
  });

  // In the dock every group is unfolded, since the tabs do the folding. Going
  // back to a wide screen folds again whichever groups were folded.
  let folded: HTMLButtonElement[] = [];
  const fit = () => {
    if (phone.matches) {
      folded = folds.filter((fold) => fold.ariaExpanded !== "true");
      for (const fold of folded) fold.click();
      body.inert = !open;
    } else {
      show("");
      body.inert = false;
      for (const fold of folded) if (fold.ariaExpanded === "true") fold.click();
      folded = [];
    }
  };
  phone.addEventListener("change", fit);
  fit();
};
