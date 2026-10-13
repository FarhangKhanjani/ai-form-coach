import { supabase, appUrl } from "../supabase";
import { h, mount, errorText } from "./dom";

type Mode = "signin" | "signup" | "forgot";

function googleButton(status: HTMLElement) {
  return h("button", {
    class: "btn google", type: "button",
    onclick: async () => {
      status.textContent = "";
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: appUrl() } });
      if (error) status.textContent = error.message;
    }
  }, h("span", { class: "g", "aria-hidden": "true" }, "G"), "Continue with Google");
}

export function authPage(mode: Mode) {
  const status = h("p", { class: "form-status", role: "alert" });
  const email = h("input", { type: "email", name: "email", autocomplete: "email", required: true });
  const password = h("input", { type: "password", name: "password", autocomplete: mode === "signup" ? "new-password" : "current-password", required: true, minlength: 8 });
  const name = h("input", { type: "text", name: "name", autocomplete: "name" });
  const submit = h("button", { class: "btn", type: "submit" },
    mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link");

  const form = h("form", { class: "auth-form" },
    mode === "signup" ? h("label", { class: "field" }, "Name", name) : null,
    h("label", { class: "field" }, "Email", email),
    mode !== "forgot" ? h("label", { class: "field" }, "Password", password) : null,
    mode === "signup" ? h("p", { class: "hint" }, "At least 8 characters.") : null,
    submit, status);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    status.textContent = ""; status.className = "form-status";
    submit.disabled = true;
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value });
        if (error) throw error;
        location.hash = "#/";
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.value, password: password.value,
          options: { emailRedirectTo: appUrl(), data: { full_name: name.value || undefined } }
        });
        if (error) throw error;
        if (data.session) location.hash = "#/";
        else { status.className = "form-status ok"; status.textContent = "Check your email and click the link to confirm your account."; form.reset(); }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.value, { redirectTo: appUrl() + "#/reset" });
        if (error) throw error;
        status.className = "form-status ok"; status.textContent = "If that email has an account, a reset link is on its way.";
      }
    } catch (err) {
      status.textContent = errorText(err);
    } finally {
      submit.disabled = false;
    }
  });

  const links = mode === "signin"
    ? h("p", { class: "auth-links" }, h("a", { href: "#/signup" }, "Create an account"), " · ", h("a", { href: "#/forgot" }, "Forgot password?"))
    : h("p", { class: "auth-links" }, h("a", { href: "#/login" }, "Back to sign in"));

  mount(h("main", { class: "auth" },
    h("div", { class: "auth-card" },
      h("p", { class: "brand-lg" }, "Form Coach"),
      h("h1", {}, mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset your password"),
      mode !== "forgot" ? [googleButton(status), h("div", { class: "or" }, h("span", {}, "or with email"))] : null,
      form, links,
      h("p", { class: "fineprint" }, "Your camera video never leaves your phone. Only body keypoints and rep results are saved to your account."))));
}

/** Shown after following a password-reset email link. */
export function resetPasswordPage() {
  const status = h("p", { class: "form-status", role: "alert" });
  const password = h("input", { type: "password", autocomplete: "new-password", required: true, minlength: 8 });
  const submit = h("button", { class: "btn", type: "submit" }, "Set new password");
  const form = h("form", { class: "auth-form" }, h("label", { class: "field" }, "New password", password), submit, status);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    submit.disabled = true;
    const { error } = await supabase.auth.updateUser({ password: password.value });
    submit.disabled = false;
    if (error) { status.textContent = error.message; return; }
    location.hash = "#/";
  });
  mount(h("main", { class: "auth" }, h("div", { class: "auth-card" }, h("p", { class: "brand-lg" }, "Form Coach"), h("h1", {}, "Choose a new password"), form)));
}
