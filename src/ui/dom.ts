type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;

/** Small element builder: h("button", { class: "btn", onclick: fn }, "Save"). Strings are inserted as text, never HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function mount(...nodes: Node[]) {
  const root = document.getElementById("app")!;
  root.replaceChildren(...nodes);
  window.scrollTo(0, 0);
}

export function topbar(title: string, ...right: Node[]) {
  return h("header", { class: "topbar" },
    h("a", { href: "#/", class: "brand" }, "Form Coach"),
    h("h1", {}, title),
    h("div", { class: "topbar-right" }, ...right));
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function download(name: string, data: unknown) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
