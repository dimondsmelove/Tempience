<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { lifeViewState, updateLifeView } from './life-view.svelte';

	const period = $derived(lifeViewState.period);
	const scale = $derived(lifeViewState.scale);
	const scope = $derived(lifeViewState.scope);
	const scopeIncludeFuture = $derived(lifeViewState.scopeIncludeFuture);

	let fromInput = $state('');
	let toInput = $state('');

	$effect(() => {
		fromInput = period.from;
		toInput = period.to;
	});

	const apply = (): void => {
		if (!fromInput || !toInput) return;
		updateLifeView({
			period: { from: fromInput, to: toInput },
			scale,
			scope,
			scopeIncludeFuture
		});
	};
</script>

<div class="cg-panel flex flex-wrap items-end gap-3">
	<div>
		<label for="life-from" class="mb-1 block text-sm text-muted">{t('life.from')}</label>
		<input
			id="life-from"
			type="date"
			bind:value={fromInput}
			class="cg-control cg-field block w-full text-sm"
		/>
	</div>
	<div>
		<label for="life-to" class="mb-1 block text-sm text-muted">{t('life.to')}</label>
		<input
			id="life-to"
			type="date"
			bind:value={toInput}
			class="cg-control cg-field block w-full text-sm"
		/>
	</div>
	<Button size="sm" variant="primary" onclick={apply}>{t('life.apply')}</Button>
</div>
