import type { RepLabel } from "../data/api";
import { ERROR_ORDER, ERROR_TEXT, type SquatError } from "../exercises/squat/config";
import { byId } from "../exercises/generic/catalog";
import { fails } from "../exercises/generic/engine";
import { h } from "./dom";

type Angles = { kneeFlex: { L: number; R: number }; hipFlex: { L: number; R: number }; trunkLean: number; trunkMinusShin: number } | null | undefined;

/** Bottom-of-rep joint angles (3D), comparable with the lab values in docs/exercises/squat.md §7. */
export function anglesText(a: Angles) {
  if (!a) return null;
  const avg = (v: { L: number; R: number }) => Math.round((v.L + v.R) / 2);
  return h("p", { class: "rep-metrics" },
    `Bottom angles: knee ${avg(a.kneeFlex)}° · hip ${avg(a.hipFlex)}° · trunk lean ${Math.round(a.trunkLean)}° · trunk vs shin ${a.trunkMinusShin > 0 ? "+" : ""}${Math.round(a.trunkMinusShin)}°`);
}

/** The mistakes a user can pick when labeling a rep of this exercise. */
export function errorChoices(exercise: string): { code: string; name: string }[] {
  const def = byId(exercise);
  if (def) return def.checks.map(c => ({ code: c.code, name: c.name }));
  return ERROR_ORDER.map(code => ({ code, name: ERROR_TEXT[code].name }));
}

export function issueName(exercise: string, code: string) {
  return byId(exercise)?.checks.find(c => c.code === code)?.name ?? ERROR_TEXT[code as SquatError]?.name ?? code;
}

export function issuesText(issues: string[], exercise = "squat") {
  return issues.length
    ? h("span", { class: "iss" }, issues.map(i => issueName(exercise, i)).join(", "))
    : h("span", { class: "ok" }, "Clean");
}

/** What was measured on a rep: squat metrics, or each catalog check's value against its limit. */
export function repDetails(exercise: string, metrics: Record<string, any>, downTime: number, view: string) {
  const def = byId(exercise);
  if (!def) {
    return [
      h("p", { class: "rep-metrics" }, `Depth ${metrics.depthPct}% · down ${downTime.toFixed(1)} s` + (view === "front" ? ` · knees ${Number(metrics.kneeRatio).toFixed(2)}×` : "")),
      anglesText(metrics.anglesAtBottom)
    ];
  }
  const items = def.checks.filter(c => metrics[c.code] !== undefined && metrics[c.code] !== null).map(c => {
    const v = Number(metrics[c.code]);
    const lim = c.limit.min !== undefined ? `≥ ${c.limit.min}` : `≤ ${c.limit.max}`;
    return h("li", { class: fails(v, c.limit) ? "iss" : "" }, `${c.name.replace(/^(Not|No) /, "")}: ${v}${c.unit === "°" || c.unit === "s" || c.unit === "×" ? c.unit : " " + c.unit} (limit ${lim})`);
  });
  const head = def.mode === "hold"
    ? `Held ${Number(metrics.holdS ?? downTime).toFixed(1)} s`
    : `${def.signal!.label} at the peak: ${metrics.peakSignal}°`;
  return [h("p", { class: "rep-metrics" }, head), items.length ? h("ul", { class: "check-list" }, ...items) : null];
}

/**
 * "Correct" or one or more errors, chosen by the user. Starts empty on purpose:
 * pre-filling the app's own flags would bias the labels we later train and validate against.
 */
export function labelEditor(initial: RepLabel | null, onChange: (l: RepLabel | null) => void | Promise<void>, showSaving = true, exercise = "squat") {
  let state: RepLabel | null = initial ? { ...initial, errors: [...initial.errors] } : null;
  const wrap = h("div", { class: "label-editor", role: "group", "aria-label": "Your label" });
  const saving = h("span", { class: "saving muted small" });
  const choices = errorChoices(exercise);

  const render = () => {
    const chip = (text: string, on: boolean, click: () => void, kind = "") =>
      h("button", { type: "button", class: `chip ${kind}${on ? " on" : ""}`, "aria-pressed": on ? "true" : "false", onclick: click }, text);
    wrap.replaceChildren(
      chip("Correct", state?.correct === true, () => { state = { correct: true, errors: [] }; changed(); }, "good"),
      ...choices.map(({ code, name }) => chip(name, !!state?.errors.includes(code), () => {
        const errors = new Set(state?.errors ?? []);
        if (errors.has(code)) errors.delete(code); else errors.add(code);
        state = errors.size ? { correct: false, errors: [...errors] } : null;
        changed();
      })),
      saving);
  };
  const changed = async () => {
    render();
    if (!showSaving) { await onChange(state); return; }
    if (!state) return;
    saving.textContent = "Saving…";
    try { await onChange(state); saving.textContent = "Saved"; }
    catch { saving.textContent = "Not saved"; }
  };
  render();
  return wrap;
}
