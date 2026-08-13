//! Dowze Infra — application de bureau (Tauri v2).
//!
//! Le frontend est l'application Dowze existante (identique au web) ; cette coque ajoute des
//! **outils locaux** (voir `tools.rs`) que le web ne peut pas offrir, exposés via `invoke(...)`.

mod tools;
#[cfg(feature = "cef-panel")]
mod cef_panel;

use tauri_plugin_opener::OpenerExt;

/// Ouvre une URL http(s) dans le navigateur par défaut du système (jamais dans la fenêtre de l'app).
#[tauri::command]
fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("URL non autorisée.".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

/// Script injecté dans la webview IA (ChatGPT/Claude) : lit la conversation, injecte le prompt de contexte,
/// et remonte la conversation à Dowze (IPC `ai_capture`). Cf. `ai_bridge.js`.
const AI_INIT_SCRIPT: &str = include_str!("ai_bridge.js");

/// Largeur (px) du panneau IA à droite. 0 = pas de panneau ouvert.
static AI_PANEL_WIDTH: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

#[cfg(target_os = "linux")]
const AI_WIDGET_NAME: &str = "dowze-ai-panel";
/// Hauteur (px) de la titlebar custom Dowze (`h-9`) : le panneau IA commence EN DESSOUS pour que la barre
/// de titre coure sur toute la largeur, au-dessus du panneau.
#[cfg(target_os = "linux")]
const TITLEBAR_H: i32 = 36;
/// Marge autour du panneau IA → aspect « carte » incrustée dans l'app (haut sous la titlebar, droite, bas).
#[cfg(target_os = "linux")]
const PANEL_GAP: i32 = 12;

/// LINUX : place la webview IA comme une CARTE incrustée en haut-à-droite, PAR-DESSUS la webview Dowze
/// (qui reste en PLEINE fenêtre) via un `GtkOverlay`. Ainsi la titlebar Dowze court sur toute la largeur —
/// même au-dessus du panneau — et le panneau flotte comme une carte avec des marges. Dowze n'est JAMAIS
/// redimensionné (pas de souci de surface WebKitGTK figée) : ouvrir = ajouter l'overlay, fermer = le retirer.
#[cfg(target_os = "linux")]
fn overlay_ai(window: &tauri::Window, panel_width: u32) -> Result<(), String> {
    use gtk::prelude::*;
    let vbox = window.default_vbox().map_err(|e| e.to_string())?;
    let children = vbox.children();
    if children.len() < 2 {
        return Err(format!("attendu ≥2 webviews dans le vbox, trouvé {}", children.len()));
    }
    let ai = children.last().unwrap().clone(); // webview IA = dernière ajoutée (add_child)
    let main = children[0].clone(); // webview Dowze
    for c in &children {
        vbox.remove(c);
    }

    let overlay = gtk::Overlay::new();
    main.set_size_request(-1, -1);
    overlay.add(&main); // Dowze = fond, pleine fenêtre

    ai.set_widget_name(AI_WIDGET_NAME);
    ai.set_halign(gtk::Align::End); // collé à droite
    ai.set_valign(gtk::Align::Fill); // du haut (sous titlebar) au bas
    ai.set_size_request(panel_width as i32, -1);
    ai.set_margin_top(TITLEBAR_H + PANEL_GAP);
    ai.set_margin_end(PANEL_GAP);
    ai.set_margin_bottom(PANEL_GAP);
    overlay.add_overlay(&ai);
    overlay.set_overlay_pass_through(&ai, false); // le panneau reçoit les clics
    // (Coins arrondis : gérés côté page — webview au fond transparent + backdrop arrondi injecté, cf. ai_bridge.js.)

    vbox.pack_start(&overlay, true, true, 0);
    vbox.show_all();
    Ok(())
}

/// LINUX : les surfaces natives des WebKitWebView de Tauri sont positionnées UNE fois (à la création) et ne
/// suivent pas les changements de layout GTK (`hide`, `size_request`, `remove` ne collapsent pas la webview).
/// Le seul geste fiable qui re-réalise une surface est le REPARENTAGE (c.-à-d. ce que fait `arrange_gtk`).
/// Donc : fermer le panneau = détruire la webview IA + reparenter Dowze en pleine largeur ; rouvrir =
/// recréer la webview + `arrange_gtk`. Le login (ChatGPT/Claude) survit via les cookies WebKitGTK sur disque.
///
/// Retire le panneau IA : reparente la webview Dowze (le fond de l'overlay) directement dans le vbox et
/// supprime l'overlay. Dowze garde sa taille (pleine fenêtre) → aucun redimensionnement.
#[cfg(target_os = "linux")]
fn collapse_to_main(window: &tauri::Window) -> Result<(), String> {
    use gtk::prelude::*;
    let vbox = window.default_vbox().map_err(|e| e.to_string())?;
    let overlay = match vbox.children().into_iter().find_map(|c| c.downcast::<gtk::Overlay>().ok()) {
        Some(o) => o,
        None => return Ok(()), // pas d'overlay → déjà refermé
    };
    // La webview Dowze = l'enfant qui n'est pas le panneau IA.
    if let Some(dowze) = overlay.children().into_iter().find(|w| w.widget_name() != AI_WIDGET_NAME) {
        overlay.remove(&dowze);
        vbox.remove(&overlay);
        vbox.pack_start(&dowze, true, true, 0);
        vbox.show_all();
    }
    Ok(())
}

/// Ouvre ChatGPT/Claude comme une CARTE incrustée à droite, PAR-DESSUS Dowze (pleine fenêtre).
/// PUR TAURI (multiwebview `unstable`) — WebKitGTK/WebView2/WKWebView selon l'OS. Pas de CEF.
fn open_ai_panel(app: &tauri::AppHandle, url: String, width: u32) -> Result<(), String> {
    use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewBuilder, WebviewUrl};
    if !url.starts_with("https://") {
        return Err("URL non autorisée.".into());
    }
    use std::sync::atomic::Ordering::SeqCst;
    let window = app.get_window("main").ok_or("fenêtre principale introuvable")?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let (cur_w, h) = (size.width, size.height);
    // Panneau ~étroit à droite ; on laisse toujours assez de place à Dowze à gauche.
    let panel = width.min(cur_w.saturating_sub(420)).max(300);
    AI_PANEL_WIDTH.store(panel, SeqCst);

    let target = tauri::Url::parse(&url).map_err(|e| e.to_string())?;
    let created = if app.get_webview("ai").is_none() {
        let builder = WebviewBuilder::new("ai", WebviewUrl::External(target))
            .initialization_script(AI_INIT_SCRIPT)
            .transparent(true); // fond transparent → coins arrondis via backdrop CSS (Dowze transparaît)
        // Position/taille initiales indicatives (le vrai placement = overlay GTK sur Linux).
        let x = cur_w.saturating_sub(panel) as i32;
        window
            .add_child(builder, PhysicalPosition::new(x, 0_i32), PhysicalSize::new(panel, h))
            .map_err(|e| e.to_string())?;
        true
    } else {
        if let Some(ai) = app.get_webview("ai") {
            ai.navigate(target).map_err(|e| e.to_string())?;
        }
        false
    };

    // Linux : à la création on met en place l'overlay (carte). Sinon (webview déjà là, ex. changement d'IA)
    // `navigate` a suffi, le layout est inchangé.
    #[cfg(target_os = "linux")]
    if created {
        overlay_ai(&window, panel)?;
    }
    // Windows/macOS : la géométrie multiwebview Tauri fonctionne → on positionne les webviews.
    // Windows/macOS : Dowze reste PLEINE fenêtre (titlebar sur toute la largeur) ; le panneau IA est une
    // carte incrustée en haut-à-droite, sous la titlebar, avec marges. La géométrie multiwebview Tauri marche.
    #[cfg(not(target_os = "linux"))]
    {
        let _ = created;
        const TITLEBAR_H: u32 = 36;
        const PANEL_GAP: u32 = 12;
        if let Some(main_wv) = app.get_webview("main") {
            let _ = main_wv.set_auto_resize(false);
            let _ = main_wv.set_position(PhysicalPosition::new(0_i32, 0_i32));
            let _ = main_wv.set_size(PhysicalSize::new(cur_w, h));
        }
        if let Some(ai) = app.get_webview("ai") {
            let x = cur_w.saturating_sub(panel + PANEL_GAP);
            let y = TITLEBAR_H + PANEL_GAP;
            let ph = h.saturating_sub(TITLEBAR_H + 2 * PANEL_GAP);
            let _ = ai.set_auto_resize(false);
            let _ = ai.set_position(PhysicalPosition::new(x as i32, y as i32));
            let _ = ai.set_size(PhysicalSize::new(panel, ph));
        }
    }
    Ok(())
}

