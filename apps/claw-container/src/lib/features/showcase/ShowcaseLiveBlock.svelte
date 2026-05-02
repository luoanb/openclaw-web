<script lang="ts">
	import {
		Accordion,
		AccordionContent,
		AccordionItem,
		AccordionTrigger,
	} from "$lib/components/ui/accordion";
	import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
	import { Avatar, AvatarFallback } from "$lib/components/ui/avatar";
	import { Badge } from "$lib/components/ui/badge";
	import { Button } from "$lib/components/ui/button";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import { Input } from "$lib/components/ui/input";
	import { Kbd } from "$lib/components/ui/kbd";
	import { Label } from "$lib/components/ui/label";
	import { Progress } from "$lib/components/ui/progress";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
	import { Separator } from "$lib/components/ui/separator";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { Spinner } from "$lib/components/ui/spinner";
	import { Switch } from "$lib/components/ui/switch";
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
	import { Textarea } from "$lib/components/ui/textarea";
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger,
	} from "$lib/components/ui/tooltip";

	let { slug }: { slug: string } = $props();

	const PREVIEW_MAP = {
		"alert-dialog": () => import("./previews/alert-dialog.svelte"),
		"aspect-ratio": () => import("./previews/aspect-ratio.svelte"),
		"breadcrumb": () => import("./previews/breadcrumb.svelte"),
		"button-group": () => import("./previews/button-group.svelte"),
		"calendar": () => import("./previews/calendar.svelte"),
		"carousel": () => import("./previews/carousel.svelte"),
		"chart": () => import("./previews/chart.svelte"),
		"collapsible": () => import("./previews/collapsible.svelte"),
		"command": () => import("./previews/command.svelte"),
		"context-menu": () => import("./previews/context-menu.svelte"),
		"data-table": () => import("./previews/data-table.svelte"),
		"dialog": () => import("./previews/dialog.svelte"),
		"drawer": () => import("./previews/drawer.svelte"),
		"dropdown-menu": () => import("./previews/dropdown-menu.svelte"),
		"empty": () => import("./previews/empty.svelte"),
		"field": () => import("./previews/field.svelte"),
		"form": () => import("./previews/form.svelte"),
		"hover-card": () => import("./previews/hover-card.svelte"),
		"input-group": () => import("./previews/input-group.svelte"),
		"input-otp": () => import("./previews/input-otp.svelte"),
		"menubar": () => import("./previews/menubar.svelte"),
		"native-select": () => import("./previews/native-select.svelte"),
		"navigation-menu": () => import("./previews/navigation-menu.svelte"),
		"pagination": () => import("./previews/pagination.svelte"),
		"popover": () => import("./previews/popover.svelte"),
		"range-calendar": () => import("./previews/range-calendar.svelte"),
		"resizable": () => import("./previews/resizable.svelte"),
		"scroll-area": () => import("./previews/scroll-area.svelte"),
		"select": () => import("./previews/select.svelte"),
		"sheet": () => import("./previews/sheet.svelte"),
		"sidebar": () => import("./previews/sidebar.svelte"),
		"slider": () => import("./previews/slider.svelte"),
		"sonner": () => import("./previews/sonner.svelte"),
		"table": () => import("./previews/table.svelte"),
		"toggle-group": () => import("./previews/toggle-group.svelte"),
	} as Record<string, () => Promise<unknown>>;

	let accordionValue = $state<string | undefined>(undefined);
	let tabValue = $state("a");
	let radioValue = $state("one");
	let progressValue = $state(42);
	let switchOn = $state(false);
	let checked = $state(false);
	let inputVal = $state("");
	let textareaVal = $state("多行文本预览。");

	let previewPromise = $derived(PREVIEW_MAP[slug as keyof typeof PREVIEW_MAP]?.());
</script>

