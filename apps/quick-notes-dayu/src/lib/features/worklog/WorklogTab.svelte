<script lang="ts">
  import { onMount } from "svelte";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import { WorklogRepository } from "$lib/core/worklog/worklog-repository";
  import { WorklogService } from "$lib/core/worklog/worklog-service";
  import type {
    RepositoryScanResult,
    WorklogConfig,
    WorklogRepositoryConfig,
    ZentaoExecutionOption,
    ZentaoProjectOption,
    ZentaoTaskDraft,
    ZentaoTaskResult,
  } from "$lib/core/worklog/worklog-types";

  const { t } = getLocaleStore();

  const TASK_TYPE_OPTIONS = [
    { value: "devel", label: "开发" },
    { value: "design", label: "设计" },
    { value: "request", label: "需求" },
    { value: "test", label: "测试" },
    { value: "study", label: "研究" },
    { value: "discuss", label: "讨论" },
    { value: "ui", label: "界面" },
    { value: "affair", label: "事务" },
    { value: "misc", label: "其他" },
  ];

  let { searchQuery }: { searchQuery: string } = $props();

  let config = $state<WorklogConfig>(WorklogService.createDefaultConfig());
  let date = $state(WorklogService.today());
  let loadState = $state<"loading" | "ready" | "error">("loading");
  let busy = $state(false);
  let statusMessage = $state("");
  let errorMessage = $state<string | null>(null);
  let scanResults = $state<RepositoryScanResult[]>([]);
  let taskDrafts = $state<ZentaoTaskDraft[]>([]);
  let taskResults = $state<ZentaoTaskResult[]>([]);
  let projects = $state<ZentaoProjectOption[]>([]);
  let executions = $state<ZentaoExecutionOption[]>([]);
  let lastAutoRunDate = $state<string | null>(null);

  const commits = $derived(WorklogService.flattenCommits(scanResults));
  const visibleCommits = $derived(WorklogService.filterCommits(commits, searchQuery));

  onMount(() => {
    void loadConfig();

    const timer = window.setInterval(() => {
      void maybeRunScheduledClockIn();
    }, 30_000);

    return () => window.clearInterval(timer);
  });

  async function loadConfig() {
    loadState = "loading";
    errorMessage = null;

    try {
      config = WorklogService.normalizeConfig(await WorklogRepository.loadConfig());
      loadState = "ready";
    } catch (error) {
      errorMessage = getErrorMessage(error, "读取禅道打卡配置失败");
      loadState = "error";
    }
  }

  async function saveConfig() {
    await runBusy(async () => {
      config = WorklogService.normalizeConfig(await WorklogRepository.saveConfig(config));
      statusMessage = "配置已保存";
    });
  }

  function addRepository(environment: WorklogRepositoryConfig["environment"]) {
    config = {
      ...config,
      repositories: [...config.repositories, WorklogService.createRepository(environment)],
    };
  }

  function updateRepository(repositoryId: string, patch: Partial<WorklogRepositoryConfig>) {
    config = {
      ...config,
      repositories: config.repositories.map((repository) =>
        repository.id === repositoryId ? { ...repository, ...patch } : repository
      ),
    };
  }

  function removeRepository(repositoryId: string) {
    config = {
      ...config,
      repositories: config.repositories.filter((repository) => repository.id !== repositoryId),
    };
  }

  async function scanCommits() {
    await runBusy(async () => {
      scanResults = (
        await WorklogRepository.scanGitCommits({
          repositories: config.repositories,
          date,
        })
      ).results;
      taskDrafts = [];
      taskResults = [];
      statusMessage = `抓取完成：${commits.length} 条提交`;
    });
  }

  async function validateZentao() {
    await runBusy(async () => {
      const result = await WorklogRepository.validateZentaoConfig(config.zentao);
      statusMessage = result.message;
      if (!result.ok) {
        errorMessage = result.message;
      }
    });
  }

  async function loadProjects() {
    await runBusy(async () => {
      projects = await WorklogRepository.listZentaoProjects(config.zentao);
      statusMessage = `已拉取 ${projects.length} 个项目`;
    });
  }

  async function loadExecutions() {
    if (!config.zentao.projectId) {
      errorMessage = "请先选择或填写项目 ID";
      return;
    }

    await runBusy(async () => {
      executions = await WorklogRepository.listZentaoExecutions({
        config: config.zentao,
        projectId: config.zentao.projectId ?? 0,
      });
      statusMessage = `已拉取 ${executions.length} 个迭代`;
    });
  }

  async function previewTasks() {
    await runBusy(async () => {
      taskDrafts = await WorklogRepository.previewZentaoTasks({
        config: config.zentao,
        date,
        commits: visibleCommits,
      });
      taskResults = [];
      statusMessage = `已生成 ${taskDrafts.length} 个待打卡任务`;
    });
  }

  async function createAndFinishTasks() {
    await runBusy(async () => {
      const result = await WorklogRepository.createAndFinishZentaoTasks({
        config: config.zentao,
        tasks: taskDrafts,
        finishedAt: WorklogService.nowForZentao(),
      });
      taskResults = result.results;
      config = {
        ...config,
        lastRun: {
          status: result.results.every((item) => item.ok) ? "success" : "partial-failed",
          ranAt: new Date().toISOString(),
          message: WorklogService.summarizeTaskResults(result.results),
        },
      };
      await WorklogRepository.saveConfig(config);
      statusMessage = WorklogService.summarizeTaskResults(result.results);
    });
  }

  async function maybeRunScheduledClockIn() {
    if (!config.schedule.enabled || busy) {
      return;
    }

    const today = WorklogService.today();
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    if (date !== today || currentTime !== config.schedule.time || lastAutoRunDate === today) {
      return;
    }

    lastAutoRunDate = today;
    await scanCommits();
    await previewTasks();
    if (taskDrafts.length > 0) {
      await createAndFinishTasks();
    }
  }

  async function runBusy(action: () => Promise<void>) {
    busy = true;
    errorMessage = null;

    try {
      await action();
    } catch (error) {
      errorMessage = getErrorMessage(error, "操作失败");
    } finally {
      busy = false;
    }
  }

  function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
