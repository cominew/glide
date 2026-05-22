use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn spawn_dashboard(app: &AppHandle) {
    if app.get_webview_window("dashboard").is_some() {
        return;
    }

    let builder = WebviewWindowBuilder::new(
        app,
        "dashboard",
        WebviewUrl::App("index.html".into()),
    )
    .title("Glide Dashboard")
    .inner_size(1200.0, 800.0)
    .visible(true)
    .resizable(true)
    .decorations(true)
    .center();

    let builder = builder.initialization_script(r#"
        window.__GLIDE_MODE = 'dashboard';
    "#);

    builder.build().unwrap();
}