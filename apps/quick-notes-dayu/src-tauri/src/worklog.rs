use serde::{Deserialize, Serialize};

use crate::config;
use crate::git;
use crate::zentao;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorklogConfig {
    pub repositories: Vec<WorklogRepositoryConfig>,
    /// Repository ids the user picked for the daily clock-in. `None` means the
    /// user has never made a choice, so the UI falls back to selecting all.
    #[serde(default)]
    pub selected_repository_ids: Option<Vec<String>>,
    pub zentao: ZentaoConfig,
    pub schedule: WorklogScheduleConfig,
    pub last_run: Option<WorklogRunSummary>,
}

impl Default for WorklogConfig {
    fn default() -> Self {
        Self {
            repositories: Vec::new(),
            selected_repository_ids: None,
            zentao: ZentaoConfig::default(),
            schedule: WorklogScheduleConfig::default(),
            last_run: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorklogRepositoryConfig {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub environment: RepositoryEnvironment,
    pub windows_path: Option<String>,
    pub wsl_distro: Option<String>,
    pub wsl_path: Option<String>,
    pub wsl_unc_path: Option<String>,
    pub author_filter: Option<String>,
    pub branch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RepositoryEnvironment {
    Windows,
    Wsl,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZentaoConfig {
    pub base_url: String,
    pub account: String,
    pub password: String,
    pub project_id: Option<i64>,
    pub execution_id: Option<i64>,
    pub assigned_to: Option<String>,
    pub task_type: String,
    pub estimate: f64,
    pub title_template: String,
    pub description_template: Option<String>,
    pub finish_comment_template: Option<String>,
}

impl Default for ZentaoConfig {
    fn default() -> Self {
        Self {
            base_url: String::new(),
            account: String::new(),
            password: String::new(),
            project_id: None,
            execution_id: None,
            assigned_to: None,
            task_type: "devel".to_string(),
            estimate: 1.0,
            title_template: "[{date}] {repo}".to_string(),
            description_template: None,
            finish_comment_template: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorklogScheduleConfig {
    pub enabled: bool,
    pub time: String,
}

impl Default for WorklogScheduleConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            time: "18:30".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorklogRunSummary {
    pub status: String,
    pub ran_at: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitRecord {
    pub repository_id: String,
    pub repository_name: String,
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub committed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryValidationResult {
    pub repository_id: String,
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanGitCommitsRequest {
    pub repositories: Vec<WorklogRepositoryConfig>,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryScanResult {
    pub repository_id: String,
    pub repository_name: String,
    pub ok: bool,
    pub message: String,
    pub commits: Vec<GitCommitRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanGitCommitsResult {
    pub date: String,
    pub results: Vec<RepositoryScanResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZentaoValidationResult {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZentaoProjectOption {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZentaoExecutionOption {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListZentaoExecutionsRequest {
    pub config: ZentaoConfig,
    pub project_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewZentaoTasksRequest {
    pub config: ZentaoConfig,
    pub date: String,
    pub commits: Vec<GitCommitRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZentaoTaskDraft {
    pub id: String,
    pub commit_key: String,
    pub execution_id: i64,
    pub date: String,
    pub name: String,
    pub task_type: String,
    pub assigned_to: String,
    pub estimate: f64,
    pub est_started: String,
    pub deadline: String,
    pub desc: String,
    pub finish_comment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAndFinishZentaoTasksRequest {
    pub config: ZentaoConfig,
    pub tasks: Vec<ZentaoTaskDraft>,
    pub finished_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZentaoTaskResult {
    pub draft_id: String,
    pub ok: bool,
    pub message: String,
    pub task_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAndFinishZentaoTasksResult {
    pub results: Vec<ZentaoTaskResult>,
}

#[tauri::command]
pub fn load_worklog_config(app: tauri::AppHandle) -> Result<WorklogConfig, String> {
    config::load_worklog_config(&app)
}

#[tauri::command]
pub fn save_worklog_config(
    app: tauri::AppHandle,
    config: WorklogConfig,
) -> Result<WorklogConfig, String> {
    config::save_worklog_config(&app, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn validate_repository(
    config: WorklogRepositoryConfig,
) -> Result<RepositoryValidationResult, String> {
    Ok(git::validate_repository(&config))
}

#[tauri::command]
pub fn scan_git_commits(request: ScanGitCommitsRequest) -> Result<ScanGitCommitsResult, String> {
    let mut results = Vec::new();

    for repository in request.repositories.iter().filter(|repo| repo.enabled) {
        results.push(git::scan_repository(repository, &request.date));
    }

    Ok(ScanGitCommitsResult {
        date: request.date,
        results,
    })
}

#[tauri::command]
pub fn validate_zentao_config(config: ZentaoConfig) -> Result<ZentaoValidationResult, String> {
    zentao::validate_config(&config)
}

#[tauri::command]
pub fn list_zentao_projects(config: ZentaoConfig) -> Result<Vec<ZentaoProjectOption>, String> {
    zentao::list_projects(&config)
}

#[tauri::command]
pub fn list_zentao_executions(
    request: ListZentaoExecutionsRequest,
) -> Result<Vec<ZentaoExecutionOption>, String> {
    zentao::list_executions(&request.config, request.project_id)
}

#[tauri::command]
pub fn preview_zentao_tasks(
    request: PreviewZentaoTasksRequest,
) -> Result<Vec<ZentaoTaskDraft>, String> {
    build_task_drafts(&request.config, &request.date, &request.commits)
}

#[tauri::command]
pub fn create_and_finish_zentao_tasks(
    request: CreateAndFinishZentaoTasksRequest,
) -> Result<CreateAndFinishZentaoTasksResult, String> {
    zentao::create_and_finish_tasks(&request.config, &request.tasks, &request.finished_at)
}

fn build_task_drafts(
    config: &ZentaoConfig,
    date: &str,
    commits: &[GitCommitRecord],
) -> Result<Vec<ZentaoTaskDraft>, String> {
    let execution_id = config
        .execution_id
        .ok_or_else(|| "请先选择禅道迭代".to_string())?;
    let assigned_to = config
        .assigned_to
        .as_deref()
        .unwrap_or(config.account.as_str())
        .trim();

    if assigned_to.is_empty() {
        return Err("请填写禅道指派账号".to_string());
    }

    if commits.is_empty() {
        return Ok(Vec::new());
    }

    let name = render_template(&config.title_template, date, commits);
    let desc = config
        .description_template
        .as_deref()
        .map(|template| render_template(template, date, commits))
        .unwrap_or_else(|| default_commit_details(commits));
    let finish_comment = config
        .finish_comment_template
        .as_deref()
        .map(|template| render_template(template, date, commits))
        .unwrap_or_else(|| default_commit_details(commits));
    let commit_key = commits
        .iter()
        .map(|commit| format!("{}:{}", commit.repository_id, commit.hash))
        .collect::<Vec<_>>()
        .join("|");

    Ok(vec![ZentaoTaskDraft {
        id: format!("{}:{commit_key}", date),
        commit_key,
        execution_id,
        date: date.to_string(),
        name,
        task_type: config.task_type.clone(),
        assigned_to: assigned_to.to_string(),
        estimate: config.estimate,
        est_started: date.to_string(),
        deadline: date.to_string(),
        desc,
        finish_comment,
    }])
}

fn render_template(template: &str, date: &str, commits: &[GitCommitRecord]) -> String {
    let first = commits.first();
    template
        .replace("{date}", date)
        .replace(
            "{repo}",
            first
                .map(|commit| commit.repository_name.as_str())
                .unwrap_or(""),
        )
        .replace(
            "{message}",
            first.map(|commit| commit.message.as_str()).unwrap_or(""),
        )
        .replace(
            "{hash}",
            first.map(|commit| commit.hash.as_str()).unwrap_or(""),
        )
        .replace(
            "{shortHash}",
            first.map(|commit| commit.short_hash.as_str()).unwrap_or(""),
        )
        .replace(
            "{author}",
            first
                .map(|commit| commit.author_name.as_str())
                .unwrap_or(""),
        )
        .replace("{count}", &commits.len().to_string())
}

fn default_commit_details(commits: &[GitCommitRecord]) -> String {
    commits
        .iter()
        .map(|commit| {
            format!(
                "- [{}] {} {} ({})",
                commit.repository_name, commit.short_hash, commit.message, commit.author_name
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}
