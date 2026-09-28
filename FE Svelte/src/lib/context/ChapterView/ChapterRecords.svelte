<script lang="ts">
	import RecordList from '$lib/context/RecordList/RecordList.svelte';
	import { ordered, withDescendants } from '$lib/model/Chapters';
	import type { ChapterRecord, Lineup } from '$lib/model/Chapters/types';
	import { scopeMembership } from '$lib/model/Projection/tree';
	import { recordShape } from '$lib/model/RecordGroups/RecordGroups';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import { chapterColour } from '$lib/theme/chapter-colour';
	import { recordItems } from './items';

	type Props = Readonly<{
		workbench: WorkbenchState;
		/** The lineup whose Scopes' records these are: their colours mark the rows. */
		lineup: Lineup;
		/** The lineup's records inside the stage in force or the whole chapter, oldest first. */
		records: readonly ChapterRecord[];
	}>;
	let { workbench, lineup, records }: Props = $props();

	const view = $derived(workbench.view);
	/**
	 * The colour each Scope under the lineup marks its records with: its own, else the lineup
	 * Scope's it sits under, focus first — so a nested Scope without a colour of its own still
	 * reads as its lineup Scope, as its row on the rail does.
	 */
	const colours = $derived.by(() => {
		const byId = new Map(view.scopes.map((scope) => [scope.id, scope]));
		const entries = ordered(lineup).flatMap((entry) => {
			const own = chapterColour(byId.get(entry.scopeId), '');
			return [...withDescendants([entry.scopeId], view)].map(
				(id) => [id, chapterColour(byId.get(id), '') || own] as const
			);
		});
		// The first lineup Scope a Scope sits under wins, and the map keeps the lineup's order.
		const kept = entries.filter(
			([id, colour], index) => colour && entries.findIndex(([other]) => other === id) === index
		);
		return new Map(kept);
	});
	const times = $derived(workbench.projection.timeByTraceId);
	/** Every Scope a record is in, not only its lineup ones: a record in two weaves both. */
	const memberships = $derived(
		scopeMembership(view.traces, view.scopes, view.intersections).scopesByTrace
	);
	/**
	 * A record's colours: its lineup Scopes' first, in the lineup's order, then its other
	 * Scopes' own colours in rail order — the ribbon paints the same record in each of its rows.
	 */
	const coloursOf = (traceId: string): string[] => {
		const mine = memberships.get(traceId) ?? new Set<string>();
		const front = [...colours].filter(([id]) => mine.has(id)).map(([, colour]) => colour);
		const rest = view.scopes
			.filter((scope) => mine.has(scope.id) && !colours.has(scope.id))
			.map((scope) => chapterColour(scope, ''))
			.filter(Boolean);
		return [...front, ...rest];
	};
	const items = $derived(
		recordItems(records, workbench.chapters.timeZone, locale.current, workbench.chapters.now).map(
			(item, index) => ({
				...item,
				mark: {
					shape: recordShape(
						times.get(item.traceId) ?? { kind: 'moment', intent: records[index].intent }
					),
					colours: coloursOf(item.traceId)
				}
			})
		)
	);
</script>

<RecordList
	{items}
	group="week"
	testId="chapter-record"
	empty={t('chapter.noRecords')}
	onselect={(traceId) => workbench.selectTrace(traceId, 'context')}
/>
