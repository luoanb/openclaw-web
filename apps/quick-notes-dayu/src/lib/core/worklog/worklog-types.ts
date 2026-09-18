export type RepositoryEnvironment = "windows" | "wsl";

export interface WorklogRepositoryConfig {
  id: string;
  name: string;
  enabled: boolean;
  environment: RepositoryEnvironment;
  windowsPath?: string | null;
  wslDistro?: string | null;
  wslPath?: string | null;
  wslUncPath?: string | null;
  authorFilter?: string | null;
  branch?: string | null;
}

export interface ZentaoConfig {
  baseUrl: string;
  account: string;
  password: string;
  projectId?: number | null;
  executionId?: number | null;
  assignedTo?: string | null;
  taskType: string;
  estimate: number;
  titleTemplate: string;
  descriptionTemplate?: string | null;
  finishCommentTemplate?: string | null;
}

export interface WorklogScheduleConfig {
  enabled: boolean;
  time: string;
}

export interface WorklogRunSummary {
  status: string;
  ranAt: string;
  message: string;
}

export interface WorklogConfig {
  repositories: WorklogRepositoryConfig[];
  /** Repositories picked for the daily clock-in. `null` means "never chosen yet". */
  selectedRepositoryIds?: string[] | null;
  zentao: ZentaoConfig;
  schedule: WorklogScheduleConfig;
  lastRun?: WorklogRunSummary | null;
}

export interface GitCommitRecord {
  repositoryId: string;
  repositoryName: string;
  hash: string;
  shortHash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  committedAt: string;
}

export interface RepositoryValidationResult {
  repositoryId: string;
  ok: boolean;
  message: string;
}

export interface ScanGitCommitsRequest {
  repositories: WorklogRepositoryConfig[];
  date: string;
}

export interface RepositoryScanResult {
  repositoryId: string;
  repositoryName: string;
  ok: boolean;
  message: string;
  commits: GitCommitRecord[];
}

export interface ScanGitCommitsResult {
  date: string;
  results: RepositoryScanResult[];
}

export interface ZentaoValidationResult {
  ok: boolean;
  message: string;
}

export interface ZentaoProjectOption {
  id: number;
  name: string;
}

export interface ZentaoExecutionOption {
  id: number;
  name: string;
}

export interface ListZentaoExecutionsRequest {
  config: ZentaoConfig;
  projectId: number;
}

export interface PreviewZentaoTasksRequest {
  config: ZentaoConfig;
  date: string;
  commits: GitCommitRecord[];
}

export interface ZentaoTaskDraft {
  id: string;
  commitKey: string;
  executionId: number;
  date: string;
  name: string;
  taskType: string;
  assignedTo: string;
  estimate: number;
  estStarted: string;
  deadline: string;
  desc: string;
  finishComment: string;
}

export interface CreateAndFinishZentaoTasksRequest {
  config: ZentaoConfig;
  tasks: ZentaoTaskDraft[];
  finishedAt: string;
}

export interface ZentaoTaskResult {
  draftId: string;
  ok: boolean;
  message: string;
  taskId?: number | null;
}

export interface CreateAndFinishZentaoTasksResult {
  results: ZentaoTaskResult[];
}
