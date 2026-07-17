use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Duration;

use crate::worklog::{
    CreateAndFinishZentaoTasksResult, ZentaoConfig, ZentaoExecutionOption, ZentaoProjectOption,
    ZentaoTaskDraft, ZentaoTaskResult, ZentaoValidationResult,
};

#[derive(Debug, Deserialize)]
struct TokenResponse {
    token: String,
}

pub fn validate_config(config: &ZentaoConfig) -> Result<ZentaoValidationResult, String> {
    let client = build_client()?;
    match fetch_token(&client, config) {
        Ok(_) => Ok(ZentaoValidationResult {
            ok: true,
            message: "禅道连接验证成功".to_string(),
        }),
        Err(message) => Ok(ZentaoValidationResult { ok: false, message }),
    }
}

pub fn list_projects(config: &ZentaoConfig) -> Result<Vec<ZentaoProjectOption>, String> {
    let client = build_client()?;
    let token = fetch_token(&client, config)?;
    let value = get_json(&client, config, &token, "/api.php/v1/projects")?;

    Ok(extract_options(&value, &["projects", "data", "list"]))
}

pub fn list_executions(
    config: &ZentaoConfig,
    project_id: i64,
) -> Result<Vec<ZentaoExecutionOption>, String> {
    let client = build_client()?;
    let token = fetch_token(&client, config)?;
    let path = format!("/api.php/v1/projects/{project_id}/executions");
    let value = get_json(&client, config, &token, &path)?;

    Ok(extract_options(&value, &["executions", "data", "list"])
        .into_iter()
        .map(|option| ZentaoExecutionOption {
            id: option.id,
            name: option.name,
        })
        .collect())
}

pub fn create_and_finish_tasks(
    config: &ZentaoConfig,
    tasks: &[ZentaoTaskDraft],
    finished_at: &str,
) -> Result<CreateAndFinishZentaoTasksResult, String> {
    let client = build_client()?;
    let token = fetch_token(&client, config)?;
    let mut results = Vec::new();

    for task in tasks {
        let result = match create_task(&client, config, &token, task) {
            Ok(task_id) => match finish_task(&client, config, &token, task_id, task, finished_at) {
                Ok(()) => ZentaoTaskResult {
                    draft_id: task.id.clone(),
                    ok: true,
                    message: "任务已创建并完成".to_string(),
                    task_id: Some(task_id),
                },
                Err(message) => ZentaoTaskResult {
                    draft_id: task.id.clone(),
                    ok: false,
                    message,
                    task_id: Some(task_id),
                },
            },
            Err(message) => ZentaoTaskResult {
                draft_id: task.id.clone(),
                ok: false,
                message,
                task_id: None,
            },
        };

        results.push(result);
    }

    Ok(CreateAndFinishZentaoTasksResult { results })
}

fn build_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| format!("创建禅道 HTTP 客户端失败：{error}"))
}

fn fetch_token(client: &Client, config: &ZentaoConfig) -> Result<String, String> {
    validate_basic_config(config)?;
    let url = build_url(config, "/api.php/v1/tokens");
    let response = client
        .post(url)
        .json(&json!({
            "account": &config.account,
            "password": &config.password,
        }))
        .send()
        .map_err(|error| format!("获取禅道 Token 失败：{error}"))?;

    if !response.status().is_success() {
        return Err(format!("获取禅道 Token 失败：HTTP {}", response.status()));
    }

    response
        .json::<TokenResponse>()
        .map(|body| body.token)
        .map_err(|error| format!("解析禅道 Token 失败：{error}"))
}

fn get_json(
    client: &Client,
    config: &ZentaoConfig,
    token: &str,
    path: &str,
) -> Result<Value, String> {
    let response = client
        .get(build_url(config, path))
        .header("Token", token)
        .send()
        .map_err(|error| format!("请求禅道数据失败：{error}"))?;

    if !response.status().is_success() {
        return Err(format!("请求禅道数据失败：HTTP {}", response.status()));
    }

    response
        .json::<Value>()
        .map_err(|error| format!("解析禅道数据失败：{error}"))
}

fn create_task(
    client: &Client,
    config: &ZentaoConfig,
    token: &str,
    task: &ZentaoTaskDraft,
) -> Result<i64, String> {
    let path = format!("/api.php/v1/executions/{}/tasks", task.execution_id);
    let mut payload = json!({
        "name": &task.name,
        "type": &task.task_type,
        "assignedTo": &task.assigned_to,
        "estimate": task.estimate,
        "estStarted": &task.est_started,
        "deadline": &task.deadline,
    });

    if !task.desc.trim().is_empty() {
        payload["desc"] = json!(&task.desc);
    }

    let response = client
        .post(build_url(config, &path))
        .header("Token", token)
        .json(&payload)
        .send()
        .map_err(|error| format!("创建禅道任务失败：{error}"))?;

    if !response.status().is_success() {
        return Err(format!("创建禅道任务失败：HTTP {}", response.status()));
    }

    let value = response
        .json::<Value>()
        .map_err(|error| format!("解析禅道任务创建结果失败：{error}"))?;
    value
        .get("id")
        .and_then(Value::as_i64)
        .ok_or_else(|| "禅道任务创建成功但未返回任务 ID".to_string())
}

fn finish_task(
    client: &Client,
    config: &ZentaoConfig,
    token: &str,
    task_id: i64,
    task: &ZentaoTaskDraft,
    finished_at: &str,
) -> Result<(), String> {
    let path = format!("/api.php/v1/tasks/{task_id}/finish");
    let mut payload = json!({
        "currentConsumed": task.estimate,
        "finishedDate": finished_at,
        "realStarted": &task.est_started,
        "comment": &task.finish_comment,
    });

    if !task.assigned_to.trim().is_empty() {
        payload["assignedTo"] = json!(&task.assigned_to);
    }

    let response = client
        .post(build_url(config, &path))
        .header("Token", token)
        .json(&payload)
        .send()
        .map_err(|error| format!("完成禅道任务失败：{error}"))?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("完成禅道任务失败：HTTP {}", response.status()))
    }
}

fn validate_basic_config(config: &ZentaoConfig) -> Result<(), String> {
    if config.base_url.trim().is_empty() {
        return Err("请填写禅道 API 地址".to_string());
    }

    if config.account.trim().is_empty() {
        return Err("请填写禅道账号".to_string());
    }

    if config.password.trim().is_empty() {
        return Err("请填写禅道密码".to_string());
    }

    Ok(())
}

fn build_url(config: &ZentaoConfig, path: &str) -> String {
    format!("{}{}", config.base_url.trim_end_matches('/'), path)
}

fn extract_options(value: &Value, keys: &[&str]) -> Vec<ZentaoProjectOption> {
    keys.iter()
        .filter_map(|key| value.get(*key).and_then(Value::as_array))
        .next()
        .or_else(|| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let id = item.get("id").and_then(|value| {
                        value.as_i64().or_else(|| value.as_str()?.parse().ok())
                    })?;
                    let name = item
                        .get("name")
                        .or_else(|| item.get("title"))
                        .and_then(Value::as_str)
                        .unwrap_or("未命名");
                    Some(ZentaoProjectOption {
                        id,
                        name: name.to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}
