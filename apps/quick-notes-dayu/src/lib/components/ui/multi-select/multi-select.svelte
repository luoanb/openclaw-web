<script lang="ts">
  import { Select } from "bits-ui";
  import Icons from "$lib/features/common/Icons.svelte";

  interface MultiSelectOption {
    value: string;
    label: string;
    hint?: string;
    disabled?: boolean;
  }

  let {
    options,
    value = $bindable<string[]>([]),
    placeholder = "请选择",
    disabled = false,
    onValueChange,
  }: {
    options: MultiSelectOption[];
    value?: string[];
    placeholder?: string;
    disabled?: boolean;
    onValueChange?: (value: string[]) => void;
  } = $props();

  function handleValueChange(next: string[]) {
    value = next;
    onValueChange?.(next);
  }

  // bits-ui resolves the trigger label from mounted items, which are unmounted
  // while the panel is closed. Passing `items` keeps the label available so the
  // closed trigger never falls back to the raw value (id).
  const items = $derived(
    options.map((option) => ({
      value: option.value,
      label: option.label,
      disabled: option.disabled,
    }))
  );
</script>

<Select.Root type="multiple" bind:value {disabled} {items} onValueChange={handleValueChange}>
  <Select.Trigger
    class="flex h-8 w-full items-center justify-between gap-2 rounded-md border bg-background px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <Select.Value {placeholder} class="min-w-0 truncate text-left" />
    <Icons name="chevron-down" class="size-4 shrink-0 text-muted-foreground" />
  </Select.Trigger>
  <Select.Portal>
    <Select.Content
      class="z-[100] max-h-64 min-w-[8rem] w-[var(--bits-select-anchor-width)] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      sideOffset={4}
    >
      <Select.Viewport>
        {#each options as option (option.value)}
          <Select.Item
            value={option.value}
            label={option.label}
            disabled={option.disabled}
            class="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          >
            {#snippet children({ selected })}
              <span class="flex size-3.5 shrink-0 items-center justify-center">
                {#if selected}
                  <Icons name="check" class="size-3.5" />
                {/if}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate">{option.label}</span>
                {#if option.hint}
                  <span class="block truncate font-mono text-[10px] text-muted-foreground">
                    {option.hint}
                  </span>
                {/if}
              </span>
            {/snippet}
          </Select.Item>
        {/each}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
