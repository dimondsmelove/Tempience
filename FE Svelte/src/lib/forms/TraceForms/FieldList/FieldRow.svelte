<script lang="ts">
	import {
		ArrowDownOutline,
		ArrowUpOutline,
		ChevronDownOutline,
		CloseOutline,
		TrashBinOutline
	} from 'flowbite-svelte-icons';
	import { FIELD_KINDS, UNIT_IDS } from '$lib/model/TraceForm/constants';
	import { newChoice } from '$lib/model/TraceForm/TraceForm';
	import type { TraceFieldDraft, TraceScalarFieldKind } from '$lib/model/TraceForm/types';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { MessageKey } from '$lib/state/Locale/types';
	import Button from '$lib/ui/Button/Button.svelte';
	import { controllersFor, shownBy, visibilityOf } from './visibility';

	let {
		field = $bindable(),
		siblings = $bindable(),
		open = $bindable(),
		index,
		onmove,
		onremove,
		onkind
	}: {
		field: TraceFieldDraft;
		/** The fields of the same level: the choices that may decide this one live there. */
		siblings: TraceFieldDraft[];
		/** The one field whose settings are open, across every level. */
		open: string | null;
		index: number;
		onmove: (delta: number) => void;
		onremove: () => void;
		onkind: (kind: TraceScalarFieldKind) => void;
	} = $props();
	const expanded = $derived(open === field.id);
	const bodyId = $derived(`field-body-${field.id}`);
	const kindLabel = (kind: TraceFieldDraft['kind']): MessageKey =>
		kind === 'repeating'
			? 'fieldKind.repeating'
			: kind === 'variants'
				? 'fieldKind.variants'
				: kind === 'group'
					? 'fieldKind.group'
					: (FIELD_KINDS.find((entry) => entry.value === kind)?.label ?? 'fieldKind.text');
	const nameOf = (other: TraceFieldDraft): string => other.label.trim() || t('form.untitled');
	const controllers = $derived(controllersFor(siblings, field));
	const visibility = $derived(visibilityOf(siblings, field));
	const controller = $derived(
		visibility ? controllers.find((choice) => choice.id === visibility.controllerId) : undefined
	);
	/** A choice whose options show fields beside it is always required (Q5). */
	const decides = $derived(
		field.kind === 'choice' && field.options.some((option) => shownBy(siblings, option).length)
	);
	let helpShown = $state(false);
	const badges = $derived.by(() => {
		const list: string[] = [];
		if (field.required || decides) list.push(t('form.requiredShort'));
		if ('unit' in field && field.unit.trim()) list.push(field.unit.trim());
		if ('options' in field && (field.kind === 'choice' || field.kind === 'multi-choice'))
			list.push(t('form.optionsCount', { count: field.options.length }));
		if ('fields' in field) list.push(t('form.fieldsCount', { count: field.fields.length }));
		if (field.kind === 'variants')
			list.push(t('form.variantsCount', { count: field.variants.length }));
		return list;
	});
	const condition = $derived(
		controller && visibility
			? t('form.visibilityChip', {
					name: nameOf(controller),
					options: controller.options
						.filter((option) => visibility.optionIds.includes(option.id))
						.map((option) => option.label.trim() || '…')
						.join(', ')
				})
			: null
	);
</script>

