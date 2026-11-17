<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import OutcomeIcon from '../OutcomeIcon/OutcomeIcon.svelte';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { ExplorerIntersection, ExplorerTrace } from '$lib/model/Snapshot/types';
	import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';
	import { traceMarkTime } from '$lib/model/Projection/marks';
	import { closedDayLabel, type ClosedGroup } from './Closed';
	let {
		closed,
		doneLimit,
		today,
		traces,
		links,
		assessments,
		search,
		reopen,
		edit,
		more
	}: {
		closed: { groups: ClosedGroup[]; total: number };
		doneLimit: number;
		today: string;
		traces: readonly ExplorerTrace[];
		links: readonly ExplorerIntersection[];
		assessments: readonly IntentionAssessment[];
		search: string;
		reopen: (id: string) => void;
		edit: (id: string) => void;
		more: () => void;
	} = $props();
	const alternative = (id: string) => {
		const factIds = new Set(
			assessments
				.filter(
					(a) =>
						a.intentionId === id &&
						a.source === 'evidence' &&
						a.outcome === 'alternative' &&
						!a.isDeleted
				)
				.map((a) => a.factId)
		);
		return traces
			.filter(
				(fact) =>
					factIds.has(fact.id) &&
					links.some(
						(link) => link.kind === 'evidence_for' && link.fromId === fact.id && link.toId === id
					)
			)
			.toSorted(
				(a, b) => (traceMarkTime(b)?.start ?? -Infinity) - (traceMarkTime(a)?.start ?? -Infinity)
			)[0]
			?.content.split('\n')[0];
	};
</script>

{#each closed.groups as group (group.day)}
	<section>
		<h2>
			{group.day ? closedDayLabel(group.day, today, locale.current) : t('intentions.undated')}
		</h2>
		{#each group.items as item (item.id)}
			<div class="done-row">
				<Button
					variant="quiet"
					icon
					aria-label={t('intentions.reopen')}
					onclick={() => reopen(item.id)}
					><OutcomeIcon outcome={item.intentOutcome ?? null} /></Button
				>
				<button type="button" class="done-title" onclick={() => edit(item.id)}>
					<span class:completed={item.intentOutcome === 'completed'}
						>{item.content.split('\n')[0]}</span
					>
					{#if item.intentOutcome === 'alternative' && alternative(item.id)}<span
							class="alternative">→ {alternative(item.id)}</span
						>{/if}
				</button>
			</div>
		{/each}
	</section>
{:else}<p>{search.trim() ? t('intentions.searchEmpty') : t('intentions.doneEmpty')}</p>{/each}
{#if doneLimit < closed.total}<Button onclick={more}>{t('intentions.showMore')}</Button>{/if}

<style>
	.done-row {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}
	.done-title {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		text-align: left;
		overflow-wrap: anywhere;
		background: none;
		border: 0;
		padding: 8px 0;
		color: var(--cg-text-muted);
		cursor: pointer;
	}
	.completed {
		text-decoration: line-through;
	}
	.alternative {
		font-size: 0.875em;
	}
</style>