/// Ouvre une IA (ChatGPT/Claude) dans le panneau docké à droite, de largeur `width` (px).
/// GTK n'est pas thread-safe : `open_ai_panel` crée/arrange des widgets WebKitGTK → il DOIT tourner sur le
/// thread principal (la commande, elle, est appelée par Tauri sur un thread worker). On la marshale donc.
#[tauri::command]
fn ai_panel_open(app: tauri::AppHandle, url: String, width: u32) -> Result<(), String> {
    let h = app.clone();
    app.run_on_main_thread(move || {
        if let Err(e) = open_ai_panel(&h, url, width) {
            eprintln!("[dowze-ai] ai_panel_open: {e}");
        }
    })
    .map_err(|e| e.to_string())
}

/// Ferme le panneau IA : détruit la webview ChatGPT/Claude et rend toute la largeur à Dowze. Rouvrir avec
/// `ai_panel_open` recrée le panneau ; le login est conservé (cookies WebKitGTK sur disque).
#[tauri::command]
fn ai_panel_close(app: tauri::AppHandle) -> Result<(), String> {
    // Comme l'ouverture : les manipulations GTK doivent tourner sur le thread principal.
    let h = app.clone();
    app.run_on_main_thread(move || {
        if let Err(e) = hide_ai_panel(&h) {
            eprintln!("[dowze-ai] ai_panel_close: {e}");
        }
    })
    .map_err(|e| e.to_string())
}

