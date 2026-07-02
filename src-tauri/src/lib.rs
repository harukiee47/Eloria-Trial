use tauri::Emitter;
use tauri::Manager;

use tauri_plugin_shell::ShellExt;

#[tauri::command]
async fn run_ffmpeg(app: tauri::AppHandle, args: Vec<String>) -> Result<String, String> {
  let shell = app.shell();
  let output = shell
    .command("ffmpeg")
    .args(args)
    .output()
    .await
    .map_err(|e| e.to_string())?;

  if output.status.success() {
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
  } else {
    Err(String::from_utf8_lossy(&output.stderr).to_string())
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![run_ffmpeg])
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        window.set_focus().ok();
      }
      for arg in &args {
        if arg.starts_with("eloria://") {
          app.emit("deep-link", arg.clone()).ok();
        }
      }
    }))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(desktop)]
      {
        use tauri_plugin_deep_link::DeepLinkExt;
        let handle = app.handle().clone();
        app.deep_link().on_open_url(move |event| {
          for url in event.urls() {
            handle.emit("deep-link", url.to_string()).ok();
          }
        });
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}