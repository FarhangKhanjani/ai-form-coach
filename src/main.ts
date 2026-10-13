import "./styles.css";
import { supabase } from "./supabase";
import { authPage, resetPasswordPage } from "./ui/auth";
import { homePage, sessionPage } from "./ui/home";
import { workoutPage } from "./ui/workout";
import { summaryPage } from "./ui/summary";
import { profilePage } from "./ui/profile";
import { importVideoPage } from "./ui/importVideo";
import { exerciseWorkoutPage } from "./ui/exerciseWorkout";

let cleanup: (() => void) | void = undefined;
let recovering = false;

const PUBLIC = new Set(["#/login", "#/signup", "#/forgot"]);

async function route() {
  if (cleanup) { cleanup(); cleanup = undefined; }
  const hash = location.hash || "#/";
  const { data } = await supabase.auth.getSession();
  const signedIn = !!data.session;

  if (recovering || hash === "#/reset") { if (signedIn) return resetPasswordPage(); }
  if (PUBLIC.has(hash)) {
    if (signedIn) { location.hash = "#/"; return; }
    return authPage(hash === "#/signup" ? "signup" : hash === "#/forgot" ? "forgot" : "signin");
  }
  if (!signedIn) { location.hash = "#/login"; return; }

  if (hash === "#/workout/squat") cleanup = workoutPage();
  else if (hash.startsWith("#/workout/")) cleanup = exerciseWorkoutPage(hash.slice("#/workout/".length));
  else if (hash.startsWith("#/import/")) cleanup = importVideoPage(hash.slice("#/import/".length));
  else if (hash === "#/summary") summaryPage();
  else if (hash === "#/profile") await profilePage();
  else if (hash.startsWith("#/session/")) await sessionPage(hash.slice("#/session/".length));
  else await homePage();
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") { recovering = true; location.hash = "#/reset"; route(); }
  if (event === "SIGNED_OUT") { location.hash = "#/login"; }
  if (event === "USER_UPDATED") recovering = false;
});

window.addEventListener("hashchange", route);
route();
