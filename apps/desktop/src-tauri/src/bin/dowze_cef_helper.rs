//! Sous-process CEF (Chromium multi-process) du panneau IA. Ne fait rien d'autre que router les
//! sous-process (render/GPU/utility) via `execute_process`. Compilé réellement seulement avec
//! `--features cef-panel` ; sinon c'est un binaire vide (le build par défaut reste inchangé).
//! Cf. docs/13-COMPAGNON/05-pont-webview-tauri.md (Phase 2).

#[cfg(feature = "cef-panel")]
fn main() {
    use cef::{args::Args, *};

    let args = Args::new();

    // Version de l'API CEF.
    let _ = api_hash(sys::CEF_API_VERSION_LAST, 0);

    // Route ce process comme sous-process Chromium (render/GPU/utility…).
    execute_process(Some(args.as_main_args()), None::<&mut App>, std::ptr::null_mut());
}

#[cfg(not(feature = "cef-panel"))]
fn main() {}
