use headless_chrome::{types::PrintToPdfOptions, Browser};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

fn pdf_error(code: &str, detail: impl ToString) -> String {
    format!("PDF_ERROR::{}::{}", code, detail.to_string())
}

fn write_temp_html(html: &str) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join("resume-builder");
    fs::create_dir_all(&dir).map_err(|e| pdf_error("TEMP_FILE", e))?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| pdf_error("TEMP_FILE", e))?
        .as_nanos();
    let path = dir.join(format!("print-{}-{}.html", std::process::id(), timestamp));
    if let Err(error) = fs::write(&path, html) {
        let _ = fs::remove_file(&path);
        return Err(pdf_error("TEMP_FILE", error));
    }
    Ok(path)
}

#[tauri::command]
pub async fn generate_pdf(
    app: tauri::AppHandle,
    html: String,
    filename: String,
) -> Result<String, String> {
    let browser = Browser::default().map_err(|e| pdf_error("BROWSER_LAUNCH", e))?;

    let tab = browser.new_tab().map_err(|e| pdf_error("TAB_CREATE", e))?;

    let temp_path = write_temp_html(&html)?;
    let result = (|| {
        let url = format!("file://{}", temp_path.display());

        tab.navigate_to(&url)
            .map_err(|e| pdf_error("NAVIGATION", e))?
            .wait_until_navigated()
            .map_err(|e| pdf_error("PAGE_LOAD", e))?;

        let pdf_options = PrintToPdfOptions {
            landscape: Some(false),
            display_header_footer: Some(false),
            print_background: Some(true),
            prefer_css_page_size: Some(true),
            paper_width: Some(8.27),
            paper_height: Some(11.69),
            margin_top: Some(0.39),
            margin_bottom: Some(0.39),
            margin_left: Some(0.39),
            margin_right: Some(0.39),
            ..Default::default()
        };

        let pdf_data = tab
            .print_to_pdf(Some(pdf_options))
            .map_err(|e| pdf_error("PRINT", e))?;

        let save_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| pdf_error("APP_DATA_DIR", e))?
            .join("pdfs");
        fs::create_dir_all(&save_dir).map_err(|e| pdf_error("OUTPUT_DIR", e))?;

        let safe_name = if filename.ends_with(".pdf") {
            filename
        } else {
            format!("{}.pdf", filename)
        };
        let save_path = save_dir.join(&safe_name);
        fs::write(&save_path, pdf_data).map_err(|e| pdf_error("SAVE_FILE", e))?;

        Ok(save_path.to_string_lossy().to_string())
    })();

    if let Err(e) = fs::remove_file(&temp_path) {
        eprintln!("Warning: failed to remove temp file {:?}: {}", temp_path, e);
    }

    result
}
