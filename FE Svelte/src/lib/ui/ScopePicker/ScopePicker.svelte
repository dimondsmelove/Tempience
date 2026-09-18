<script lang="ts">
	import { ChevronDownOutline, ChevronRightOutline, PlusOutline } from 'flowbite-svelte-icons';
	import { SvelteSet } from 'svelte/reactivity';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { positionPopover } from '$lib/ui/Popover/position';
	import { PICKER_INDENT_PX, PICKER_LIST_MAX_HEIGHT, PICKER_MIN_WIDTH_REM } from './constants';
	import { scopePath, scopeRows } from './tree';
	import type { ScopePickerProps } from './types';

	let {
		scopes,
		label,
		value = null,
		exclude = [],
		none,
		placeholder,
		onpick,
		oncreate,
		disabled = false,
		size = 'md',
		inline = false,
		testId,
		class: className
	}: ScopePickerProps = $props();
	const id = $props.id();
	const listId = `${id}-list`;
	let query = $state('');
	/** The line the keyboard stands on, as an index of `choices`. */
	let active = $state(0);
	let trigger = $state<HTMLButtonElement | null>(null);
	let panel = $state<HTMLDivElement | null>(null);
	let search = $state<HTMLInputElement | null>(null);
	let open = $state(false);
	/** Scopes folded by the user; a search unfolds everything for its duration. */
	const collapsed = new SvelteSet<string>();
	const excluded = $derived(new Set(exclude));
	const rows = $derived(scopeRows(scopes, query, collapsed));
	const searching = $derived(Boolean(query.trim()));
	/** What Enter and the arrows walk: the «none» line first, then every offered Scope. */
	const choices = $derived<(string | null)[]>([
		...(none && !searching ? [null] : []),
		...rows.filter((row) => !excluded.has(row.id)).map((row) => row.id)
	]);
	const chosen = $derived(value ? scopes.find((scope) => scope.id === value) : undefined);
	const chosenPath = $derived(value ? scopePath(scopes, value) : []);
	const optionId = (scopeId: string | null): string => `${id}-option-${scopeId ?? 'none'}`;

	const close = (): void => panel?.hidePopover();
	const pick = (scopeId: string | null): void => {
		onpick(scopeId);
		close();
	};
	const fold = (scopeId: string, folded = !collapsed.has(scopeId)): void => {
		if (folded) collapsed.add(scopeId);
		else collapsed.delete(scopeId);
	};
	/** The list is as wide as its control, never narrower than a readable minimum. */
	const onbeforetoggle = (event: ToggleEvent): void => {
		if (event.newState !== 'open' || !panel || !trigger) return;
		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		const width = Math.max(trigger.getBoundingClientRect().width, PICKER_MIN_WIDTH_REM * rem);
		panel.style.width = `${width}px`;
	};
	const ontoggle = (event: ToggleEvent): void => {
		open = event.newState === 'open';
		if (!open) return;
		query = '';
		active = 0;
		search?.focus();
	};
	const onkeydown = (event: KeyboardEvent): void => {
		const current = choices[active] ?? null;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			const step = event.key === 'ArrowDown' ? 1 : -1;
			active = choices.length ? (active + step + choices.length) % choices.length : 0;
			document.getElementById(optionId(choices[active] ?? null))?.scrollIntoView({
				block: 'nearest'
			});
			event.preventDefault();
		} else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && current && !searching) {
			if (rows.find((row) => row.id === current)?.hasChildren)
				fold(current, event.key === 'ArrowLeft');
			event.preventDefault();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			if (choices.length) pick(choices[Math.min(active, choices.length - 1)]);
			else if (oncreate && searching) oncreate(query.trim());
		}
	};
</script>

<!-- One picker for every choice of a Scope: a field-like control (or a small «+ …» among
     chips) that opens a searchable, foldable tree as wide as itself. The list is in the DOM
     whether open or not, so a server render lists the choices. -->
<button
	type="button"
	class={[
		'scope-picker-trigger flex min-w-0 items-center gap-1 text-left',
		inline
			? 'scope-picker-inline rounded-[var(--cg-radius-control)] border border-dashed border-outline px-1.5 py-0.5 text-xs text-muted hover:border-[color:var(--cg-border-strong)] hover:text-ink'
			: 'cg-control cg-field',
		!inline && size === 'sm' && 'cg-control-sm',
		className
	]}
	role="combobox"
	aria-label={label}
	aria-haspopup="listbox"
	aria-expanded={open}
	aria-controls={listId}
	popovertarget={id}
	{disabled}
	data-testid={testId}
	bind:this={trigger}
