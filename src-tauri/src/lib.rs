use tauri::menu::{Menu, MenuBuilder, MenuEvent};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;

const TRAY_ID: &str = "main";

fn build_tray_menu<R: tauri::Runtime>(app: &tauri::App<R>) -> tauri::Result<Menu<R>> {
  let handle = app.handle();
  MenuBuilder::new(handle)
    .text("show", "Show")
    .text("quit", "Quit")
    .build()
}

fn on_tray_menu_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, event: MenuEvent) {
  match event.id.as_ref() {
    "show" => {
      if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
      }
    }
    "quit" => {
      app.exit(0);
    }
    _ => {}
  }
}

#[tauri::command]
fn set_tray_status(
  app: tauri::AppHandle<tauri::Wry>,
  status: String,
) -> Result<(), String> {
  let tray = app
    .tray_by_id(TRAY_ID)
    .ok_or_else(|| "Tray not found".to_string())?;
  tray.set_tooltip(Some(status.as_str())).map_err(|e| e.to_string())?;
  #[cfg(target_os = "macos")]
  {
    tray.set_title(Some(status.as_str())).map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let handle = app.handle();
      let menu = build_tray_menu(app)?;
      let icon = handle
        .default_window_icon()
        .cloned()
        .ok_or("no default window icon")?;

      let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .menu(&menu)
        .tooltip("EchoFlow")
        .icon_as_template(true)
        .on_menu_event(on_tray_menu_event)
        .build(handle)?;

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![set_tray_status])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
