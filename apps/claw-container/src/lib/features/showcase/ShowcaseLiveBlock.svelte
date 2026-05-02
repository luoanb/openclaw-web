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

	let accordionValue = $state<string | undefined>(undefined);
	let tabValue = $state("a");
	let radioValue = $state("one");
	let progressValue = $state(42);
	let switchOn = $state(false);
	let checked = $state(false);
	let inputVal = $state("");
	let textareaVal = $state("多行文本预览。");
</script>

{#if slug === "accordion"}
	<Accordion type="single" bind:value={accordionValue} class="max-w-md">
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
	<Alert class="max-w-lg">
		<AlertTitle>提示</AlertTitle>
		<AlertDescription>这是一条 Alert 组件的最小示例。</AlertDescription>
	</Alert>
{:else if slug === "avatar"}
	<div class="flex items-center gap-3">
		<Avatar>
			<AvatarFallback>OC</AvatarFallback>
		</Avatar>
		<span class="text-muted-foreground text-sm">仅 Fallback 文本</span>
	</div>
{:else if slug === "badge"}
	<div class="flex flex-wrap gap-2">
		<Badge>默认</Badge>
		<Badge variant="secondary">次要</Badge>
		<Badge variant="outline">描边</Badge>
		<Badge variant="destructive">危险</Badge>
	</div>
{:else if slug === "button"}
	<div class="flex flex-wrap items-center gap-2">
		<Button type="button">默认</Button>
		<Button type="button" variant="secondary">次要</Button>
		<Button type="button" variant="outline">描边</Button>
		<Button type="button" variant="ghost">幽灵</Button>
		<Button type="button" variant="destructive" size="sm">危险</Button>
		<Button type="button" size="icon" aria-label="图标按钮">⋯</Button>
	</div>
{:else if slug === "card"}
	<Card class="max-w-md">
		<CardHeader>
			<CardTitle>卡片标题</CardTitle>
			<CardDescription>卡片副标题或说明。</CardDescription>
		</CardHeader>
		<CardContent class="text-muted-foreground text-sm">CardContent 区域。</CardContent>
	</Card>
{:else if slug === "checkbox"}
	<label class="flex cursor-pointer items-center gap-2">
		<Checkbox bind:checked />
		<span class="text-sm">同意条款（演示）</span>
	</label>
{:else if slug === "input"}
	<Input bind:value={inputVal} type="text" placeholder="请输入文字" class="max-w-sm" />
{:else if slug === "kbd"}
	<div class="flex flex-wrap items-center gap-2">
		<Kbd>Ctrl</Kbd>
		<span class="text-muted-foreground text-sm">+</span>
		<Kbd>K</Kbd>
	</div>
{:else if slug === "label"}
	<div class="grid max-w-sm gap-2">
		<Label for="showcase-demo-field">字段标签</Label>
		<Input id="showcase-demo-field" placeholder="与 Label 关联" />
	</div>
{:else if slug === "progress"}
	<Progress value={progressValue} class="max-w-xs" />
	<div class="mt-2 flex gap-2">
		<Button type="button" size="sm" variant="outline" onclick={() => (progressValue = 0)}>0</Button>
		<Button type="button" size="sm" variant="outline" onclick={() => (progressValue = 50)}>50</Button>
		<Button type="button" size="sm" variant="outline" onclick={() => (progressValue = 100)}>100</Button>
	</div>
{:else if slug === "radio-group"}
	<RadioGroup bind:value={radioValue} class="max-w-xs space-y-2">
		<label class="flex cursor-pointer items-center gap-2">
			<RadioGroupItem value="one" />
			<span class="text-sm">选项一</span>
		</label>
		<label class="flex cursor-pointer items-center gap-2">
			<RadioGroupItem value="two" />
			<span class="text-sm">选项二</span>
		</label>
	</RadioGroup>
{:else if slug === "separator"}
	<div class="flex h-10 max-w-xs items-center gap-2">
		<span class="text-sm">左</span>
		<Separator orientation="vertical" class="h-6" />
		<span class="text-sm">右</span>
	</div>
	<Separator class="my-3 max-w-xs" />
	<p class="text-muted-foreground text-xs">横向分隔线</p>
{:else if slug === "skeleton"}
	<div class="flex max-w-xs flex-col gap-2">
		<Skeleton class="h-10 w-full" />
		<Skeleton class="h-4 w-3/4" />
		<Skeleton class="h-4 w-1/2" />
	</div>
{:else if slug === "spinner"}
	<div class="flex items-center gap-2 text-sm">
		<Spinner />
		<span class="text-muted-foreground">加载中</span>
	</div>
{:else if slug === "switch"}
	<label class="flex cursor-pointer items-center gap-2">
		<Switch bind:checked={switchOn} />
		<span class="text-sm">{switchOn ? "已开启" : "已关闭"}</span>
	</label>
{:else if slug === "tabs"}
	<Tabs bind:value={tabValue} class="max-w-md">
		<TabsList>
			<TabsTrigger value="a">标签 A</TabsTrigger>
			<TabsTrigger value="b">标签 B</TabsTrigger>
		</TabsList>
		<TabsContent value="a" class="text-muted-foreground mt-2 border-t pt-3">面板 A 内容</TabsContent>
		<TabsContent value="b" class="text-muted-foreground mt-2 border-t pt-3">面板 B 内容</TabsContent>
	</Tabs>
{:else if slug === "textarea"}
	<Textarea bind:value={textareaVal} rows={3} class="max-w-lg" />
{:else if slug === "tooltip"}
	<TooltipProvider delayDuration={200}>
		<Tooltip>
			<TooltipTrigger>
				<Button type="button" variant="outline" size="sm">悬停查看提示</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">Tooltip 内容示例</TooltipContent>
		</Tooltip>
	</TooltipProvider>
{/if}
