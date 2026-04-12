use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::ai_config::AIConfig;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: f64,
    pub max_tokens: u32,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ChatCompletionResponse {
    pub choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ChatChoice {
    pub message: ChatResponseMessage,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ChatResponseMessage {
    pub content: Value,
}

pub(crate) async fn chat_completion(
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
