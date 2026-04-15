use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

/// Resolve the Tauri app data directory.
pub fn app_data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to resolve app data dir")
}

/// Read a JSON file and deserialize into `T`. Returns `Ok(fallback)` if the file doesn't exist.
pub fn read_json_or<T: serde::de::DeserializeOwned>(path: &Path, fallback: T) -> Result<T, String> {
    if !path.exists() {
        return Ok(fallback);
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

/// Read a JSON file as raw `serde_json::Value` for custom deserialization.
/// Returns `Ok(Value::Null)` if the file doesn't exist.
#[cfg(test)]
pub(crate) fn read_json_value(path: &Path) -> Result<serde_json::Value, String> {
    if !path.exists() {
        return Ok(serde_json::Value::Null);
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

/// Write data to a JSON file using atomic write (temp file → flush → sync → rename).
/// Prevents data corruption on crash by never leaving a partially-written target file.
pub fn write_json_atomic<T: serde::Serialize>(path: &Path, data: &T) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("存储路径无效，缺少父目录".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let temp_path = temp_file_for(path)?;
    let json = serde_json::to_vec_pretty(data).map_err(|e| e.to_string())?;
    let result = (|| -> Result<(), String> {
        let mut file = File::create(&temp_path).map_err(|e| e.to_string())?;
        file.write_all(&json).map_err(|e| e.to_string())?;
        file.flush().map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        fs::rename(&temp_path, path).map_err(|e| e.to_string())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }

    result
}

/// Generate a unique temporary file path alongside the target file.
fn temp_file_for(path: &Path) -> Result<PathBuf, String> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("存储路径无效，无法生成临时文件名".to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();

    Ok(path.with_file_name(format!(
        "{}.tmp-{}-{}",
        file_name,
        std::process::id(),
        timestamp
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn unique_test_dir(label: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("timestamp should be valid")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "resume-builder-persist-tests-{}-{}-{}",
            label,
            std::process::id(),
            timestamp
        ))
    }

    #[test]
    fn read_json_or_returns_fallback_when_file_missing() {
        let dir = unique_test_dir("missing");
        fs::create_dir_all(&dir).expect("temp dir should be created");
        let path = dir.join("nonexistent.json");
        let fallback: Vec<String> = vec!["fallback".to_string()];
        let result = read_json_or(&path, fallback.clone()).expect("should return fallback");
        assert_eq!(result, fallback);
        fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[test]
    fn write_and_read_roundtrip() {
        let dir = unique_test_dir("roundtrip");
        fs::create_dir_all(&dir).expect("temp dir should be created");
        let path = dir.join("test.json");

        #[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq)]
        struct TestData {
            name: String,
            value: i32,
        }

        let original = TestData {
            name: "hello".to_string(),
            value: 42,
        };
        write_json_atomic(&path, &original).expect("write should succeed");
        let loaded: TestData =
            serde_json::from_value(read_json_value(&path).expect("read should succeed"))
                .expect("deserialization should succeed");
        assert_eq!(loaded, original);

        fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[test]
    fn atomic_write_replaces_without_temp_artifacts() {
        let dir = unique_test_dir("atomic");
        fs::create_dir_all(&dir).expect("temp dir should be created");
        let path = dir.join("data.json");

        let first = serde_json::json!({"version": 1});
        write_json_atomic(&path, &first).expect("first write should succeed");

        let second = serde_json::json!({"version": 2});
        write_json_atomic(&path, &second).expect("second write should succeed");

        let loaded: serde_json::Value = read_json_value(&path).expect("read should succeed");
        assert_eq!(loaded["version"], 2);

        let artifacts: Vec<String> = fs::read_dir(&dir)
            .expect("dir should be readable")
            .filter_map(|e| e.ok())
            .filter_map(|e| e.file_name().to_str().map(|s| s.to_string()))
            .filter(|n| n != "data.json")
            .collect();
        assert!(
            artifacts.is_empty(),
            "unexpected temp files: {:?}",
            artifacts
        );

        fs::remove_dir_all(&dir).expect("cleanup");
    }
}
