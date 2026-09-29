<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { CloseOutline, PlusOutline } from 'flowbite-svelte-icons';
	import {
		COUNT_WAYS,
		extrasFor,
		workoutDraft,
		type CountWay,
		type Exercise,
		type Extra
	} from '$lib/model/TraceForm/templates';
	import type { TraceFormDraft } from '$lib/model/TraceForm/types';
	import { createId } from '$lib/state/triplit/ids';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { MessageKey } from '$lib/state/Locale/types';
	import Button from '$lib/ui/Button/Button.svelte';

	let {
		busy = false,
		editing,
		setup,
		oncreate,
		onbuild,
		onback
	}: {
		busy?: boolean;
		/** The workout being edited: its unchanged exercises keep their fields. */
		editing?: TraceFormDraft;
		/** Its template screen as saved: the name and each exercise with its way and extras. */
		setup?: { name: string; exercises: readonly Exercise[] };
		/** Saves the workout as it is. */
		oncreate: (draft: TraceFormDraft) => void;
		/** Opens the workout in the builder, to adjust anything the template does not. */
		onbuild: (draft: TraceFormDraft) => void;
		/** Back to the choice of template; a workout being edited has none. */
		onback?: () => void;
	} = $props();
	type Row = { key: string; id?: string; label: string; way: CountWay; extras: Extra[] };
	const row = (exercise?: Exercise): Row => ({
		key: createId(),
		id: exercise?.id,
		label: exercise?.label ?? '',
		way: exercise?.way ?? 'reps',
		extras: [...(exercise?.extras ?? [])]
	});
	let name = $state(untrack(() => setup?.name ?? t('template.workoutName')));
	let exercises = $state<Row[]>(
		untrack(() => (setup?.exercises.length ? setup.exercises.map(row) : [row()]))
	);
	const ready = $derived(name.trim() && exercises.some((exercise) => exercise.label.trim()));
	const draft = (): TraceFormDraft =>
		workoutDraft(
			name.trim(),
			exercises.map(({ id, label, way, extras }) => ({
				id,
				label,
				way,
				// An extra the way cannot take is dropped, not kept hidden.
				extras: extras.filter((extra) => extrasFor(way).includes(extra))
			})),
			locale.current,
			untrack(() => editing)
		);
	const add = async (): Promise<void> => {
		const next = row();
		exercises.push(next);
		await tick();
		document.querySelector<HTMLInputElement>(`[data-exercise="${next.key}"]`)?.focus();
	};
	const toggle = (exercise: Row, extra: Extra): void => {
		exercise.extras = exercise.extras.includes(extra)
			? exercise.extras.filter((entry) => entry !== extra)
			: [...exercise.extras, extra];
	};
</script>

<!-- A workout is its exercises and the way each is counted (Hevy's exercise types), with what
     a set or an exercise may add: nothing about fields, lists or conditions — the builder shows
     those when the owner asks for it (owner, 2026-09-29). -->
<section class="grid min-w-0 gap-3" data-testid="workout-setup">
	<label class="grid gap-1 text-sm"
		>{t('form.kindName')}<input class="cg-control cg-field" bind:value={name} /></label
	>
	<div class="grid min-w-0 gap-2" role="group" aria-labelledby="workout-exercises">
		<span id="workout-exercises" class="text-sm">{t('template.workoutTitle')}</span>
		{#each exercises as exercise, n (exercise.key)}
			<div class="grid min-w-0 gap-1">
				<div class="exercise grid min-w-0 items-center gap-1.5">
					<input
						class="cg-control cg-field min-w-0"
						data-exercise={exercise.key}
						aria-label={t('template.exerciseName', { n: n + 1 })}
						placeholder={t('template.exercisePlaceholder')}
						bind:value={exercise.label}
					/>
					<select
						class="cg-control cg-field min-w-0"
						aria-label={t('template.way')}
						bind:value={exercise.way}
					>
						{#each COUNT_WAYS as way (way)}<option value={way}
								>{t(`template.way.${way}` as MessageKey)}</option
							>{/each}
					</select>
					<Button
						variant="quiet"
						icon
						aria-label={t('template.removeExercise', { n: n + 1 })}
						title={t('template.removeExercise', { n: n + 1 })}
						disabled={exercises.length === 1}
						onclick={() => exercises.splice(n, 1)}><CloseOutline class="h-3.5 w-3.5" /></Button
					>
				</div>
				<div
					class="flex flex-wrap items-center gap-1 text-xs"
					role="group"
					aria-label={t('template.extras')}
				>
					<span class="text-muted">{t('template.extras')}:</span>
					{#each extrasFor(exercise.way) as extra (extra)}
						{@const on = exercise.extras.includes(extra)}
						<button
							type="button"
							class={['extra', on && 'on']}
							aria-pressed={on}
							onclick={() => toggle(exercise, extra)}
							>{t(`template.extra.${extra}` as MessageKey)}</button
						>
					{/each}
				</div>
			</div>
		{/each}
		<Button class="justify-self-start" size="sm" onclick={add}
			><PlusOutline class="h-3.5 w-3.5" aria-hidden="true" />{t('template.addExercise')}</Button
		>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<Button variant="primary" disabled={busy || !ready} onclick={() => oncreate(draft())}
			>{editing ? t('template.save') : t('template.create')}</Button
		>
		<Button disabled={busy || !ready} onclick={() => onbuild(draft())}
			>{t('template.toBuilder')}</Button
		>
		{#if onback}<Button variant="quiet" disabled={busy} onclick={onback}
				>{t('template.back')}</Button
			>{/if}
	</div>
</section>

<style>
	/* The name takes the room; the way of counting keeps a readable width; the × its own. */
	.exercise {
		grid-template-columns: minmax(0, 1fr) minmax(0, 12rem) auto;
	}
	.extra {
		padding: 0.0625rem 0.5rem;
		color: var(--cg-text-muted);
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-control);
		cursor: pointer;
	}
	.extra.on {
		color: var(--cg-text-primary);
		border-color: var(--cg-accent);
		background: color-mix(in srgb, var(--cg-accent) 18%, transparent);
	}
</style>