<!-- A field is one line — its name, its kind, what matters about it — and opens in place, one
     at a time (research 2026-09-29: Google Forms' single open card); when it is shown is set
     here, on the field that depends (Airtable, SurveyJS), not on the choice above it. -->
<div class={['field-row min-w-0', expanded && 'open']} data-testid="form-field">
	<button
		type="button"
		class="field-head"
		aria-expanded={expanded}
		aria-controls={bodyId}
		onclick={() => (open = expanded ? null : field.id)}
	>
		<!-- The name keeps its room; what is said about the field wraps under it on a narrow line. -->
		<span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
			<span class={['max-w-full truncate', !field.label.trim() && 'text-muted']}
				>{nameOf(field)}</span
			>
			<span class="shrink-0 text-xs text-muted">{t(kindLabel(field.kind))}</span>
			{#each badges as badge (badge)}<span class="badge">{badge}</span>{/each}
			{#if condition}<span class="badge condition">{condition}</span>{/if}
		</span>
		<ChevronDownOutline
			class={['ml-auto h-4 w-4 shrink-0 text-muted transition-transform', expanded && 'rotate-180']}
			aria-hidden="true"
		/>
	</button>
	{#if expanded}
		<div id={bodyId} class="grid min-w-0 gap-3 px-3 pt-1 pb-3">
			<div class="@container grid min-w-0 gap-3">
				<div class="grid min-w-0 gap-3 @min-[26rem]:grid-cols-2">
					<label class="grid min-w-0 gap-1 text-sm"
						>{t('form.fieldName')}<input
							class="cg-control cg-field"
							data-field-name={field.id}
							bind:value={field.label}
						/></label
					>
					{#if field.kind === 'variants'}<label class="grid min-w-0 gap-1 text-sm"
							>{t('form.choiceLabel')}<input
								class="cg-control cg-field"
								placeholder={t('form.choiceLabelPlaceholder')}
								bind:value={field.choiceLabel}
							/></label
						>{:else if !('fields' in field)}<label class="grid min-w-0 gap-1 text-sm"
							>{t('form.fieldType')}<select
								class="cg-control cg-field"
								value={field.kind}
								disabled={field.locked}
								onchange={(event) => onkind(event.currentTarget.value as TraceScalarFieldKind)}
							>
								{#each FIELD_KINDS as kind (kind.value)}<option value={kind.value}
										>{t(kind.label)}</option
									>{/each}
							</select></label
						>{/if}
				</div>
				{#if field.kind !== 'boolean'}
					<label class="flex flex-wrap items-center gap-2 text-sm"
						><input type="checkbox" bind:checked={field.required} disabled={decides} />{t(
							field.kind === 'repeating' || field.kind === 'variants'
								? 'form.requiredList'
								: 'form.required'
						)}{#if decides}<span class="text-xs text-muted">{t('form.decidesRequired')}</span
							>{/if}</label
					>{/if}
				{#if field.kind === 'repeating' || field.kind === 'variants'}<p class="text-xs text-muted">
						{t(field.kind === 'repeating' ? 'form.listHint' : 'form.variantsHint')}
					</p>{/if}
				{#if field.kind === 'number' || field.kind === 'integer'}
					<label class="grid min-w-0 gap-1 text-sm"
						>{t('form.unit')}<input
							class="cg-control cg-field"
							list={`units-${field.id}`}
							bind:value={field.unit}
							disabled={field.locked}
							placeholder={t('form.unitPlaceholder')}
						/></label
					>
					<datalist id={`units-${field.id}`}
						>{#each Object.keys(UNIT_IDS) as unit (unit)}<option value={unit}
							></option>{/each}</datalist
					>
				{/if}
				{#if field.kind === 'choice' || field.kind === 'multi-choice'}
					<div class="grid min-w-0 gap-2" role="group" aria-label={t('form.options')}>
						<span class="text-sm">{t('form.options')}</span>
						{#each field.options as option, n (option.id)}
							<div class="grid min-w-0 gap-1">
								<div class="flex min-w-0 items-center gap-1">
									<input
										class="cg-control cg-field min-w-0 flex-1"
										aria-label={t('form.optionN', { n: n + 1 })}
										placeholder={t('form.optionN', { n: n + 1 })}
										bind:value={option.label}
									/><Button
										variant="quiet"
										icon
										aria-label={t('form.removeOptionN', { n: n + 1 })}
										title={t('form.removeOptionN', { n: n + 1 })}
										onclick={() =>
											(field.options = field.options.filter((entry) => entry.id !== option.id))}
										><CloseOutline class="h-3.5 w-3.5" /></Button
									>
								</div>
							</div>
						{/each}
						<Button
							class="justify-self-start"
							size="sm"
							onclick={() => field.options.push(newChoice())}>{t('form.addOption')}</Button
						>
					</div>
				{/if}
				{#if field.help || helpShown}
					<label class="grid min-w-0 gap-1 text-sm"
						>{t('form.help')}<input class="cg-control cg-field" bind:value={field.help} /></label
					>
				{:else}
					<button
						type="button"
						class="link justify-self-start text-sm"
						onclick={() => (helpShown = true)}>{t('form.addHelp')}</button
					>
				{/if}
				{#if field.locked}<p class="text-xs text-muted">{t('form.lockedHint')}</p>{/if}
				<div class="flex items-center gap-1 border-t border-outline pt-2">
					<Button
						size="sm"
						variant="quiet"
						icon
						disabled={index === 0}
						aria-label={t('form.moveUp')}
						title={t('form.moveUp')}
						onclick={() => onmove(-1)}><ArrowUpOutline class="h-4 w-4" /></Button
					>
					<Button
						size="sm"
						variant="quiet"
						icon
						disabled={index === siblings.length - 1}
						aria-label={t('form.moveDown')}
						title={t('form.moveDown')}
						onclick={() => onmove(1)}><ArrowDownOutline class="h-4 w-4" /></Button
					>
					<Button size="sm" variant="quiet" class="ml-auto" onclick={onremove}
						><TrashBinOutline class="h-4 w-4" aria-hidden="true" />{t('form.removeField')}</Button
					>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.field-row {
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-surface);
		background: var(--cg-bg-raised);
	}
	.field-row.open {
		border-color: var(--cg-accent);
	}
	.field-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-width: 0;
		padding: 0.5rem 0.75rem;
		text-align: left;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.badge {
		flex-shrink: 0;
		padding: 0 0.375rem;
		font-size: 0.75rem;
		color: var(--cg-text-muted);
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-control);
	}
	.badge.condition {
		flex-shrink: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--cg-text-primary);
		border-color: color-mix(in srgb, var(--cg-accent) 55%, transparent);
	}
	.link {
		color: var(--cg-accent);
		cursor: pointer;
	}
	.link:hover {
		text-decoration: underline;
	}
</style>