{#if slug === "accordion"}
	<Accordion type="single" bind:value={accordionValue} class="max-w-md text-sm">
		<AccordionItem value="one">
			<AccordionTrigger>第一节</AccordionTrigger>
			<AccordionContent>第一节下的说明文字。</AccordionContent>
		</AccordionItem>
		<AccordionItem value="two">
			<AccordionTrigger>第二节</AccordionTrigger>
			<AccordionContent>第二节下的说明文字。</AccordionContent>
		</AccordionItem>
	</Accordion>
{:else if slug === "alert"}
	<Alert class="max-w-md text-sm">
		<AlertTitle>提示</AlertTitle>
		<AlertDescription>这是一条 Alert 组件的最小示例。</AlertDescription>
	</Alert>
{:else if slug === "avatar"}
	<div class="flex items-center gap-2">
		<Avatar>
			<AvatarFallback>OC</AvatarFallback>
		</Avatar>
		<span class="text-muted-foreground text-xs">仅 Fallback</span>
	</div>
{:else if slug === "badge"}
	<div class="flex flex-wrap gap-1.5">
		<Badge>默认</Badge>
		<Badge variant="secondary">次要</Badge>
		<Badge variant="outline">描边</Badge>
		<Badge variant="destructive">危险</Badge>
	</div>
{:else if slug === "button"}
	<div class="flex flex-wrap items-center gap-1.5">
		<Button type="button">默认</Button>
		<Button type="button" variant="secondary">次要</Button>
		<Button type="button" variant="outline">描边</Button>
		<Button type="button" variant="ghost">幽灵</Button>
		<Button type="button" variant="destructive" size="sm">危险</Button>
		<Button type="button" size="icon" aria-label="图标按钮">⋯</Button>
	</div>
{:else if slug === "card"}
	<Card class="max-w-md" size="sm">
		<CardHeader>
			<CardTitle>卡片标题</CardTitle>
			<CardDescription>卡片副标题或说明。</CardDescription>
		</CardHeader>
		<CardContent class="text-muted-foreground text-xs">CardContent 区域。</CardContent>
	</Card>
{:else if slug === "checkbox"}
	<label class="flex cursor-pointer items-center gap-1.5">
		<Checkbox bind:checked />
		<span class="text-xs">同意条款（演示）</span>
	</label>
{:else if slug === "input"}
	<Input bind:value={inputVal} type="text" placeholder="请输入文字" class="max-w-sm" />
{:else if slug === "kbd"}
	<div class="flex flex-wrap items-center gap-1.5 text-xs">
		<Kbd>Ctrl</Kbd>
		<span class="text-muted-foreground">+</span>
		<Kbd>K</Kbd>
	</div>
{:else if slug === "label"}
	<div class="grid max-w-sm gap-1">
		<Label for="showcase-demo-field">字段标签</Label>
		<Input id="showcase-demo-field" placeholder="与 Label 关联" />
	</div>
{:else if slug === "progress"}
	<Progress value={progressValue} class="max-w-xs" />
	<div class="mt-1.5 flex flex-wrap gap-1.5">
		<Button type="button" size="sm" variant="outline" onclick={() => (progressValue = 0)}>0</Button>
		<Button type="button" size="sm" variant="outline" onclick={() => (progressValue = 50)}>50</Button>
		<Button type="button" size="sm" variant="outline" onclick={() => (progressValue = 100)}>100</Button>
	</div>
{:else if slug === "radio-group"}
	<RadioGroup bind:value={radioValue} class="max-w-xs space-y-1">
		<label class="flex cursor-pointer items-center gap-1.5">
			<RadioGroupItem value="one" />
			<span class="text-xs">选项一</span>
		</label>
		<label class="flex cursor-pointer items-center gap-1.5">
			<RadioGroupItem value="two" />
			<span class="text-xs">选项二</span>
		</label>
	</RadioGroup>
{:else if slug === "separator"}
	<div class="flex h-8 max-w-xs items-center gap-1.5">
		<span class="text-xs">左</span>
		<Separator orientation="vertical" class="h-5" />
		<span class="text-xs">右</span>
	</div>
	<Separator class="my-2 max-w-xs" />
	<p class="text-muted-foreground text-xs">横向分隔线</p>
{:else if slug === "skeleton"}
	<div class="flex max-w-xs flex-col gap-1.5">
		<Skeleton class="h-10 w-full" />
		<Skeleton class="h-4 w-3/4" />
		<Skeleton class="h-4 w-1/2" />
	</div>
{:else if slug === "spinner"}
	<div class="flex items-center gap-1.5 text-xs">
		<Spinner />
		<span class="text-muted-foreground">加载中</span>
	</div>
{:else if slug === "switch"}
	<label class="flex cursor-pointer items-center gap-1.5">
		<Switch bind:checked={switchOn} />
		<span class="text-xs">{switchOn ? "已开启" : "已关闭"}</span>
	</label>
{:else if slug === "tabs"}
	<Tabs bind:value={tabValue} class="max-w-md text-sm">
		<TabsList>
			<TabsTrigger value="a">标签 A</TabsTrigger>
			<TabsTrigger value="b">标签 B</TabsTrigger>
		</TabsList>
		<TabsContent value="a" class="text-muted-foreground mt-1.5 border-t pt-2 text-xs">面板 A</TabsContent>
		<TabsContent value="b" class="text-muted-foreground mt-1.5 border-t pt-2 text-xs">面板 B</TabsContent>
	</Tabs>
{:else if slug === "textarea"}
	<Textarea bind:value={textareaVal} rows={2} class="max-w-lg text-sm" />
{:else if slug === "tooltip"}
	<TooltipProvider delayDuration={200}>
		<Tooltip>
			<TooltipTrigger>
				<Button type="button" variant="outline" size="sm">悬停查看提示</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">Tooltip 内容示例</TooltipContent>
		</Tooltip>
	</TooltipProvider>
{:else if previewPromise}
	{#await previewPromise}
		<div class="bg-muted/25 flex h-20 items-center justify-center rounded-md">
			<span class="text-muted-foreground text-xs">加载中...</span>
		</div>
	{:then mod}
		<svelte:component this={(mod as any).default} />
	{:catch}
		<div class="bg-muted/25 flex h-20 items-center justify-center rounded-md">
			<span class="text-muted-foreground text-xs">加载失败</span>
		</div>
	{/await}
{/if}