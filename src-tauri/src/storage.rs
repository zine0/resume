use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoredResume {
    pub id: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "resumeData")]
    pub resume_data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct StorageData {
    entries: Vec<StoredResume>,
}

fn data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to resolve app data dir")
}

fn storage_file(app: &tauri::AppHandle) -> PathBuf {
    data_dir(app).join("resumes.json")
}

fn read_storage(app: &tauri::AppHandle) -> StorageData {
    let path = storage_file(app);
    if !path.exists() {
        return StorageData { entries: vec![] };
    }
    let content = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or(StorageData { entries: vec![] })
}

fn write_storage(app: &tauri::AppHandle, data: &StorageData) -> Result<(), String> {
    let path = storage_file(app);
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_resumes(app: tauri::AppHandle) -> Vec<StoredResume> {
    read_storage(&app).entries
}

#[tauri::command]
pub fn get_resume_by_id(app: tauri::AppHandle, id: String) -> Option<StoredResume> {
    read_storage(&app).entries.into_iter().find(|e| e.id == id)
}

#[tauri::command]
pub fn create_resume(app: tauri::AppHandle, entry: StoredResume) -> Result<StoredResume, String> {
    let mut storage = read_storage(&app);
    storage.entries.insert(0, entry.clone());
    write_storage(&app, &storage)?;
    Ok(entry)
}

#[tauri::command]
pub fn update_resume(
    app: tauri::AppHandle,
    id: String,
    data: serde_json::Value,
) -> Result<StoredResume, String> {
    let mut storage = read_storage(&app);
    let entry = storage
        .entries
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or("Resume not found".to_string())?;
    entry.resume_data = data;
    entry.updated_at = chrono::Utc::now().to_rfc3339();
    let updated = entry.clone();
    write_storage(&app, &storage)?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_resumes(app: tauri::AppHandle, ids: Vec<String>) -> Result<(), String> {
    let mut storage = read_storage(&app);
    let id_set: std::collections::HashSet<String> = ids.into_iter().collect();
    storage.entries.retain(|e| !id_set.contains(&e.id));
    write_storage(&app, &storage)
}
