// src-tauri/src/windows/dashboard.rs

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn spawn_dashboard(app: &AppHandle) {
    if app.get_webview_window("dashboard").is_some() {
        return;
    }

    let _ = WebviewWindowBuilder::new(
        app,
        "dashboard",
        WebviewUrl::App("index.html?mode=dashboard".into()),
    )
    .title("Glide Dashboard")
    .inner_size(1200.0, 800.0)
    .visible(true)
    .build();
}