<script lang="ts">
	import {
		Provider,
		Sidebar,
		SidebarContent,
		SidebarFooter,
		SidebarGroup,
		SidebarGroupContent,
		SidebarGroupLabel,
		SidebarHeader,
		SidebarInset,
		SidebarMenu,
		SidebarMenuItem,
		SidebarMenuButton,
		SidebarTrigger,
	} from "$lib/components/ui/sidebar";
</script>

<!--
  Sidebar 桌面端为 position:fixed，默认相对视口。
  父级加 transform 建立新的包含块，使 fixed 相对于本预览框而非整页。
-->
<div
	class="relative h-52 w-full max-w-full overflow-hidden rounded-md border [transform:translate3d(0,0,0)]"
>
	<Provider
		class="relative flex h-full min-h-0 w-full max-w-full overflow-hidden !min-h-0"
	>
		<!-- 覆盖组件内默认 h-svh，使侧栏高度贴合预览框（父级已 transform 形成包含块） -->
		<Sidebar class="border-e-0 min-h-0 !h-full !max-h-full">
			<SidebarHeader>
				<SidebarGroupLabel>导航</SidebarGroupLabel>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton>首页</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton>设置</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>底部</SidebarFooter>
		</Sidebar>
		<SidebarInset class="min-h-0 min-w-0">
			<header
				class="bg-background flex h-9 shrink-0 items-center gap-2 border-b px-2"
			>
				<SidebarTrigger />
				<span class="text-muted-foreground text-xs">点击切换；Ctrl+B / ⌘B</span>
			</header>
			<div
				class="bg-muted flex min-h-0 flex-1 items-center justify-center text-xs text-muted-foreground"
			>
				主内容区
			</div>
		</SidebarInset>
	</Provider>
</div>
