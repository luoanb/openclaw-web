<script lang="ts">
  import { onMount, tick } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { Icon, type IconName } from "$lib/components/icon";
  import { RuntimeManagerProvider } from "$lib/core/runtime";
  import { TerminalServiceProvider } from "$lib/core/terminal";
  import type { RuntimeSnapshot, TerminalEvent, TerminalSession, TerminalSnapshot, Unsubscribe } from "os-core";

  const runtimeManager = RuntimeManagerProvider.getRuntimeManager();
  const terminalService = TerminalServiceProvider.getTerminalService();

  let runtimeSnapshot: RuntimeSnapshot = $state(runtimeManager.getSnapshot());
  let terminalElement: HTMLDivElement | undefined = $state();
  let promptElement: HTMLInputElement | undefined = $state();
  let terminalSession: TerminalSession | null = $state(null);
  let terminalSnapshot: TerminalSnapshot | null = $state(null);
  let terminalInput = $state("");
  let commandHistory: string[] = $state([]);
  let historyCursor: number | null = $state(null);
  let historyDraft = $state("");
  let busy = $state(false);
  let errorMessage: string | null = $state(null);
  let notices: string[] = $state([]);
  let terminalUnsubscribe: Unsubscribe | null = null;

  onMount(() => {
    const runtimeUnsubscribe = runtimeManager.onEvent(() => {
      runtimeSnapshot = runtimeManager.getSnapshot();
      if (runtimeSnapshot.status === "running") {
        void ensureTerminal();
      } else {
        clearTerminal();
      }
    });

    void ensureTerminal();

    return () => {
      runtimeUnsubscribe();
      clearTerminal();
    };
  });

  async function ensureTerminal() {
    if (terminalSession || busy || !terminalElement || runtimeSnapshot.status !== "running" || !runtimeManager.currentSession) {
      return;
    }

    busy = true;
    errorMessage = null;
    try {
      terminalSession = await terminalService.createTerminal(runtimeManager.currentSession, {
        name: "Terminal 1",
        element: terminalElement,
      });
      terminalSnapshot = terminalSession.getSnapshot();
      terminalUnsubscribe = terminalSession.onEvent(handleTerminalEvent);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
      if (terminalSession) {
        await focusPrompt();
      }
    }
  }

  function clearTerminal() {
    terminalUnsubscribe?.();
    terminalUnsubscribe = null;
    terminalSession = null;
    terminalSnapshot = null;
    notices = [];
    historyCursor = null;
    historyDraft = "";
  }

  function handleTerminalEvent(event: TerminalEvent) {
    if (!terminalSession) return;

    terminalSnapshot = terminalSession.getSnapshot();

    if (event.type === "terminal-notice") {
      notices = [event.message, ...notices].slice(0, 3);
    }

    if (event.type === "terminal-clear") {
      notices = [];
    }

    if (event.type === "terminal-error") {
      errorMessage = event.error.message;
    }
  }

  async function submitPrompt() {
    const command = terminalInput.trim();
    if (!terminalSession || !command) return;

    busy = true;
    errorMessage = null;
    terminalInput = "";
    historyCursor = null;
    historyDraft = "";
    appendCommandHistory(command);
    const result = await terminalSession.submitCommand(command);
    terminalSnapshot = terminalSession.getSnapshot();
    if (!result.ok) {
      errorMessage = result.message;
    }
    busy = false;
    await focusPrompt();
  }

  function handlePromptKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      showPreviousHistory();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      showNextHistory();
      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();
    void submitPrompt();
  }

  function appendCommandHistory(command: string) {
    if (commandHistory.at(-1) === command) return;
    commandHistory = [...commandHistory, command];
  }

  function showPreviousHistory() {
    if (commandHistory.length === 0 || promptDisabled()) return;

    if (historyCursor === null) {
      historyDraft = terminalInput;
      historyCursor = commandHistory.length - 1;
    } else {
      historyCursor = Math.max(0, historyCursor - 1);
    }

    terminalInput = commandHistory[historyCursor] ?? "";
  }

  function showNextHistory() {
    if (commandHistory.length === 0 || historyCursor === null || promptDisabled()) return;

    if (historyCursor >= commandHistory.length - 1) {
      historyCursor = null;
      terminalInput = historyDraft;
      historyDraft = "";
      return;
    }

    historyCursor += 1;
    terminalInput = commandHistory[historyCursor] ?? "";
  }

  async function focusPrompt() {
    await tick();
    if (!promptDisabled()) {
      promptElement?.focus();
    }
  }

  function promptDisabled() {
    return busy || runtimeSnapshot.status !== "running" || !terminalSession || terminalSnapshot?.interactionStatus === "running";
  }

  function interactionIconName(): IconName {
    if (errorMessage) return "errorCircle";
    if (busy || terminalSnapshot?.interactionStatus === "running") return "loading";
    return terminalSnapshot?.interactionStatus === "ready" ? "checkCircle" : "info";
  }
