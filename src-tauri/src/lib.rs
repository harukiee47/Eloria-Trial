use tauri::Emitter;
use tauri::Manager;

use tauri_plugin_shell::ShellExt;

#[tauri::command]
async fn pick_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
  use tauri_plugin_dialog::DialogExt;
  let path = app.dialog()
    .file()
    .add_filter("Video", &["mp4", "mov", "avi", "mkv", "webm", "m4v"])
    .blocking_pick_file();
  Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
async fn run_ffmpeg(app: tauri::AppHandle, args: Vec<String>) -> Result<String, String> {
  use tauri::Manager;
  use tauri_plugin_shell::process::CommandEvent;

  let shell = app.shell();

  // Resolve bundled ffmpeg binary path
  let ffmpeg_path = app
    .path()
    .resolve("binaries/ffmpeg", tauri::path::BaseDirectory::Resource)
    .map_err(|e| format!("Could not find bundled ffmpeg: {}", e))?;

  let mut final_args = vec![
    "-progress".to_string(),
    "pipe:1".to_string(),
    "-nostats".to_string(),
  ];
  final_args.extend(args);

  let (mut rx, _child) = shell
    .command(ffmpeg_path.to_str().unwrap_or("ffmpeg"))
    .args(final_args)
    .spawn()
    .map_err(|e| e.to_string())?;

  let mut last_err = String::new();

  while let Some(event) = rx.recv().await {
    match event {
      CommandEvent::Stdout(line) => {
        let text = String::from_utf8_lossy(&line).to_string();
        app.emit("ffmpeg-progress", &text).ok();
      }
      CommandEvent::Stderr(line) => {
        let text = String::from_utf8_lossy(&line).to_string();
        last_err = text.clone();
        app.emit("ffmpeg-progress", &text).ok();
      }
      CommandEvent::Terminated(status) => {
        if status.code == Some(0) {
          return Ok("done".to_string());
        } else {
          return Err(last_err);
        }
      }
      _ => {}
    }
  }

  Ok("done".to_string())
}

#[tauri::command]
async fn run_shell_command(app: tauri::AppHandle, program: String, args: Vec<String>) -> Result<String, String> {
  let shell = app.shell();
  let output = shell
    .command(&program)
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
    .plugin(tauri_plugin_dialog::init()) 
    .invoke_handler(tauri::generate_handler![run_ffmpeg, run_shell_command, pick_file])
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