/// Ferme le panneau IA. À exécuter sur le thread principal (GTK). Dowze étant en pleine fenêtre en permanence,
/// fermer = juste détruire la webview IA + retirer l'overlay ; aucun redimensionnement.
fn hide_ai_panel(app: &tauri::AppHandle) -> Result<(), String> {
    use std::sync::atomic::Ordering::SeqCst;
    use tauri::Manager;
    if AI_PANEL_WIDTH.swap(0, SeqCst) == 0 {
        return Ok(()); // déjà fermé
    }
    let _window = app.get_window("main").ok_or("fenêtre principale introuvable")?;
    // Détruit la webview IA (tue sa surface native).
    if let Some(ai) = app.get_webview("ai") {
        ai.close().map_err(|e| e.to_string())?;
    }
    // Linux : retire l'overlay, Dowze reprend le fond (déjà pleine fenêtre). Windows/macOS : rien à faire,
    // Dowze est déjà en pleine fenêtre (la carte IA était juste posée dessus).
    #[cfg(target_os = "linux")]
    collapse_to_main(&_window)?;
    Ok(())
}

/// Injecte le prompt de contexte dans le champ de saisie de l'IA (ChatGPT/Claude).
/// Sur WebKitGTK, appeler `eval` depuis un thread worker (comme le fait Tauri pour les commandes) fige la
/// boucle GTK → on marshale l'`eval` sur le thread principal, comme les manipulations de widgets.
#[tauri::command]
fn ai_inject(app: tauri::AppHandle, text: String) -> Result<(), String> {
    let h = app.clone();
    app.run_on_main_thread(move || {
        use tauri::Manager;
        if let Some(ai) = h.get_webview("ai") {
            let payload = serde_json::to_string(&text).unwrap_or_else(|_| "\"\"".into());
            let _ = ai.eval(format!("window.__dowzeInjectPrompt && window.__dowzeInjectPrompt({payload})"));
        }
    })
    .map_err(|e| e.to_string())
}

