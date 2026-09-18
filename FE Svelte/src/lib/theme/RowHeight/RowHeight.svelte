<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { defaultDevice } from '../constants';
	import { rowHeightBounds } from './constants';
	import type { RowHeightProps } from './types';
	let { value, onchange, compact = false }: RowHeightProps = $props();
</script>

<div
	class={compact ? 'flex items-center justify-between gap-1 text-xs text-muted' : 'cg-label'}
	role="group"
	aria-label={t('rows.height')}
>
	<span>{compact ? t('rows.heightShort') : t('rows.height')}</span>
	<div class="flex items-center gap-1">
		<Button
			size="sm"
			aria-label={compact ? t('rows.lower') : t('rows.decrease')}
			disabled={value <= rowHeightBounds.min}
			onclick={() => onchange(Math.max(rowHeightBounds.min, value - rowHeightBounds.step))}
			>−</Button
		>
		<output class="font-mono" data-testid={compact ? 'rail-row-height' : 'row-height'}
			>{value} px</output
		>
		<Button
			size="sm"
			aria-label={compact ? t('rows.higher') : t('rows.increase')}
			disabled={value >= rowHeightBounds.max}
			onclick={() => onchange(Math.min(rowHeightBounds.max, value + rowHeightBounds.step))}
			>+</Button
		>
		<Button
			size="sm"
			variant="quiet"
			aria-label={compact ? t('rows.original') : undefined}
			title={t('rows.reset')}
			disabled={value === defaultDevice.rowHeightPx}
			onclick={() => onchange(defaultDevice.rowHeightPx)}>{compact ? '↺' : t('rows.reset')}</Button
		>
	</div>
</div>
