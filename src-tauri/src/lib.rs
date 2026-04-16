use std::collections::HashMap;
use std::str::FromStr;
use std::time::Instant;

use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use tauri::{menu::MenuBuilder, tray::TrayIconBuilder, Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

const QUICK_DESK_SHORTCUT: &str = "CommandOrControl+Shift+Space";
const TRAY_TOGGLE_ID: &str = "toggle-window";
const TRAY_QUIT_ID: &str = "quit-app";

#[derive(Debug, Deserialize)]
struct HttpRequest {
    method: String,
    url: String,
    headers: String,
    body: String,
}

#[derive(Debug, Serialize)]
struct HttpResponse {
    status: u16,
    status_text: String,
    elapsed_ms: u128,
    headers: HashMap<String, String>,
    body: String,
}

fn parse_headers(raw_headers: &str) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();

    for line in raw_headers.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Some((key, value)) = trimmed.split_once(':') else {
            return Err(format!("Header 格式错误：{trimmed}"));
        };

        let name = HeaderName::from_bytes(key.trim().as_bytes())
            .map_err(|error| format!("Header 名称无效：{error}"))?;
        let value = HeaderValue::from_str(value.trim())
            .map_err(|error| format!("Header 值无效：{error}"))?;
        headers.insert(name, value);
    }

    Ok(headers)
}

#[tauri::command]
async fn send_http_request(request: HttpRequest) -> Result<HttpResponse, String> {
    let method = request
        .method
        .parse::<reqwest::Method>()
        .map_err(|error| format!("Method 无效：{error}"))?;
    let headers = parse_headers(&request.headers)?;
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|error| format!("请求客户端创建失败：{error}"))?;

    let started_at = Instant::now();
    let mut builder = client.request(method, request.url).headers(headers);
    if !request.body.trim().is_empty() {
        builder = builder.body(request.body);
    }

    let response = builder
        .send()
        .await
        .map_err(|error| format!("请求失败：{error}"))?;

    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let headers = response
        .headers()
        .iter()
        .map(|(key, value)| {
            (
                key.to_string(),
                value.to_str().unwrap_or("<非 UTF-8 Header>").to_string(),
            )
        })
        .collect::<HashMap<_, _>>();
    let body = response
        .text()
        .await
        .map_err(|error| format!("响应读取失败：{error}"))?;

    Ok(HttpResponse {
        status: status.as_u16(),
        status_text,
        elapsed_ms: started_at.elapsed().as_millis(),
        headers,
        body,
    })
}

fn show_or_hide_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let visible = window.is_visible().unwrap_or(false);
    if visible {
        let _ = window.hide();
        return;
    }

    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
    let _ = window.emit("focus-search", ());
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text(TRAY_TOGGLE_ID, "显示/隐藏 SwiftBox")
        .separator()
        .text(TRAY_QUIT_ID, "退出")
        .build()?;

    let mut tray = TrayIconBuilder::with_id("swiftbox-tray")
        .tooltip("SwiftBox")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            TRAY_TOGGLE_ID => show_or_hide_main_window(app),
            TRAY_QUIT_ID => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    let Ok(expected) = Shortcut::from_str(QUICK_DESK_SHORTCUT) else {
                        return;
                    };
                    if shortcut == &expected && event.state() == ShortcutState::Pressed {
                        show_or_hide_main_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            setup_tray(app)?;

            let shortcut = Shortcut::from_str(QUICK_DESK_SHORTCUT)?;
            app.global_shortcut().register(shortcut)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![send_http_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
