<script lang="ts">
	let { label, count }: Readonly<{ label: string; count: number }> = $props();
</script>

<!-- The header of a stretch of records: the week, day or month in the axis's mono, the count. -->
<h4 class="head font-mono" data-testid="record-group">
	<span>{label}</span><span>{count}</span>
</h4>

<style>
	.head {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		margin-top: 8px;
		padding: 0 8px 4px;
		border-bottom: 1px solid var(--cg-border-default);
		font-size: 11px;
		font-weight: 400;
		color: var(--cg-text-muted);
	}
</style>
