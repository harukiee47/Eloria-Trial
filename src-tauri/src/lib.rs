use tauri::Emitter;
use tauri::Listener;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_deep_link::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let handle = app.handle().clone();
      app.listen("deep-link://new-url", move |event| {
        let url = event.payload().to_string();
        handle.emit("deep-link", url).ok();
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}