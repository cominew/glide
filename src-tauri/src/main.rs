use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[tauri::command]
fn show_window(window: tauri::WebviewWindow) {
    window.show().ok();
    window.set_focus().ok();
    window.emit("projection:refresh", ()).ok();
}

#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) {
    window.hide().ok();
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![show_window, hide_window])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // 热键 Ctrl+Shift+G 切换窗口
            let app_handle = app.handle().clone();
            let _ = app.global_shortcut().on_shortcut("CommandOrControl+Shift+G", move |_app, _shortcut, event| {
                if matches!(event.state, ShortcutState::Pressed) {
                    let win = app_handle.get_webview_window("main").unwrap();
                    if win.is_visible().unwrap_or(false) {
                        win.hide().ok();
                    } else {
                        win.show().ok();
                        win.set_focus().ok();
                        win.emit("projection:refresh", ()).ok();
                    }
                }
            });

            // 失焦自动隐藏（关键！稳定的自动隐藏）
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(false) = event {
                    // 延迟 100ms 避免极短失焦导致误隐藏
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    let _ = window_clone.hide();
                }
            });

            window.emit("portal:awaken", ()).ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Glide Portal");
}