//! Panneau IA = vrai Chromium embarqué (CEF). Compilé seulement avec `--features cef-panel`.
//!
//! - Init CEF avec **external message pump** (cohabite avec la boucle Tauri).
//! - **Navigateur enfant chromeless** parenté à la fenêtre Tauri (`WindowInfo::set_as_child`).
//! - Login **persistant** (`root_cache_path`), sous-process via le binaire `dowze_cef_helper`.
//! Contraintes CEF : tous les appels UI (créer un navigateur, pomper) sur le THREAD PRINCIPAL
//! (celui de `initialize`) → la création se fait dans la boucle Tauri via `tick()`.
//! Palier suivant (P2.2) : `CefMessageRouter`/`execute_java_script` pour lire le DOM / injecter le prompt.

use cef::*;
#[cfg(target_os = "linux")]
use cef::sys::cef_window_handle_t;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

static CONTEXT_READY: AtomicBool = AtomicBool::new(false);

/// Demande d'ouverture en attente (posée par une commande, traitée sur le thread principal par `tick`).
/// `tauri::WebviewWindow` est `Send`+`Clone` → on diffère TOUS les appels GTK au thread principal (`tick`).
struct OpenReq {
    window: tauri::WebviewWindow,
    url: String,
    panel_width: i32,
}
static PENDING_OPEN: Mutex<Option<OpenReq>> = Mutex::new(None);

// La zone GTK du panneau (créée une fois) — accédée UNIQUEMENT sur le thread principal.
#[cfg(target_os = "linux")]
thread_local! {
    static PANEL_AREA: std::cell::RefCell<Option<gtk::DrawingArea>> = std::cell::RefCell::new(None);
}

// ---- App + gestionnaire de process ----

wrap_app! {
    pub struct DowzeApp;

    impl App {
        fn browser_process_handler(&self) -> Option<BrowserProcessHandler> {
            Some(DowzeBrowserProcessHandler::new())
        }

        // Désactive le GPU (le process GPU crashe sur certains pilotes NVIDIA/Vulkan) → rendu logiciel fiable.
        fn on_before_command_line_processing(
            &self,
            process_type: Option<&CefString>,
            command_line: Option<&mut CommandLine>,
        ) {
            let is_browser = process_type.map(|s| s.to_string().is_empty()).unwrap_or(true);
            if is_browser {
                if let Some(cl) = command_line {
                    // GPU matériel cassé sur cette machine (ICD NVIDIA/Vulkan) → on force un GL LOGICIEL
                    // (SwiftShader via ANGLE). CEF rend alors via GL dans la fenêtre X11 embarquée, sans
                    // toucher au pilote cassé ni au présentateur bitmap logiciel défaillant.
                    cl.append_switch_with_value(Some(&CefString::from("use-gl")), Some(&CefString::from("angle")));
                    cl.append_switch_with_value(Some(&CefString::from("use-angle")), Some(&CefString::from("swiftshader")));
                    cl.append_switch(Some(&CefString::from("enable-unsafe-swiftshader")));
                    cl.append_switch(Some(&CefString::from("disable-gpu-sandbox")));
                }
            }
        }
    }
}

wrap_browser_process_handler! {
    struct DowzeBrowserProcessHandler {}

    impl BrowserProcessHandler {
        fn on_schedule_message_pump_work(&self, _delay_ms: i64) {
            // La boucle Tauri pompe déjà à chaque tour (P2.0c raffinera le réveil ciblé).
        }
        fn on_context_initialized(&self) {
            CONTEXT_READY.store(true, Ordering::SeqCst);
        }
    }
}

// Client minimal (les callbacks lifecycle/message-router viendront au P2.2).
wrap_client! {
    pub struct DowzeClient {}

    impl Client {}
}

// ---- Cycle de vie ----

/// Chemin du binaire helper des sous-process CEF (sibling de l'exécutable courant).
fn helper_path() -> Option<String> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    Some(dir.join("dowze_cef_helper").to_string_lossy().into_owned())
}

/// Dossier de profil persistant (cookies/login gardés) — sous le répertoire de données de l'utilisateur.
fn cache_path() -> String {
    let base = std::env::var("XDG_DATA_HOME")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| std::env::var("HOME").ok().map(|h| format!("{h}/.local/share")))
        .unwrap_or_else(|| "/tmp".to_string());
    format!("{base}/dowze/cef-profile")
}

