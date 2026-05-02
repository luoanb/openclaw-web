<script lang="ts">
	import { Provider, Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "$lib/components/ui/sidebar";
</script>

<Provider>
	<div class="flex h-48 overflow-hidden rounded-md border">
		<Sidebar>
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
		<div class="bg-muted flex flex-1 items-center justify-center text-xs text-muted-foreground">主内容区</div>
	</div>
</Provider>