/// Petite commande de diagnostic : le frontend peut vérifier qu'il tourne bien dans le desktop.
#[tauri::command]
fn desktop_info() -> serde_json::Value {
    serde_json::json!({
        "app": "Dowze Infra Desktop",
        "version": env!("CARGO_PKG_VERSION"),
        "os": std::env::consts::OS,
        "searxng": std::env::var("DOWZE_SEARXNG_URL").ok(),
        "tools": ["web_search", "wikipedia_search", "ollama_request"],
    })
}

/// Appelle exclusivement Ollama sur la boucle locale du poste client.
/// L'URL n'est volontairement pas configurable depuis le web : aucun SSRF ni Ollama distant.
#[tauri::command]
async fn ollama_request(payload: serde_json::Value) -> Result<serde_json::Value, String> {
    let operation = payload
        .get("operation")
        .and_then(|value| value.as_str())
        .ok_or("opération Ollama absente")?;
    let path = match operation {
        "chat" => "chat",
        "embed" => "embed",
        _ => return Err("opération Ollama non autorisée".into()),
    };
    let mut body = payload.as_object().cloned().ok_or("charge utile invalide")?;
    body.remove("operation");
    if operation == "chat" {
        body.insert("stream".into(), serde_json::Value::Bool(false));
    }
    reqwest::Client::new()
        .post(format!("http://127.0.0.1:11434/api/{path}"))
        .json(&body)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|_| "Ollama n'est pas joignable sur cette machine (127.0.0.1:11434).".to_string())?
        .error_for_status()
        .map_err(|error| format!("Ollama a refusé la requête : {error}"))?
        .json()
        .await
        .map_err(|error| format!("Réponse Ollama invalide : {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            desktop_info,
            open_external,
            ai_panel_open,
            ai_panel_close,
            ai_inject,
            tools::web_search,
            tools::wikipedia_search,
            ollama_request,
        ])
        .build(tauri::generate_context!())
        .expect("erreur au démarrage de Dowze Infra Desktop");

    // Pont IA : la webview `ai` (ChatGPT/Claude) émet `dowze://ai-capture` (core event, permis par la
    // capability ai-panel) quand la conversation change. On l'écoute côté Rust et on la relaie à la webview
    // `main` (qui a le token Dowze) via `dowze://ai-conversation` → elle appellera `POST /companion/bridge/ingest`.
    {
        use tauri::{Emitter, Listener, Manager};
        let h = app.handle().clone();
        app.listen_any("dowze://ai-capture", move |event| {
            let val: serde_json::Value =
                serde_json::from_str(event.payload()).unwrap_or_else(|_| serde_json::json!({}));
            // IMPORTANT : `main` est une fenêtre MULTIWEBVIEW (elle héberge aussi la webview `ai`) → ce n'est
            // plus une WebviewWindow. On récupère donc la webview par `get_webview`, pas `get_webview_window`.
            if let Some(main) = h.get_webview("main") {
                let _ = main.emit("dowze://ai-conversation", val);
            } else {
                eprintln!("[dowze-ai] webview `main` introuvable, conversation non relayée");
            }
        });
    }

    app.run(move |app, event| match event {
        tauri::RunEvent::Ready => {
            // Dev : `DOWZE_AI_TEST_URL=https://chatgpt.com` ouvre directement le panneau IA au démarrage.
            if let Ok(url) = std::env::var("DOWZE_AI_TEST_URL") {
                if let Err(e) = open_ai_panel(app, url, 420) {
                    eprintln!("[dowze-ai] échec ouverture panneau : {e}");
                }
            }
        }
        // Linux : GTK (GtkBox) gère le resize du split tout seul. (Windows/macOS : à recâbler au besoin.)
        _ => {}
    });
}
