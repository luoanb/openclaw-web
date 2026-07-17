use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::worklog::WorklogConfig;

const WORKLOG_CONFIG_FILE_NAME: &str = "worklog-config.json";
const TEMP_WORKLOG_CONFIG_FILE_NAME: &str = "worklog-config.json.tmp";

pub fn load_worklog_config(app: &AppHandle) -> Result<WorklogConfig, String> {
    let config_path = get_worklog_config_path(app)?;

    if !config_path.exists() {
        return Ok(WorklogConfig::default());
    }

    let contents = fs::read_to_string(&config_path)
        .map_err(|error| format!("读取禅道打卡配置失败：{error}"))?;
    serde_json::from_str::<WorklogConfig>(&contents)
        .map_err(|error| format!("解析禅道打卡配置失败：{error}"))
}

pub fn save_worklog_config(app: &AppHandle, config: &WorklogConfig) -> Result<(), String> {
    let data_dir = get_data_dir(app)?;
    fs::create_dir_all(&data_dir).map_err(|error| format!("创建数据目录失败：{error}"))?;

    let config_path = data_dir.join(WORKLOG_CONFIG_FILE_NAME);
    let temp_path = data_dir.join(TEMP_WORKLOG_CONFIG_FILE_NAME);
    let contents = serde_json::to_string_pretty(config)
        .map_err(|error| format!("序列化禅道打卡配置失败：{error}"))?;

    fs::write(&temp_path, contents).map_err(|error| format!("写入临时配置失败：{error}"))?;
    fs::rename(&temp_path, &config_path)
        .map_err(|error| format!("保存禅道打卡配置失败：{error}"))?;

    Ok(())
}

fn get_worklog_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_data_dir(app)?.join(WORKLOG_CONFIG_FILE_NAME))
}

fn get_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("获取应用数据目录失败：{error}"))
}
