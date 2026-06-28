/* ============================================================
   views/login.js — Selecció d'usuari: administrador o cambrera
   (identitat local per dispositiu; no és seguretat real)
   ============================================================ */
import { h, clear, icon, iconEl, toast, promptSheet } from "../ui.js";
import { t } from "../i18n.js";
import { state, setSession, initials } from "../store.js";

export function renderLogin(view) {
  clear(view);
  const wrap = h("div", { class: "login" });

  wrap.append(
    h("div", { class: "login__mark", html: icon("bed", 40, 1.5) }),
    h("h1", { class: "login__title" }, t("login.who")),
    h("p", { class: "login__sub" }, t("login.subtitle")),
  );

  // Administrador
  wrap.append(h("button", { class: "login-card login-card--admin", onClick: () => enterAdmin() },
    h("span", { class: "login-card__ic", html: icon("layers", 24, 2) }),
    h("div", { class: "login-card__txt" },
      h("div", { class: "login-card__name" }, t("login.admin")),
      h("div", { class: "login-card__desc" }, t("login.admin_desc"))),
    h("span", { class: "login-card__arrow", html: icon("chevron", 22) })
  ));

  // Cambreres
  wrap.append(h("div", { class: "section-label", style: "margin:22px 4px 10px" }, t("login.staff_title")));
  if (state.staff.length === 0) {
    wrap.append(h("p", { class: "muted", style: "font-size:13px;text-align:center;padding:0 16px" }, t("login.no_staff")));
  } else {
    const list = h("div", { class: "login-staff" });
    state.staff.forEach((s) => list.append(h("button", { class: "login-staff__btn", onClick: () => {
      setSession({ role: "staff", staffId: s.id });
      toast(`${t("inc.you")}: ${s.name}`);
    } },
      h("span", { class: "login-staff__av", style: `background:${s.color}` }, initials(s.name)),
      h("span", { class: "login-staff__name" }, s.name)
    )));
    wrap.append(list);
    wrap.append(h("p", { class: "muted", style: "font-size:11.5px;text-align:center;margin-top:10px" }, t("login.your_work")));
  }

  view.append(wrap);
}

async function enterAdmin() {
  const pin = state.config?.adminPin;
  if (pin) {
    const entered = await promptSheet(t("login.admin"), { label: t("login.pin_label"), placeholder: "••••" });
    if (entered === null) return false;
    if (entered !== String(pin)) { toast(t("login.pin_wrong"), "err"); return false; }
  }
  setSession({ role: "admin" });
  return true;
}
