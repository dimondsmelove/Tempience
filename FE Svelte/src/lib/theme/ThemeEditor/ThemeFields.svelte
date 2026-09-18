<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { colorFields, metricFields, monoFonts, uiFonts, type MetricGroup } from '../constants';
	import type { ResolvedTheme } from '../resolve-theme';
	import type { Theme } from '../types';
	let {
		theme = $bindable(),
		mode,
		onchange
	}: { theme: Theme; mode: ResolvedTheme; onchange: () => void } = $props();
	let colorContext: CanvasRenderingContext2D | null = null;
	const hex = (value: string): string => {
		if (typeof document === 'undefined') return '#000000';
		colorContext ??= document
			.createElement('canvas')
			.getContext('2d', { willReadFrequently: true });
		if (!colorContext) return '#000000';
		colorContext.clearRect(0, 0, 1, 1);
		colorContext.fillStyle = value;
		colorContext.fillRect(0, 0, 1, 1);
		return (
			'#' +
			[...colorContext.getImageData(0, 0, 1, 1).data]
				.slice(0, 3)
				.map((n) => n.toString(16).padStart(2, '0'))
				.join('')
		);
	};
	const GROUPS: readonly MetricGroup[] = ['typography', 'geometry'];
</script>

<details class="editor-group">
	<summary>{t('theme.colors')}</summary>
	<div class="fields">
		{#each Object.entries(colorFields) as [key, [label]] (key)}
			<label class="cg-label">
				{t(label)}
				<span class="color-field">
					<input
						type="color"
						aria-label={t('theme.palettePicker', { label: t(label) })}
						value={hex(theme.colors[mode][key as keyof typeof colorFields])}
						oninput={(e) => {
							theme.colors[mode][key as keyof typeof colorFields] = e.currentTarget.value;
							onchange();
						}}
					/>
					<input
						class="cg-control cg-field"
						aria-label={t(label)}
						value={theme.colors[mode][key as keyof typeof colorFields]}
						oninput={(e) => {
							theme.colors[mode][key as keyof typeof colorFields] = e.currentTarget.value;
							onchange();
						}}
					/>
				</span>
			</label>
		{/each}
	</div>
</details>
{#each GROUPS as group (group)}
	<details class="editor-group">
		<summary>{t(`theme.group.${group}`)}</summary>
		<div class="fields">
			{#if group === 'typography'}
				<label class="cg-label"
					>{t('theme.fontUi')}
					<select
						class="cg-control cg-field"
						aria-label={t('theme.fontUi')}
						value={theme.fonts.ui}
						onchange={(e) => {
							theme.fonts.ui = e.currentTarget.value as Theme['fonts']['ui'];
							onchange();
						}}
					>
						{#each Object.entries(uiFonts) as [id, font] (id)}<option value={id}
								>{t(font.label)}</option
							>{/each}
					</select>
				</label>
				<label class="cg-label"
					>{t('theme.fontMono')}
					<select
						class="cg-control cg-field"
						aria-label={t('theme.fontMono')}
						value={theme.fonts.mono}
						onchange={(e) => {
							theme.fonts.mono = e.currentTarget.value as Theme['fonts']['mono'];
							onchange();
						}}
					>
						{#each Object.entries(monoFonts) as [id, font] (id)}<option value={id}
								>{t(font.label)}</option
							>{/each}
					</select>
				</label>
			{/if}
			{#each Object.entries(metricFields).filter(([, field]) => field.group === group) as [key, field] (key)}
				<label class="cg-label">
					<span class="field-label"
						>{t(field.label)}<span class="metric-value"
							>{theme.metrics[key as keyof typeof metricFields]}</span
						></span
					>
					<input
						type="range"
						min={field.min}
						max={field.max}
						step={field.step}
						value={theme.metrics[key as keyof typeof metricFields]}
						oninput={(e) => {
							theme.metrics[key as keyof typeof metricFields] = e.currentTarget.valueAsNumber;
							onchange();
						}}
					/>
				</label>
			{/each}
		</div>
	</details>
{/each}

<style>
	.editor-group {
		border: var(--cg-border-width) solid var(--cg-border-default);
		border-radius: var(--cg-radius-surface);
		overflow: clip;
	}
	summary {
		padding: clamp(0.5rem, var(--cg-panel-padding), 1rem);
		cursor: pointer;
		font-size: var(--cg-text-size-control);
		font-weight: 500;
	}
	summary:hover {
		background: var(--cg-accent-secondary);
		color: var(--cg-text-on-secondary);
	}
	.fields {
		display: grid;
		gap: var(--cg-gap);
		padding: 0 clamp(0.5rem, var(--cg-panel-padding), 1rem)
			clamp(0.5rem, var(--cg-panel-padding), 1rem);
	}
	.color-field {
		display: grid;
		grid-template-columns: 2.25rem minmax(0, 1fr);
		gap: calc(var(--cg-gap) * 0.5);
		align-items: center;
	}
	input[type='color'] {
		width: 2.25rem;
		height: var(--cg-control-height);
		padding: 2px;
		background: var(--cg-bg-input);
		border: var(--cg-border-width) solid var(--cg-border-default);
		border-radius: var(--cg-radius-control);
	}
	.field-label {
		display: flex;
		justify-content: space-between;
		gap: var(--cg-gap);
	}
	.metric-value {
		font-family: var(--cg-font-mono);
		color: var(--cg-text-muted);
	}
	input[type='range'] {
		width: 100%;
	}
</style>