</script>

{#if loadState === "loading"}
  <section class="grid h-full place-items-center text-sm text-muted-foreground">读取禅道打卡配置...</section>
{:else if loadState === "error"}
  <section class="grid h-full place-items-center p-6 text-center">
    <div class="max-w-sm rounded-lg border bg-card p-5">
      <h2 class="text-sm font-semibold">读取配置失败</h2>
      <p class="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
      <button class="mt-4 h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" type="button" onclick={() => void loadConfig()}>
        {t("error.retry")}
      </button>
    </div>
  </section>
{:else}
  <section class="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)_360px] bg-background text-sm">
    <aside class="min-h-0 overflow-auto border-r bg-card/50 p-4">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-sm font-semibold">{t("worklog.repositories")}</h2>
        <button class="h-8 rounded-md border px-3 text-xs font-medium" type="button" onclick={() => void saveConfig()} disabled={busy}>
          {t("common.save")}
        </button>
      </div>

      <label class="mb-3 block text-xs font-medium text-muted-foreground">
        日期
        <input class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm" type="date" bind:value={date} />
      </label>

      <div class="mb-4 grid grid-cols-2 gap-2">
        <button class="h-8 rounded-md border px-2 text-xs font-medium" type="button" onclick={() => addRepository("windows")}>
          {t("worklog.addWindowsRepo")}
        </button>
        <button class="h-8 rounded-md border px-2 text-xs font-medium" type="button" onclick={() => addRepository("wsl")}>
          {t("worklog.addWslRepo")}
        </button>
      </div>

      <div class="space-y-3">
        {#each config.repositories as repository (repository.id)}
          <div class="rounded-lg border bg-card p-3">
            <div class="mb-2 flex items-center justify-between gap-2">
              <label class="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={repository.enabled}
                  onchange={(event) =>
                    updateRepository(repository.id, {
                      enabled: (event.currentTarget as HTMLInputElement).checked,
                    })}
                />
                启用
              </label>
              <button class="text-xs text-destructive hover:underline" type="button" onclick={() => removeRepository(repository.id)}>
                {t("common.delete")}
              </button>
            </div>

            <input
              class="mb-2 h-8 w-full rounded-md border bg-background px-2"
              value={repository.name}
              placeholder="仓库名称"
              oninput={(event) => updateRepository(repository.id, { name: event.currentTarget.value })}
            />

            {#if repository.environment === "windows"}
              <input
                class="h-8 w-full rounded-md border bg-background px-2 font-mono text-xs"
                value={repository.windowsPath ?? ""}
                placeholder="D:\work-space\repo"
                oninput={(event) =>
                  updateRepository(repository.id, { windowsPath: event.currentTarget.value })}
              />
            {:else}
              <div class="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                <input
                  class="h-8 rounded-md border bg-background px-2 text-xs"
                  value={repository.wslDistro ?? ""}
                  placeholder="Ubuntu"
                  oninput={(event) =>
                    updateRepository(repository.id, { wslDistro: event.currentTarget.value })}
                />
                <input
                  class="h-8 rounded-md border bg-background px-2 font-mono text-xs"
                  value={repository.wslPath ?? ""}
                  placeholder="/home/me/repo"
                  oninput={(event) =>
                    updateRepository(repository.id, { wslPath: event.currentTarget.value })}
                />
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <div class="mt-4 rounded-lg border bg-card p-3">
        <label class="flex items-center justify-between text-xs font-medium">
          定时自动触发
          <input
            type="checkbox"
            checked={config.schedule.enabled}
            onchange={(event) =>
              (config = {
                ...config,
                schedule: { ...config.schedule, enabled: event.currentTarget.checked },
              })}
          />
        </label>
        <input
          class="mt-2 h-8 w-full rounded-md border bg-background px-2"
          type="time"
          value={config.schedule.time}
          oninput={(event) =>
            (config = { ...config, schedule: { ...config.schedule, time: event.currentTarget.value } })}
        />
        <p class="mt-2 text-xs text-muted-foreground">{t("worklog.scheduleHint")}</p>
      </div>
    </aside>

    <main class="min-h-0 overflow-auto border-r p-4">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold">{date} 的提交记录</h2>
          <p class="text-xs text-muted-foreground">{visibleCommits.length} commits</p>
        </div>
        <button class="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50" type="button" onclick={() => void scanCommits()} disabled={busy}>
          {t("worklog.scan")}
        </button>
      </div>

      {#if scanResults.length === 0}
        <div class="rounded-lg border border-dashed bg-card/60 px-4 py-8 text-center text-muted-foreground">
          {t("worklog.emptyCommits")}
        </div>
      {:else}
        <div class="space-y-4">
          {#each scanResults as result (result.repositoryId)}
            <section class="overflow-hidden rounded-lg border bg-card">
              <div class="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                <div>
                  <h3 class="text-sm font-medium">{result.repositoryName}</h3>
                  <p class:text-destructive={!result.ok} class="text-xs text-muted-foreground">{result.message}</p>
                </div>
                <span class="text-xs text-muted-foreground">{result.commits.length}</span>
              </div>
              {#if result.commits.length > 0}
                <div class="divide-y">
                  {#each result.commits as commit (commit.hash)}
                    <div class="grid grid-cols-[72px_minmax(0,1fr)_72px] gap-3 px-3 py-2 text-xs">
                      <span class="font-mono text-muted-foreground">{commit.committedAt.slice(11, 16)}</span>
                      <div class="min-w-0">
                        <p class="truncate text-foreground">{commit.message}</p>
                        <p class="truncate text-muted-foreground">{commit.authorName} · {commit.repositoryName}</p>
                      </div>
                      <span class="font-mono text-muted-foreground">{commit.shortHash}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </section>
          {/each}
        </div>
      {/if}
    </main>

    <aside class="min-h-0 overflow-auto bg-card/50 p-4">
      <div class="mb-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold">{t("worklog.zentao")}</h2>
            <p class="text-xs text-muted-foreground">创建任务后立即完成</p>
          </div>
          <button
            class="h-8 shrink-0 rounded-md border px-3 text-xs font-medium"
            type="button"
            onclick={() => void saveConfig()}
            disabled={busy}
          >
            保存禅道配置
          </button>
        </div>
      </div>

      <div class="space-y-3">
        <input class="h-8 w-full rounded-md border bg-background px-2" bind:value={config.zentao.baseUrl} placeholder="https://zentao.example.com" />
        <input class="h-8 w-full rounded-md border bg-background px-2" bind:value={config.zentao.account} placeholder="账号" />
        <input class="h-8 w-full rounded-md border bg-background px-2" bind:value={config.zentao.password} placeholder="密码" type="password" />
        <label class="block text-xs font-medium text-muted-foreground">
          指派账号
          <input
            class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
            bind:value={config.zentao.assignedTo}
            placeholder="不填则使用当前登录账号"
          />
          <span class="mt-1 block text-[11px] leading-4 text-muted-foreground">
            创建任务时的 assignedTo；任务会创建后立即完成，通常填自己的禅道账号即可。
          </span>
        </label>

        <div class="grid grid-cols-2 gap-2">
          <button class="h-8 rounded-md border px-2 text-xs font-medium" type="button" onclick={() => void validateZentao()} disabled={busy}>
            {t("worklog.validate")}
          </button>
          <button class="h-8 rounded-md border px-2 text-xs font-medium" type="button" onclick={() => void loadProjects()} disabled={busy}>
            {t("worklog.loadProjects")}
          </button>
        </div>

        <label class="block text-xs font-medium text-muted-foreground">
          项目
          <select
            class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
            value={config.zentao.projectId ?? ""}
            onchange={(event) =>
              (config = {
                ...config,
                zentao: {
                  ...config.zentao,
                  projectId: Number(event.currentTarget.value) || null,
                  executionId: null,
                },
              })}
          >
            <option value="">选择项目</option>
            {#each projects as project (project.id)}
              <option value={project.id}>{project.name}</option>
            {/each}
          </select>
        </label>

        <button class="h-8 w-full rounded-md border px-2 text-xs font-medium" type="button" onclick={() => void loadExecutions()} disabled={busy || !config.zentao.projectId}>
          {t("worklog.loadExecutions")}
        </button>

        <label class="block text-xs font-medium text-muted-foreground">
          迭代
          <select
            class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
            value={config.zentao.executionId ?? ""}
            onchange={(event) =>
              (config = {
                ...config,
                zentao: {
                  ...config.zentao,
                  executionId: Number(event.currentTarget.value) || null,
                },
              })}
          >
            <option value="">选择迭代</option>
            {#each executions as execution (execution.id)}
              <option value={execution.id}>{execution.name}</option>
            {/each}
          </select>
        </label>

        <div class="grid grid-cols-2 gap-2">
          <select
            class="h-8 rounded-md border bg-background px-2"
            value={config.zentao.taskType}
            onchange={(event) =>
              (config = {
                ...config,
                zentao: { ...config.zentao, taskType: event.currentTarget.value },
              })}
          >
            {#each TASK_TYPE_OPTIONS as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          <input class="h-8 rounded-md border bg-background px-2" bind:value={config.zentao.estimate} min="0" step="0.5" type="number" />
        </div>

        <input class="h-8 w-full rounded-md border bg-background px-2" bind:value={config.zentao.titleTemplate} placeholder={"[{date}] {repo} 禅道打卡"} />

        <div class="grid grid-cols-2 gap-2">
          <button class="h-8 rounded-md border px-2 text-xs font-medium" type="button" onclick={() => void previewTasks()} disabled={busy || visibleCommits.length === 0}>
            {t("worklog.preview")}
          </button>
          <button class="h-8 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground disabled:opacity-50" type="button" onclick={() => void createAndFinishTasks()} disabled={busy || taskDrafts.length === 0}>
            {t("worklog.createAndFinish")}
          </button>
        </div>
      </div>

      {#if statusMessage}
        <p class="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-xs">{statusMessage}</p>
      {/if}
      {#if errorMessage}
        <p class="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </p>
      {/if}

      {#if taskDrafts.length > 0}
        <section class="mt-4 rounded-lg border bg-card p-3">
          <h3 class="text-sm font-medium">待创建并完成</h3>
          {#each taskDrafts as task (task.id)}
            <div class="mt-3 border-t pt-3 text-xs">
              <p class="font-medium">{task.name}</p>
              <p class="mt-1 text-muted-foreground">预计 {task.estimate}h · {task.assignedTo}</p>
              <pre class="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-mono text-[11px]">{task.desc}</pre>
            </div>
          {/each}
        </section>
      {/if}

      {#if taskResults.length > 0}
        <section class="mt-4 rounded-lg border bg-card p-3">
          <h3 class="text-sm font-medium">打卡结果</h3>
          <div class="mt-2 space-y-2">
            {#each taskResults as result (result.draftId)}
              <p class:text-destructive={!result.ok} class="text-xs text-muted-foreground">
                {result.ok ? "成功" : "失败"} {result.taskId ? `#${result.taskId}` : ""} · {result.message}
              </p>
            {/each}
          </div>
        </section>
      {/if}
    </aside>
  </section>
{/if}
