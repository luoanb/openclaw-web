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

  type AsyncState = "idle" | "loading" | "ready" | "error";
  type WorklogView = "init" | "clockIn";

  let { searchQuery }: { searchQuery: string } = $props();

  let config = $state<WorklogConfig>(WorklogService.createDefaultConfig());
  let date = $state(WorklogService.today());
  let loadState = $state<AsyncState>("loading");
  let projectsState = $state<AsyncState>("idle");
  let executionsState = $state<AsyncState>("idle");
  let previewState = $state<AsyncState>("idle");
  let submitState = $state<AsyncState>("idle");
  let initValidationState = $state<AsyncState>("idle");
  let activeView = $state<WorklogView>("init");
  let zentaoVerified = $state(false);
  let initValidationMessage = $state("");
  let statusMessage = $state("");
  let errorMessage = $state<string | null>(null);
  let selectedRepositoryIds = $state<string[]>([]);
  let scanResults = $state<RepositoryScanResult[]>([]);
  let taskDrafts = $state<ZentaoTaskDraft[]>([]);
  let taskResults = $state<ZentaoTaskResult[]>([]);
  let projects = $state<ZentaoProjectOption[]>([]);
  let executions = $state<ZentaoExecutionOption[]>([]);
  let lastAutoRunDate = $state<string | null>(null);

  const anyBusy = $derived(
    loadState === "loading" ||
      projectsState === "loading" ||
      executionsState === "loading" ||
      previewState === "loading" ||
      submitState === "loading"
  );
  const selectedRepositories = $derived(
    WorklogService.getSelectedRepositories(config, selectedRepositoryIds)
  );
  const commits = $derived(WorklogService.flattenCommits(scanResults));
  const visibleCommits = $derived(WorklogService.filterCommits(commits, searchQuery));
  const dailyConfigComplete = $derived(
    WorklogService.isDailyConfigComplete(config, selectedRepositoryIds)
  );
  const canEnableSchedule = $derived(
    WorklogService.canEnableSchedule(config, selectedRepositoryIds)
  );

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
      selectedRepositoryIds = config.repositories.map((repository) => repository.id);
      zentaoVerified = false;
      loadState = "ready";

      if (WorklogService.isZentaoConnectionConfigured(config)) {
        void autoValidateZentaoConfig();
      } else {
        activeView = "init";
      }
    } catch (error) {
      errorMessage = getErrorMessage(error, "读取禅道打卡配置失败");
      loadState = "error";
    }
  }

  async function saveConfig(message = "配置已保存") {
    config = WorklogService.normalizeConfig(await WorklogRepository.saveConfig(config));
    statusMessage = message;
  }

  async function autoValidateZentaoConfig() {
    initValidationState = "loading";
    initValidationMessage = "正在验证已保存的禅道连接...";
    errorMessage = null;

    try {
      const result = await WorklogRepository.validateZentaoConfig(config.zentao);
      initValidationMessage = result.message;

      if (!result.ok) {
        zentaoVerified = false;
        activeView = "init";
        initValidationState = "error";
        return;
      }

      zentaoVerified = true;
      activeView = "clockIn";
      initValidationState = "ready";
      void loadProjects(true);
    } catch (error) {
      zentaoVerified = false;
      activeView = "init";
      initValidationState = "error";
      initValidationMessage = getErrorMessage(error, "自动验证禅道连接失败");
    }
  }

  async function validateAndSaveInitConfig() {
    if (!WorklogService.isZentaoConnectionConfigured(config)) {
      initValidationMessage = "请先填写禅道地址、账号和密码。";
      return;
    }

    initValidationState = "loading";
    initValidationMessage = "正在验证禅道连接...";
    errorMessage = null;

    try {
      const result = await WorklogRepository.validateZentaoConfig(config.zentao);
      initValidationMessage = result.message;

      if (!result.ok) {
        zentaoVerified = false;
        initValidationState = "error";
        return;
      }

      zentaoVerified = true;
      await saveConfig("初始化配置已验证并保存");
      initValidationState = "ready";
      activeView = "clockIn";
      void loadProjects(true);
    } catch (error) {
      initValidationMessage = getErrorMessage(error, "验证禅道连接失败");
      initValidationState = "error";
    }
  }

  async function saveInitConfigAndOpenClockIn() {
    if (!zentaoVerified) {
      return;
    }

    initValidationState = "loading";
    try {
      await saveConfig("初始化配置已保存");
      activeView = "clockIn";
      initValidationState = "ready";
    } catch (error) {
      initValidationMessage = getErrorMessage(error, "保存初始化配置失败");
      initValidationState = "error";
    }
  }

  async function loadProjects(shouldLoadExecutions = false) {
    if (!WorklogService.isZentaoConnectionConfigured(config)) {
      return;
    }

    projectsState = "loading";
    errorMessage = null;

    try {
      projects = await WorklogRepository.listZentaoProjects(config.zentao);
      projectsState = "ready";

      if (shouldLoadExecutions && config.zentao.projectId) {
        await loadExecutions(config.zentao.projectId);
      }
    } catch (error) {
      projectsState = "error";
      errorMessage = getErrorMessage(error, "自动拉取禅道项目失败");
    }
  }

  async function loadExecutions(projectId: number) {
    executionsState = "loading";
    errorMessage = null;

    try {
      executions = await WorklogRepository.listZentaoExecutions({
        config: config.zentao,
        projectId,
      });
      executionsState = "ready";
    } catch (error) {
      executionsState = "error";
      errorMessage = getErrorMessage(error, "自动拉取禅道迭代失败");
    }
  }

  async function openPreview() {
    if (!dailyConfigComplete) {
      errorMessage = "请先选择项目、迭代和本次参与仓库。";
      return;
    }

    previewState = "loading";
    errorMessage = null;
    taskResults = [];

    try {
      const scan = await WorklogRepository.scanGitCommits({
        repositories: selectedRepositories,
        date,
      });
      scanResults = scan.results;

      const scannedCommits = WorklogService.flattenCommits(scan.results);
      taskDrafts = await WorklogRepository.previewZentaoTasks({
        config: config.zentao,
        date,
        commits: WorklogService.filterCommits(scannedCommits, searchQuery),
      });
      previewState = "ready";
      statusMessage = `已生成 ${taskDrafts.length} 个待打卡任务`;
    } catch (error) {
      previewState = "error";
      errorMessage = getErrorMessage(error, "打开预览失败");
    }
  }

  async function submitClockIn() {
    if (taskDrafts.length === 0) {
      errorMessage = "请先打开预览。";
      return;
    }

    submitState = "loading";
    errorMessage = null;

    try {
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
      await saveConfig(WorklogService.summarizeTaskResults(result.results));
      submitState = "ready";
    } catch (error) {
      submitState = "error";
      errorMessage = getErrorMessage(error, "提交打卡失败");
    }
  }

  async function maybeRunScheduledClockIn() {
    if (!config.schedule.enabled || anyBusy || !dailyConfigComplete) {
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
    await openPreview();
    if (taskDrafts.length > 0) {
      await submitClockIn();
    }
  }

  function addRepository(environment: WorklogRepositoryConfig["environment"]) {
    const repository = WorklogService.createRepository(environment);
    config = {
      ...config,
      repositories: [...config.repositories, repository],
    };
    selectedRepositoryIds = [...selectedRepositoryIds, repository.id];
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
    selectedRepositoryIds = selectedRepositoryIds.filter((id) => id !== repositoryId);
  }

  function toggleRepository(repositoryId: string, checked: boolean) {
    selectedRepositoryIds = checked
      ? [...new Set([...selectedRepositoryIds, repositoryId])]
      : selectedRepositoryIds.filter((id) => id !== repositoryId);
    taskDrafts = [];
    taskResults = [];
  }

  function updateZentaoConfig(patch: Partial<WorklogConfig["zentao"]>) {
    config = {
      ...config,
      zentao: {
        ...config.zentao,
        ...patch,
      },
    };
    taskDrafts = [];
    taskResults = [];
  }

  function updateSchedule(patch: Partial<WorklogConfig["schedule"]>) {
    config = {
      ...config,
      schedule: {
        ...config.schedule,
        ...patch,
      },
    };
  }

  function updateInitZentaoConfig(patch: Partial<WorklogConfig["zentao"]>) {
    updateZentaoConfig(patch);
    zentaoVerified = false;
  }

  async function persistDailyConfig(message = "日常配置已保存") {
    try {
      await saveConfig(message);
    } catch (error) {
      errorMessage = getErrorMessage(error, "保存日常配置失败");
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
  <section class="flex h-full min-h-0 flex-col bg-background text-sm">
    <div class="border-b bg-card/70 p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold">{activeView === "init" ? "初始化配置" : "今日打卡"}</h2>
          <p class="text-xs text-muted-foreground">
            {activeView === "init"
              ? "先完成禅道连接验证；仓库可以现在登记，也可以稍后补充。"
              : "项目会自动拉取；选择日常配置后打开预览，再提交打卡。"}
          </p>
        </div>
        <div class="flex rounded-md border bg-background p-0.5">
          <button
            class="h-7 rounded px-3 text-xs font-medium transition-colors"
            class:bg-primary={activeView === "init"}
            class:text-primary-foreground={activeView === "init"}
            class:text-muted-foreground={activeView !== "init"}
            type="button"
            onclick={() => (activeView = "init")}
          >
            初始化配置
          </button>
          <button
            class="h-7 rounded px-3 text-xs font-medium transition-colors disabled:opacity-50"
            class:bg-primary={activeView === "clockIn"}
            class:text-primary-foreground={activeView === "clockIn"}
            class:text-muted-foreground={activeView !== "clockIn"}
            type="button"
            onclick={() => {
              if (zentaoVerified) {
                activeView = "clockIn";
              }
            }}
            disabled={!zentaoVerified}
          >
            打卡
          </button>
        </div>
      </div>

      {#if activeView === "clockIn"}
      <div class="grid grid-cols-[140px_minmax(140px,1fr)_minmax(140px,1fr)_120px_96px_160px] gap-2">
        <label class="block text-xs font-medium text-muted-foreground">
          日期
          <input class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm" type="date" bind:value={date} />
        </label>

        <label class="block text-xs font-medium text-muted-foreground">
          项目
          <select
            class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
            value={config.zentao.projectId ?? ""}
            disabled={projectsState === "loading"}
            onchange={(event) => {
              const projectId = Number(event.currentTarget.value) || null;
              updateZentaoConfig({ projectId, executionId: null });
              executions = [];
              void persistDailyConfig();
              if (projectId) {
                void loadExecutions(projectId);
              }
            }}
          >
            <option value="">{projectsState === "loading" ? "项目加载中..." : "选择项目"}</option>
            {#each projects as project (project.id)}
              <option value={project.id}>{project.name}</option>
            {/each}
          </select>
        </label>

        <label class="block text-xs font-medium text-muted-foreground">
          迭代
          <select
            class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
            value={config.zentao.executionId ?? ""}
            disabled={!config.zentao.projectId || executionsState === "loading"}
            onchange={(event) => {
              updateZentaoConfig({ executionId: Number(event.currentTarget.value) || null });
              void persistDailyConfig();
            }}
          >
            <option value="">{executionsState === "loading" ? "迭代加载中..." : "选择迭代"}</option>
            {#each executions as execution (execution.id)}
              <option value={execution.id}>{execution.name}</option>
            {/each}
          </select>
        </label>

        <label class="block text-xs font-medium text-muted-foreground">
          类型
          <select
            class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
            value={config.zentao.taskType}
            onchange={(event) => {
              updateZentaoConfig({ taskType: event.currentTarget.value });
              void persistDailyConfig();
            }}
          >
            {#each TASK_TYPE_OPTIONS as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>

        <label class="block text-xs font-medium text-muted-foreground">
          工时
          <input
            class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
            value={config.zentao.estimate}
            min="0"
            step="0.5"
            type="number"
            onchange={(event) => {
              updateZentaoConfig({ estimate: Number(event.currentTarget.value) || 0 });
              void persistDailyConfig();
            }}
          />
        </label>

        <label class="block text-xs font-medium text-muted-foreground">
          定时
          <div class="mt-1 flex h-8 items-center gap-2 rounded-md border bg-background px-2">
            <input
              type="checkbox"
              checked={config.schedule.enabled}
              disabled={!canEnableSchedule}
              onchange={(event) => {
                updateSchedule({ enabled: event.currentTarget.checked });
                void persistDailyConfig();
              }}
            />
            <input
              class="min-w-0 flex-1 bg-transparent text-xs outline-none disabled:opacity-50"
              type="time"
              value={config.schedule.time}
              disabled={!canEnableSchedule}
              onchange={(event) => {
                updateSchedule({ time: event.currentTarget.value });
                void persistDailyConfig();
              }}
            />
          </div>
        </label>
      </div>

      {#if !canEnableSchedule}
        <p class="mt-2 text-xs text-muted-foreground">选择项目、迭代和至少一个参与仓库后，才可以开启定时打卡。</p>
      {/if}

      <label class="mt-3 block text-xs font-medium text-muted-foreground">
        任务名模板
        <input
          class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
          value={config.zentao.titleTemplate}
          placeholder={"[{date}] {repo} 禅道打卡"}
          onchange={(event) => {
            updateZentaoConfig({ titleTemplate: event.currentTarget.value });
            void persistDailyConfig("任务名模板已保存");
          }}
        />
        <span class="mt-1 block text-[11px] text-muted-foreground">
          可用变量：{"{date}"}、{"{repo}"}、{"{message}"}、{"{hash}"}、{"{shortHash}"}、{"{author}"}、{"{count}"}
        </span>
      </label>
      {/if}
    </div>

    {#if activeView === "init"}
      <div class="min-h-0 flex-1 overflow-auto p-6">
        <div class="mx-auto max-w-4xl rounded-xl border bg-card shadow-sm">
          <div class="border-b p-4">
            <h3 class="text-base font-semibold">初始化配置</h3>
            <p class="mt-1 text-sm text-muted-foreground">
              先验证禅道连接。仓库可以现在登记，也可以稍后补充。
            </p>
          </div>

          <div class="space-y-5 p-4">
            <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3">
              <label class="block text-xs font-medium text-muted-foreground">
                禅道地址
                <input
                  class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
                  value={config.zentao.baseUrl}
                  placeholder="https://zentao.example.com"
                  oninput={(event) => updateInitZentaoConfig({ baseUrl: event.currentTarget.value })}
                />
              </label>
              <label class="block text-xs font-medium text-muted-foreground">
                账号
                <input
                  class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
                  value={config.zentao.account}
                  placeholder="admin"
                  oninput={(event) => updateInitZentaoConfig({ account: event.currentTarget.value })}
                />
              </label>
              <label class="block text-xs font-medium text-muted-foreground">
                密码
                <input
                  class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
                  value={config.zentao.password}
                  type="password"
                  oninput={(event) => updateInitZentaoConfig({ password: event.currentTarget.value })}
                />
              </label>
              <button
                class="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                type="button"
                onclick={() => void validateAndSaveInitConfig()}
                disabled={initValidationState === "loading"}
              >
                {initValidationState === "loading" ? "验证中..." : "验证"}
              </button>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold">仓库地址</h3>
                <p class="text-xs text-muted-foreground">仓库不影响进入打卡 view，用于日常打卡时多选。</p>
              </div>
              <div class="flex gap-2">
                <button class="h-8 rounded-md border px-3 text-xs font-medium" type="button" onclick={() => addRepository("windows")}>
                  添加 Windows
                </button>
                <button class="h-8 rounded-md border px-3 text-xs font-medium" type="button" onclick={() => addRepository("wsl")}>
                  添加 WSL
                </button>
              </div>
            </div>

            <div class="space-y-3">
              {#each config.repositories as repository (repository.id)}
                <div class="rounded-lg border bg-background p-3">
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <input
                      class="h-8 flex-1 rounded-md border bg-card px-2 text-sm"
                      value={repository.name}
                      placeholder="仓库名称"
                      oninput={(event) => updateRepository(repository.id, { name: event.currentTarget.value })}
                    />
                    <button class="text-xs text-destructive hover:underline" type="button" onclick={() => removeRepository(repository.id)}>
                      {t("common.delete")}
                    </button>
                  </div>

                  {#if repository.environment === "windows"}
                    <input
                      class="h-8 w-full rounded-md border bg-card px-2 font-mono text-xs"
                      value={repository.windowsPath ?? ""}
                      placeholder="D:\work-space\repo"
                      oninput={(event) =>
                        updateRepository(repository.id, { windowsPath: event.currentTarget.value })}
                    />
                  {:else}
                    <div class="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
                      <input
                        class="h-8 rounded-md border bg-card px-2 text-xs"
                        value={repository.wslDistro ?? ""}
                        placeholder="Ubuntu"
                        oninput={(event) =>
                          updateRepository(repository.id, { wslDistro: event.currentTarget.value })}
                      />
                      <input
                        class="h-8 rounded-md border bg-card px-2 font-mono text-xs"
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

            {#if initValidationMessage}
              <p class="rounded-md border bg-muted/40 px-3 py-2 text-xs">{initValidationMessage}</p>
            {/if}

            <div class="flex items-center justify-between border-t pt-4">
              <p class="text-xs text-muted-foreground">
                {zentaoVerified ? "连接已验证，可以进入打卡 view。" : "验证成功并保存后才能进入打卡 view。"}
              </p>
              <button
                class="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                type="button"
                onclick={() => void saveInitConfigAndOpenClockIn()}
                disabled={!zentaoVerified || initValidationState === "loading"}
              >
                进入打卡
              </button>
            </div>
          </div>
        </div>
      </div>
    {:else}
    <div class="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_320px]">
      <aside class="min-h-0 overflow-auto border-r bg-card/50 p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold">本次参与仓库</h3>
          <span class="text-xs text-muted-foreground">{selectedRepositoryIds.length}/{config.repositories.length}</span>
        </div>

        {#if config.repositories.length === 0}
          <div class="rounded-lg border border-dashed bg-card/60 p-4 text-sm text-muted-foreground">
            还没有仓库。打开初始化配置添加 Windows 或 WSL 仓库。
          </div>
        {:else}
          <div class="space-y-2">
            {#each config.repositories as repository (repository.id)}
              <label class="block rounded-lg border bg-card p-3">
                <div class="flex items-start gap-2">
                  <input
                    class="mt-1"
                    type="checkbox"
                    checked={selectedRepositoryIds.includes(repository.id)}
                    onchange={(event) => toggleRepository(repository.id, event.currentTarget.checked)}
                  />
                  <div class="min-w-0">
                    <p class="truncate font-medium">{repository.name}</p>
                    <p class="truncate font-mono text-[11px] text-muted-foreground">
                      {repository.environment === "wsl"
                        ? `${repository.wslDistro ?? "WSL"}:${repository.wslPath ?? ""}`
                        : repository.windowsPath}
                    </p>
                  </div>
                </div>
              </label>
            {/each}
          </div>
        {/if}
      </aside>

      <main class="min-h-0 overflow-auto border-r p-4">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold">打卡预览</h3>
            <p class="text-xs text-muted-foreground">
              {previewState === "loading" ? "正在抓取提交并生成预览..." : `${visibleCommits.length} commits`}
            </p>
          </div>
          <button
            class="h-8 rounded-md border px-3 text-xs font-medium disabled:opacity-50"
            type="button"
            onclick={() => void openPreview()}
            disabled={previewState === "loading" || !dailyConfigComplete}
          >
            打开预览
          </button>
        </div>

        {#if previewState === "idle"}
          <div class="rounded-lg border border-dashed bg-card/60 px-4 py-8 text-center text-muted-foreground">
            选择日常配置后点击“打开预览”，系统会自动抓取 Git 提交并生成禅道任务。
          </div>
        {:else if scanResults.length > 0}
          <div class="space-y-4">
            {#each scanResults as result (result.repositoryId)}
              <section class="overflow-hidden rounded-lg border bg-card">
                <div class="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                  <div>
                    <h4 class="text-sm font-medium">{result.repositoryName}</h4>
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
        {:else}
          <div class="rounded-lg border border-dashed bg-card/60 px-4 py-8 text-center text-muted-foreground">
            这一天没有可同步的提交。
          </div>
        {/if}

        {#if taskDrafts.length > 0}
          <section class="mt-4 rounded-lg border bg-card p-3">
            <h4 class="text-sm font-medium">待创建并完成</h4>
            {#each taskDrafts as task (task.id)}
              <div class="mt-3 border-t pt-3 text-xs">
                <p class="font-medium">{task.name}</p>
                <p class="mt-1 text-muted-foreground">
                  {task.date} · {task.taskType} · 预计 {task.estimate}h · {task.assignedTo}
                </p>
                <pre class="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-mono text-[11px]">{task.desc}</pre>
              </div>
            {/each}
          </section>
        {/if}
      </main>

      <aside class="min-h-0 overflow-auto bg-card/50 p-4">
        <div class="mb-4">
          <h3 class="text-sm font-semibold">提交打卡</h3>
          <p class="text-xs text-muted-foreground">创建任务后立即完成。</p>
        </div>

        <div class="space-y-3 rounded-lg border bg-card p-3 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">禅道连接</span>
            <span>{WorklogService.isZentaoConnectionConfigured(config) ? "已配置" : "未配置"}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">项目/迭代</span>
            <span>{config.zentao.projectId && config.zentao.executionId ? "已选择" : "未完成"}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">参与仓库</span>
            <span>{selectedRepositoryIds.length} 个</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">预览任务</span>
            <span>{taskDrafts.length} 个</span>
          </div>
        </div>

        <button
          class="mt-4 h-9 w-full rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          type="button"
          onclick={() => void submitClockIn()}
          disabled={submitState === "loading" || taskDrafts.length === 0}
        >
          {submitState === "loading" ? "提交中..." : "提交打卡"}
        </button>

        {#if statusMessage}
          <p class="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-xs">{statusMessage}</p>
        {/if}
        {#if errorMessage}
          <p class="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {errorMessage}
          </p>
        {/if}

        {#if config.lastRun}
          <section class="mt-4 rounded-lg border bg-card p-3">
            <h4 class="text-sm font-medium">最近一次打卡</h4>
            <p class="mt-2 text-xs text-muted-foreground">{config.lastRun.message}</p>
            <p class="mt-1 text-xs text-muted-foreground">{config.lastRun.ranAt}</p>
          </section>
        {/if}

        {#if taskResults.length > 0}
          <section class="mt-4 rounded-lg border bg-card p-3">
            <h4 class="text-sm font-medium">打卡结果</h4>
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
    </div>
    {/if}
  </section>
{/if}
