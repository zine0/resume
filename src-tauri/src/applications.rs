use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ApplicationStatus {
    Wishlist,
    Applied,
    Interview,
    Offer,
    Rejected,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationEntry {
    pub id: String,
    pub status: ApplicationStatus,
    pub company: String,
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jd_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resume_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resume_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub applied_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationInput {
    pub status: ApplicationStatus,
    pub company: String,
    pub role: String,
    #[serde(default)]
    pub jd_text: Option<String>,
    #[serde(default)]
    pub resume_id: Option<String>,
    #[serde(default)]
    pub resume_title: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub applied_at: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ApplicationStorageData {
    entries: Vec<ApplicationEntry>,
}

fn data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to resolve app data dir")
}

fn storage_file(app: &tauri::AppHandle) -> PathBuf {
    data_dir(app).join("applications.json")
}

fn read_storage(app: &tauri::AppHandle) -> Result<ApplicationStorageData, String> {
    let path = storage_file(app);
    if !path.exists() {
        return Ok(ApplicationStorageData { entries: vec![] });
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str::<ApplicationStorageData>(&content)
        .map_err(|_| "读取求职记录失败：存储文件格式无法识别，请先备份当前数据文件。".to_string())
}

fn write_storage(app: &tauri::AppHandle, data: &ApplicationStorageData) -> Result<(), String> {
    let path = storage_file(app);
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn sanitize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn validate_application_input(input: ApplicationInput) -> Result<ApplicationInput, String> {
    let company = input.company.trim().to_string();
    if company.is_empty() {
        return Err("公司名称不能为空".to_string());
    }

    let role = input.role.trim().to_string();
    if role.is_empty() {
        return Err("职位名称不能为空".to_string());
    }

    Ok(ApplicationInput {
        status: input.status,
        company,
        role,
        jd_text: sanitize_optional_text(input.jd_text),
        resume_id: sanitize_optional_text(input.resume_id),
        resume_title: sanitize_optional_text(input.resume_title),
        url: sanitize_optional_text(input.url),
        applied_at: sanitize_optional_text(input.applied_at),
        notes: sanitize_optional_text(input.notes),
    })
}

fn build_entry(
    id: String,
    created_at: String,
    updated_at: String,
    input: ApplicationInput,
) -> ApplicationEntry {
    ApplicationEntry {
        id,
        status: input.status,
        company: input.company,
        role: input.role,
        jd_text: input.jd_text,
        resume_id: input.resume_id,
        resume_title: input.resume_title,
        url: input.url,
        applied_at: input.applied_at,
        created_at,
        updated_at,
        notes: input.notes,
    }
}

#[tauri::command]
pub fn get_all_applications(app: tauri::AppHandle) -> Result<Vec<ApplicationEntry>, String> {
    Ok(read_storage(&app)?.entries)
}

#[tauri::command]
pub fn get_application_by_id(
    app: tauri::AppHandle,
    id: String,
) -> Result<Option<ApplicationEntry>, String> {
    Ok(read_storage(&app)?
        .entries
        .into_iter()
        .find(|entry| entry.id == id))
}

#[tauri::command]
pub fn create_application(
    app: tauri::AppHandle,
    data: ApplicationInput,
) -> Result<ApplicationEntry, String> {
    let mut storage = read_storage(&app)?;
    let now = Utc::now().to_rfc3339();
    let validated = validate_application_input(data)?;
    let created = build_entry(Uuid::new_v4().to_string(), now.clone(), now, validated);
    storage.entries.insert(0, created.clone());
    write_storage(&app, &storage)?;
    Ok(created)
}

#[tauri::command]
pub fn update_application(
    app: tauri::AppHandle,
    id: String,
    data: ApplicationInput,
) -> Result<ApplicationEntry, String> {
    let mut storage = read_storage(&app)?;
    let entry = storage
        .entries
        .iter_mut()
        .find(|entry| entry.id == id)
        .ok_or("Application not found".to_string())?;

    let validated = validate_application_input(data)?;
    let updated = build_entry(
        entry.id.clone(),
        entry.created_at.clone(),
        Utc::now().to_rfc3339(),
        validated,
    );
    *entry = updated.clone();
    write_storage(&app, &storage)?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_applications(app: tauri::AppHandle, ids: Vec<String>) -> Result<(), String> {
    let mut storage = read_storage(&app)?;
    let id_set: std::collections::HashSet<String> = ids.into_iter().collect();
    storage.entries.retain(|entry| !id_set.contains(&entry.id));
    write_storage(&app, &storage)
}

#[cfg(test)]
mod tests {
    use super::{validate_application_input, ApplicationInput, ApplicationStatus};

    fn valid_input() -> ApplicationInput {
        ApplicationInput {
            status: ApplicationStatus::Wishlist,
            company: "  Acme  ".to_string(),
            role: "  Rust Engineer  ".to_string(),
            jd_text: Some("  build desktop apps  ".to_string()),
            resume_id: Some(" resume-1 ".to_string()),
            resume_title: Some(" Resume A ".to_string()),
            url: Some(" https://example.com ".to_string()),
            applied_at: Some(" 2026-04-12 ".to_string()),
            notes: Some("  keep in touch  ".to_string()),
        }
    }

    #[test]
    fn validate_application_input_trims_fields() {
        let validated = validate_application_input(valid_input()).expect("input should validate");
        assert_eq!(validated.company, "Acme");
        assert_eq!(validated.role, "Rust Engineer");
        assert_eq!(validated.jd_text.as_deref(), Some("build desktop apps"));
        assert_eq!(validated.resume_id.as_deref(), Some("resume-1"));
    }

    #[test]
    fn validate_application_input_rejects_blank_company() {
        let mut input = valid_input();
        input.company = "   ".to_string();
        let error = validate_application_input(input).expect_err("blank company should fail");
        assert_eq!(error, "公司名称不能为空");
    }

    #[test]
    fn validate_application_input_rejects_blank_role() {
        let mut input = valid_input();
        input.role = " ".to_string();
        let error = validate_application_input(input).expect_err("blank role should fail");
        assert_eq!(error, "职位名称不能为空");
    }

    #[test]
    fn validate_application_input_drops_empty_optional_values() {
        let mut input = valid_input();
        input.notes = Some("   ".to_string());
        input.url = None;
        let validated = validate_application_input(input).expect("input should validate");
        assert!(validated.notes.is_none());
        assert!(validated.url.is_none());
    }
}
