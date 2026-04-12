use headless_chrome::{Browser, types::PrintToPdfOptions};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn write_temp_html(html: &str) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join("resume-builder");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("print.html");
    fs::write(&path, html).map_err(|e| e.to_string())?;
    Ok(path)
}

#[tauri::command]
pub async fn generate_pdf(
    app: tauri::AppHandle,
    html: String,
    filename: String,
) -> Result<String, String> {
    let browser = Browser::default().map_err(|e| format!("Failed to launch browser: {}", e))?;

    let tab = browser.new_tab().map_err(|e| format!("Failed to create tab: {}", e))?;

    let temp_path = write_temp_html(&html)?;
    let url = format!("file://{}", temp_path.display());

    tab.navigate_to(&url)
        .map_err(|e| format!("Navigation failed: {}", e))?
        .wait_until_navigated()
        .map_err(|e| format!("Wait failed: {}", e))?;

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
        .map_err(|e| format!("PDF generation failed: {}", e))?;

    let save_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?
        .join("pdfs");
    fs::create_dir_all(&save_dir).map_err(|e| e.to_string())?;

    let safe_name = if filename.ends_with(".pdf") { filename } else { format!("{}.pdf", filename) };
    let save_path = save_dir.join(&safe_name);
    fs::write(&save_path, pdf_data).map_err(|e| format!("Failed to write PDF: {}", e))?;

    let _ = fs::remove_file(&temp_path);
    if let Err(e) = fs::remove_file(&temp_path) {
        eprintln!("Warning: failed to remove temp file {:?}: {}", temp_path, e);
    }

    Ok(save_path.to_string_lossy().to_string())
}
