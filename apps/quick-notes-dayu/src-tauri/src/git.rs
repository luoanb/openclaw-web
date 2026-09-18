use std::process::Command;

use crate::worklog::{
    GitCommitRecord, RepositoryEnvironment, RepositoryScanResult, RepositoryValidationResult,
    WorklogRepositoryConfig,
};

const FIELD_SEPARATOR: char = '\u{1f}';
const RECORD_SEPARATOR: char = '\u{1e}';
const GIT_FORMAT: &str = "%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1e";

/// Build a command that never pops up a console window. Without
/// `CREATE_NO_WINDOW` (0x0800_0000) the spawned `git`/`wsl.exe` process briefly
/// flashes a terminal window on Windows.
fn new_command(program: &str) -> Command {
    let mut command = Command::new(program);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
}

pub fn validate_repository(config: &WorklogRepositoryConfig) -> RepositoryValidationResult {
    match run_git(config, &["rev-parse", "--is-inside-work-tree"]) {
        Ok(output) if output.trim() == "true" => RepositoryValidationResult {
            repository_id: config.id.clone(),
            ok: true,
            message: "仓库可用".to_string(),
        },
        Ok(output) => RepositoryValidationResult {
            repository_id: config.id.clone(),
            ok: false,
            message: format!("路径不是 Git 仓库：{}", output.trim()),
        },
        Err(message) => RepositoryValidationResult {
            repository_id: config.id.clone(),
            ok: false,
            message,
        },
    }
}

pub fn scan_repository(config: &WorklogRepositoryConfig, date: &str) -> RepositoryScanResult {
    let repository_name = config.name.clone();

    if !config.enabled {
        return RepositoryScanResult {
            repository_id: config.id.clone(),
            repository_name,
            ok: true,
            message: "仓库已停用".to_string(),
            commits: Vec::new(),
        };
    }

    let since = format!("{date}T00:00:00");
    let until = format!("{date}T23:59:59");
    let pretty = format!("--pretty=format:{GIT_FORMAT}");
    let args = [
        "log",
        "--no-merges",
        "--since",
        since.as_str(),
        "--until",
        until.as_str(),
        pretty.as_str(),
    ];

    match run_git(config, &args) {
        Ok(output) => {
            let commits = parse_git_log(config, &output);
            RepositoryScanResult {
                repository_id: config.id.clone(),
                repository_name,
                ok: true,
                message: format!("{} commits", commits.len()),
                commits,
            }
        }
        Err(message) => RepositoryScanResult {
            repository_id: config.id.clone(),
            repository_name,
            ok: false,
            message,
            commits: Vec::new(),
        },
    }
}

fn run_git(config: &WorklogRepositoryConfig, git_args: &[&str]) -> Result<String, String> {
    let output = match config.environment {
        RepositoryEnvironment::Windows => {
            let path = config
                .windows_path
                .as_deref()
                .ok_or_else(|| "请填写 Windows 仓库路径".to_string())?;
            let mut command = new_command("git");
            command.arg("-C").arg(path).args(git_args);
            command.output()
        }
        RepositoryEnvironment::Wsl => {
            let distro = config
                .wsl_distro
                .as_deref()
                .ok_or_else(|| "请填写 WSL 发行版".to_string())?;
            let path = config
                .wsl_path
                .as_deref()
                .ok_or_else(|| "请填写 WSL 仓库路径".to_string())?;
            let mut command = new_command("wsl.exe");
            command
                .arg("-d")
                .arg(distro)
                .arg("--")
                .arg("git")
                .arg("-C")
                .arg(path)
                .args(git_args);
            command.output()
        }
    }
    .map_err(|error| format!("执行 Git 命令失败：{error}"))?;

    if output.status.success() {
        return String::from_utf8(output.stdout)
            .map_err(|error| format!("解析 Git 输出失败：{error}"));
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let message = if stderr.trim().is_empty() {
        stdout.trim().to_string()
    } else {
        stderr.trim().to_string()
    };

    Err(if message.is_empty() {
        "Git 命令执行失败".to_string()
    } else {
        message
    })
}

fn parse_git_log(config: &WorklogRepositoryConfig, output: &str) -> Vec<GitCommitRecord> {
    output
        .split(RECORD_SEPARATOR)
        .filter_map(|record| {
            let trimmed = record.trim();
            if trimmed.is_empty() {
                return None;
            }

            let fields = trimmed.split(FIELD_SEPARATOR).collect::<Vec<_>>();
            if fields.len() < 6 {
                return None;
            }

            if let Some(filter) = config.author_filter.as_deref() {
                let filter = filter.trim();
                if !filter.is_empty() && !fields[2].contains(filter) && !fields[3].contains(filter)
                {
                    return None;
                }
            }

            Some(GitCommitRecord {
                repository_id: config.id.clone(),
                repository_name: config.name.clone(),
                hash: fields[0].to_string(),
                short_hash: fields[1].to_string(),
                author_name: fields[2].to_string(),
                author_email: fields[3].to_string(),
                committed_at: fields[4].to_string(),
                message: fields[5].to_string(),
            })
        })
        .collect()
}
