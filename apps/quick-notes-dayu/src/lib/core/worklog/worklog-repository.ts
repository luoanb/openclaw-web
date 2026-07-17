import { invoke } from "@tauri-apps/api/core";

import type {
  CreateAndFinishZentaoTasksRequest,
  CreateAndFinishZentaoTasksResult,
  ListZentaoExecutionsRequest,
  PreviewZentaoTasksRequest,
  RepositoryValidationResult,
  ScanGitCommitsRequest,
  ScanGitCommitsResult,
  WorklogConfig,
  WorklogRepositoryConfig,
  ZentaoConfig,
  ZentaoExecutionOption,
  ZentaoProjectOption,
  ZentaoTaskDraft,
  ZentaoValidationResult,
} from "./worklog-types";

export class WorklogRepository {
  static async loadConfig(): Promise<WorklogConfig> {
    try {
      return await invoke<WorklogConfig>("load_worklog_config");
    } catch (error) {
      throw new Error(this.toMessage(error, "读取禅道打卡配置失败"));
    }
  }

  static async saveConfig(config: WorklogConfig): Promise<WorklogConfig> {
    try {
      return await invoke<WorklogConfig>("save_worklog_config", { config });
    } catch (error) {
      throw new Error(this.toMessage(error, "保存禅道打卡配置失败"));
    }
  }

  static async validateRepository(
    config: WorklogRepositoryConfig
  ): Promise<RepositoryValidationResult> {
    try {
      return await invoke<RepositoryValidationResult>("validate_repository", { config });
    } catch (error) {
      throw new Error(this.toMessage(error, "验证仓库失败"));
    }
  }

  static async scanGitCommits(request: ScanGitCommitsRequest): Promise<ScanGitCommitsResult> {
    try {
      return await invoke<ScanGitCommitsResult>("scan_git_commits", { request });
    } catch (error) {
      throw new Error(this.toMessage(error, "抓取提交失败"));
    }
  }

  static async validateZentaoConfig(config: ZentaoConfig): Promise<ZentaoValidationResult> {
    try {
      return await invoke<ZentaoValidationResult>("validate_zentao_config", { config });
    } catch (error) {
      throw new Error(this.toMessage(error, "验证禅道连接失败"));
    }
  }

  static async listZentaoProjects(config: ZentaoConfig): Promise<ZentaoProjectOption[]> {
    try {
      return await invoke<ZentaoProjectOption[]>("list_zentao_projects", { config });
    } catch (error) {
      throw new Error(this.toMessage(error, "拉取禅道项目失败"));
    }
  }

  static async listZentaoExecutions(
    request: ListZentaoExecutionsRequest
  ): Promise<ZentaoExecutionOption[]> {
    try {
      return await invoke<ZentaoExecutionOption[]>("list_zentao_executions", { request });
    } catch (error) {
      throw new Error(this.toMessage(error, "拉取禅道迭代失败"));
    }
  }

  static async previewZentaoTasks(request: PreviewZentaoTasksRequest): Promise<ZentaoTaskDraft[]> {
    try {
      return await invoke<ZentaoTaskDraft[]>("preview_zentao_tasks", { request });
    } catch (error) {
      throw new Error(this.toMessage(error, "生成禅道任务预览失败"));
    }
  }

  static async createAndFinishZentaoTasks(
    request: CreateAndFinishZentaoTasksRequest
  ): Promise<CreateAndFinishZentaoTasksResult> {
    try {
      return await invoke<CreateAndFinishZentaoTasksResult>("create_and_finish_zentao_tasks", {
        request,
      });
    } catch (error) {
      throw new Error(this.toMessage(error, "禅道打卡失败"));
    }
  }

  private static toMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return fallback;
  }
}
