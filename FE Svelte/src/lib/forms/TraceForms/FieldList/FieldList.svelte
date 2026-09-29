<script lang="ts">
	import { tick } from 'svelte';
	import { MAX_LIST_DEPTH } from '$lib/model/TraceForm/constants';
	import { newTraceField, newVariant } from '$lib/model/TraceForm/TraceForm';
	import { blockFields, type BlockId } from '$lib/model/TraceForm/templates';
	import { CloseOutline, PlusOutline } from 'flowbite-svelte-icons';
	import Button from '$lib/ui/Button/Button.svelte';
	import type {
		TraceFieldDraft,
		TraceScalarFieldKind,
		TraceVariantsFieldDraft
	} from '$lib/model/TraceForm/types';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import AddMenu from './AddMenu.svelte';
	import FieldList from './FieldList.svelte';
	import FieldRow from './FieldRow.svelte';
	import type { AddKind } from './types';
	import { setVisibility } from './visibility';

	let {
		fields = $bindable(),
		open = $bindable(null),
		lists = 0,
		listName = ''
	}: {
		fields: TraceFieldDraft[];
		/** The one field whose settings are open, shared by every level. */
		open?: string | null;
		/** Lists around this level: a third level of lists is not offered (Q2). */
		lists?: number;
		/** The list these fields are rows of; its «+» names it, so the level is never a guess. */
		listName?: string;
	} = $props();

	/** A new field asks for nothing until the user says it must (audit 2026-09-29). */
	const make = (kind: Exclude<AddKind, `block:${string}`>): TraceFieldDraft => ({
		...(kind === 'repeating'
			? { ...newTraceField('repeating'), kind, fields: [] }
			: newTraceField(kind)),
		required: false
	});
	/** A new field stands where it was asked for, open, its name ready to type. */
	const place = async (at: number, field: TraceFieldDraft): Promise<void> => {
		fields.splice(at, 0, field);
		open = field.id;
		await tick();
		document.querySelector<HTMLInputElement>(`[data-field-name="${field.id}"]`)?.focus();
	};
	/** What «+» asked for, placed at `at`: one field, or every field of a ready block. */
	const pick = async (at: number, kind: AddKind): Promise<void> => {
		if (!kind.startsWith('block:'))
			return place(at, make(kind as Exclude<AddKind, `block:${string}`>));
		const block = blockFields(kind.slice('block:'.length) as BlockId, locale.current);
		fields.splice(at, 0, ...block.slice(1));
		await place(at, block[0]);
	};
	const move = (index: number, delta: number): void => {
		const next = [...fields];
		[next[index], next[index + delta]] = [next[index + delta], next[index]];
		fields = next;
	};
	const remove = (index: number): void => {
		const { id } = fields[index];
		setVisibility(fields, id, null);
		fields.splice(index, 1);
		if (open === id) open = null;
	};
	/** A value field changes its kind keeping its name; a list never becomes a value. */
	const changeKind = (index: number, kind: TraceScalarFieldKind): void => {
		const before = fields[index];
		fields[index] = {
			...newTraceField(kind),
			id: before.id,
			key: before.key,
			label: before.label,
			required: kind === 'boolean' ? false : before.required
		};
	};
	/** A new variant stands at the end of its list, its name ready to type. */
	const addVariant = async (field: TraceVariantsFieldDraft): Promise<void> => {
		const variant = newVariant();
		field.variants.push(variant);
		await tick();
		document.querySelector<HTMLInputElement>(`[data-variant-name="${variant.id}"]`)?.focus();
	};
	const endLabel = $derived(
		lists && listName.trim()
			? t('form.addFieldIn', { name: listName.trim() })
			: t('form.addFieldPlus')
	);
</script>

<!-- A level of the form: its fields as lines, a quiet «+» on every gap and a named «+» at the
     end; a list's own fields stand under it behind a line, the way its rows will. -->
<div class="grid min-w-0 gap-1.5" data-testid="form-field-list">
	{#each fields as field, index (field.id)}
		{#if index > 0}
			<div class="gap-insert">
				<AddMenu
					between
					label={t('form.addHere')}
					allowList={lists < MAX_LIST_DEPTH}
					onpick={(kind) => pick(index, kind)}
				/>
			</div>
		{/if}
		<FieldRow
			bind:field={fields[index]}
			bind:siblings={fields}
			bind:open
			{index}
			onmove={(delta) => move(index, delta)}
			onremove={() => remove(index)}
			onkind={(kind) => changeKind(index, kind)}
		/>
		{#if field.kind === 'variants'}
			<!-- Each variant is a small form of its own: its name on top, its fields under it. -->
			<div class="ml-3 grid min-w-0 gap-2 border-l-2 border-outline pl-3">
				{#each field.variants as variant, v (variant.id)}
					<div class="variant grid min-w-0 gap-1.5" data-testid="form-variant">
						<div class="flex min-w-0 items-center gap-1">
							<input
								class="cg-control cg-field min-w-0 flex-1 font-medium"
								data-variant-name={variant.id}
								aria-label={t('form.variantN', { n: v + 1 })}
								placeholder={t('form.variantPlaceholder')}
								bind:value={variant.label}
							/><Button
								variant="quiet"
								icon
								aria-label={t('form.removeVariant', { name: variant.label || String(v + 1) })}
								title={t('form.removeVariant', { name: variant.label || String(v + 1) })}
								onclick={() => field.variants.splice(v, 1)}
								><CloseOutline class="h-3.5 w-3.5" /></Button
							>
						</div>
						<FieldList
							bind:fields={variant.fields}
							bind:open
							lists={lists + 1}
							listName={variant.label}
						/>
					</div>
				{/each}
				<button
					type="button"
					class="add-variant"
					data-testid="variant-add"
					onclick={() => addVariant(field)}
					><PlusOutline class="h-3.5 w-3.5" aria-hidden="true" />{t('form.addVariant')}</button
				>
			</div>
		{:else if 'fields' in field}
			<div class="ml-3 grid min-w-0 gap-1.5 border-l-2 border-outline pl-3">
				<FieldList
					bind:fields={field.fields}
					bind:open
					lists={lists + (field.kind === 'repeating' ? 1 : 0)}
					listName={field.kind === 'repeating' ? field.label : listName}
				/>
			</div>
		{/if}
	{/each}
	<AddMenu
		label={endLabel}
		allowList={lists < MAX_LIST_DEPTH}
		onpick={(kind) => pick(fields.length, kind)}
	/>
</div>

<style>
	.variant {
		padding: 0.5rem;
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-surface);
	}
	.add-variant {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		justify-self: start;
		padding: 0.25rem 0.5rem;
		font-size: 0.875rem;
		color: var(--cg-accent);
		border: 1px dashed color-mix(in srgb, var(--cg-accent) 55%, transparent);
		border-radius: var(--cg-radius-control);
		cursor: pointer;
	}
	/* The «+» between two fields sits on the gap itself and takes no room of its own. */
	.gap-insert {
		display: flex;
		justify-content: center;
		height: 0;
		margin: -0.125rem 0;
		position: relative;
		z-index: 1;
		align-items: center;
	}
</style>
