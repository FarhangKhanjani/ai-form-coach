import type { RepLabel } from "../data/api";
import { ERROR_ORDER, ERROR_TEXT, type SquatError } from "../exercises/squat/config";
import { h } from "./dom";

type Angles = { kneeFlex: { L: number; R: number }; hipFlex: { L: number; R: number }; trunkLean: number; trunkMinusShin: number } | null | undefined;

/** Bottom-of-rep joint angles (3D), comparable with the lab values in docs/exercises/squat.md §7. */
export function anglesText(a: Angles) {
  if (!a) return null;
  const avg = (v: { L: number; R: number }) => Math.round((v.L + v.R) / 2);
  return h("p", { class: "rep-metrics" },
    `Bottom angles: knee ${avg(a.kneeFlex)}° · hip ${avg(a.hipFlex)}° · trunk lean ${Math.round(a.trunkLean)}° · trunk vs shin ${a.trunkMinusShin > 0 ? "+" : ""}${Math.round(a.trunkMinusShin)}°`);
}

export function issuesText(issues: string[]) {
  return issues.length
    ? h("span", { class: "iss" }, issues.map(i => ERROR_TEXT[i as SquatError]?.name ?? i).join(", "))
    : h("span", { class: "ok" }, "Clean");
}

/**
 * "Correct" or one or more errors, chosen by the user. Starts empty on purpose:
 * pre-filling the app's own flags would bias the labels we later train and validate against.
 */
export function labelEditor(initial: RepLabel | null, onChange: (l: RepLabel | null) => void | Promise<void>, showSaving = true) {
  let state: RepLabel | null = initial ? { ...initial, errors: [...initial.errors] } : null;
  const wrap = h("div", { class: "label-editor", role: "group", "aria-label": "Your label" });
  const saving = h("span", { class: "saving muted small" });

  const render = () => {
    const chip = (text: string, on: boolean, click: () => void, kind = "") =>
      h("button", { type: "button", class: `chip ${kind}${on ? " on" : ""}`, "aria-pressed": on ? "true" : "false", onclick: click }, text);
    wrap.replaceChildren(
      chip("Correct", state?.correct === true, () => { state = { correct: true, errors: [] }; changed(); }, "good"),
      ...ERROR_ORDER.map(code => chip(ERROR_TEXT[code].name, !!state?.errors.includes(code), () => {
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
