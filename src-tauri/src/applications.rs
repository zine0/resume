use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
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

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ApplicationReminderStatus {
    Pending,
    Completed,
    Snoozed,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ApplicationReviewStatus {
    Active,
    Waiting,
    Blocked,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_channel: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_contact_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub follow_up_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reminder_status: Option<ApplicationReminderStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interview_stage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interview_round: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub review_status: Option<ApplicationReviewStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocked_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
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
    pub source: Option<String>,
    #[serde(default)]
    pub contact_name: Option<String>,
    #[serde(default)]
    pub contact_channel: Option<String>,
    #[serde(default)]
    pub last_contact_at: Option<String>,
    #[serde(default)]
    pub next_action: Option<String>,
    #[serde(default)]
    pub follow_up_date: Option<String>,
    #[serde(default)]
    pub reminder_status: Option<ApplicationReminderStatus>,
    #[serde(default)]
    pub interview_stage: Option<String>,
    #[serde(default)]
    pub interview_round: Option<String>,
    #[serde(default)]
    pub review_status: Option<ApplicationReviewStatus>,
    #[serde(default)]
    pub blocked_reason: Option<String>,
    #[serde(default)]
    pub result: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ApplicationStorageData {
    entries: Vec<ApplicationEntry>,
}

fn data_dir(app: &tauri::AppHandle) -> PathBuf {
    crate::persist::app_data_dir(app)
}

fn storage_file(app: &tauri::AppHandle) -> PathBuf {
    data_dir(app).join("applications.json")
}

fn read_storage(app: &tauri::AppHandle) -> Result<ApplicationStorageData, String> {
    let path = storage_file(app);
    crate::persist::read_json_or(&path, ApplicationStorageData { entries: vec![] })
        .map_err(|_| "读取求职记录失败：存储文件格式无法识别，请先备份当前数据文件。".to_string())
}

fn write_storage(app: &tauri::AppHandle, data: &ApplicationStorageData) -> Result<(), String> {
    let path = storage_file(app);
    crate::persist::write_json_atomic(&path, data)
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

    let interview_stage = sanitize_optional_text(input.interview_stage);
    let interview_round = sanitize_optional_text(input.interview_round);
    let (interview_stage, interview_round) = match input.status {
        ApplicationStatus::Interview => (interview_stage, interview_round),
        _ => (None, None),
    };

    let review_status = input.review_status;
    let blocked_reason = sanitize_optional_text(input.blocked_reason);
    let blocked_reason = match review_status {
        Some(ApplicationReviewStatus::Blocked) => blocked_reason,
        _ => None,
    };

    Ok(ApplicationInput {
        status: input.status,
        company,
        role,
        jd_text: sanitize_optional_text(input.jd_text),
        resume_id: sanitize_optional_text(input.resume_id),
        resume_title: sanitize_optional_text(input.resume_title),
        url: sanitize_optional_text(input.url),
        applied_at: sanitize_optional_text(input.applied_at),
        source: sanitize_optional_text(input.source),
        contact_name: sanitize_optional_text(input.contact_name),
        contact_channel: sanitize_optional_text(input.contact_channel),
        last_contact_at: sanitize_optional_text(input.last_contact_at),
        next_action: sanitize_optional_text(input.next_action),
        follow_up_date: sanitize_optional_text(input.follow_up_date),
        reminder_status: input.reminder_status,
        interview_stage,
        interview_round,
        review_status,
        blocked_reason,
        result: sanitize_optional_text(input.result),
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
        source: input.source,
        contact_name: input.contact_name,
        contact_channel: input.contact_channel,
        last_contact_at: input.last_contact_at,
        next_action: input.next_action,
        follow_up_date: input.follow_up_date,
        reminder_status: input.reminder_status,
        interview_stage: input.interview_stage,
        interview_round: input.interview_round,
        review_status: input.review_status,
        blocked_reason: input.blocked_reason,
        result: input.result,
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
    use super::{
        validate_application_input, ApplicationInput, ApplicationReminderStatus,
        ApplicationReviewStatus, ApplicationStatus,
    };

    fn valid_input() -> ApplicationInput {
        ApplicationInput {
            status: ApplicationStatus::Interview,
            company: "  Acme  ".to_string(),
            role: "  Rust Engineer  ".to_string(),
            jd_text: Some("  build desktop apps  ".to_string()),
            resume_id: Some(" resume-1 ".to_string()),
            resume_title: Some(" Resume A ".to_string()),
            url: Some(" https://example.com ".to_string()),
            applied_at: Some(" 2026-04-12 ".to_string()),
            source: Some(" Boss 直聘 ".to_string()),
            contact_name: Some(" Alice ".to_string()),
            contact_channel: Some(" 微信 ".to_string()),
            last_contact_at: Some(" 2026-04-13 ".to_string()),
            next_action: Some(" send follow-up email ".to_string()),
            follow_up_date: Some(" 2026-04-18 ".to_string()),
            reminder_status: Some(ApplicationReminderStatus::Pending),
            interview_stage: Some(" 技术面 ".to_string()),
            interview_round: Some(" 第 2 轮 ".to_string()),
            review_status: Some(ApplicationReviewStatus::Blocked),
            blocked_reason: Some(" waiting for recruiter reply ".to_string()),
            result: Some(" in progress ".to_string()),
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
        assert_eq!(validated.source.as_deref(), Some("Boss 直聘"));
        assert_eq!(validated.contact_name.as_deref(), Some("Alice"));
        assert_eq!(validated.contact_channel.as_deref(), Some("微信"));
        assert_eq!(validated.last_contact_at.as_deref(), Some("2026-04-13"));
        assert_eq!(
            validated.next_action.as_deref(),
            Some("send follow-up email")
        );
        assert_eq!(validated.follow_up_date.as_deref(), Some("2026-04-18"));
        assert_eq!(validated.interview_stage.as_deref(), Some("技术面"));
        assert_eq!(validated.interview_round.as_deref(), Some("第 2 轮"));
        assert_eq!(
            validated.blocked_reason.as_deref(),
            Some("waiting for recruiter reply")
        );
        assert_eq!(validated.result.as_deref(), Some("in progress"));
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
        input.next_action = Some("  ".to_string());
        input.follow_up_date = Some(" ".to_string());
        input.interview_stage = Some("  ".to_string());
        input.interview_round = Some(" ".to_string());
        input.contact_channel = Some("   ".to_string());
        input.blocked_reason = Some(" ".to_string());
        input.result = Some("  ".to_string());
        input.url = None;
        let validated = validate_application_input(input).expect("input should validate");
        assert!(validated.notes.is_none());
        assert!(validated.next_action.is_none());
        assert!(validated.follow_up_date.is_none());
        assert!(validated.interview_stage.is_none());
        assert!(validated.interview_round.is_none());
        assert!(validated.contact_channel.is_none());
        assert!(validated.blocked_reason.is_none());
        assert!(validated.result.is_none());
        assert!(validated.url.is_none());
    }

    #[test]
    fn validate_application_input_clears_interview_fields_for_non_interview_status() {
        let mut input = valid_input();
        input.status = ApplicationStatus::Offer;
        let validated = validate_application_input(input).expect("input should validate");
        assert!(validated.interview_stage.is_none());
        assert!(validated.interview_round.is_none());
    }

    #[test]
    fn validate_application_input_clears_blocked_reason_when_not_blocked() {
        let mut input = valid_input();
        input.review_status = Some(ApplicationReviewStatus::Waiting);
        let validated = validate_application_input(input).expect("input should validate");
        assert_eq!(
            validated.review_status,
            Some(ApplicationReviewStatus::Waiting)
        );
        assert!(validated.blocked_reason.is_none());
    }
}
