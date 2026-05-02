<script lang="ts">
	import { Field, FieldLabel, FieldDescription, FieldError, FieldContent, FieldSet, FieldLegend } from "$lib/components/ui/field";
	import { Input } from "$lib/components/ui/input";
</script>

<div class="max-w-sm space-y-4">
	<FieldSet>
		<FieldLegend>个人信息</FieldLegend>
		<Field>
			<FieldLabel>用户名</FieldLabel>
			<FieldContent>
				<Input placeholder="请输入用户名" />
			</FieldContent>
			<FieldDescription>用于登录和展示</FieldDescription>
		</Field>
		<Field>
			<FieldLabel>邮箱</FieldLabel>
			<FieldContent>
				<Input type="email" placeholder="请输入邮箱" />
			</FieldContent>
			<FieldError>请输入有效的邮箱地址</FieldError>
		</Field>
	</FieldSet>
</div>