<script lang="ts">
	import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
</script>

<Table class="max-w-md text-xs">
	<TableCaption>表格示例</TableCaption>
	<TableHeader>
		<TableRow>
			<TableHead>名称</TableHead>
			<TableHead>状态</TableHead>
			<TableHead class="text-right">数量</TableHead>
		</TableRow>
	</TableHeader>
	<TableBody>
		<TableRow>
			<TableCell>项目 A</TableCell>
			<TableCell>进行中</TableCell>
			<TableCell class="text-right">10</TableCell>
		</TableRow>
		<TableRow>
			<TableCell>项目 B</TableCell>
			<TableCell>已完成</TableCell>
			<TableCell class="text-right">25</TableCell>
		</TableRow>
	</TableBody>
	<TableFooter>
		<TableRow>
			<TableCell>合计</TableCell>
			<TableCell></TableCell>
			<TableCell class="text-right">35</TableCell>
		</TableRow>
	</TableFooter>
</Table>