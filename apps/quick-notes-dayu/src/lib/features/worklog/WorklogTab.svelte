<script lang="ts">
  import { onMount } from "svelte";
  import MultiSelect from "$lib/components/ui/multi-select/multi-select.svelte";
  import { getLocaleStore } from "$lib/core/i18n/store.svelte.js";
  import { toast } from "$lib/core/toast/toast.svelte";
  import { WorklogRepository } from "$lib/core/worklog/worklog-repository";
  import { WorklogService } from "$lib/core/worklog/worklog-service";
  import type {
    GitCommitRecord,
    RepositoryScanResult,
    WorklogConfig,
    WorklogRepositoryConfig,
    ZentaoExecutionOption,
    ZentaoProjectOption,
    ZentaoTaskDraft,
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
  let loadErrorMessage = $state<string | null>(null);
  let selectedRepositoryIds = $state<string[]>([]);
  let scanResults = $state<RepositoryScanResult[]>([]);
  let selectedCommitKeys = $state<string[]>([]);
  let taskDrafts = $state<ZentaoTaskDraft[]>([]);
  let projects = $state<ZentaoProjectOption[]>([]);
  let executions = $state<ZentaoExecutionOption[]>([]);
  let lastAutoRunDate = $state<string | null>(null);
  // Guards against out-of-order task-draft regeneration.
  let draftRequestId = 0;

  const anyBusy = $derived(
    loadState === "loading" ||
      projectsState === "loading" ||
      executionsState === "loading" ||
      previewState === "loading" ||
      submitState === "loading"
  );
  const repositoryOptions = $derived(
    config.repositories.map((repository) => ({
      value: repository.id,
      label: repository.name,
      hint:
        repository.environment === "wsl"
          ? `${repository.wslDistro ?? "WSL"}:${repository.wslPath ?? ""}`
          : (repository.windowsPath ?? ""),
    }))
  );
  const selectedRepositories = $derived(
    WorklogService.getSelectedRepositories(config, selectedRepositoryIds)
  );
  const commits = $derived(WorklogService.flattenCommits(scanResults));
  // Search narrows what is listed; the checkboxes decide what gets clocked in.
  const visibleScanResults = $derived(
    scanResults
      .map((result) => ({
        ...result,
        commits: WorklogService.filterCommits(result.commits, searchQuery),
      }))
      .filter((result) => result.commits.length > 0)
  );
  const selectedCommitCount = $derived(
    WorklogService.selectCommits(commits, selectedCommitKeys).length
  );
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
    loadErrorMessage = null;

    try {
      config = WorklogService.normalizeConfig(await WorklogRepository.loadConfig());
      selectedRepositoryIds = WorklogService.resolveSelectedRepositoryIds(config);
      zentaoVerified = false;
      loadState = "ready";

      if (WorklogService.isZentaoConnectionConfigured(config)) {
        void autoValidateZentaoConfig();
      } else {
        activeView = "init";
      }
    } catch (error) {
      loadErrorMessage = getErrorMessage(error, "读取禅道打卡配置失败");
      loadState = "error";
    }
  }

  async function saveConfig() {
    config = WorklogService.normalizeConfig(await WorklogRepository.saveConfig(config));
  }

  async function autoValidateZentaoConfig() {
    initValidationState = "loading";
    initValidationMessage = "正在验证已保存的禅道连接...";

    try {
      const result = await WorklogRepository.validateZentaoConfig(config.zentao);
      initValidationMessage = "";

      if (!result.ok) {
        zentaoVerified = false;
        activeView = "init";
        initValidationState = "error";
        toast(result.message, { variant: "error" });
        return;
      }

      zentaoVerified = true;
      activeView = "clockIn";
      initValidationState = "ready";
      toast(result.message, { variant: "success" });
      void loadProjects(true);
    } catch (error) {
      zentaoVerified = false;
      activeView = "init";
      initValidationState = "error";
      initValidationMessage = "";
      toast(getErrorMessage(error, "自动验证禅道连接失败"), { variant: "error" });
    }
  }

  async function validateAndSaveInitConfig() {
    if (!WorklogService.isZentaoConnectionConfigured(config)) {
      toast("请先填写禅道地址、账号和密码。", { variant: "warning" });
      return;
    }

    initValidationState = "loading";
    initValidationMessage = "正在验证禅道连接...";

    try {
      const result = await WorklogRepository.validateZentaoConfig(config.zentao);
      initValidationMessage = "";

      if (!result.ok) {
        zentaoVerified = false;
        initValidationState = "error";
        toast(result.message, { variant: "error" });
        return;
      }

      zentaoVerified = true;
      await saveConfig();
      initValidationState = "ready";
      activeView = "clockIn";
      toast(result.message, { variant: "success" });
      void loadProjects(true);
    } catch (error) {
      initValidationMessage = "";
      initValidationState = "error";
      toast(getErrorMessage(error, "验证禅道连接失败"), { variant: "error" });
    }
  }

  async function saveInitConfigAndOpenClockIn() {
    if (!zentaoVerified) {
      return;
    }

    initValidationState = "loading";
    try {
      await saveConfig();
      activeView = "clockIn";
      initValidationState = "ready";
    } catch (error) {
      initValidationState = "error";
      toast(getErrorMessage(error, "保存初始化配置失败"), { variant: "error" });
    }
  }

  async function loadProjects(shouldLoadExecutions = false) {
    if (!WorklogService.isZentaoConnectionConfigured(config)) {
      return;
    }

    projectsState = "loading";

    try {
      projects = await WorklogRepository.listZentaoProjects(config.zentao);
      projectsState = "ready";

      if (shouldLoadExecutions && config.zentao.projectId) {
        await loadExecutions(config.zentao.projectId);
      }
    } catch (error) {
      projectsState = "error";
      toast(getErrorMessage(error, "自动拉取禅道项目失败"), { variant: "error" });
    }
  }

  async function loadExecutions(projectId: number) {
    executionsState = "loading";

    try {
      executions = await WorklogRepository.listZentaoExecutions({
        config: config.zentao,
        projectId,
      });
      executionsState = "ready";
    } catch (error) {
      executionsState = "error";
      toast(getErrorMessage(error, "自动拉取禅道迭代失败"), { variant: "error" });
    }
  }

  async function openPreview() {
    if (!dailyConfigComplete) {
      toast("请先选择项目、迭代和本次参与仓库。", { variant: "warning" });
      return;
    }

    previewState = "loading";

    try {
      const scan = await WorklogRepository.scanGitCommits({
        repositories: selectedRepositories,
        date,
      });
      scanResults = scan.results;
      selectedCommitKeys = WorklogService.flattenCommits(scan.results).map((commit) =>
        WorklogService.commitKey(commit)
      );
      await generateTaskDrafts(scan.results);
      previewState = "ready";
      toast(`已生成 ${taskDrafts.length} 个待打卡任务`, { variant: "success" });
    } catch (error) {
      previewState = "error";
      toast(getErrorMessage(error, "打开预览失败"), { variant: "error" });
    }
  }

  /**
   * Rebuild the task drafts from the currently checked commits. Any manual edit
   * made to a draft is discarded here, which matches the flow of "pick commits
   * first, then edit the generated task".
   */
  async function generateTaskDrafts(results: RepositoryScanResult[]) {
    const requestId = ++draftRequestId;
    const commits = WorklogService.selectCommits(
      WorklogService.flattenCommits(results),
      selectedCommitKeys
    );

    if (commits.length === 0) {
      if (requestId === draftRequestId) {
        taskDrafts = [];
      }
      return;
    }

    const drafts = await WorklogRepository.previewZentaoTasks({
      config: config.zentao,
      date,
      commits,
    });

    if (requestId !== draftRequestId) {
      return;
    }

    taskDrafts = drafts;
  }

  async function toggleCommit(commit: GitCommitRecord, checked: boolean) {
    const key = WorklogService.commitKey(commit);
    selectedCommitKeys = checked
      ? [...new Set([...selectedCommitKeys, key])]
      : selectedCommitKeys.filter((item) => item !== key);

    try {
      await generateTaskDrafts(scanResults);
    } catch (error) {
      toast(getErrorMessage(error, "生成打卡任务失败"), { variant: "error" });
    }
  }

  function updateTaskDraft(draftId: string, patch: Partial<ZentaoTaskDraft>) {
    taskDrafts = taskDrafts.map((draft) =>
      draft.id === draftId ? { ...draft, ...patch } : draft
    );
  }

  async function submitClockIn() {
    if (taskDrafts.length === 0) {
      toast("请先打开预览。", { variant: "warning" });
      return;
    }

    submitState = "loading";

    try {
      const result = await WorklogRepository.createAndFinishZentaoTasks({
        config: config.zentao,
        tasks: taskDrafts,
        finishedAt: WorklogService.nowForZentao(),
      });
      const summary = WorklogService.summarizeTaskResults(result.results);
      const successCount = result.results.filter((item) => item.ok).length;
      const details = result.results
        .map(
          (item) =>
            `${item.ok ? "成功" : "失败"}${item.taskId ? ` #${item.taskId}` : ""} · ${item.message}`
        )
        .join("\n");
      config = {
        ...config,
        lastRun: {
          status: successCount === result.results.length ? "success" : "partial-failed",
          ranAt: new Date().toISOString(),
          message: summary,
        },
      };
      await saveConfig();
      submitState = "ready";

      if (successCount === result.results.length) {
        toast(`打卡成功\n${details}`, { variant: "success" });
      } else if (successCount === 0) {
        toast(`打卡失败\n${details}`, { variant: "error" });
      } else {
        toast(`部分打卡失败\n${details}`, { variant: "warning" });
      }
    } catch (error) {
      submitState = "error";
      toast(getErrorMessage(error, "提交打卡失败"), { variant: "error" });
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
    setSelectedRepositories([...selectedRepositoryIds, repository.id]);
    config = {
      ...config,
      repositories: [...config.repositories, repository],
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
    setSelectedRepositories(selectedRepositoryIds.filter((id) => id !== repositoryId));
  }

  function setSelectedRepositories(repositoryIds: string[]) {
    selectedRepositoryIds = repositoryIds;
    config = { ...config, selectedRepositoryIds: repositoryIds };
    taskDrafts = [];
  }

  function persistSelectedRepositories(repositoryIds: string[]) {
    setSelectedRepositories(repositoryIds);
    void persistDailyConfig();
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

  async function persistDailyConfig() {
    try {
      await saveConfig();
    } catch (error) {
      toast(getErrorMessage(error, "保存日常配置失败"), { variant: "error" });
    }
  }

  function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
</script>

{#if loadState === "loading"}
  <section class="grid h-full place-items-center text-sm text-muted-foreground">读取禅道配置...</section>
{:else if loadState === "error"}
  <section class="grid h-full place-items-center p-6 text-center">
    <div class="max-w-sm rounded-lg border bg-card p-5">
      <h2 class="text-sm font-semibold">读取配置失败</h2>
      <p class="mt-2 text-sm text-muted-foreground">{loadErrorMessage}</p>
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
              : "左侧完成配置，右侧按顺序预览并提交打卡。"}
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
      <div class="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)]">
        <!-- 左栏：配置集中 -->
        <aside class="min-h-0 overflow-auto border-r bg-card/50 p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold">打卡配置</h3>
            {#if !dailyConfigComplete}
              <span class="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">未完成</span>
            {/if}
          </div>

          <div class="space-y-3 rounded-lg border bg-card p-3">
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

            <div class="block text-xs font-medium text-muted-foreground">
              参与仓库
              <div class="mt-1">
                {#if config.repositories.length === 0}
                  <p
                    class="rounded-md border border-dashed bg-background px-2 py-2 text-[11px] text-muted-foreground"
                  >
                    还没有仓库，请先在初始化配置中添加。
                  </p>
                {:else}
                  <MultiSelect
                    options={repositoryOptions}
                    value={selectedRepositoryIds}
                    placeholder="选择本次参与的仓库"
                    onValueChange={persistSelectedRepositories}
                  />
                  <span class="mt-1 block text-[11px] text-muted-foreground">
                    已选 {selectedRepositoryIds.length}/{config.repositories.length}
                  </span>
                {/if}
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
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
            </div>

            <label class="block text-xs font-medium text-muted-foreground">
              定时打卡
              <div class="mt-1 flex h-8 items-center justify-between gap-2 rounded-md border bg-background px-2">
                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.schedule.enabled}
                    disabled={!canEnableSchedule}
                    onchange={(event) => {
                      updateSchedule({ enabled: event.currentTarget.checked });
                      void persistDailyConfig();
                    }}
                  />
                  <span class="text-xs text-foreground">{config.schedule.enabled ? "已开启" : "已关闭"}</span>
                </div>
                <input
                  class="min-w-0 flex-1 bg-transparent text-right text-xs outline-none disabled:opacity-50"
                  type="time"
                  value={config.schedule.time}
                  disabled={!canEnableSchedule}
                  onchange={(event) => {
                    updateSchedule({ time: event.currentTarget.value });
                    void persistDailyConfig();
                  }}
                />
              </div>
              {#if !canEnableSchedule}
                <span class="mt-1 block text-[11px] text-muted-foreground">需先选项目、迭代和至少一个参与仓库</span>
              {/if}
            </label>
          </div>

          <div class="mt-3 rounded-lg border bg-card p-3">
            <label class="block text-xs font-medium text-muted-foreground">
              任务名模板
              <input
                class="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
                value={config.zentao.titleTemplate}
                placeholder={"[{date}] {repo} 禅道"}
                onchange={(event) => {
                  updateZentaoConfig({ titleTemplate: event.currentTarget.value });
                  void persistDailyConfig();
                }}
              />
              <span class="mt-1 block text-[11px] text-muted-foreground">
                可用变量：{"{date}"}、{"{repo}"}、{"{message}"}、{"{hash}"}、{"{shortHash}"}、{"{author}"}、{"{count}"}
              </span>
            </label>
          </div>
        </aside>

        <!-- 右栏：主流程面板 -->
        <main class="flex min-h-0 flex-col">
          <!-- 主流程滚动区 -->
          <div class="min-h-0 flex-1 overflow-auto p-4">
            <!-- ② 打卡预览 信息 -->
            <div class="mb-4">
              <h3 class="text-sm font-semibold">打卡预览</h3>
              <p class="text-xs text-muted-foreground">
                {previewState === "loading"
                  ? "正在抓取提交并生成预览..."
                  : `已选 ${selectedCommitCount}/${commits.length} commits`}
              </p>
            </div>

            {#if !dailyConfigComplete}
              <p class="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                请先在左侧完成日期、项目、迭代和参与仓库，即可打开预览。
              </p>
            {/if}

            {#if previewState === "idle"}
              <div class="rounded-lg border border-dashed bg-card/60 px-4 py-8 text-center text-muted-foreground">
                完成配置后点击“打开预览”，系统会自动抓取 Git 提交并生成禅道任务。
              </div>
            {:else if visibleScanResults.length > 0}
              <div class="space-y-4">
                {#each visibleScanResults as result (result.repositoryId)}
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
                          <label
                            class="grid cursor-pointer grid-cols-[auto_72px_minmax(0,1fr)_72px] items-center gap-3 px-3 py-2 text-xs transition-colors hover:bg-muted/40"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCommitKeys.includes(WorklogService.commitKey(commit))}
                              onchange={(event) => void toggleCommit(commit, event.currentTarget.checked)}
                            />
                            <span class="font-mono text-muted-foreground">{commit.committedAt.slice(11, 16)}</span>
                            <div class="min-w-0">
                              <p class="truncate text-foreground">{commit.message}</p>
                              <p class="truncate text-muted-foreground">{commit.authorName} · {commit.repositoryName}</p>
                            </div>
                            <span class="font-mono text-muted-foreground">{commit.shortHash}</span>
                          </label>
                        {/each}
                      </div>
                    {/if}
                  </section>
                {/each}
              </div>
            {:else if commits.length > 0}
              <div class="rounded-lg border border-dashed bg-card/60 px-4 py-8 text-center text-muted-foreground">
                没有匹配的提交。
              </div>
            {:else}
              <div class="rounded-lg border border-dashed bg-card/60 px-4 py-8 text-center text-muted-foreground">
                这一天没有可同步的提交。
              </div>
            {/if}

            {#if taskDrafts.length > 0}
              <section class="mt-4 rounded-lg border bg-card p-3">
                <h4 class="text-sm font-medium">待创建并完成（{taskDrafts.length}）</h4>
                <p class="mt-1 text-[11px] text-muted-foreground">
                  可直接编辑任务名与描述；调整上方提交勾选会按勾选内容重新生成。
                </p>
                {#each taskDrafts as task (task.id)}
                  <div class="mt-3 border-t pt-3 text-xs">
                    <input
                      class="h-8 w-full rounded-md border bg-background px-2 text-sm"
                      aria-label="任务名"
                      value={task.name}
                      oninput={(event) => updateTaskDraft(task.id, { name: event.currentTarget.value })}
                    />
                    <p class="mt-1 text-muted-foreground">
                      {task.date} · {task.taskType} · 预计 {task.estimate}h · {task.assignedTo}
                    </p>
                    <textarea
                      class="mt-2 max-h-80 w-full resize-y overflow-auto rounded-md border bg-muted/50 p-2 font-mono text-[11px]"
                      aria-label="任务描述"
                      rows="10"
                      value={task.desc}
                      oninput={(event) =>
                        updateTaskDraft(task.id, {
                          desc: event.currentTarget.value,
                          finishComment: event.currentTarget.value,
                        })}
                    ></textarea>
                  </div>
                {/each}
              </section>
            {/if}
          </div>

          <!-- ③ 预览 + 提交打卡 sticky 底部 + 结果 -->
          <div class="border-t bg-card/70 p-4">
            <div class="flex items-center justify-end gap-2">
              <button
                class="h-10 rounded-md border px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                type="button"
                onclick={() => void openPreview()}
                disabled={previewState === "loading" || !dailyConfigComplete}
              >
                {previewState === "loading" ? "预览中..." : "打开预览"}
              </button>
              <button
                class="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
                type="button"
                onclick={() => void submitClockIn()}
                disabled={submitState === "loading" || taskDrafts.length === 0}
              >
                {submitState === "loading" ? "提交中..." : taskDrafts.length > 0 ? `提交打卡（${taskDrafts.length} 个任务）` : "提交打卡"}
              </button>
            </div>
          </div>
        </main>
      </div>
    {/if}
  </section>
{/if}