>
	{#if inline}<PlusOutline class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{/if}
	<span class={['min-w-0 flex-1 truncate', !inline && !chosen && !none && 'text-muted']}>
		{#if chosen}
			{#if chosenPath.length}<span class="text-muted" aria-hidden="true"
					>{chosenPath.join(' › ')} ›
				</span>{/if}{chosen.name}
		{:else}{value === null && none ? none : (placeholder ?? label)}{/if}
	</span>
	{#if !inline}<ChevronDownOutline
			class={[
				'h-4 w-4 shrink-0 text-muted transition-transform duration-150',
				open && 'rotate-180'
			]}
			aria-hidden="true"
		/>{/if}
</button>
<div
	{id}
	popover="auto"
	class="scope-picker-panel cg-popover border border-outline bg-surface text-ink"
	bind:this={panel}
	{onbeforetoggle}
	{ontoggle}
	{@attach positionPopover}
>
	<input
		type="search"
		class="cg-control cg-control-sm cg-field scope-picker-search"
		placeholder={t('picker.search')}
		aria-label={t('picker.search')}
		aria-controls={listId}
		aria-activedescendant={choices.length ? optionId(choices[active] ?? null) : undefined}
		bind:this={search}
		bind:value={query}
		{onkeydown}
	/>
	<ul
		id={listId}
		role="listbox"
		aria-label={label}
		class="scope-picker-list overflow-auto"
		style:max-height={PICKER_LIST_MAX_HEIGHT}
	>
		{#if none && !searching}
			<!-- The keyboard walks the options from the search box (aria-activedescendant); a click here is the pointer's way. -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li
				id={optionId(null)}
				role="option"
				class="scope-picker-option cursor-pointer rounded-[var(--cg-radius-control)] px-2 py-1 text-muted"
				aria-label={none}
				aria-selected={value === null}
				data-active={choices[active] === null}
				onmouseenter={() => (active = 0)}
				onmousedown={(event) => event.preventDefault()}
				onclick={() => pick(null)}
			>
				{none}
			</li>
		{/if}
		{#each rows as row (row.id)}
			{@const taken = excluded.has(row.id)}
			<!-- The keyboard walks the options from the search box (aria-activedescendant); a click here is the pointer's way. -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li
				id={optionId(row.id)}
				role="option"
				class={[
					'scope-picker-option flex min-w-0 items-center gap-0.5 rounded-[var(--cg-radius-control)] py-1 pr-2',
					taken ? 'text-muted opacity-60' : 'cursor-pointer',
					!row.match && 'text-muted'
				]}
				style:padding-left="{0.25 + (row.depth * PICKER_INDENT_PX) / 16}rem"
				aria-label={row.name}
				aria-selected={row.id === value}
				aria-disabled={taken || undefined}
				title={taken
					? t('picker.taken')
					: row.path.length
						? [...row.path, row.name].join(' › ')
						: undefined}
				data-active={choices[active] === row.id}
				onmouseenter={() => {
					if (!taken) active = choices.indexOf(row.id);
				}}
				onmousedown={(event) => event.preventDefault()}
				onclick={() => {
					if (!taken) pick(row.id);
				}}
			>
				{#if row.hasChildren && !searching}
					<button
						type="button"
						class="scope-picker-fold flex shrink-0 cursor-pointer items-center justify-center rounded-[var(--cg-radius-control)] text-muted hover:text-ink"
						tabindex="-1"
						aria-label={collapsed.has(row.id)
							? t('rail.unfold', { name: row.name })
							: t('rail.fold', { name: row.name })}
						aria-expanded={!collapsed.has(row.id)}
						onclick={(event) => {
							event.stopPropagation();
							fold(row.id);
						}}
					>
						{#if collapsed.has(row.id)}<ChevronRightOutline class="h-3.5 w-3.5" />
						{:else}<ChevronDownOutline class="h-3.5 w-3.5" />{/if}
					</button>
				{:else}<span class="scope-picker-fold shrink-0"></span>{/if}
				<span class="min-w-0 truncate">{row.name}</span>
			</li>
		{:else}
			<li class="px-2 py-1 text-muted" role="presentation">{t('picker.empty')}</li>
		{/each}
	</ul>
	{#if oncreate && searching}
		<button
			type="button"
			class="cg-control cg-control-sm cursor-pointer justify-start border-t border-outline text-left text-accent"
			data-testid={testId ? `${testId}-create` : undefined}
			onclick={() => oncreate(query.trim())}>+ {t('picker.create', { name: query.trim() })}</button
		>
	{/if}
</div>

<style>
	.scope-picker-trigger {
		cursor: pointer;
	}
	.scope-picker-trigger:disabled {
		cursor: default;
		opacity: 0.5;
	}
	/* Only an open popover is laid out: a display utility on the element would override the
	   user agent's `display: none` for a closed one and leave it in the way of the page. */
	.scope-picker-panel:popover-open {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.scope-picker-panel {
		position: fixed;
		inset: auto;
		margin: 0;
		max-width: calc(100vw - 1rem);
		max-height: calc(100dvh - 1rem);
		padding: 0.375rem;
		font-size: var(--cg-text-size-caption);
	}
	.scope-picker-search::-webkit-search-cancel-button {
		appearance: none;
	}
	.scope-picker-fold {
		width: 1.125rem;
		height: 1.125rem;
	}
	/* One line is lit at a time: the one the keyboard or the pointer stands on. */
	.scope-picker-option[data-active='true'] {
		background: color-mix(in srgb, var(--cg-accent) 12%, transparent);
	}
	.scope-picker-option[aria-selected='true'] {
		color: var(--cg-accent);
	}
</style>
