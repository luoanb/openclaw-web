<script lang="ts">
	import { NavigationMenuRoot, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, NavigationMenuViewport } from "$lib/components/ui/navigation-menu";
</script>

<NavigationMenuRoot>
	<NavigationMenuList>
		<NavigationMenuItem>
			<NavigationMenuTrigger>组件</NavigationMenuTrigger>
			<NavigationMenuContent>
				<div class="grid gap-2 p-2 text-xs">
					<div class="grid gap-1">
					</div>
				</div>
			</NavigationMenuContent>
		</NavigationMenuItem>
		<NavigationMenuItem>
			<NavigationMenuLink href="#">链接</NavigationMenuLink>
		</NavigationMenuItem>
	</NavigationMenuList>
	<NavigationMenuIndicator />
	<NavigationMenuViewport />
</NavigationMenuRoot>