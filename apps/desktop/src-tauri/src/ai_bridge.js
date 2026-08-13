// Script injecté dans la webview IA (ChatGPT / Claude) — le "pont" côté page.
// (1) lit la conversation (parseur par site), (2) injecte le prompt de contexte, (3) remonte
// automatiquement la conversation à Dowze (IPC → Rust → frontend Dowze → /companion/bridge/ingest).
(function () {
  if (window.__DOWZE_AI_INSTALLED__) return;
  window.__DOWZE_AI_INSTALLED__ = true;

  const host = location.hostname || "";
  const isClaude = host.indexOf("claude.ai") >= 0 || host.indexOf("anthropic") >= 0;
  const isGPT = host.indexOf("chatgpt.com") >= 0 || host.indexOf("openai") >= 0;

  // --- Coins arrondis de la CARTE ---
  // La webview a un fond transparent (Rust). Le fond sombre de ChatGPT/Claude est peint par le « canvas »
  // de la page (propagé depuis html/body) et remplit tout le rectangle → coins carrés. On rend donc html/body
  // transparents et on pose un BACKDROP `border-radius` de la MÊME couleur derrière le contenu : seuls les 4
  // coins (hors du rayon) restent transparents et laissent voir Dowze → carte arrondie, indépendante du DOM.
  function roundCorners() {
    try {
      if (!document.body) return;
      let bg = getComputedStyle(document.body).backgroundColor;
      if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {
        bg = getComputedStyle(document.documentElement).backgroundColor;
      }
      if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") bg = isClaude ? "#262624" : "#212121";
      let st = document.getElementById("__dowze_round_css__");
      if (!st) {
        st = document.createElement("style");
        st.id = "__dowze_round_css__";
        (document.head || document.documentElement).appendChild(st);
      }
      st.textContent = "html,body{background:transparent!important}";
      let bd = document.getElementById("__dowze_backdrop__");
      if (!bd) {
        bd = document.createElement("div");
        bd.id = "__dowze_backdrop__";
        document.documentElement.appendChild(bd);
      }
      bd.style.cssText =
        "position:fixed;inset:0;z-index:-2147483647;pointer-events:none;border-radius:16px;background:" + bg;
    } catch (e) {}
  }
  roundCorners();
  document.addEventListener("DOMContentLoaded", roundCorners);
  [400, 1200, 2500].forEach((t) => setTimeout(roundCorners, t));

  // --- Lecture de la conversation (parseur par site ; best-effort, tolérant aux refontes d'UI) ---
  function readConversation() {
    try {
      const turns = [];
      if (isGPT) {
        document.querySelectorAll("[data-message-author-role]").forEach((el) => {
          const role = el.getAttribute("data-message-author-role");
          const text = (el.innerText || "").trim();
          if (text) turns.push((role === "user" ? "Élève" : "Assistant") + " : " + text);
        });
      } else if (isClaude) {
        document
          .querySelectorAll('[data-testid="user-message"], .font-claude-message')
          .forEach((el) => {
            const role = el.matches('[data-testid="user-message"]') ? "Élève" : "Assistant";
            const text = (el.innerText || "").trim();
            if (text) turns.push(role + " : " + text);
          });
      }
      return turns.join("\n\n");
    } catch (e) {
      return "";
    }
  }

  // --- Injection du prompt de contexte dans le champ de saisie (textarea OU contenteditable/ProseMirror) ---
  function injectPrompt(text) {
    try {
      const el =
        document.querySelector("#prompt-textarea") ||
        document.querySelector('div[contenteditable="true"]') ||
        document.querySelector("textarea");
      if (!el) return false;
      el.focus();
      if (el.tagName === "TEXTAREA") {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        ).set;
        setter.call(el, text);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        try {
          document.execCommand("selectAll", false, null);
        } catch (e) {}
        const ok = document.execCommand("insertText", false, text);
        if (!ok) {
          el.textContent = text;
          el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Remonte une info à Dowze. On passe par le SYSTÈME D'ÉVÉNEMENTS core de Tauri
  // (`core:event:allow-emit`, permis par la capability ai-panel) et NON par une commande applicative :
  // les commandes applicatives custom sont refusées par l'ACL pour une origine distante (chatgpt.com/claude.ai).
  function emit(source, text) {
    try {
      if (window.__TAURI__ && window.__TAURI__.event) {
        window.__TAURI__.event.emit("dowze://ai-capture", { source: source, text: String(text) });
      }
    } catch (e) {}
  }

  window.__dowzeReadConversation = readConversation;
  window.__dowzeInjectPrompt = function (text) {
    const ok = injectPrompt(text);
    emit("__inject__", "ok=" + ok + " hasTauri=" + !!(window.__TAURI__ && window.__TAURI__.event));
    return ok;
  };

  // Ping de diagnostic : confirme que le script d'init s'est exécuté ET que l'événement passe.
  emit("__ready__", "installé sur " + host + " tauri=" + !!(window.__TAURI__ && window.__TAURI__.event));

  // --- Remontée automatique de la conversation à Dowze (débounce sur les changements du DOM) ---
  let last = "";
  let timer = null;
  function push() {
    const text = readConversation();
    if (text && text !== last) {
      last = text;
      emit(isClaude ? "claude" : "chatgpt", text.slice(0, 50000));
    }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(push, 2500);
  }
  function start() {
    try {
      new MutationObserver(schedule).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    } catch (e) {}
    schedule();
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
