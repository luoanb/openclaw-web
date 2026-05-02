<script lang="ts">
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
</script>

<Table>
	<TableHeader>
		<TableRow>
			<TableHead>名称</TableHead>
			<TableHead>状态</TableHead>
			<TableHead>日期</TableHead>
		</TableRow>
	</TableHeader>
	<TableBody>
		<TableRow>
			<TableCell class="font-medium">项目 A</TableCell>
			<TableCell>进行中</TableCell>
			<TableCell>2024-01-15</TableCell>
		</TableRow>
		<TableRow>
			<TableCell class="font-medium">项目 B</TableCell>
			<TableCell>已完成</TableCell>
			<TableCell>2024-01-20</TableCell>
		</TableRow>
		<TableRow>
			<TableCell class="font-medium">项目 C</TableCell>
			<TableCell>待处理</TableCell>
			<TableCell>2024-01-25</TableCell>
		</TableRow>
	</TableBody>
</Table>