/// Initialise CEF dans le process navigateur. UNE fois, sur le thread principal, avant la boucle Tauri.
pub fn init() -> bool {
    let args = cef::args::Args::new();
    let _ = api_hash(sys::CEF_API_VERSION_LAST, 0);

    // Process navigateur : `execute_process` renvoie -1 (les sous-process passent par `dowze_cef_helper`).
    let ret = execute_process(Some(args.as_main_args()), None::<&mut App>, std::ptr::null_mut());
    if ret >= 0 {
        return false;
    }

    let mut app = DowzeApp::new();
    let mut settings = Settings {
        no_sandbox: 1,
        external_message_pump: 1,
        root_cache_path: CefString::from(cache_path().as_str()),
        ..Default::default()
    };
    if let Some(h) = helper_path() {
        settings.browser_subprocess_path = CefString::from(h.as_str());
    }
    // En dev (non bundlé), on pointe les ressources CEF (icudtl.dat, *.pak, locales) vers CEF_PATH.
    // En prod, elles seront à côté de l'exécutable (packaging P2.3) et ces lignes seront superflues.
    if let Ok(cef_dir) = std::env::var("CEF_PATH") {
        settings.resources_dir_path = CefString::from(cef_dir.as_str());
        settings.locales_dir_path = CefString::from(format!("{cef_dir}/locales").as_str());
    }

    initialize(
        Some(args.as_main_args()),
        Some(&settings),
        Some(&mut app),
        std::ptr::null_mut(),
    ) == 1
}

/// Depuis une commande Tauri (thread quelconque) : enregistre l'ouverture d'une IA dans le panneau.
/// TOUT le travail GTK/CEF est différé au prochain `tick()` (thread principal).
pub fn open_for_window(window: &tauri::WebviewWindow, url: String, panel_width: i32) -> Result<(), String> {
    *PENDING_OPEN.lock().unwrap() = Some(OpenReq {
        window: window.clone(),
        url,
        panel_width: panel_width.max(240),
    });
    Ok(())
}

/// LINUX : restructure la fenêtre GTK en `[ webview (extensible) | GtkDrawingArea (panneau) ]`, réalise
/// l'aire, et crée le navigateur CEF comme ENFANT de la `GdkWindow` de l'aire (pattern `cefclient`).
/// Parenter au top-level ne marche pas (occupé par WebKit) — il faut un widget dédié.
#[cfg(target_os = "linux")]
fn build_panel_and_browser(req: &OpenReq) -> Result<(), String> {
    use gtk::prelude::*;

    let vbox = req.window.default_vbox().map_err(|e| e.to_string())?;

    // Restructuration une seule fois : on déplace les enfants existants (la webview) dans un hbox, et on
    // ajoute la DrawingArea du panneau à droite.
    let hbox = gtk::Box::new(gtk::Orientation::Horizontal, 0);
    for child in vbox.children() {
        vbox.remove(&child);
        hbox.pack_start(&child, true, true, 0);
    }
    let area = gtk::DrawingArea::new();
    area.set_size_request(req.panel_width, -1);
    hbox.pack_start(&area, false, false, 0);
    vbox.pack_start(&hbox, true, true, 0);
    vbox.show_all();

    WidgetExt::realize(&area);
    let gdk = WidgetExt::window(&area).ok_or_else(|| "GdkWindow de l'aire absente".to_string())?;
    let x11: gdkx11::X11Window = gdk.downcast().map_err(|_| "aire non X11".to_string())?;
    let xid = x11.xid() as cef_window_handle_t;

    // Bornes du navigateur = toute l'aire. La hauteur exacte peut ne pas être encore allouée → on prend la
    // hauteur de la fenêtre en repli.
    let h = req
        .window
        .inner_size()
        .map(|s| s.height as i32)
        .unwrap_or(600);
    let bounds = Rect { x: 0, y: 0, width: req.panel_width, height: h.max(1) };

    let window_info = WindowInfo::default().set_as_child(xid, &bounds);
    let mut client = DowzeClient::new();
    let browser_settings = BrowserSettings::default();
    let url = CefString::from(req.url.as_str());
    let _ = browser_host_create_browser(
        Some(&window_info),
        Some(&mut client),
        Some(&url),
        Some(&browser_settings),
        None,
        None,
    );

    PANEL_AREA.with(|c| *c.borrow_mut() = Some(area));
    Ok(())
}

/// À appeler à CHAQUE tour de la boucle Tauri (thread principal) : pompe CEF + traite les demandes.
pub fn tick() {
    do_message_loop_work();
    if !CONTEXT_READY.load(Ordering::SeqCst) {
        return;
    }
    let req = PENDING_OPEN.lock().unwrap().take();
    if let Some(_req) = req {
        #[cfg(target_os = "linux")]
        {
            if let Err(e) = build_panel_and_browser(&_req) {
                eprintln!("[dowze-cef] échec ouverture panneau : {e}");
            }
        }
    }
}

/// Arrêt propre de CEF (thread principal).
pub fn shutdown_cef() {
    shutdown();
}
