use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

use crate::ai_config::{load_ai_config, AIConfig};
use crate::resume::{
    JobIntentionType, ModuleContentRowType, PersonalInfoItem, PersonalInfoValueType, ResumeData,
    SalaryRange,
};

const RESUME_TITLE_TARGET_ID: &str = "__resume_title__";
const JD_SUGGESTION_MODULE_TITLE: &str = "JD \u{5b9a}\u{5236}\u{5efa}\u{8bae}";

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PolishMode {
    Polish,
    Expand,
    Shorten,
    TranslateEn,
    TranslateZh,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum AiPatchTargetKind {
    ResumeTitle,
    PersonalInfo,
    JobIntention,
    ModuleElement,
    ModuleTags,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AiPatchContentKind {
    Plain,
    Markdown,
    Tags,
    Salary,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiPatchOperation {
    pub target_kind: AiPatchTargetKind,
    pub target_id: String,
    pub content_kind: AiPatchContentKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub salary_range: Option<SalaryRange>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiResumePatch {
    pub operations: Vec<AiPatchOperation>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiPolishTextResult {
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiJdAnalysisSuggestion {
    pub section: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    pub original_text: String,
    pub suggested_text: String,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_kind: Option<AiPatchTargetKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_id: Option<String>,
    pub content_kind: AiPatchContentKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub salary_range: Option<SalaryRange>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiJdAnalysisResult {
    pub match_score: i64,
    pub missing_keywords: Vec<String>,
    pub matched_keywords: Vec<String>,
    pub suggestions: Vec<AiJdAnalysisSuggestion>,
    pub summary: String,
    pub patch: AiResumePatch,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiRewriteForJdResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<AiJdAnalysisSuggestion>,
    pub patch: AiResumePatch,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f64,
    max_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ChatResponseMessage {
    content: Value,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct EditableTargetSnapshot {
    id: String,
    target_kind: AiPatchTargetKind,
    section: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content_kind: Option<AiPatchContentKind>,
    original_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    salary_range: Option<SalaryRange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    item_type: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResumeOptimizationSnapshot {
    targets: Vec<EditableTargetSnapshot>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OptimizationResponse {
    #[serde(default)]
    operations: Vec<AiPatchOperation>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JdAnalysisResponse {
    match_score: i64,
    #[serde(default)]
    missing_keywords: Vec<String>,
    #[serde(default)]
    matched_keywords: Vec<String>,
    #[serde(default)]
    suggestions: Vec<AiJdAnalysisSuggestion>,
    summary: String,
}

#[derive(Debug, Default)]
struct PatchValidationSummary {
    missing_title: bool,
    missing_personal_info_count: usize,
    missing_job_intention_count: usize,
    missing_module_element_count: usize,
    missing_module_tag_count: usize,
    unknown_id_count: usize,
    invalid_content_count: usize,
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

fn is_simple_text_content(value: &Value) -> bool {
    match value {
        Value::Object(map) => {
            if map.get("type").and_then(Value::as_str) == Some("text") {
                return !map
                    .get("marks")
                    .and_then(Value::as_array)
                    .map(|marks| !marks.is_empty())
                    .unwrap_or(false);
            }

            if map.get("type").and_then(Value::as_str) == Some("hardBreak") {
                return true;
            }

            match map.get("content") {
                Some(Value::Array(items)) => items.iter().all(is_simple_text_content),
                Some(content) => is_simple_text_content(content),
                None => matches!(
                    map.get("type").and_then(Value::as_str),
                    Some("paragraph") | Some("doc")
                ),
            }
        }
        Value::Array(items) => items.iter().all(is_simple_text_content),
        _ => false,
    }
}

fn parse_salary_range(text: &str) -> Option<SalaryRange> {
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

fn build_optimized_title(title: &str) -> String {
    if title.contains("\u{4f18}\u{5316}\u{7248}") {
        title.to_string()
    } else {
        format!("{} - \u{4f18}\u{5316}\u{7248}", title)
    }
}

fn build_tailored_title(title: &str) -> String {
    if title.contains("JD\u{5b9a}\u{5236}\u{7248}") {
        title.to_string()
    } else {
        format!("{} - JD\u{5b9a}\u{5236}\u{7248}", title)
    }
}

fn is_protected_personal_info(item: &PersonalInfoItem) -> bool {
    item.value.value_type == Some(PersonalInfoValueType::Link)
        || protected_personal_info_label_re(&item.label)
}

fn build_resume_text(data: &ResumeData) -> String {
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

fn build_editable_snapshot(data: &ResumeData) -> ResumeOptimizationSnapshot {
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
                if is_simple_text_content(&element.content) {
                    let text = extract_text(&element.content);
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
    }

    ResumeOptimizationSnapshot { targets }
}

fn strip_code_fences(raw: &str) -> String {
    raw.replace("```json", "")
        .replace("```JSON", "")
        .replace("```", "")
        .trim()
        .to_string()
}

fn expected_content_kind_for_target(target: &EditableTargetSnapshot) -> AiPatchContentKind {
    target
        .content_kind
        .clone()
        .unwrap_or(AiPatchContentKind::Plain)
}

fn validate_patch_operations(
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

fn build_optimization_warnings(data: &ResumeData, summary: &PatchValidationSummary) -> Vec<String> {
    let protected_personal_info_count = data
        .personal_info_section
        .personal_info
        .iter()
        .filter(|item| is_protected_personal_info(item))
        .count();
    let skipped_complex_module_element_count = data
        .modules
        .iter()
        .flat_map(|module| module.rows.iter())
        .filter(|row| row.row_type != Some(ModuleContentRowType::Tags))
        .flat_map(|row| row.elements.iter())
        .filter(|element| !is_simple_text_content(&element.content))
        .count();

    let mut warnings = Vec::new();

    if protected_personal_info_count > 0 {
        warnings.push(format!(
            "\u{5df2}\u{4fdd}\u{7559} {} \u{9879}\u{8054}\u{7cfb}\u{65b9}\u{5f0f}/\u{94fe}\u{63a5}\u{7b49}\u{4e8b}\u{5b9e}\u{4fe1}\u{606f}\u{ff0c}\u{4e0d}\u{53c2}\u{4e0e} AI \u{6539}\u{5199}\u{3002}",
            protected_personal_info_count
        ));
    }

    if skipped_complex_module_element_count > 0 {
        warnings.push(format!(
            "\u{5df2}\u{4fdd}\u{7559} {} \u{5904}\u{590d}\u{6742}\u{5bcc}\u{6587}\u{672c}\u{7ed3}\u{6784}\u{ff0c}\u{907f}\u{514d}\u{7834}\u{574f}\u{539f}\u{6709}\u{683c}\u{5f0f}\u{3002}",
            skipped_complex_module_element_count
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

async fn chat_completion(
    config: &AIConfig,
    messages: Vec<ChatMessage>,
    temperature: f64,
    max_tokens: u32,
) -> Result<String, String> {
    let client = Client::new();
    let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));
    let response = client
        .post(url)
        .bearer_auth(config.api_key.trim())
        .json(&ChatCompletionRequest {
            model: config.model.clone(),
            messages,
            temperature,
            max_tokens,
        })
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "AI API \u{8bf7}\u{6c42}\u{5931}\u{8d25} ({}): {}",
            status,
            if body.is_empty() {
                status
                    .canonical_reason()
                    .unwrap_or("unknown error")
                    .to_string()
            } else {
                body
            }
        ));
    }

    let data = response
        .json::<ChatCompletionResponse>()
        .await
        .map_err(|error| error.to_string())?;
    let content = data
        .choices
        .first()
        .map(|choice| &choice.message.content)
        .ok_or_else(|| "AI API \u{8fd4}\u{56de}\u{4e86}\u{7a7a}\u{5185}\u{5bb9}".to_string())?;

    match content {
        Value::String(text) => {
            if text.trim().is_empty() {
                Err("AI API \u{8fd4}\u{56de}\u{4e86}\u{7a7a}\u{5185}\u{5bb9}".to_string())
            } else {
                Ok(text.clone())
            }
        }
        Value::Array(items) => {
            let text = items
                .iter()
                .filter_map(|item| item.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("");
            if text.trim().is_empty() {
                Err("AI API \u{8fd4}\u{56de}\u{4e86}\u{7a7a}\u{5185}\u{5bb9}".to_string())
            } else {
                Ok(text)
            }
        }
        _ => Err("AI API \u{8fd4}\u{56de}\u{4e86}\u{65e0}\u{6cd5}\u{8bc6}\u{522b}\u{7684}\u{5185}\u{5bb9}\u{683c}\u{5f0f}".to_string()),
    }
}

fn ensure_title_operation(operations: &mut Vec<AiPatchOperation>, title: String) {
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

#[tauri::command]
pub async fn ai_polish_text(
    app: tauri::AppHandle,
    text: String,
    mode: PolishMode,
) -> Result<AiPolishTextResult, String> {
    let config = load_ai_config(&app)?;
    let prompt = match mode {
        PolishMode::Polish => "\u{4f60}\u{662f}\u{4e00}\u{4e2a}\u{4e13}\u{4e1a}\u{7684}\u{7b80}\u{5386}\u{4f18}\u{5316}\u{52a9}\u{624b}\u{3002}\u{8bf7}\u{6da6}\u{8272}\u{4ee5}\u{4e0b}\u{7b80}\u{5386}\u{6587}\u{672c}\u{ff0c}\u{4f7f}\u{5176}\u{66f4}\u{52a0}\u{4e13}\u{4e1a}\u{3001}\u{7b80}\u{6d01}\u{3001}\u{6709}\u{8bf4}\u{670d}\u{529b}\u{3002}\n\n\u{8981}\u{6c42}\u{ff1a}\n1. \u{4f7f}\u{7528}\u{66f4}\u{7cbe}\u{51c6}\u{7684}\u{52a8}\u{8bcd}\n2. \u{5c3d}\u{91cf}\u{91cf}\u{5316}\u{6210}\u{679c}\u{ff0c}\u{5728}\u{539f}\u{6587}\u{7f3a}\u{5c11}\u{91cf}\u{5316}\u{6570}\u{636e}\u{65f6}\u{53ef}\u{5408}\u{7406}\u{63a8}\u{65ad}\u{8865}\u{5145}\n3. \u{4fdd}\u{6301}\u{539f}\u{6587}\u{6838}\u{5fc3}\u{542b}\u{4e49}\u{4e0d}\u{53d8}\n4. \u{76f4}\u{63a5}\u{8fd4}\u{56de}\u{6da6}\u{8272}\u{540e}\u{7684}\u{6587}\u{672c}\u{ff0c}\u{4e0d}\u{8981}\u{6dfb}\u{52a0}\u{89e3}\u{91ca}\u{3001}\u{524d}\u{7f00}\u{6216}\u{540e}\u{7f00}\n5. \u{53ef}\u{4ee5}\u{4f7f}\u{7528} Markdown \u{683c}\u{5f0f}\u{ff1a}\u{7528} **\u{52a0}\u{7c97}** \u{5f3a}\u{8c03}\u{5173}\u{952e}\u{6210}\u{679c}\u{6216}\u{6570}\u{636e}\u{ff0c}\u{4f7f}\u{7528}\u{6362}\u{884c}\u{5206}\u{9694}\u{4e0d}\u{540c}\u{8981}\u{70b9}\n\n\u{539f}\u{59cb}\u{6587}\u{672c}\u{ff1a}",
        PolishMode::Expand => "\u{4f60}\u{662f}\u{4e00}\u{4e2a}\u{4e13}\u{4e1a}\u{7684}\u{7b80}\u{5386}\u{4f18}\u{5316}\u{52a9}\u{624b}\u{3002}\u{8bf7}\u{5c06}\u{4ee5}\u{4e0b}\u{7b80}\u{5386}\u{6587}\u{672c}\u{6269}\u{5199}\u{ff0c}\u{6dfb}\u{52a0}\u{66f4}\u{591a}\u{5408}\u{7406}\u{7684}\u{4e13}\u{4e1a}\u{7ec6}\u{8282}\u{548c}\u{6210}\u{679c}\u{63cf}\u{8ff0}\u{3002}\n\n\u{8981}\u{6c42}\u{ff1a}\n1. \u{4fdd}\u{6301}\u{539f}\u{6587}\u{7684}\u{6838}\u{5fc3}\u{542b}\u{4e49}\u{548c}\u{7ed3}\u{6784}\n2. \u{6dfb}\u{52a0}\u{5408}\u{7406}\u{7684}\u{5de5}\u{4f5c}\u{7ec6}\u{8282}\n3. \u{6dfb}\u{52a0}\u{53ef}\u{91cf}\u{5316}\u{7684}\u{6210}\u{679c}\u{63cf}\u{8ff0}\n4. \u{4f7f}\u{7528}\u{4e13}\u{4e1a}\u{672f}\u{8bed}\n5. \u{76f4}\u{63a5}\u{8fd4}\u{56de}\u{6269}\u{5199}\u{540e}\u{7684}\u{6587}\u{672c}\u{ff0c}\u{4e0d}\u{8981}\u{6dfb}\u{52a0}\u{89e3}\u{91ca}\u{6216}\u{524d}\u{7f00}\n6. \u{4f7f}\u{7528} Markdown \u{683c}\u{5f0f}\u{ff1a}\u{7528} **\u{52a0}\u{7c97}** \u{5f3a}\u{8c03}\u{5173}\u{952e}\u{6210}\u{679c}\u{6216}\u{6570}\u{636e}\u{ff0c}\u{7528}\u{6362}\u{884c}\u{5206}\u{9694}\u{4e0d}\u{540c}\u{8981}\u{70b9}\n\n\u{539f}\u{59cb}\u{6587}\u{672c}\u{ff1a}",
        PolishMode::Shorten => "\u{4f60}\u{662f}\u{4e00}\u{4e2a}\u{4e13}\u{4e1a}\u{7684}\u{7b80}\u{5386}\u{4f18}\u{5316}\u{52a9}\u{624b}\u{3002}\u{8bf7}\u{7cbe}\u{7b80}\u{4ee5}\u{4e0b}\u{7b80}\u{5386}\u{6587}\u{672c}\u{ff0c}\u{53bb}\u{9664}\u{5197}\u{4f59}\u{ff0c}\u{4fdd}\u{7559}\u{6700}\u{6838}\u{5fc3}\u{7684}\u{4fe1}\u{606f}\u{3002}\n\n\u{8981}\u{6c42}\u{ff1a}\n1. \u{4fdd}\u{7559}\u{6700}\u{5173}\u{952e}\u{7684}\u{4fe1}\u{606f}\u{548c}\u{6210}\u{679c}\n2. \u{53bb}\u{9664}\u{91cd}\u{590d}\u{548c}\u{4e0d}\u{5fc5}\u{8981}\u{7684}\u{63cf}\u{8ff0}\n3. \u{4fdd}\u{6301}\u{4e13}\u{4e1a}\u{6027}\u{548c}\u{53ef}\u{8bfb}\u{6027}\n4. \u{76f4}\u{63a5}\u{8fd4}\u{56de}\u{7cbe}\u{7b80}\u{540e}\u{7684}\u{6587}\u{672c}\u{ff0c}\u{4e0d}\u{8981}\u{6dfb}\u{52a0}\u{89e3}\u{91ca}\u{6216}\u{524d}\u{7f00}\n5. \u{53ef}\u{4ee5}\u{4f7f}\u{7528} Markdown \u{683c}\u{5f0f}\u{ff1a}\u{7528} **\u{52a0}\u{7c97}** \u{5f3a}\u{8c03}\u{5173}\u{952e}\u{6210}\u{679c}\n\n\u{539f}\u{59cb}\u{6587}\u{672c}\u{ff1a}",
        PolishMode::TranslateEn => "You are a professional resume translator. Translate the following Chinese resume text into professional, natural-sounding English. Use strong action verbs and maintain a professional tone. Return only the translated text without any explanation or prefix.\n\nOriginal text:",
        PolishMode::TranslateZh => "\u{4f60}\u{662f}\u{4e00}\u{4e2a}\u{4e13}\u{4e1a}\u{7684}\u{7b80}\u{5386}\u{7ffb}\u{8bd1}\u{52a9}\u{624b}\u{3002}\u{5c06}\u{4ee5}\u{4e0b}\u{82f1}\u{6587}\u{7b80}\u{5386}\u{7ffb}\u{8bd1}\u{4e3a}\u{4e13}\u{4e1a}\u{3001}\u{5730}\u{9053}\u{7684}\u{4e2d}\u{6587}\u{7b80}\u{5386}\u{8868}\u{8fbe}\u{3002}\u{4f7f}\u{7528}\u{4e13}\u{4e1a}\u{7684}\u{884c}\u{4e1a}\u{672f}\u{8bed}\u{3002}\u{76f4}\u{63a5}\u{8fd4}\u{56de}\u{7ffb}\u{8bd1}\u{540e}\u{7684}\u{6587}\u{672c}\u{ff0c}\u{4e0d}\u{8981}\u{6dfb}\u{52a0}\u{89e3}\u{91ca}\u{6216}\u{524d}\u{7f00}\u{3002}\n\nOriginal text:",
    };

    let result = chat_completion(
        &config,
        vec![ChatMessage {
            role: "user".to_string(),
            content: format!("{}\n{}", prompt, text),
        }],
        0.7,
        2000,
    )
    .await?;

    Ok(AiPolishTextResult { text: result })
}

#[tauri::command]
pub async fn ai_optimize_resume(
    app: tauri::AppHandle,
    data: ResumeData,
) -> Result<AiResumePatch, String> {
    let config = load_ai_config(&app)?;
    let snapshot = build_editable_snapshot(&data);
    let system_prompt = "\u{4f60}\u{662f}\u{4e00}\u{4e2a}\u{4e13}\u{4e1a}\u{7684}\u{4e2d}\u{6587}\u{7b80}\u{5386}\u{4f18}\u{5316}\u{52a9}\u{624b}\u{3002}\u{8bf7}\u{57fa}\u{4e8e}\u{7528}\u{6237}\u{63d0}\u{4f9b}\u{7684}\u{53ef}\u{7f16}\u{8f91}\u{7b80}\u{5386}\u{5feb}\u{7167}\u{ff0c}\u{5bf9}\u{6574}\u{4efd}\u{7b80}\u{5386}\u{505a}\u{6574}\u{4f53}\u{4f18}\u{5316}\u{3002}

\u{4f18}\u{5316}\u{8981}\u{6c42}\u{ff1a}
1. \u{4ec5}\u{4f18}\u{5316}\u{6587}\u{672c}\u{8868}\u{8fbe}\u{ff0c}\u{8ba9}\u{5185}\u{5bb9}\u{66f4}\u{4e13}\u{4e1a}\u{3001}\u{7b80}\u{6d01}\u{3001}\u{6709}\u{8bf4}\u{670d}\u{529b}
2. \u{4f18}\u{5148}\u{4f7f}\u{7528}\u{66f4}\u{5f3a}\u{7684}\u{52a8}\u{8bcd}\u{3001}\u{6e05}\u{6670}\u{7684}\u{804c}\u{8d23}\u{8868}\u{8ff0}\u{548c}\u{66f4}\u{6709}\u{7ed3}\u{679c}\u{5bfc}\u{5411}\u{7684}\u{63aa}\u{8f9e}
3. \u{4ec5}\u{5728}\u{4e0a}\u{4e0b}\u{6587}\u{5df2}\u{7ecf}\u{660e}\u{663e}\u{6697}\u{793a}\u{65f6}\u{ff0c}\u{4fdd}\u{5b88}\u{5730}\u{8865}\u{5168}\u{53ef}\u{91cf}\u{5316}\u{8868}\u{8fbe}\u{ff1b}\u{4e0d}\u{8981}\u{7f16}\u{9020}\u{5938}\u{5f20}\u{6216}\u{865a}\u{5047}\u{7684}\u{7ecf}\u{5386}
4. \u{8054}\u{7cfb}\u{65b9}\u{5f0f}\u{3001}\u{90ae}\u{7bb1}\u{3001}\u{7535}\u{8bdd}\u{3001}\u{94fe}\u{63a5}\u{7b49}\u{4e8b}\u{5b9e}\u{4fe1}\u{606f}\u{4e0d}\u{4f1a}\u{51fa}\u{73b0}\u{5728}\u{8f93}\u{5165}\u{4e2d}\u{ff0c}\u{4e0d}\u{8981}\u{731c}\u{6d4b}\u{65b0}\u{589e}
5. \u{4fdd}\u{6301}\u{4e2d}\u{6587}\u{8f93}\u{51fa}\u{ff0c}\u{4e0d}\u{8981}\u{6dfb}\u{52a0}\u{89e3}\u{91ca}\u{3001}\u{8bf4}\u{660e}\u{6216}\u{4ee3}\u{7801}\u{5757}
6. \u{4e0d}\u{8981}\u{65b0}\u{589e}\u{6216}\u{5220}\u{9664}\u{4efb}\u{4f55}\u{6761}\u{76ee}\u{ff0c}\u{5fc5}\u{987b}\u{53ea}\u{9488}\u{5bf9}\u{8f93}\u{5165} targets \u{4e2d}\u{5df2}\u{6709}\u{7684} id \u{8f93}\u{51fa}\u{64cd}\u{4f5c}
7. contentKind \u{4e3a} markdown \u{7684}\u{6587}\u{672c}\u{53ef}\u{4ee5}\u{4f7f}\u{7528} Markdown\u{ff1a}\u{7528} **\u{52a0}\u{7c97}** \u{5f3a}\u{8c03}\u{5173}\u{952e}\u{6210}\u{679c}\u{6216}\u{6570}\u{636e}\u{ff0c}\u{7528}\u{6362}\u{884c}\u{5206}\u{9694}\u{4e0d}\u{540c}\u{8981}\u{70b9}\u{ff0c}\u{7528} - \u{5f00}\u{5934}\u{8868}\u{793a}\u{5217}\u{8868}\u{9879}
8. contentKind \u{4e3a} tags \u{65f6}\u{5fc5}\u{987b}\u{8fd4}\u{56de} tags \u{6570}\u{7ec4}\u{ff1b}contentKind \u{4e3a} salary \u{65f6}\u{5fc5}\u{987b}\u{8fd4}\u{56de} text \u{548c} salaryRange

\u{4f60}\u{5fc5}\u{987b}\u{4e25}\u{683c}\u{8fd4}\u{56de}\u{4ee5}\u{4e0b} JSON \u{7ed3}\u{6784}\u{ff0c}\u{4e0d}\u{8981}\u{8fd4}\u{56de}\u{5176}\u{4ed6}\u{6587}\u{5b57}\u{ff1a}
{
  \"operations\": [
    {
      \"targetKind\": \"resumeTitle | personalInfo | jobIntention | moduleElement | moduleTags\",
      \"targetId\": \"\u{8f93}\u{5165}\u{4e2d}\u{7684} id\",
      \"contentKind\": \"plain | markdown | tags | salary\",
      \"text\": \"\u{4f18}\u{5316}\u{540e}\u{7684}\u{6587}\u{672c}\u{ff08}plain/markdown/salary \u{65f6}\u{4f7f}\u{7528}\u{ff09}\",
      \"tags\": [\"\u{4f18}\u{5316}\u{540e}\u{7684}\u{6807}\u{7b7e}\u{ff0c}\u{4ec5} tags \u{65f6}\u{4f7f}\u{7528}\"],
      \"salaryRange\": { \"min\": 20, \"max\": 30 }
    }
  ]
}

\u{5982}\u{679c}\u{67d0}\u{9879}\u{4e0d}\u{9700}\u{8981}\u{4fee}\u{6539}\u{ff0c}\u{4e5f}\u{5fc5}\u{987b}\u{4fdd}\u{7559}\u{539f}\u{59cb} targetId \u{5e76}\u{8fd4}\u{56de}\u{539f}\u{6587}\u{3002}";

    let raw = chat_completion(
        &config,
        vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "\u{8bf7}\u{4f18}\u{5316}\u{4ee5}\u{4e0b}\u{7b80}\u{5386}\u{53ef}\u{7f16}\u{8f91}\u{5feb}\u{7167}\u{ff1a}\n{}",
                    serde_json::to_string_pretty(&snapshot).map_err(|error| error.to_string())?
                ),
            },
        ],
        0.4,
        6000,
    )
    .await?;

    let parsed: OptimizationResponse = serde_json::from_str(&strip_code_fences(&raw))
        .map_err(|_| "AI \u{8fd4}\u{56de}\u{4e86}\u{65e0}\u{6cd5}\u{89e3}\u{6790}\u{7684}\u{4f18}\u{5316}\u{7ed3}\u{679c}\u{ff0c}\u{8bf7}\u{91cd}\u{8bd5}".to_string())?;
    let (mut operations, summary) = validate_patch_operations(&snapshot, parsed.operations);
    ensure_title_operation(&mut operations, build_optimized_title(&data.title));

    Ok(AiResumePatch {
        operations,
        warnings: build_optimization_warnings(&data, &summary),
    })
}

#[tauri::command]
pub async fn ai_analyze_jd(
    app: tauri::AppHandle,
    data: ResumeData,
    jd: String,
) -> Result<AiJdAnalysisResult, String> {
    let config = load_ai_config(&app)?;
    let snapshot = build_editable_snapshot(&data);
    let resume_text = build_resume_text(&data);
    let system_prompt = "\u{4f60}\u{662f}\u{4e00}\u{4e2a}\u{4e13}\u{4e1a}\u{7684}\u{7b80}\u{5386}\u{4f18}\u{5316}\u{987e}\u{95ee}\u{3002}\u{7528}\u{6237}\u{5c06}\u{63d0}\u{4f9b}\u{4e00}\u{4efd}\u{76ee}\u{6807}\u{804c}\u{4f4d}\u{63cf}\u{8ff0}\u{ff08}JD\u{ff09}\u{3001}\u{5f53}\u{524d}\u{7b80}\u{5386}\u{5168}\u{6587}\u{ff0c}\u{4ee5}\u{53ca}\u{4e00}\u{4efd}\u{53ef}\u{5b89}\u{5168}\u{7f16}\u{8f91}\u{7684} target \u{5feb}\u{7167}\u{3002}

\u{8bf7}\u{5206}\u{6790}\u{7b80}\u{5386}\u{4e0e} JD \u{7684}\u{5339}\u{914d}\u{5ea6}\u{ff0c}\u{5e76}\u{8f93}\u{51fa}\u{ff1a}
1. \u{5339}\u{914d}\u{5ea6}\u{8bc4}\u{5206}
2. \u{5df2}\u{5339}\u{914d}\u{5173}\u{952e}\u{8bcd}\u{4e0e}\u{7f3a}\u{5931}\u{5173}\u{952e}\u{8bcd}
3. \u{6700}\u{591a} 8 \u{6761}\u{5177}\u{4f53}\u{4f18}\u{5316}\u{5efa}\u{8bae}

\u{91cd}\u{8981}\u{7ea6}\u{675f}\u{ff1a}
- \u{4f18}\u{5148}\u{9488}\u{5bf9}\u{8f93}\u{5165} targets \u{4e2d}\u{5df2}\u{6709}\u{7684} targetId \u{505a}\u{5b9a}\u{5411}\u{4fee}\u{6539}\u{ff0c}\u{4e0d}\u{8981}\u{81ea}\u{5df1}\u{53d1}\u{660e}\u{65b0}\u{7684} targetId
- \u{6bcf}\u{6761}\u{5efa}\u{8bae}\u{5982}\u{679c}\u{53ef}\u{4ee5}\u{76f4}\u{63a5}\u{843d}\u{5230}\u{73b0}\u{6709} target\u{ff0c}\u{5c31}\u{5fc5}\u{987b}\u{8fd4}\u{56de} targetKind\u{3001}targetId\u{3001}contentKind
- \u{53ea}\u{6709}\u{5f53}\u{5efa}\u{8bae}\u{66f4}\u{9002}\u{5408}\u{4f5c}\u{4e3a}\u{4eba}\u{5de5}\u{8865}\u{5145}\u{3001}\u{65e0}\u{6cd5}\u{5b89}\u{5168}\u{843d}\u{5230}\u{73b0}\u{6709} target \u{65f6}\u{ff0c}\u{624d}\u{53ef}\u{4ee5}\u{7701}\u{7565} targetKind \u{548c} targetId
- \u{5bf9} moduleElement \u{7684} suggestedText \u{53ef}\u{4ee5}\u{4f7f}\u{7528} Markdown
- \u{5bf9} moduleTags \u{7684} suggestedText \u{53ef}\u{4ee5}\u{4e3a}\u{7a7a}\u{ff0c}\u{4f46}\u{5fc5}\u{987b}\u{63d0}\u{4f9b} tags \u{6570}\u{7ec4}
- \u{5bf9} salary \u{7c7b}\u{578b}\u{5fc5}\u{987b}\u{8fd4}\u{56de} text\u{ff0c}\u{5e76}\u{5c3d}\u{91cf}\u{63d0}\u{4f9b} salaryRange

\u{4f60}\u{5fc5}\u{987b}\u{4e25}\u{683c}\u{8fd4}\u{56de}\u{4ee5}\u{4e0b} JSON\u{ff0c}\u{4e0d}\u{8981}\u{8fd4}\u{56de}\u{5176}\u{4ed6}\u{6587}\u{5b57}\u{ff1a}
{
  \"matchScore\": 0,
  \"missingKeywords\": [\"...\"],
  \"matchedKeywords\": [\"...\"],
  \"suggestions\": [
    {
      \"section\": \"\u{6a21}\u{5757}\u{540d}\u{79f0}\",
      \"field\": \"\u{5b57}\u{6bb5}\u{540d}\u{79f0}\u{ff0c}\u{53ef}\u{9009}\",
      \"originalText\": \"\u{539f}\u{6587}\u{6458}\u{8981}\",
      \"suggestedText\": \"\u{5efa}\u{8bae}\u{66ff}\u{6362}\u{540e}\u{7684}\u{5b8c}\u{6574}\u{5185}\u{5bb9}\",
      \"reason\": \"\u{4e3a}\u{4ec0}\u{4e48}\u{8fd9}\u{6837}\u{4fee}\u{6539}\",
      \"targetKind\": \"resumeTitle | personalInfo | jobIntention | moduleElement | moduleTags\",
      \"targetId\": \"\u{5df2}\u{6709} target id\",
      \"contentKind\": \"plain | markdown | tags | salary\",
      \"tags\": [\"\u{6807}\u{7b7e}\u{ff0c}\u{4ec5} tags \u{65f6}\u{4f7f}\u{7528}\"],
      \"salaryRange\": { \"min\": 20, \"max\": 30 }
    }
  ],
  \"summary\": \"\u{603b}\u{7ed3}\"
}";

    let raw = chat_completion(
        &config,
        vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "\u{3010}\u{76ee}\u{6807}\u{804c}\u{4f4d}\u{63cf}\u{8ff0}\u{ff08}JD\u{ff09}\u{3011}\n{}\n\n\u{3010}\u{5f53}\u{524d}\u{7b80}\u{5386}\u{5185}\u{5bb9}\u{3011}\n{}\n\n\u{3010}\u{53ef}\u{7f16}\u{8f91}\u{76ee}\u{6807}\u{5feb}\u{7167}\u{3011}\n{}",
                    jd,
                    resume_text,
                    serde_json::to_string_pretty(&snapshot).map_err(|error| error.to_string())?
                ),
            },
        ],
        0.3,
        5000,
    )
    .await?;

    let parsed: JdAnalysisResponse = serde_json::from_str(&strip_code_fences(&raw))
        .map_err(|_| "AI \u{8fd4}\u{56de}\u{4e86}\u{65e0}\u{6cd5}\u{89e3}\u{6790}\u{7684}\u{5185}\u{5bb9}\u{ff0c}\u{8bf7}\u{91cd}\u{8bd5}".to_string())?;

    let mut patch_operations = Vec::new();
    let mut warnings = Vec::new();
    let target_keys = snapshot
        .targets
        .iter()
        .map(|target| ((target.target_kind.clone(), target.id.clone()), target))
        .collect::<HashMap<_, _>>();

    for suggestion in &parsed.suggestions {
        let (Some(target_kind), Some(target_id)) = (&suggestion.target_kind, &suggestion.target_id) else {
            continue;
        };

        let Some(target) = target_keys.get(&(target_kind.clone(), target_id.clone())) else {
            warnings.push(format!(
                "AI \u{5efa}\u{8bae}\u{5f15}\u{7528}\u{4e86}\u{65e0}\u{6cd5}\u{8bc6}\u{522b}\u{7684}\u{76ee}\u{6807} {}:{}\u{ff0c}\u{5df2}\u{5ffd}\u{7565}\u{81ea}\u{52a8}\u{5e94}\u{7528}\u{3002}",
                match target_kind {
                    AiPatchTargetKind::ResumeTitle => "resumeTitle",
                    AiPatchTargetKind::PersonalInfo => "personalInfo",
                    AiPatchTargetKind::JobIntention => "jobIntention",
                    AiPatchTargetKind::ModuleElement => "moduleElement",
                    AiPatchTargetKind::ModuleTags => "moduleTags",
                },
                target_id
            ));
            continue;
        };

        if suggestion.content_kind != expected_content_kind_for_target(target) {
            warnings.push(format!(
                "AI \u{4e3a}\u{76ee}\u{6807} {} \u{8fd4}\u{56de}\u{4e86}\u{4e0d}\u{5339}\u{914d}\u{7684}\u{5185}\u{5bb9}\u{7c7b}\u{578b}\u{ff0c}\u{5df2}\u{5ffd}\u{7565}\u{81ea}\u{52a8}\u{5e94}\u{7528}\u{3002}",
                target_id
            ));
            continue;
        }

        let salary_range = if suggestion.content_kind == AiPatchContentKind::Salary {
            suggestion
                .salary_range
                .clone()
                .or_else(|| parse_salary_range(&suggestion.suggested_text))
        } else {
            suggestion.salary_range.clone()
        };

        patch_operations.push(AiPatchOperation {
            target_kind: target_kind.clone(),
            target_id: target_id.clone(),
            content_kind: suggestion.content_kind.clone(),
            text: Some(suggestion.suggested_text.clone()),
            tags: suggestion.tags.clone(),
            salary_range,
        });
    }

    ensure_title_operation(&mut patch_operations, build_tailored_title(&data.title));

    Ok(AiJdAnalysisResult {
        match_score: parsed.match_score.clamp(0, 100),
        missing_keywords: parsed.missing_keywords,
        matched_keywords: parsed.matched_keywords,
        suggestions: parsed.suggestions,
        summary: parsed.summary,
        patch: AiResumePatch {
            operations: patch_operations,
            warnings,
        },
    })
}

#[tauri::command]
pub async fn ai_rewrite_for_jd(
    app: tauri::AppHandle,
    data: ResumeData,
    jd: String,
    target_kind: AiPatchTargetKind,
    target_id: String,
    suggestion: String,
) -> Result<AiRewriteForJdResult, String> {
    let config = load_ai_config(&app)?;
    let snapshot = build_editable_snapshot(&data);
    let target = snapshot
        .targets
        .iter()
        .find(|candidate| candidate.target_kind == target_kind && candidate.id == target_id)
        .cloned()
        .ok_or_else(|| "\u{672a}\u{627e}\u{5230}\u{6307}\u{5b9a}\u{7684}\u{53ef}\u{7f16}\u{8f91}\u{76ee}\u{6807}".to_string())?;

    let system_prompt = "\u{4f60}\u{662f}\u{4e00}\u{4e2a}\u{4e13}\u{4e1a}\u{7684}\u{7b80}\u{5386}\u{4f18}\u{5316}\u{52a9}\u{624b}\u{3002}\u{8bf7}\u{6839}\u{636e} JD \u{8981}\u{6c42}\u{ff0c}\u{4ec5}\u{6539}\u{5199}\u{6307}\u{5b9a}\u{7684}\u{4e00}\u{4e2a}\u{7b80}\u{5386}\u{76ee}\u{6807}\u{3002}

\u{8981}\u{6c42}\u{ff1a}
- \u{53ea}\u{8fd4}\u{56de}\u{4e00}\u{4e2a}\u{53ef}\u{76f4}\u{63a5}\u{5e94}\u{7528}\u{5230}\u{8be5} target \u{7684}\u{7ed3}\u{679c}
- \u{4e0d}\u{8981}\u{6539}\u{5199} targetId \u{6216} targetKind
- contentKind \u{5fc5}\u{987b}\u{4e0e}\u{8f93}\u{5165} target \u{4fdd}\u{6301}\u{4e00}\u{81f4}
- moduleElement \u{65f6}\u{53ef}\u{4ee5}\u{4f7f}\u{7528} Markdown
- tags \u{65f6}\u{8fd4}\u{56de} tags \u{6570}\u{7ec4}
- salary \u{65f6}\u{8fd4}\u{56de} text\u{ff0c}\u{5e76}\u{5c3d}\u{91cf}\u{8fd4}\u{56de} salaryRange

\u{4f60}\u{5fc5}\u{987b}\u{4e25}\u{683c}\u{8fd4}\u{56de}\u{4ee5}\u{4e0b} JSON\u{ff1a}
{
  \"section\": \"\u{6a21}\u{5757}\u{540d}\u{79f0}\",
  \"field\": \"\u{5b57}\u{6bb5}\u{540d}\u{79f0}\u{ff0c}\u{53ef}\u{9009}\",
  \"originalText\": \"\u{539f}\u{6587}\u{6458}\u{8981}\",
  \"suggestedText\": \"\u{6539}\u{5199}\u{540e}\u{7684}\u{5b8c}\u{6574}\u{5185}\u{5bb9}\",
  \"reason\": \"\u{6539}\u{5199}\u{7406}\u{7531}\",
  \"targetKind\": \"resumeTitle | personalInfo | jobIntention | moduleElement | moduleTags\",
  \"targetId\": \"\u{8f93}\u{5165}\u{4e2d}\u{7684} targetId\",
  \"contentKind\": \"plain | markdown | tags | salary\",
  \"tags\": [\"...\"],
  \"salaryRange\": { \"min\": 20, \"max\": 30 }
}";

    let raw = chat_completion(
        &config,
        vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "\u{3010}\u{76ee}\u{6807} JD\u{3011}\n{}\n\n\u{3010}\u{6307}\u{5b9a}\u{76ee}\u{6807}\u{3011}\n{}\n\n\u{3010}\u{4f18}\u{5316}\u{65b9}\u{5411}\u{3011}\n{}",
                    jd,
                    serde_json::to_string_pretty(&target).map_err(|error| error.to_string())?,
                    suggestion
                ),
            },
        ],
        0.4,
        2500,
    )
    .await?;

    let parsed: AiJdAnalysisSuggestion = serde_json::from_str(&strip_code_fences(&raw))
        .map_err(|_| "AI \u{8fd4}\u{56de}\u{4e86}\u{65e0}\u{6cd5}\u{89e3}\u{6790}\u{7684}\u{6539}\u{5199}\u{7ed3}\u{679c}\u{ff0c}\u{8bf7}\u{91cd}\u{8bd5}".to_string())?;

    let mut warnings = Vec::new();
    let operation = if parsed.target_kind.as_ref() == Some(&target_kind)
        && parsed.target_id.as_deref() == Some(target_id.as_str())
        && parsed.content_kind == expected_content_kind_for_target(&target)
    {
        Some(AiPatchOperation {
            target_kind,
            target_id,
            content_kind: parsed.content_kind.clone(),
            text: Some(parsed.suggested_text.clone()),
            tags: parsed.tags.clone(),
            salary_range: if parsed.content_kind == AiPatchContentKind::Salary {
                parsed
                    .salary_range
                    .clone()
                    .or_else(|| parse_salary_range(&parsed.suggested_text))
            } else {
                parsed.salary_range.clone()
            },
        })
    } else {
        warnings.push("AI \u{8fd4}\u{56de}\u{7684}\u{6539}\u{5199}\u{76ee}\u{6807}\u{4e0d}\u{5408}\u{6cd5}\u{ff0c}\u{672a}\u{81ea}\u{52a8}\u{5e94}\u{7528}\u{3002}".to_string());
        None
    };

    Ok(AiRewriteForJdResult {
        suggestion: Some(parsed),
        patch: AiResumePatch {
            operations: operation.into_iter().collect(),
            warnings,
        },
    })
}

#[tauri::command]
pub async fn ai_test_connection(app: tauri::AppHandle) -> Result<(), String> {
    let _ = ai_polish_text(app, "\u{4f60}\u{597d}".to_string(), PolishMode::Polish).await?;
    Ok(())
}

#[allow(dead_code)]
pub fn jd_suggestion_module_title() -> &'static str {
    JD_SUGGESTION_MODULE_TITLE
}