</script>

<section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs">
  <div class="flex h-10 shrink-0 items-center gap-2 border-b px-3">
    <Icon name="terminal" class="size-3.5 text-muted-foreground" />
    <div class="min-w-0 flex-1">
      <div class="truncate text-xs font-medium">Terminal 1</div>
    </div>
    <span class="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-[0.625rem] text-muted-foreground">
      <Icon
        name={interactionIconName()}
        class={`size-3 ${busy || terminalSnapshot?.interactionStatus === "running" ? "animate-spin" : ""}`}
      />
      {terminalSnapshot?.interactionStatus ?? (runtimeSnapshot.status === "running" ? "creating" : "waiting")}
    </span>
  </div>

  <div class="relative min-h-0 flex-1 bg-zinc-950 text-zinc-100">
    <div bind:this={terminalElement} class="h-full min-h-0 w-full overflow-auto font-mono text-sm"></div>

    {#if runtimeSnapshot.status !== "running"}
      <div class="absolute inset-0 flex items-center justify-center bg-card text-card-foreground">
        <div class="max-w-[28rem] px-6 text-center">
          <Icon name="alert" class="mx-auto mb-3 size-5 text-muted-foreground" />
          <p class="text-sm font-medium">容器未运行</p>
          <p class="mt-2 text-xs/relaxed text-muted-foreground">
            启动容器后会在这里创建终端；终端不会自行 boot BrowserPod。
          </p>
        </div>
      </div>
    {/if}
  </div>

  {#if notices.length > 0 || errorMessage}
    <div class="space-y-1 border-t bg-muted/40 px-3 py-2 text-xs">
      {#if errorMessage}
        <p class="flex items-center gap-1 text-red-700 dark:text-red-300">
          <Icon name="errorCircle" class="size-3.5" />
          {errorMessage}
        </p>
      {/if}
      {#each notices as notice}
        <p class="flex items-center gap-1 text-muted-foreground">
          <Icon name="info" class="size-3.5" />
          {notice}
        </p>
      {/each}
    </div>
  {/if}

  <div class="flex items-center gap-2 border-t px-3 py-2">
    <Icon name="folder" class="size-3.5 text-muted-foreground" />
    <span class="max-w-[12rem] truncate font-mono text-xs text-muted-foreground">
      {terminalSnapshot?.cwd ?? "/"}
    </span>
    <input
      bind:this={promptElement}
      class="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Terminal command"
      placeholder={runtimeSnapshot.status === "running" ? "输入命令后按 Enter" : "等待容器启动"}
      disabled={promptDisabled()}
      bind:value={terminalInput}
      onkeydown={handlePromptKeydown}
    />
    <Button size="sm" disabled={promptDisabled() || !terminalInput.trim()} onclick={submitPrompt}>
      <Icon name="play" class="size-3" />
      Run
    </Button>
  </div>
</section>
