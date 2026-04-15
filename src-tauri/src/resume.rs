use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersonalInfoValue {
    pub content: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub value_type: Option<PersonalInfoValueType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PersonalInfoValueType {
    Text,
    Link,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersonalInfoItem {
    pub label: String,
    pub value: PersonalInfoValue,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    pub id: String,
    pub order: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PersonalInfoLayoutMode {
    Inline,
    Grid,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersonalInfoLayout {
    #[serde(default = "default_layout_mode")]
    pub mode: PersonalInfoLayoutMode,
    #[serde(default = "default_items_per_row")]
    pub items_per_row: u8,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AvatarShape {
    Circle,
    Square,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AvatarType {
    Default,
    IdPhoto,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersonalInfoSection {
    #[serde(default)]
    pub personal_info: Vec<PersonalInfoItem>,
    #[serde(default = "default_show_personal_info_labels")]
    pub show_personal_info_labels: bool,
    #[serde(default = "default_avatar_shape")]
    pub avatar_shape: AvatarShape,
    #[serde(default = "default_avatar_type")]
    pub avatar_type: AvatarType,
    #[serde(default = "default_personal_info_layout")]
    pub layout: PersonalInfoLayout,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SalaryRange {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum JobIntentionType {
    WorkYears,
    Position,
    City,
    Salary,
    Custom,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JobIntentionItem {
    pub id: String,
    pub label: String,
    pub value: String,
    pub order: i64,
    #[serde(rename = "type")]
    pub item_type: JobIntentionType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub salary_range: Option<SalaryRange>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JobIntentionSection {
    #[serde(default)]
    pub items: Vec<JobIntentionItem>,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModuleContentElement {
    pub id: String,
    pub content: Value,
    pub column_index: u8,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModuleContentRowType {
    Rich,
    Tags,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModuleContentRow {
    pub id: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub row_type: Option<ModuleContentRowType>,
    pub columns: u8,
    #[serde(default)]
    pub elements: Vec<ModuleContentElement>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    pub order: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResumeModule {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    pub order: i64,
    #[serde(default)]
    pub rows: Vec<ModuleContentRow>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResumeData {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub center_title: Option<bool>,
    pub personal_info_section: PersonalInfoSection,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub job_intention_section: Option<JobIntentionSection>,
    #[serde(default)]
    pub modules: Vec<ResumeModule>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[derive(Default)]
pub enum ResumeVariantKind {
    #[default]
    Base,
    Clone,
    Optimized,
    JdTailored,
}


#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResumeLineage {
    #[serde(default)]
    pub family_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_resume_id: Option<String>,
    #[serde(default = "default_resume_variant_kind")]
    pub variant_kind: ResumeVariantKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_application_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CreateResumeLineageInput {
    #[serde(default)]
    pub family_id: Option<String>,
    #[serde(default)]
    pub parent_resume_id: Option<String>,
    #[serde(default)]
    pub variant_kind: Option<ResumeVariantKind>,
    #[serde(default)]
    pub source_application_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StoredResume {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub resume_data: ResumeData,
    #[serde(default)]
    pub lineage: ResumeLineage,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResumeFileMetadata {
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
    #[serde(rename = "appVersion")]
    pub app_version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResumeFile {
    pub version: String,
    pub data: ResumeData,
    pub metadata: ResumeFileMetadata,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResumeValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub normalized_data: ResumeData,
}

fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

fn generate_id(prefix: &str) -> String {
    format!("{}-{}", prefix, Uuid::new_v4())
}

fn default_layout_mode() -> PersonalInfoLayoutMode {
    PersonalInfoLayoutMode::Grid
}

fn default_items_per_row() -> u8 {
    2
}

fn default_personal_info_layout() -> PersonalInfoLayout {
    PersonalInfoLayout {
        mode: default_layout_mode(),
        items_per_row: default_items_per_row(),
    }
}

fn default_show_personal_info_labels() -> bool {
    true
}

fn default_avatar_shape() -> AvatarShape {
    AvatarShape::Circle
}

fn default_avatar_type() -> AvatarType {
    AvatarType::Default
}

fn default_resume_variant_kind() -> ResumeVariantKind {
    ResumeVariantKind::Base
}

fn empty_rich_text_doc() -> Value {
    serde_json::json!({
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": []
            }
        ]
    })
}

fn normalize_layout(layout: PersonalInfoLayout) -> PersonalInfoLayout {
    PersonalInfoLayout {
        mode: layout.mode,
        items_per_row: layout.items_per_row.clamp(1, 6),
    }
}

fn normalize_resume_data(mut data: ResumeData) -> ResumeData {
    let now = now_rfc3339();

    if data.created_at.trim().is_empty() {
        data.created_at = now.clone();
    }

    if data.updated_at.trim().is_empty() {
        data.updated_at = now;
    }

    data.personal_info_section.layout = normalize_layout(data.personal_info_section.layout);

    if data.personal_info_section.avatar_type == AvatarType::IdPhoto {
        data.personal_info_section.avatar_shape = AvatarShape::Square;
    }

    data
}

fn validate_resume_data_inner(data: ResumeData) -> ResumeValidationResult {
    let normalized_data = normalize_resume_data(data);
    let mut errors = Vec::new();

    if normalized_data.title.trim().is_empty() {
        errors.push("简历标题不能为空".to_string());
    }

    for (index, item) in normalized_data
        .personal_info_section
        .personal_info
        .iter()
        .enumerate()
    {
        if item.id.trim().is_empty() || item.label.trim().is_empty() {
            errors.push(format!("个人信息第{}项格式错误", index + 1));
        }
    }

    for (index, module) in normalized_data.modules.iter().enumerate() {
        if module.id.trim().is_empty() || module.title.trim().is_empty() {
            errors.push(format!("简历模块第{}项格式错误", index + 1));
        }
    }

    ResumeValidationResult {
        is_valid: errors.is_empty(),
        errors,
        normalized_data,
    }
}

pub fn validate_resume_data_or_error(data: ResumeData) -> Result<ResumeData, String> {
    let result = validate_resume_data_inner(data);
    if result.is_valid {
        Ok(result.normalized_data)
    } else {
        Err(result.errors.join("；"))
    }
}

pub fn build_default_resume_data() -> ResumeData {
    let now = now_rfc3339();

    ResumeData {
        title: "我的简历".to_string(),
        center_title: Some(true),
        personal_info_section: PersonalInfoSection {
            personal_info: vec![
                PersonalInfoItem {
                    id: "phone".to_string(),
                    label: "电话".to_string(),
                    value: PersonalInfoValue {
                        content: "138xxxx8888".to_string(),
                        value_type: Some(PersonalInfoValueType::Text),
                        title: None,
                    },
                    icon: Some("<path fill=\"currentColor\" d=\"M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25c1.12.37 2.32.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57c.11.35.03.74-.25 1.02z\"/>".to_string()),
                    order: 0,
                },
                PersonalInfoItem {
                    id: "email".to_string(),
                    label: "邮箱".to_string(),
                    value: PersonalInfoValue {
                        content: "example@email.com".to_string(),
                        value_type: Some(PersonalInfoValueType::Text),
                        title: None,
                    },
                    icon: Some("<path fill=\"currentColor\" d=\"m20 8l-8 5l-8-5V6l8 5l8-5m0-2H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2\"/>".to_string()),
                    order: 1,
                },
            ],
            show_personal_info_labels: false,
            avatar_shape: AvatarShape::Circle,
            avatar_type: AvatarType::Default,
            layout: default_personal_info_layout(),
        },
        job_intention_section: Some(JobIntentionSection {
            items: vec![
                JobIntentionItem {
                    id: "jii-1".to_string(),
                    label: "工作经验".to_string(),
                    value: "3年".to_string(),
                    order: 0,
                    item_type: JobIntentionType::WorkYears,
                    salary_range: None,
                },
                JobIntentionItem {
                    id: "jii-2".to_string(),
                    label: "求职意向".to_string(),
                    value: "前端工程师".to_string(),
                    order: 1,
                    item_type: JobIntentionType::Position,
                    salary_range: None,
                },
            ],
            enabled: true,
        }),
        modules: vec![
            ResumeModule {
                id: "education-1".to_string(),
                title: "教育背景".to_string(),
                icon: Some("<path fill=\"currentColor\" d=\"M12 3L1 9l11 6l9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17z\"/>".to_string()),
                order: 0,
                rows: vec![ModuleContentRow {
                    id: "edu-row-1".to_string(),
                    row_type: None,
                    columns: 3,
                    elements: vec![
                        ModuleContentElement {
                            id: "edu-elem-1".to_string(),
                            content: serde_json::json!({
                                "type": "doc",
                                "content": [{
                                    "type": "paragraph",
                                    "content": [{ "type": "text", "text": "XX大学" }],
                                    "attrs": { "textAlign": "left" }
                                }]
                            }),
                            column_index: 0,
                        },
                        ModuleContentElement {
                            id: "edu-elem-2".to_string(),
                            content: serde_json::json!({
                                "type": "doc",
                                "content": [{
                                    "type": "paragraph",
                                    "content": [{ "type": "text", "text": "计算机科学与技术" }],
                                    "attrs": { "textAlign": "center" }
                                }]
                            }),
                            column_index: 1,
                        },
                        ModuleContentElement {
                            id: "edu-elem-3".to_string(),
                            content: serde_json::json!({
                                "type": "doc",
                                "content": [{
                                    "type": "paragraph",
                                    "content": [{ "type": "text", "text": "2018.09 - 2022.06" }],
                                    "attrs": { "textAlign": "right" }
                                }]
                            }),
                            column_index: 2,
                        },
                    ],
                    tags: None,
                    order: 0,
                }],
            },
            ResumeModule {
                id: "work-1".to_string(),
                title: "工作经历".to_string(),
                icon: Some("<path fill=\"currentColor\" d=\"M10 2h4a2 2 0 0 1 2 2v2h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8c0-1.11.89-2 2-2h4V4c0-1.11.89-2 2-2m4 4V4h-4v2z\"/>".to_string()),
                order: 1,
                rows: vec![
                    ModuleContentRow {
                        id: "work-row-1".to_string(),
                        row_type: None,
                        columns: 3,
                        elements: vec![
                            ModuleContentElement {
                                id: "work-elem-1".to_string(),
                                content: serde_json::json!({
                                    "type": "doc",
                                    "content": [{
                                        "type": "paragraph",
                                        "content": [{ "type": "text", "text": "XX科技公司" }],
                                        "attrs": { "textAlign": "left" }
                                    }]
                                }),
                                column_index: 0,
                            },
                            ModuleContentElement {
                                id: "work-elem-2".to_string(),
                                content: serde_json::json!({
                                    "type": "doc",
                                    "content": [{
                                        "type": "paragraph",
                                        "content": [{ "type": "text", "text": "前端工程师" }],
                                        "attrs": { "textAlign": "center" }
                                    }]
                                }),
                                column_index: 1,
                            },
                            ModuleContentElement {
                                id: "work-elem-3".to_string(),
                                content: serde_json::json!({
                                    "type": "doc",
                                    "content": [{
                                        "type": "paragraph",
                                        "content": [{ "type": "text", "text": "2022.07 - 至今" }],
                                        "attrs": { "textAlign": "right" }
                                    }]
                                }),
                                column_index: 2,
                            },
                        ],
                        tags: None,
                        order: 0,
                    },
                    ModuleContentRow {
                        id: "work-row-2".to_string(),
                        row_type: None,
                        columns: 1,
                        elements: vec![ModuleContentElement {
                            id: "work-elem-4".to_string(),
                            content: serde_json::json!({
                                "type": "doc",
                                "content": [{
                                    "type": "paragraph",
                                    "content": [{ "type": "text", "text": "负责公司核心产品的前端开发工作，使用 React、TypeScript 等技术栈。" }],
                                    "attrs": { "textAlign": "left" }
                                }]
                            }),
                            column_index: 0,
                        }],
                        tags: None,
                        order: 1,
                    },
                ],
            },
        ],
        avatar: Some("/default-avatar.jpg".to_string()),
        created_at: now.clone(),
        updated_at: now,
    }
}

fn build_personal_info_item(order: i64) -> PersonalInfoItem {
    PersonalInfoItem {
        id: generate_id("info"),
        label: "新标签，如：电话、邮箱等".to_string(),
        value: PersonalInfoValue {
            content: String::new(),
            value_type: Some(PersonalInfoValueType::Text),
            title: None,
        },
        icon: Some("<path fill=\"currentColor\" d=\"M11 17h2v-6h-2zm0-8h2V7h-2zm1 13C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10s-4.48 10-10 10\"/>".to_string()),
        order,
    }
}

fn build_job_intention_item(item_type: JobIntentionType, order: i64) -> JobIntentionItem {
    let label = match item_type {
        JobIntentionType::WorkYears => "工作经验",
        JobIntentionType::Position => "求职意向",
        JobIntentionType::City => "目标城市",
        JobIntentionType::Salary => "期望薪资",
        JobIntentionType::Custom => "自定义",
    };

    JobIntentionItem {
        id: generate_id("jii"),
        label: label.to_string(),
        value: String::new(),
        order,
        item_type: item_type.clone(),
        salary_range: if item_type == JobIntentionType::Salary {
            Some(SalaryRange {
                min: None,
                max: None,
            })
        } else {
            None
        },
    }
}

fn build_resume_module(order: i64) -> ResumeModule {
    ResumeModule {
        id: generate_id("module"),
        title: "新模块".to_string(),
        icon: Some("<path fill=\"currentColor\" d=\"M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z\"/>".to_string()),
        order,
        rows: vec![],
    }
}

fn build_rich_text_row(columns: u8, order: i64) -> ModuleContentRow {
    let clamped_columns = columns.clamp(1, 4);
    let mut elements = Vec::with_capacity(clamped_columns as usize);

    for column_index in 0..clamped_columns {
        elements.push(ModuleContentElement {
            id: generate_id("element"),
            content: empty_rich_text_doc(),
            column_index,
        });
    }

    ModuleContentRow {
        id: generate_id("row"),
        row_type: Some(ModuleContentRowType::Rich),
        columns: clamped_columns,
        elements,
        tags: None,
        order,
    }
}

fn build_tags_row(order: i64) -> ModuleContentRow {
    ModuleContentRow {
        id: generate_id("row"),
        row_type: Some(ModuleContentRowType::Tags),
        columns: 1,
        elements: vec![],
        tags: Some(vec![]),
        order,
    }
}

#[tauri::command]
pub fn get_default_resume_data() -> ResumeData {
    build_default_resume_data()
}

#[tauri::command]
pub fn validate_resume_data_command(data: ResumeData) -> ResumeValidationResult {
    validate_resume_data_inner(data)
}

#[tauri::command]
pub fn import_resume_file(content: String) -> Result<ResumeData, String> {
    if content.trim().is_empty() {
        return Err("文件内容为空".to_string());
    }

    let value: Value = serde_json::from_str(&content).map_err(|_| "无效的文件格式".to_string())?;
    let object = value
        .as_object()
        .ok_or_else(|| "无效的文件格式".to_string())?;

    object
        .get("version")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|version| !version.is_empty())
        .ok_or_else(|| "缺少版本信息".to_string())?;

    let data_value = object
        .get("data")
        .cloned()
        .ok_or_else(|| "缺少简历数据".to_string())?;

    if data_value
        .get("title")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|title| !title.is_empty())
        .is_none()
    {
        return Err("简历标题格式错误".to_string());
    }

    if data_value
        .get("personalInfoSection")
        .and_then(|section| section.get("personalInfo"))
        .and_then(Value::as_array)
        .is_none()
    {
        return Err("个人信息格式错误".to_string());
    }

    if data_value
        .get("modules")
        .and_then(Value::as_array)
        .is_none()
    {
        return Err("简历模块格式错误".to_string());
    }

    let data: ResumeData =
        serde_json::from_value(data_value).map_err(|_| "简历数据格式错误".to_string())?;
    let mut result = validate_resume_data_inner(data);

    if !result.is_valid {
        return Err(result.errors.join("；"));
    }

    result.normalized_data.updated_at = now_rfc3339();
    if result.normalized_data.created_at.trim().is_empty() {
        result.normalized_data.created_at = result.normalized_data.updated_at.clone();
    }

    Ok(result.normalized_data)
}

#[tauri::command]
pub fn export_resume_file(data: ResumeData) -> Result<String, String> {
    let mut normalized = validate_resume_data_or_error(data)?;
    normalized.updated_at = now_rfc3339();
    if normalized.created_at.trim().is_empty() {
        normalized.created_at = normalized.updated_at.clone();
    }

    let file = ResumeFile {
        version: "1.0.0".to_string(),
        data: normalized,
        metadata: ResumeFileMetadata {
            exported_at: now_rfc3339(),
            app_version: "1.0.0".to_string(),
        },
    };

    serde_json::to_string_pretty(&file).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_personal_info_item(order: Option<i64>) -> PersonalInfoItem {
    build_personal_info_item(order.unwrap_or(0))
}

#[tauri::command]
pub fn create_job_intention_item(item_type: JobIntentionType, order: i64) -> JobIntentionItem {
    build_job_intention_item(item_type, order)
}

#[tauri::command]
pub fn create_resume_module(order: i64) -> ResumeModule {
    build_resume_module(order)
}

#[tauri::command]
pub fn create_rich_text_row(columns: u8, order: i64) -> ModuleContentRow {
    build_rich_text_row(columns, order)
}

#[tauri::command]
pub fn create_tags_row(order: i64) -> ModuleContentRow {
    build_tags_row(order)
}
