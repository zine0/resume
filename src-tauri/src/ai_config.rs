use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIConfig {
    pub provider: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    pub model: String,
}

fn config_file(app: &tauri::AppHandle) -> std::path::PathBuf {
    crate::persist::app_data_dir(app).join("ai-config.json")
}

pub fn load_ai_config(app: &tauri::AppHandle) -> Result<AIConfig, String> {
    let path = config_file(app);
    if !path.exists() {
        return Err("请先配置 AI 设置".to_string());
    }

    let content = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_ai_config(app: tauri::AppHandle) -> Option<AIConfig> {
    load_ai_config(&app).ok()
}

#[tauri::command]
pub fn save_ai_config(app: tauri::AppHandle, config: AIConfig) -> Result<(), String> {
    let path = config_file(&app);
    crate::persist::write_json_atomic(&path, &config)
}
