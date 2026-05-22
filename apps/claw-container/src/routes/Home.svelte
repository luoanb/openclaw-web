<script lang="ts">
  import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "$lib/components/ui/tabs";
  import { link } from "svelte-spa-router";

  let tab = $state<"files" | "runtime" | "preview">("files");
</script>

<div class="flex min-h-[100dvh] flex-col bg-background text-foreground">
  <!-- 与 Demo（ShowcaseLiveBlock tabs）一致：默认 variant = 分段底 + bg-muted，非 line 下划线 -->
  <Tabs bind:value={tab} class="flex flex-1 flex-col gap-2 text-sm">
    <header class="bg-background shrink-0 px-4 pt-4">
      <TabsList
        class="[&_[data-slot=tabs-trigger]]:min-w-0 [&_[data-slot=tabs-trigger]]:flex-1"
      >
        <TabsTrigger value="files">文件管理</TabsTrigger>
        <TabsTrigger value="runtime">系统运行</TabsTrigger>
        <TabsTrigger value="preview">功能预览</TabsTrigger>
      </TabsList>
    </header>

    <main class="flex min-h-0 flex-1 flex-col px-4 pb-6">
      <TabsContent
        value="files"
        class="text-muted-foreground mt-1.5 flex-1 border-t border-border pt-2 text-xs"
      >
        <p>文件管理区域（待接入）</p>
      </TabsContent>
      <TabsContent
        value="runtime"
        class="text-muted-foreground mt-1.5 flex-1 border-t border-border pt-2 text-xs"
      >
        <p>系统运行区域（待接入）</p>
      </TabsContent>
      <TabsContent
        value="preview"
        class="mt-1.5 flex min-h-[40vh] flex-1 border-t border-border pt-2"
      />
    </main>
  </Tabs>

  <footer
    class="border-t border-border px-4 py-3 text-xs text-muted-foreground flex items-center justify-center"
  >
    <span class="mr-3">演示路由</span>
    <a href="/about" use:link class="text-primary underline underline-offset-4"
      >About</a
    >
    <span class="mx-2 text-border">·</span>
    <a href="/demo" use:link class="text-primary underline underline-offset-4"
      >组件展示</a
    >
  </footer>
</div>
