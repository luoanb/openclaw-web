use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const STORE_FILE_NAME: &str = "quick-notes.json";
const TEMP_STORE_FILE_NAME: &str = "quick-notes.json.tmp";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuickTask {
    id: String,
    content: String,
    status: TaskStatus,
    created_at: String,
    updated_at: String,
    completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum TaskStatus {
    Active,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuickNote {
    id: String,
    content: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuickNotesStore {
    tasks: Vec<QuickTask>,
    notes: Vec<QuickNote>,
}

#[tauri::command]
fn load_store(app: AppHandle) -> Result<QuickNotesStore, String> {
    let store_path = get_store_path(&app)?;

    if !store_path.exists() {
        return Ok(QuickNotesStore::default());
    }

    let contents = fs::read_to_string(&store_path)
        .map_err(|error| format!("读取本地数据失败：{error}"))?;
    let store = serde_json::from_str::<QuickNotesStore>(&contents)
        .map_err(|error| format!("解析本地数据失败：{error}"))?;

    validate_store(&store)?;
    Ok(store)
}

#[tauri::command]
fn save_store(app: AppHandle, store: QuickNotesStore) -> Result<QuickNotesStore, String> {
    validate_store(&store)?;

    let data_dir = get_data_dir(&app)?;
    fs::create_dir_all(&data_dir).map_err(|error| format!("创建数据目录失败：{error}"))?;

    let store_path = data_dir.join(STORE_FILE_NAME);
    let temp_path = data_dir.join(TEMP_STORE_FILE_NAME);
    let contents = serde_json::to_string_pretty(&store)
        .map_err(|error| format!("序列化本地数据失败：{error}"))?;

    fs::write(&temp_path, contents).map_err(|error| format!("写入临时数据失败：{error}"))?;
    fs::rename(&temp_path, &store_path).map_err(|error| format!("保存本地数据失败：{error}"))?;

    Ok(store)
}

fn get_store_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_data_dir(app)?.join(STORE_FILE_NAME))
}

fn get_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("获取应用数据目录失败：{error}"))
}

fn validate_store(store: &QuickNotesStore) -> Result<(), String> {
    for task in &store.tasks {
        validate_content(&task.content, "任务")?;

        if task.status == TaskStatus::Active && task.completed_at.is_some() {
            return Err("进行中任务不能包含完成时间".to_string());
        }
    }

    for note in &store.notes {
        validate_content(&note.content, "速记")?;
    }

    Ok(())
}

fn validate_content(content: &str, label: &str) -> Result<(), String> {
    if content.trim().is_empty() {
        return Err(format!("{label}内容不能为空"));
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_store, save_store])
        .run(tauri::generate_context!())
        .expect("error while running quick-notes");
}
