// src-tauri/src/main.rs

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

//
// ─────────────────────────────
// Window Modules
// ─────────────────────────────
//
mod windows {
    pub mod dashboard;
}

//
// ─────────────────────────────
// Presence State
// ─────────────────────────────
//
#[derive(Clone, Copy, Debug)]
pub enum PresenceState {
    Dormant,
    Arriving,
    Attentive,
    Projecting,
    Dissolving,
}

fn emit_presence(window: &tauri::WebviewWindow, state: PresenceState) {
    let s = match state {
        PresenceState::Dormant => "dormant",
        PresenceState::Arriving => "arriving",
        PresenceState::Attentive => "attentive",
        PresenceState::Projecting => "projecting",
        PresenceState::Dissolving => "dissolving",
    };

    let _ = window.emit("presence:shift", s);
}

//
// ─────────────────────────────
// Commands (UI → Kernel)
// ─────────────────────────────
//
#[tauri::command]
fn open_dashboard(app: tauri::AppHandle) {
    windows::dashboard::spawn_dashboard(&app);
}

//
// ─────────────────────────────
// Kernel Entry
// ─────────────────────────────
//
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            open_dashboard
        ])
        .setup(|app| {

    //
    // ─────────────────────────────
    // Create Pet Presence Window
    // ─────────────────────────────
    //
    if app.get_webview_window("pet").is_none() {

        tauri::WebviewWindowBuilder::new(
            app,
            "pet",
            tauri::WebviewUrl::App("index.html".into())
        )
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(true)
        .build()
        .expect("failed to create pet window");

        println!("✅ Pet window created");
    }

    //
    // ─────────────────────────────
    // Presence Anchor
    // ─────────────────────────────
    //
    let pet = app.get_webview_window("pet").unwrap();

    emit_presence(&pet, PresenceState::Dormant);

    let handle = app.handle().clone();

    //
    // ─────────────────────────────
    // Global Shortcut
    // ─────────────────────────────
    //
    app.global_shortcut()
        .on_shortcut("Ctrl+Shift+G", move |_, _, _| {
            if let Some(w) = handle.get_webview_window("pet") {
                let _ = w.show();
                let _ = w.set_focus();
                emit_presence(&w, PresenceState::Arriving);
            }
        })
        .unwrap();

    //
    // ─────────────────────────────
    // Focus Dissolve
    // ─────────────────────────────
    //
    let wc = pet.clone();

    pet.on_window_event(move |e| {
        if let tauri::WindowEvent::Focused(false) = e {
            emit_presence(&wc, PresenceState::Dissolving);
        }
    });

    Ok(())
})
        .run(tauri::generate_context!())
        .expect("Glide Presence Kernel");
}