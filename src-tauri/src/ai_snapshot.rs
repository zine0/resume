use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

use crate::ai_service::{
    AiPatchContentKind, AiPatchOperation, AiPatchTargetKind,
};
use crate::resume::{
    JobIntentionType, ModuleContentRowType, PersonalInfoItem, PersonalInfoValueType, ResumeData,
    SalaryRange,
};

const RESUME_TITLE_TARGET_ID: &str = "__resume_title__";

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EditableTargetSnapshot {
    pub id: String,
    pub target_kind: AiPatchTargetKind,
    pub section: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_kind: Option<AiPatchContentKind>,
    pub original_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub salary_range: Option<SalaryRange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_type: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ResumeOptimizationSnapshot {
    pub targets: Vec<EditableTargetSnapshot>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OptimizationResponse {
    #[serde(default)]
    pub operations: Vec<AiPatchOperation>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct JdAnalysisResponse {
    pub match_score: i64,
    #[serde(default)]
    pub missing_keywords: Vec<String>,
    #[serde(default)]
    pub matched_keywords: Vec<String>,
    #[serde(default)]
    pub suggestions: Vec<crate::ai_service::AiJdAnalysisSuggestion>,
    pub summary: String,
}

#[derive(Debug, Default)]
pub(crate) struct PatchValidationSummary {
    pub missing_title: bool,
    pub missing_personal_info_count: usize,
    pub missing_job_intention_count: usize,
    pub missing_module_element_count: usize,
    pub missing_module_tag_count: usize,
    pub unknown_id_count: usize,
    pub invalid_content_count: usize,
}

pub(crate) fn strip_code_fences(raw: &str) -> String {
    raw.replace("```json", "")
        .replace("```JSON", "")
        .replace("```", "")
        .trim()
        .to_string()
}

pub(crate) fn expected_content_kind_for_target(target: &EditableTargetSnapshot) -> AiPatchContentKind {
    target
        .content_kind
        .clone()
        .unwrap_or(AiPatchContentKind::Plain)
}

pub(crate) fn parse_salary_range(text: &str) -> Option<SalaryRange> {
    let numbers = text
        .split(|ch: char| !ch.is_ascii_digit())
        .filter(|segment| !segment.is_empty())
        .filter_map(|segment| segment.parse::<f64>().ok())
        .collect::<Vec<_>>();

    if numbers.is_empty() {
        return None;
    }

    if numbers.len() == 1 {
        let value = numbers[0];
        if ['\u{8d77}', '\u{4ee5}', '\u{4e0a}'].iter().any(|needle| text.contains(*needle)) {
            return Some(SalaryRange {
                min: Some(value),
                max: None,
            });
        }

        if ['\u{4e0b}', '\u{5185}'].iter().any(|needle| text.contains(*needle)) {
            return Some(SalaryRange {
                min: None,
                max: Some(value),
            });
        }

        return Some(SalaryRange {
            min: Some(value),
            max: None,
        });
    }

    Some(SalaryRange {
        min: Some(numbers[0].min(numbers[1])),
        max: Some(numbers[0].max(numbers[1])),
    })
}

pub(crate) fn build_optimized_title(title: &str) -> String {
    if title.contains("\u{4f18}\u{5316}\u{7248}") {
        title.to_string()
    } else {
        format!("{} - \u{4f18}\u{5316}\u{7248}", title)
    }
}

pub(crate) fn build_tailored_title(title: &str) -> String {
    if title.contains("JD\u{5b9a}\u{5236}\u{7248}") {
        title.to_string()
    } else {
        format!("{} - JD\u{5b9a}\u{5236}\u{7248}", title)
    }
}

fn protected_personal_info_label_re(label: &str) -> bool {
    let lower = label.to_lowercase();
    lower.contains("\u{90ae}\u{7bb1}")
        || lower.contains("\u{90ae}\u{4ef6}")
        || lower.contains("mail")
        || lower.contains("e-mail")
        || lower.contains("\u{624b}\u{673a}")
        || lower.contains("\u{7535}\u{8bdd}")
        || lower.contains("tel")
        || lower.contains("\u{5fae}\u{4fe1}")
        || lower.contains("wechat")
        || lower.contains("github")
        || lower.contains("gitlab")
        || lower.contains("\u{535a}\u{5ba2}")
        || lower.contains("blog")
        || lower.contains("\u{4e3b}\u{9875}")
        || lower.contains("\u{7f51}\u{7ad9}")
        || lower.contains("\u{94fe}\u{63a5}")
        || lower.contains("link")
        || lower.contains("url")
        || lower.contains("\u{5730}\u{5740}")
        || lower.contains("portfolio")
        || lower.contains("\u{7f51}\u{5740}")
}

fn is_protected_personal_info(item: &PersonalInfoItem) -> bool {
    item.value.value_type == Some(PersonalInfoValueType::Link)
        || protected_personal_info_label_re(&item.label)
}

fn extract_text(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(text) => text.clone(),
        Value::Array(items) => items.iter().map(extract_text).collect::<Vec<_>>().join(""),
        Value::Object(map) => {
            if map.get("type").and_then(Value::as_str) == Some("hardBreak") {
                return "\n".to_string();
            }
            if map.get("type").and_then(Value::as_str) == Some("text") {
                return map
                    .get("text")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
            }
            map.get("content").map(extract_text).unwrap_or_default()
        }
        other => other.to_string(),
    }
}

pub(crate) fn build_resume_text(data: &ResumeData) -> String {
    let mut lines = Vec::new();

    lines.push(format!("\u{3010}\u{7b80}\u{5386}\u{6807}\u{9898}\u{3011}{}", data.title));
    lines.push(String::new());

    if !data.personal_info_section.personal_info.is_empty() {
        lines.push("\u{3010}\u{4e2a}\u{4eba}\u{4fe1}\u{606f}\u{3011}".to_string());
        for item in &data.personal_info_section.personal_info {
            lines.push(format!("  {}: {}", item.label, item.value.content));
        }
        lines.push(String::new());
    }

    if let Some(job_intention) = data.job_intention_section.as_ref().filter(|section| section.enabled) {
        if !job_intention.items.is_empty() {
            lines.push("\u{3010}\u{6c42}\u{804c}\u{610f}\u{5411}\u{3011}".to_string());
            for item in &job_intention.items {
                if item.item_type == JobIntentionType::Salary {
                    if let Some(range) = &item.salary_range {
                        let min = range.min.map(|value| value.to_string()).unwrap_or_default();
                        let max = range.max.map(|value| value.to_string()).unwrap_or_default();
                        lines.push(format!("  {}: {}K-{}K", item.label, min, max));
                        continue;
                    }
                }
                lines.push(format!("  {}: {}", item.label, item.value));
            }
            lines.push(String::new());
        }
    }

    for module in &data.modules {
        lines.push(format!("\u{3010}{}\u{3011}", module.title));
        for row in &module.rows {
            if row.row_type == Some(ModuleContentRowType::Tags) {
                if let Some(tags) = &row.tags {
                    if !tags.is_empty() {
                        lines.push(format!("  \u{6807}\u{7b7e}: {}", tags.join(", ")));
                    }
                }
                continue;
            }

            let row_text = row
                .elements
                .iter()
                .map(|element| extract_text(&element.content))
                .filter(|text| !text.trim().is_empty())
                .collect::<Vec<_>>()
                .join(" | ");

            if !row_text.is_empty() {
                lines.push(format!("  {}", row_text));
            }
        }
        lines.push(String::new());
    }

    lines.join("\n")
}

pub(crate) fn build_editable_snapshot(data: &ResumeData) -> ResumeOptimizationSnapshot {
    let mut targets = vec![EditableTargetSnapshot {
        id: RESUME_TITLE_TARGET_ID.to_string(),
        target_kind: AiPatchTargetKind::ResumeTitle,
        section: "\u{7b80}\u{5386}\u{6807}\u{9898}".to_string(),
        field: None,
        content_kind: Some(AiPatchContentKind::Plain),
        original_text: data.title.clone(),
        tags: None,
        salary_range: None,
        item_type: None,
    }];

    targets.extend(
        data.personal_info_section
            .personal_info
            .iter()
            .filter(|item| !is_protected_personal_info(item))
            .map(|item| EditableTargetSnapshot {
                id: item.id.clone(),
                target_kind: AiPatchTargetKind::PersonalInfo,
                section: "\u{4e2a}\u{4eba}\u{4fe1}\u{606f}".to_string(),
                field: Some(item.label.clone()),
                content_kind: Some(AiPatchContentKind::Plain),
                original_text: item.value.content.clone(),
                tags: None,
                salary_range: None,
                item_type: None,
            }),
    );

    if let Some(job_intention) = data.job_intention_section.as_ref().filter(|section| section.enabled) {
        targets.extend(job_intention.items.iter().map(|item| EditableTargetSnapshot {
            id: item.id.clone(),
            target_kind: AiPatchTargetKind::JobIntention,
            section: "\u{6c42}\u{804c}\u{610f}\u{5411}".to_string(),
            field: Some(item.label.clone()),
            content_kind: Some(if item.item_type == JobIntentionType::Salary {
                AiPatchContentKind::Salary
            } else {
                AiPatchContentKind::Plain
            }),
            original_text: item.value.clone(),
            tags: None,
            salary_range: item.salary_range.clone(),
            item_type: Some(match item.item_type {
                JobIntentionType::WorkYears => "workYears",
                JobIntentionType::Position => "position",
                JobIntentionType::City => "city",
                JobIntentionType::Salary => "salary",
                JobIntentionType::Custom => "custom",
            }
            .to_string()),
        }));
    }

    for module in &data.modules {
        for row in &module.rows {
            if row.row_type == Some(ModuleContentRowType::Tags) {
                if let Some(tags) = &row.tags {
                    if !tags.is_empty() {
                        targets.push(EditableTargetSnapshot {
                            id: row.id.clone(),
                            target_kind: AiPatchTargetKind::ModuleTags,
                            section: module.title.clone(),
                            field: Some("\u{6807}\u{7b7e}".to_string()),
                            content_kind: Some(AiPatchContentKind::Tags),
                            original_text: tags.join(", "),
                            tags: Some(tags.clone()),
                            salary_range: None,
                            item_type: None,
                        });
                    }
                }
                continue;
            }

            for element in &row.elements {
                let text = extract_text(&element.content);
                if text.trim().is_empty() {
                    continue;
                }
                targets.push(EditableTargetSnapshot {
                    id: element.id.clone(),
                    target_kind: AiPatchTargetKind::ModuleElement,
                    section: module.title.clone(),
                    field: None,
                    content_kind: Some(AiPatchContentKind::Markdown),
                    original_text: text,
                    tags: None,
                    salary_range: None,
                    item_type: None,
                });
            }
        }
    }

    ResumeOptimizationSnapshot { targets }
}

pub(crate) fn validate_patch_operations(
    snapshot: &ResumeOptimizationSnapshot,
    operations: Vec<AiPatchOperation>,
) -> (Vec<AiPatchOperation>, PatchValidationSummary) {
    let target_map = snapshot
        .targets
        .iter()
        .map(|target| ((target.target_kind.clone(), target.id.clone()), target))
        .collect::<HashMap<_, _>>();

    let expected_personal_info = snapshot
        .targets
        .iter()
        .filter(|target| target.target_kind == AiPatchTargetKind::PersonalInfo)
        .count();
    let expected_job_intention = snapshot
        .targets
        .iter()
        .filter(|target| target.target_kind == AiPatchTargetKind::JobIntention)
        .count();
    let expected_module_elements = snapshot
        .targets
        .iter()
        .filter(|target| target.target_kind == AiPatchTargetKind::ModuleElement)
        .count();
    let expected_module_tags = snapshot
        .targets
        .iter()
        .filter(|target| target.target_kind == AiPatchTargetKind::ModuleTags)
        .count();

    let mut summary = PatchValidationSummary::default();
    let mut seen = HashSet::new();
    let mut valid = Vec::new();

    for operation in operations {
        let key = (operation.target_kind.clone(), operation.target_id.clone());
        let Some(target) = target_map.get(&key) else {
            summary.unknown_id_count += 1;
            continue;
        };

        if operation.content_kind != expected_content_kind_for_target(target) {
            summary.invalid_content_count += 1;
            continue;
        }

        let content_is_valid = match operation.content_kind {
            AiPatchContentKind::Plain | AiPatchContentKind::Markdown => operation
                .text
                .as_ref()
                .map(|text| !text.trim().is_empty())
                .unwrap_or(false),
            AiPatchContentKind::Tags => operation
                .tags
                .as_ref()
                .map(|tags| tags.iter().any(|tag| !tag.trim().is_empty()))
                .unwrap_or(false),
            AiPatchContentKind::Salary => operation
                .text
                .as_ref()
                .map(|text| !text.trim().is_empty())
                .unwrap_or(false),
        };

        if !content_is_valid {
            summary.invalid_content_count += 1;
            continue;
        }

        if operation.content_kind == AiPatchContentKind::Salary && operation.salary_range.is_none() {
            let parsed = operation.text.as_deref().and_then(parse_salary_range);
            if let Some(range) = parsed {
                valid.push(AiPatchOperation {
                    salary_range: Some(range),
                    ..operation.clone()
                });
            } else {
                summary.invalid_content_count += 1;
            }
        } else {
            valid.push(operation.clone());
        }

        seen.insert(key);
    }

    summary.missing_title = !seen.contains(&(AiPatchTargetKind::ResumeTitle, RESUME_TITLE_TARGET_ID.to_string()));
    summary.missing_personal_info_count = snapshot
        .targets
        .iter()
        .filter(|target| target.target_kind == AiPatchTargetKind::PersonalInfo)
        .filter(|target| !seen.contains(&(target.target_kind.clone(), target.id.clone())))
        .count();
    summary.missing_job_intention_count = snapshot
        .targets
        .iter()
        .filter(|target| target.target_kind == AiPatchTargetKind::JobIntention)
        .filter(|target| !seen.contains(&(target.target_kind.clone(), target.id.clone())))
        .count();
    summary.missing_module_element_count = snapshot
        .targets
        .iter()
        .filter(|target| target.target_kind == AiPatchTargetKind::ModuleElement)
        .filter(|target| !seen.contains(&(target.target_kind.clone(), target.id.clone())))
        .count();
    summary.missing_module_tag_count = snapshot
        .targets
        .iter()
        .filter(|target| target.target_kind == AiPatchTargetKind::ModuleTags)
        .filter(|target| !seen.contains(&(target.target_kind.clone(), target.id.clone())))
        .count();

    if expected_personal_info == 0 {
        summary.missing_personal_info_count = 0;
    }
    if expected_job_intention == 0 {
        summary.missing_job_intention_count = 0;
    }
    if expected_module_elements == 0 {
        summary.missing_module_element_count = 0;
    }
    if expected_module_tags == 0 {
        summary.missing_module_tag_count = 0;
    }

    (valid, summary)
}

pub(crate) fn build_optimization_warnings(data: &ResumeData, summary: &PatchValidationSummary) -> Vec<String> {
    let protected_personal_info_count = data
        .personal_info_section
        .personal_info
        .iter()
        .filter(|item| is_protected_personal_info(item))
        .count();
    let mut warnings = Vec::new();

    if protected_personal_info_count > 0 {
        warnings.push(format!(
            "\u{5df2}\u{4fdd}\u{7559} {} \u{9879}\u{8054}\u{7cfb}\u{65b9}\u{5f0f}/\u{94fe}\u{63a5}\u{7b49}\u{4e8b}\u{5b9e}\u{4fe1}\u{606f}\u{ff0c}\u{4e0d}\u{53c2}\u{4e0e} AI \u{6539}\u{5199}\u{3002}",
            protected_personal_info_count
        ));
    }

    let missing_total = usize::from(summary.missing_title)
        + summary.missing_personal_info_count
        + summary.missing_job_intention_count
        + summary.missing_module_element_count
        + summary.missing_module_tag_count;

    if missing_total > 0 {
        warnings.push(format!(
            "AI \u{672a}\u{5b8c}\u{6574}\u{8fd4}\u{56de} {} \u{9879}\u{5185}\u{5bb9}\u{ff0c}\u{8fd9}\u{4e9b}\u{90e8}\u{5206}\u{5df2}\u{4fdd}\u{7559}\u{539f}\u{6587}\u{3002}",
            missing_total
        ));
    }

    if summary.unknown_id_count > 0 {
        warnings.push(format!(
            "AI \u{8fd4}\u{56de}\u{4e86} {} \u{4e2a}\u{65e0}\u{6cd5}\u{8bc6}\u{522b}\u{7684}\u{6761}\u{76ee}\u{ff0c}\u{7cfb}\u{7edf}\u{5df2}\u{5ffd}\u{7565}\u{3002}",
            summary.unknown_id_count
        ));
    }

    if summary.invalid_content_count > 0 {
        warnings.push(format!(
            "AI \u{8fd4}\u{56de}\u{4e86} {} \u{6761}\u{65e0}\u{6548}\u{8865}\u{4e01}\u{ff0c}\u{7cfb}\u{7edf}\u{5df2}\u{5ffd}\u{7565}\u{3002}",
            summary.invalid_content_count
        ));
    }

    warnings
}

pub(crate) fn ensure_title_operation(operations: &mut Vec<AiPatchOperation>, title: String) {
    if operations.iter().any(|operation| {
        operation.target_kind == AiPatchTargetKind::ResumeTitle
            && operation.target_id == RESUME_TITLE_TARGET_ID
    }) {
        return;
    }

    operations.insert(
        0,
        AiPatchOperation {
            target_kind: AiPatchTargetKind::ResumeTitle,
            target_id: RESUME_TITLE_TARGET_ID.to_string(),
            content_kind: AiPatchContentKind::Plain,
            text: Some(title),
            tags: None,
            salary_range: None,
        },
    );
}
