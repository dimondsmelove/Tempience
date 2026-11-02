<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { PracticeState } from '$lib/state/Practice/Practice.svelte';
	import { practiceFields, samePath } from '$lib/state/triplit/PracticeSettings/source';
	import { dateLabel, minutesLabel } from '../../model/Practice/format';
	import type { PracticeChartActivity, PracticeEntry } from '../../model/Practice/types';
	import type { Trace } from '$lib/state/triplit/types';

	let {
		practice,
		records,
		activities,
		onedit,
		onremove
	}: {
		practice: PracticeState;
		records: readonly PracticeEntry[];
		activities: readonly PracticeChartActivity[];
		onedit: (id: string) => void;
		onremove: (id: string) => void;
	} = $props();
	const version = $derived(
		practice.versions.find((row) => row.id === practice.kind?.currentKindVId)
	);
	const fieldLabel = $derived(
		version && practice.source
			? practiceFields(version).find((field) => samePath(field.path, practice.source!.path))?.label
			: undefined
	);
	const issueTrace = (id: string): Trace | undefined =>
		practice.traces.find((trace) => trace.id === id);
	const issueDate = (trace: Trace | undefined): string => {
		const time = trace?.aboutTime;
		return time?.basis === 'absolute'
			? time.start.slice(0, 10)
			: (trace?.capturedAt ?? '').slice(0, 10);
	};
	const issueValue = (trace: Trace | undefined): string => {
		let value: unknown = trace?.data;
		for (const key of practice.source?.path ?? []) {
			value =
				value && typeof value === 'object' && !Array.isArray(value)
					? (value as Record<string, unknown>)[key]
					: undefined;
		}
		return value === undefined || value === null ? '—' : String(value);
	};
	const issueScopes = (traceId: string): string[] =>
		practice.links
			.filter((link) => !link.isDeleted && link.kind === 'belongs_to' && link.fromId === traceId)
			.map((link) => practice.scopes.find((scope) => scope.id === link.toId)?.name ?? link.toId);
</script>

<details class="practice-records" data-testid="practice-records" open>
	<summary
		><span>{t('practice.records')}</span><span class="practice-record-count">{records.length}</span
		></summary
	>
	<p class="practice-record-source">{practice.kind?.name} · {fieldLabel}</p>
	{#if records.length}<div class="practice-record-list">
			{#each records as entry (entry.id)}<div class="practice-record practice-record-live">
					<time datetime={entry.date}>{dateLabel(entry.date, locale.current)}</time>
					<div>
						<strong>{activities.find((item) => entry.scopeIds.includes(item.id))?.name}</strong>
						<p>{entry.note}</p>
					</div>
					<span>{minutesLabel(entry.data.minutes, locale.current)}</span>
					<span class="practice-record-actions"
						><button type="button" class="cg-control" onclick={() => onedit(entry.id)}
							>{t('practice.edit')}</button
						><button type="button" class="cg-control" onclick={() => onremove(entry.id)}
							>{t('practice.delete')}</button
						></span
					>
				</div>{/each}
		</div>{:else}<p class="practice-empty">{t('practice.empty')}</p>{/if}
</details>
{#if practice.projection.issues.length}<details
		class="practice-records"
		data-testid="practice-excluded-records"
	>
		<summary>{t('practice.excluded', { count: practice.projection.issues.length })}</summary
		>{#each practice.projection.issues as issue (issue.id)}
			{@const trace = issueTrace(issue.id)}
			<div class="practice-record practice-record-issue" data-testid="practice-excluded-record">
				<div class="practice-record-issue-details">
					<time>{dateLabel(issueDate(trace), locale.current)}</time>
					<strong
						>{trace?.description ||
							trace?.content ||
							practice.kind?.name ||
							t('practice.issue.record')}</strong
					>
					<p>
						{t('practice.issue.fieldValue', { field: fieldLabel ?? '', value: issueValue(trace) })}
					</p>
					{#if issueScopes(issue.id).length}<p>{issueScopes(issue.id).join(', ')}</p>{/if}
				</div>
				<span
					>{t(
						issue.reason === 'value'
							? 'practice.issue.value'
							: issue.reason === 'time'
								? 'practice.issue.time'
								: issue.reason === 'scope'
									? 'practice.issue.scope'
									: 'practice.issue.version'
					)}</span
				>
				<button type="button" class="cg-control" onclick={() => onedit(issue.id)}
					>{t('practice.edit')}</button
				>
			</div>
		{/each}
	</details>{/if}
