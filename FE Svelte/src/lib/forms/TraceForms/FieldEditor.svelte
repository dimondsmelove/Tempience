<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import Button from '$lib/ui/Button/Button.svelte';
	import { FIELD_KINDS, UNIT_IDS } from '$lib/model/TraceForm/constants';
	import { newTraceField, newChoice } from '$lib/model/TraceForm/TraceForm';
	import type { TraceFieldDraft } from '$lib/model/TraceForm/types';
	import FieldEditor from './FieldEditor.svelte';

	let { fields = $bindable(), depth = 0 }: { fields: TraceFieldDraft[]; depth?: number } = $props();
	let addKind = $state<TraceFieldDraft['kind']>('text');
	const move = (index: number, delta: number) => {
		const reordered = [...fields];
		[reordered[index], reordered[index + delta]] = [reordered[index + delta], reordered[index]];
		fields = reordered;
	};
	const changeKind = (index: number, kind: TraceFieldDraft['kind']) => {
		const before = fields[index];
		fields[index] = {
			...newTraceField(kind),
			id: before.id,
			key: before.key,
			label: before.label,
			required: before.required
		};
	};
</script>

<!-- Every field is a card a shade lighter than the page, nested ones a shade darker again:
     the eye reads the blocks, no dividers needed (owner, 2026-09-18). -->
<div class="@container grid min-w-0 gap-2" data-testid="form-field-list">
	{#each fields as field, index (field.id)}
		<section
			class={[
				'min-w-0 rounded-[var(--cg-radius-surface)] p-3',
				depth % 2 ? 'bg-canvas' : 'bg-surface'
			]}
			aria-label={t('form.fieldN', { n: index + 1 })}
			data-testid="form-field"
		>
			<div class="mb-3 flex flex-wrap items-center gap-1">
				<span class="mr-auto font-mono text-xs text-muted"
					>{t('form.fieldN', { n: index + 1 })}</span
				>
				<Button
					size="sm"
					variant="quiet"
					icon
					disabled={index === 0}
					aria-label={t('form.moveUp')}
					title={t('form.moveUp')}
					onclick={() => move(index, -1)}>↑</Button
				>
				<Button
					size="sm"
					variant="quiet"
					icon
					disabled={index === fields.length - 1}
					aria-label={t('form.moveDown')}
					title={t('form.moveDown')}
					onclick={() => move(index, 1)}>↓</Button
				>
				<Button
					size="sm"
					variant="quiet"
					icon
					aria-label={t('form.removeField')}
					title={t('form.removeField')}
					onclick={() => (fields = fields.filter((entry) => entry.id !== field.id))}
					><TrashBinOutline class="h-4 w-4" /></Button
				>
			</div>
			<div class="grid min-w-0 gap-3 @min-[28rem]:grid-cols-2">
				<label class="grid min-w-0 gap-1 text-sm"
					>{t('form.fieldName')}<input
						class="cg-control cg-field"
						bind:value={field.label}
					/></label
				>
				<label class="grid min-w-0 gap-1 text-sm"
					>{t('form.fieldType')}
					<select
						class="cg-control cg-field"
						value={field.kind}
						disabled={field.locked}
						onchange={(event) =>
							changeKind(index, event.currentTarget.value as TraceFieldDraft['kind'])}
					>
						{#each FIELD_KINDS as kind (kind.value)}<option value={kind.value}
								>{t(kind.label)}</option
							>{/each}
					</select>
				</label>
				<label class="flex items-center gap-2 text-sm"
					><input type="checkbox" bind:checked={field.required} />{t('form.required')}</label
				>
				<label class="grid min-w-0 gap-1 text-sm"
					>{t('form.help')}<input class="cg-control cg-field" bind:value={field.help} /></label
				>
			</div>
			{#if 'fields' in field}
				{#if field.kind === 'repeating'}
					<div class="mt-3 grid grid-cols-2 gap-3">
						<label class="grid gap-1 text-sm"
							>{t('form.minItems')}<input
								class="cg-control cg-field"
								type="number"
								min="0"
								step="1"
								bind:value={field.minItems}
							/></label
						>
						<label class="grid gap-1 text-sm"
							>{t('form.maxItems')}<input
								class="cg-control cg-field"
								type="number"
								min="0"
								step="1"
								bind:value={field.maxItems}
							/></label
						>
					</div>
				{/if}
				<div class="mt-3 min-w-0">
					<FieldEditor bind:fields={field.fields} depth={depth + 1} />
				</div>
			{:else}
				{#if field.kind === 'number' || field.kind === 'integer'}
					<div class="mt-3 grid grid-cols-2 gap-3">
						<label class="col-span-2 grid gap-1 text-sm"
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
						<label class="grid gap-1 text-sm"
							>{t('form.minimum')}<input
								class="cg-control cg-field"
								type="number"
								step="any"
								bind:value={field.minimum}
							/></label
						>
						<label class="grid gap-1 text-sm"
							>{t('form.maximum')}<input
								class="cg-control cg-field"
								type="number"
								step="any"
								bind:value={field.maximum}
							/></label
						>
					</div>
				{:else if field.kind === 'text' || field.kind === 'textarea'}
					<div class="mt-3 grid grid-cols-2 gap-3">
						<label class="grid gap-1 text-sm"
							>{t('form.minLength')}<input
								class="cg-control cg-field"
								type="number"
								min="0"
								step="1"
								bind:value={field.minLength}
							/></label
						>
						<label class="grid gap-1 text-sm"
							>{t('form.maxLength')}<input
								class="cg-control cg-field"
								type="number"
								min="0"
								step="1"
								bind:value={field.maxLength}
							/></label
						>
					</div>
				{:else if field.kind === 'boolean'}
					<label class="mt-3 flex items-center gap-2 text-sm"
						><input type="checkbox" bind:checked={field.initial} />{t('form.yesByDefault')}</label
					>
				{:else if field.kind === 'choice' || field.kind === 'multi-choice'}
					<div class="mt-3 grid gap-2">
						{#each field.options as option, optionIndex (option.id)}
							<div class="flex min-w-0 gap-2">
								<label class="grid min-w-0 flex-1 gap-1 text-sm"
									>{t('form.optionN', { n: optionIndex + 1 })}<input
										class="cg-control cg-field"
										bind:value={option.label}
									/></label
								><Button
									class="self-end"
									aria-label={t('form.removeOptionN', { n: optionIndex + 1 })}
									onclick={() =>
										(field.options = field.options.filter((entry) => entry.id !== option.id))}
									>×</Button
								>
							</div>
						{/each}
						<Button
							class="justify-self-start"
							size="sm"
							onclick={() => field.options.push(newChoice())}>{t('form.addOption')}</Button
						>
					</div>
				{/if}
			{/if}
			{#if field.locked}<p class="mt-2 text-xs text-muted">
					{t('form.lockedHint')}
				</p>{/if}
		</section>
	{/each}
	<div class="mt-2 flex flex-wrap items-end gap-2">
		<label class="grid min-w-0 flex-1 gap-1 text-sm"
			>{depth ? t('form.newNested') : t('form.newField')}
			<select class="cg-control cg-field" bind:value={addKind}
				>{#each FIELD_KINDS as kind (kind.value)}<option value={kind.value}>{t(kind.label)}</option
					>{/each}</select
			>
		</label>
		<Button onclick={() => fields.push(newTraceField(addKind))}>{t('form.addField')}</Button>
	</div>
</div>
