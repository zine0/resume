use crate::resume::{
    validate_resume_data_or_error, CreateResumeLineageInput, ResumeData, ResumeLineage,
    ResumeVariantKind, StoredResume,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
struct StorageData {
    entries: Vec<StoredResume>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyStoredResume {
    id: String,
    created_at: String,
    updated_at: String,
    resume_data: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct LegacyStorageData {
    entries: Vec<LegacyStoredResume>,
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn normalize_lineage_for_entry(
    resume_id: &str,
    lineage: ResumeLineage,
) -> Result<ResumeLineage, String> {
    let variant_kind = lineage.variant_kind;
    let family_id = if lineage.family_id.trim().is_empty() {
        match variant_kind {
            ResumeVariantKind::Base => resume_id.to_string(),
            _ => {
                return Err("派生简历缺少 familyId，无法建立版本谱系".to_string());
            }
        }
    } else {
        lineage.family_id.trim().to_string()
    };

    let parent_resume_id = normalize_optional_string(lineage.parent_resume_id);
    let source_application_id = normalize_optional_string(lineage.source_application_id);

    if variant_kind != ResumeVariantKind::Base && parent_resume_id.is_none() {
        return Err("派生简历缺少 parentResumeId，无法建立版本谱系".to_string());
    }

    Ok(ResumeLineage {
        family_id,
        parent_resume_id,
        variant_kind,
        source_application_id,
    })
}

fn normalize_lineage_input(
    resume_id: &str,
    lineage: Option<CreateResumeLineageInput>,
) -> Result<ResumeLineage, String> {
    let lineage = lineage.unwrap_or_default();
    normalize_lineage_for_entry(
        resume_id,
        ResumeLineage {
            family_id: lineage.family_id.unwrap_or_default(),
            parent_resume_id: lineage.parent_resume_id,
            variant_kind: lineage.variant_kind.unwrap_or(ResumeVariantKind::Base),
            source_application_id: lineage.source_application_id,
        },
    )
}

fn normalize_stored_resume(mut entry: StoredResume) -> Result<StoredResume, String> {
    entry.lineage = normalize_lineage_for_entry(&entry.id, entry.lineage)?;
    Ok(entry)
}

fn data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to resolve app data dir")
}

fn storage_file(app: &tauri::AppHandle) -> PathBuf {
    data_dir(app).join("resumes.json")
}

fn read_storage(app: &tauri::AppHandle) -> Result<StorageData, String> {
    let path = storage_file(app);
    if !path.exists() {
        return Ok(StorageData { entries: vec![] });
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if let Ok(storage) = serde_json::from_str::<StorageData>(&content) {
        let entries = storage
            .entries
            .into_iter()
            .map(normalize_stored_resume)
            .collect::<Result<Vec<_>, String>>()?;
        return Ok(StorageData { entries });
    }

    let legacy = match serde_json::from_str::<LegacyStorageData>(&content) {
        Ok(storage) => storage,
        Err(_) => {
            return Err(
                "读取本地简历数据失败：存储文件格式无法识别，请先备份当前数据文件。".to_string(),
            )
        }
    };

    let entries = legacy
        .entries
        .into_iter()
        .map(|entry| {
            let entry_id = entry.id.clone();
            let mut resume_data: ResumeData = serde_json::from_value(entry.resume_data)
                .map_err(|_| format!("读取旧版简历失败：{} 的数据格式错误", entry_id))?;

            if !entry.created_at.trim().is_empty() {
                resume_data.created_at = entry.created_at.clone();
            }
            if !entry.updated_at.trim().is_empty() {
                resume_data.updated_at = entry.updated_at.clone();
            }

            let mut resume_data = validate_resume_data_or_error(resume_data)?;
            if !entry.created_at.trim().is_empty() {
                resume_data.created_at = entry.created_at.clone();
            }
            if !entry.updated_at.trim().is_empty() {
                resume_data.updated_at = entry.updated_at.clone();
            }

            Ok(StoredResume {
                id: entry.id,
                created_at: entry.created_at,
                updated_at: entry.updated_at,
                resume_data,
                lineage: normalize_lineage_input(&entry_id, None)?,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    Ok(StorageData { entries })
}

fn write_storage(app: &tauri::AppHandle, data: &StorageData) -> Result<(), String> {
    let path = storage_file(app);
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn build_new_entry_from_data(
    data: ResumeData,
    lineage: Option<CreateResumeLineageInput>,
) -> Result<StoredResume, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();
    let mut resume_data = validate_resume_data_or_error(data)?;
    resume_data.created_at = now.clone();
    resume_data.updated_at = now.clone();
    let lineage = normalize_lineage_input(&id, lineage)?;

    Ok(StoredResume {
        id,
        created_at: now.clone(),
        updated_at: now,
        resume_data,
        lineage,
    })
}

#[tauri::command]
pub fn get_all_resumes(app: tauri::AppHandle) -> Result<Vec<StoredResume>, String> {
    Ok(read_storage(&app)?.entries)
}

#[tauri::command]
pub fn get_resume_by_id(app: tauri::AppHandle, id: String) -> Result<Option<StoredResume>, String> {
    Ok(read_storage(&app)?.entries.into_iter().find(|e| e.id == id))
}

#[tauri::command]
pub fn create_resume(app: tauri::AppHandle, entry: StoredResume) -> Result<StoredResume, String> {
    let mut storage = read_storage(&app)?;
    let now = chrono::Utc::now().to_rfc3339();
    let mut created = entry;
    if created.created_at.trim().is_empty() {
        created.created_at = now.clone();
    }
    created.updated_at = now;

    let mut resume_data = validate_resume_data_or_error(created.resume_data)?;
    resume_data.created_at = created.created_at.clone();
    resume_data.updated_at = created.updated_at.clone();
    created.resume_data = resume_data;
    created.lineage = normalize_lineage_for_entry(&created.id, created.lineage)?;

    storage.entries.insert(0, created.clone());
    write_storage(&app, &storage)?;
    Ok(created)
}

#[tauri::command]
pub fn create_resume_from_data(
    app: tauri::AppHandle,
    data: ResumeData,
    lineage: Option<CreateResumeLineageInput>,
) -> Result<StoredResume, String> {
    let mut storage = read_storage(&app)?;
    let created = build_new_entry_from_data(data, lineage)?;
    storage.entries.insert(0, created.clone());
    write_storage(&app, &storage)?;
    Ok(created)
}

#[tauri::command]
pub fn update_resume(
    app: tauri::AppHandle,
    id: String,
    data: ResumeData,
) -> Result<StoredResume, String> {
    let mut storage = read_storage(&app)?;
    let entry = storage
        .entries
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or("Resume not found".to_string())?;

    let mut resume_data = validate_resume_data_or_error(data)?;
    resume_data.created_at = if entry.resume_data.created_at.trim().is_empty() {
        entry.created_at.clone()
    } else {
        entry.resume_data.created_at.clone()
    };
    entry.updated_at = chrono::Utc::now().to_rfc3339();
    resume_data.updated_at = entry.updated_at.clone();
    entry.resume_data = resume_data;

    let updated = entry.clone();
    write_storage(&app, &storage)?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_resumes(app: tauri::AppHandle, ids: Vec<String>) -> Result<(), String> {
    let mut storage = read_storage(&app)?;
    let id_set: std::collections::HashSet<String> = ids.into_iter().collect();
    storage.entries.retain(|e| !id_set.contains(&e.id));
    write_storage(&app, &storage)
}

#[cfg(test)]
mod tests {
    use super::{build_new_entry_from_data, normalize_stored_resume};
    use crate::resume::{
        build_default_resume_data, CreateResumeLineageInput, ResumeLineage, ResumeVariantKind,
        StoredResume,
    };

    #[test]
    fn normalizes_legacy_resume_without_lineage_to_base_family() {
        let normalized = normalize_stored_resume(StoredResume {
            id: "resume-1".to_string(),
            created_at: "2026-04-14T00:00:00Z".to_string(),
            updated_at: "2026-04-14T00:00:00Z".to_string(),
            resume_data: build_default_resume_data(),
            lineage: ResumeLineage::default(),
        })
        .expect("legacy resume should normalize");

        assert_eq!(normalized.lineage.variant_kind, ResumeVariantKind::Base);
        assert_eq!(normalized.lineage.family_id, normalized.id);
        assert_eq!(normalized.lineage.parent_resume_id, None);
    }

    #[test]
    fn creates_child_resume_with_preserved_family_and_parent() {
        let created = build_new_entry_from_data(
            build_default_resume_data(),
            Some(CreateResumeLineageInput {
                family_id: Some("family-1".to_string()),
                parent_resume_id: Some("parent-1".to_string()),
                variant_kind: Some(ResumeVariantKind::Clone),
                source_application_id: None,
            }),
        )
        .expect("child resume should be created");

        assert_eq!(created.lineage.family_id, "family-1");
        assert_eq!(
            created.lineage.parent_resume_id.as_deref(),
            Some("parent-1")
        );
        assert_eq!(created.lineage.variant_kind, ResumeVariantKind::Clone);
    }

    #[test]
    fn persists_source_application_id_for_jd_tailored_resume() {
        let created = build_new_entry_from_data(
            build_default_resume_data(),
            Some(CreateResumeLineageInput {
                family_id: Some("family-1".to_string()),
                parent_resume_id: Some("parent-1".to_string()),
                variant_kind: Some(ResumeVariantKind::JdTailored),
                source_application_id: Some("app-1".to_string()),
            }),
        )
        .expect("jd tailored resume should be created");

        assert_eq!(created.lineage.variant_kind, ResumeVariantKind::JdTailored);
        assert_eq!(
            created.lineage.source_application_id.as_deref(),
            Some("app-1")
        );
    }

    #[test]
    fn defaults_manual_creation_to_base_lineage() {
        let created = build_new_entry_from_data(build_default_resume_data(), None)
            .expect("manual resume should be created");

        assert_eq!(created.lineage.variant_kind, ResumeVariantKind::Base);
        assert_eq!(created.lineage.family_id, created.id);
        assert_eq!(created.lineage.parent_resume_id, None);
    }
}
