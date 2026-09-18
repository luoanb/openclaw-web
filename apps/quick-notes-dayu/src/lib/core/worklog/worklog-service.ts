import type {
  GitCommitRecord,
  RepositoryScanResult,
  WorklogConfig,
  WorklogRepositoryConfig,
  ZentaoTaskResult,
} from "./worklog-types";

export class WorklogService {
  static createDefaultConfig(): WorklogConfig {
    return {
      repositories: [],
      selectedRepositoryIds: null,
      zentao: {
        baseUrl: "",
        account: "",
        password: "",
        projectId: null,
        executionId: null,
        assignedTo: null,
        taskType: "devel",
        estimate: 1,
        titleTemplate: "[{date}] {repo} 禅道",
        descriptionTemplate: null,
        finishCommentTemplate: null,
      },
      schedule: {
        enabled: false,
        time: "18:30",
      },
      lastRun: null,
    };
  }

  static normalizeConfig(config: Partial<WorklogConfig> | null | undefined): WorklogConfig {
    const fallback = WorklogService.createDefaultConfig();

    return {
      repositories: Array.isArray(config?.repositories) ? config.repositories : [],
      selectedRepositoryIds: config?.selectedRepositoryIds ?? null,
      zentao: {
        ...fallback.zentao,
        ...(config?.zentao ?? {}),
        estimate: Number(config?.zentao?.estimate ?? fallback.zentao.estimate),
      },
      schedule: {
        ...fallback.schedule,
        ...(config?.schedule ?? {}),
      },
      lastRun: config?.lastRun ?? null,
    };
  }

  /**
   * Resolve the repositories selected for the daily clock-in. When the user has
   * never made a choice (`null`), every known repository is selected; otherwise
   * only the remembered ids that still exist are kept.
   */
  static resolveSelectedRepositoryIds(config: WorklogConfig): string[] {
    const knownIds = config.repositories.map((repository) => repository.id);

    if (config.selectedRepositoryIds == null) {
      return knownIds;
    }

    const savedIds = new Set(config.selectedRepositoryIds);
    return knownIds.filter((id) => savedIds.has(id));
  }

  static today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  static nowForZentao(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  static createRepository(environment: WorklogRepositoryConfig["environment"]): WorklogRepositoryConfig {
    const id = crypto.randomUUID();

    return {
      id,
      name: environment === "wsl" ? "WSL 仓库" : "Windows 仓库",
      enabled: true,
      environment,
      windowsPath: "",
      wslDistro: environment === "wsl" ? "Ubuntu" : null,
      wslPath: "",
      wslUncPath: null,
      authorFilter: null,
      branch: null,
    };
  }

  static flattenCommits(results: RepositoryScanResult[]): GitCommitRecord[] {
    return results.flatMap((result) => result.commits);
  }

  /** Stable identity for a commit across repositories. */
  static commitKey(commit: GitCommitRecord): string {
    return `${commit.repositoryId}:${commit.hash}`;
  }

  static selectCommits(commits: GitCommitRecord[], selectedKeys: string[]): GitCommitRecord[] {
    const keys = new Set(selectedKeys);
    return commits.filter((commit) => keys.has(WorklogService.commitKey(commit)));
  }

  static filterCommits(commits: GitCommitRecord[], query: string): GitCommitRecord[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return commits;
    }

    return commits.filter((commit) =>
      [
        commit.repositoryName,
        commit.message,
        commit.shortHash,
        commit.hash,
        commit.authorName,
        commit.authorEmail,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }

  static summarizeTaskResults(results: ZentaoTaskResult[]): string {
    const success = results.filter((result) => result.ok).length;
    const failed = results.length - success;

    return `成功 ${success} 个，失败 ${failed} 个`;
  }

  static isZentaoConnectionConfigured(config: WorklogConfig): boolean {
    return (
      config.zentao.baseUrl.trim().length > 0 &&
      config.zentao.account.trim().length > 0 &&
      config.zentao.password.trim().length > 0
    );
  }

  static getSelectedRepositories(
    config: WorklogConfig,
    selectedRepositoryIds: string[]
  ): WorklogRepositoryConfig[] {
    const selectedIds = new Set(selectedRepositoryIds);

    return config.repositories
      .filter((repository) => selectedIds.has(repository.id))
      .map((repository) => ({
        ...repository,
        enabled: true,
      }));
  }

  static isDailyConfigComplete(config: WorklogConfig, selectedRepositoryIds: string[]): boolean {
    return (
      WorklogService.isZentaoConnectionConfigured(config) &&
      Boolean(config.zentao.projectId) &&
      Boolean(config.zentao.executionId) &&
      selectedRepositoryIds.length > 0
    );
  }

  static canEnableSchedule(config: WorklogConfig, selectedRepositoryIds: string[]): boolean {
    return WorklogService.isDailyConfigComplete(config, selectedRepositoryIds);
  }
}
