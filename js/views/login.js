/* ============================================================
   views/login.js — Selecció d'usuari, entrada i registre
   (identitat local per dispositiu; no és seguretat real)
   ============================================================ */
import { h, clear, icon, iconEl, toast, promptSheet } from "../ui.js";
import { t } from "../i18n.js";
import { state, setSession, initials, staffByName, registerStaff } from "../store.js";

let mode = "root"; // "root" | "staff" | "register"

export function renderLogin(view) {
  clear(view);
  const wrap = h("div", { class: "login" });
  wrap.append(
    h("div", { class: "login__mark", html: icon("bed", 40, 1.5) }),
    h("h1", { class: "login__title" }, t("login.who")),
    h("p", { class: "login__sub" }, t("login.subtitle")),
  );

  if (mode === "root") rootScreen(wrap, view);
  else if (mode === "staff") staffScreen(wrap, view);
  else registerScreen(wrap, view);

  view.append(wrap);
}

/* ---------- Pas 1: rol ---------- */
function rootScreen(wrap, view) {
  wrap.append(h("button", { class: "login-card login-card--admin", onClick: () => enterAdmin(view) },
    h("span", { class: "login-card__ic", html: icon("layers", 24, 2) }),
    h("div", { class: "login-card__txt" },
      h("div", { class: "login-card__name" }, t("login.admin")),
      h("div", { class: "login-card__desc" }, t("login.admin_desc"))),
    h("span", { class: "login-card__arrow", html: icon("chevron", 22) })
  ));
  wrap.append(h("button", { class: "login-card", style: "margin-top:10px", onClick: () => { mode = "staff"; renderLogin(view); } },
    h("span", { class: "login-card__ic", style: "background:var(--terra)", html: icon("user", 24, 2) }),
    h("div", { class: "login-card__txt" },
      h("div", { class: "login-card__name" }, t("auth.staff_enter")),
      h("div", { class: "login-card__desc" }, t("login.your_work"))),
    h("span", { class: "login-card__arrow", html: icon("chevron", 22) })
  ));
}

/* ---------- Pas 2: entrar com a cambrera ---------- */
function staffScreen(wrap, view) {
  wrap.append(backBtn(view));
  wrap.append(h("div", { class: "section-label", style: "margin:18px 4px 10px" }, t("auth.staff_enter")));

  const name = h("input", { class: "input", placeholder: t("auth.name"), autocomplete: "off" });
  const pw = h("input", { class: "input", type: "password", placeholder: t("auth.password"), autocomplete: "off" });

  // dreceres amb els noms ja registrats (aprovats)
  const approved = state.staff.filter((s) => !s.pending);
  if (approved.length) {
    const chips = h("div", { class: "chips", style: "flex-wrap:wrap;overflow:visible;margin-bottom:6px" });
    approved.forEach((s) => chips.append(h("button", { type: "button", class: "chip", onClick: () => { name.value = s.name; pw.focus(); } },
      h("span", { class: "dot", style: `background:${s.color}` }), s.name)));
    wrap.append(chips);
  }

  const form = h("div", { class: "auth-form" },
    h("div", { class: "field" }, h("label", {}, t("auth.name")), name),
    h("div", { class: "field" }, h("label", {}, t("auth.password")), pw),
    h("button", { class: "btn btn--primary btn--block btn--lg", onClick: () => doStaffLogin(name.value, pw.value) }, t("auth.enter")),
    h("p", { class: "muted", style: "font-size:11.5px;text-align:center;margin-top:10px" }, t("auth.forgot")),
  );
  pw.addEventListener("keydown", (e) => { if (e.key === "Enter") doStaffLogin(name.value, pw.value); });
  wrap.append(form);

  wrap.append(h("button", { class: "btn btn--ghost btn--block", style: "margin-top:8px", onClick: () => { mode = "register"; renderLogin(view); } }, t("auth.no_account")));
}

function doStaffLogin(nameVal, pwVal) {
  const s = staffByName(nameVal);
  if (!s) { toast(t("auth.not_found"), "warn"); return; }
  if (s.pending) { toast(t("auth.pending"), "warn"); return; }
  if (s.password && s.password !== pwVal) { toast(t("auth.wrong_pw"), "err"); return; }
  setSession({ role: "staff", staffId: s.id });
}

/* ---------- Pas 2b: registre ---------- */
function registerScreen(wrap, view) {
  wrap.append(backBtn(view, "staff"));
  wrap.append(h("div", { class: "section-label", style: "margin:18px 4px 10px" }, t("auth.register_title")));

  const name = h("input", { class: "input", placeholder: t("auth.name"), autocomplete: "off" });
  const pw = h("input", { class: "input", type: "text", placeholder: t("auth.password_easy"), autocomplete: "off" });

  wrap.append(h("div", { class: "auth-form" },
    h("div", { class: "field" }, h("label", {}, t("auth.name")), name),
    h("div", { class: "field" }, h("label", {}, t("auth.password")), pw),
    h("button", { class: "btn btn--primary btn--block btn--lg", onClick: async () => {
      const res = await registerStaff(name.value, pw.value);
      if (res.error === "name") { toast(t("auth.need_name"), "warn"); return; }
      if (res.error === "exists") { toast(t("auth.name_taken"), "warn"); return; }
      toast(t("auth.registered"));
      mode = "staff"; renderLogin(view);
    } }, iconEl("check", 18), t("auth.register")),
    h("p", { class: "muted", style: "font-size:11.5px;text-align:center;margin-top:10px" }, t("auth.registered")),
  ));
  wrap.append(h("button", { class: "btn btn--ghost btn--block", style: "margin-top:8px", onClick: () => { mode = "staff"; renderLogin(view); } }, t("auth.have_account")));
}

/* ---------- Helpers ---------- */
function backBtn(view, to = "root") {
  return h("button", { class: "auth-back", onClick: () => { mode = to; renderLogin(view); } }, h("span", { html: icon("chevron", 18) }), t("auth.back"));
}

async function enterAdmin(view) {
  const pin = state.config?.adminPin;
  if (pin) {
    const entered = await promptSheet(t("login.admin"), { label: t("login.pin_label"), placeholder: "••••" });
    if (entered === null) return false;
    if (entered !== String(pin)) { toast(t("login.pin_wrong"), "err"); return false; }
  }
  mode = "root";
  setSession({ role: "admin" });
  return true;
}
