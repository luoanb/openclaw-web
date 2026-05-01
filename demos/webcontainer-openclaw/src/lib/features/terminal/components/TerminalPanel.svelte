<script lang="ts">
  import type { WebContainer } from "@webcontainer/api";
  import TerminalPane from "$lib/features/terminal/components/TerminalPane.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import { cn } from "$lib/utils.js";

  type Props = {
    isolated: boolean;
    wirePreview: (wc: WebContainer) => void;
  };

  let { isolated, wirePreview }: Props = $props();

  type TermTab = { id: string; label: string };

  let tabSeq = $state(1);
  let tabs = $state<TermTab[]>([{ id: "t-1", label: "终端 1" }]);
  let activeId = $state("t-1");

  function addTab(): void {
    tabSeq += 1;
    const id = `t-${tabSeq}`;
    const n = tabs.length + 1;
    tabs = [...tabs, { id, label: `终端 ${n}` }];
    activeId = id;
  }

  function closeTab(id: string): void {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const next = tabs[idx + 1] ?? tabs[idx - 1];
    tabs = tabs.filter((t) => t.id !== id);
    if (activeId === id && next) activeId = next.id;
  }

  /** 整行 hover/选中底在父级 `group`；此处只负责文字与焦点环 */
  const tabTrigger = (selected: boolean, closable: boolean) =>
    cn(
      "relative z-0 w-full rounded-md py-1.5 text-left text-xs font-medium tracking-wide transition-colors outline-none",
      closable ? "pl-2 pr-8" : "px-2",
      "text-[color:var(--text-primary)]/75 hover:text-[color:var(--text-primary)]",
      selected && "text-[color:var(--text-primary)]",
      "focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--shell-bg)]"
    );

  /** 行内右侧，仅在父级 `group-hover` / `focus-within` 时显现 */
  const closeBtn = cn(
    "absolute right-0.5 top-1/2 z-[1] flex -translate-y-1/2 cursor-pointer items-center justify-center rounded p-1",
    "text-[color:var(--text-primary)]/55 outline-none transition-[color,opacity]",
    "hover:text-[color:var(--text-primary)]",
    "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
    "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
    "focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--shell-bg)]"
  );

  const rowShell = (selected: boolean) =>
    cn(
      "group relative min-h-8 rounded-md transition-colors",
      "hover:bg-[color:var(--tab-rail-bg)]",
      selected && "bg-[color:var(--tab-rail-bg)]"
    );
</script>

<div class="flex min-h-0 flex-1 flex-row gap-2">
  <div class="relative min-h-0 min-w-0 flex-1">
    {#each tabs as t (t.id)}
      <div
        class="absolute inset-0 flex min-h-0 flex-col"
        class:hidden={activeId !== t.id}
        class:pointer-events-none={activeId !== t.id}
        aria-hidden={activeId !== t.id}
      >
        <TerminalPane {isolated} {wirePreview} visible={activeId === t.id} />
      </div>
    {/each}
  </div>

  <aside
    class="flex w-[8.5rem] shrink-0 flex-col border-l border-[color:var(--border-subtle)] pl-2"
    aria-label="终端会话侧栏"
  >
    <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-0.5">
      <Button
        variant="ghost"
        class="h-8 w-full shrink-0 justify-start px-2 text-xs"
        title="新建终端"
        onclick={addTab}
      >
        新建
      </Button>

      <div
        role="tablist"
        aria-label="终端会话"
        class="flex min-h-0 flex-1 flex-col gap-0.5"
      >
        {#each tabs as t (t.id)}
          <div class={rowShell(activeId === t.id)}>
            <button
              type="button"
              role="tab"
              aria-selected={activeId === t.id}
              class={tabTrigger(activeId === t.id, tabs.length > 1)}
              onclick={() => (activeId = t.id)}
            >
              {t.label}
            </button>
            {#if tabs.length > 1}
              <button
                type="button"
                class={closeBtn}
                aria-label={`关闭 ${t.label}`}
                onclick={() => closeTab(t.id)}
              >
                <svg
                  class="h-3.5 w-3.5"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <path d="M3 3l6 6M9 3L3 9" />
                </svg>
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </aside>
</div>
