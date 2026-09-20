<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { colorFields, metricFields, monoFonts, uiFonts, type MetricGroup } from '../constants';
	import type { ResolvedTheme } from '../resolve-theme';
	import type { ColorKey, Theme } from '../types';
	import ThemeColourField from './ThemeColourField/ThemeColourField.svelte';
	let {
		theme = $bindable(),
		mode,
		onchange
	}: { theme: Theme; mode: ResolvedTheme; onchange: () => void } = $props();
	const GROUPS: readonly MetricGroup[] = ['typography', 'geometry'];
	// Scope colours are not theme fields (R1, owner 2026-09-19): a Scope keeps a hue, the mode the tone.
	const colorEntries = Object.entries(colorFields) as [ColorKey, (typeof colorFields)[ColorKey]][];
</script>

{#snippet colorField(key: ColorKey, label: (typeof colorFields)[ColorKey][0])}
	<!-- The dot opens the flower; the hex beside it is the exact path (pack 3, P2). -->
	<ThemeColourField
		label={t(label)}
		value={theme.colors[mode][key]}
		testId={`theme-colour-${key}`}
		onchange={(next) => {
			theme.colors[mode][key] = next;
			onchange();
		}}
	/>
{/snippet}

<details class="editor-group">
	<summary>{t('theme.colors')}</summary>
	<div class="fields">
		{#each colorEntries as [key, [label]] (key)}{@render colorField(key, label)}{/each}
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
