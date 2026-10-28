import { SvelteSet } from 'svelte/reactivity';
import { Temporal } from 'temporal-polyfill';
import { CodedError } from '$lib/model/Errors/CodedError';
import { addDays } from '$lib/practice/PracticeDemo/model';
import { practiceFields, samePath } from '$lib/state/triplit/PracticeSettings/source';
import type { PracticeSettingsRepository } from '$lib/state/triplit/PracticeSettings/PracticeSettings';
import type { PracticeSource } from '$lib/state/triplit/PracticeSettings/types';
import type { PracticeTargetsRepository } from '$lib/state/triplit/PracticeTargets/PracticeTargets';
import { weeklyTargetFor } from '$lib/state/triplit/PracticeTargets/targets';
import type { PracticeTarget } from '$lib/state/triplit/PracticeTargets/types';
import type { Intersection, Scope, Trace, TraceKind, TraceKindV } from '$lib/state/triplit/types';
import type { PracticeActivity } from '$lib/practice/PracticeDemo/types';
import type { PracticeDashboardData, PracticeRepository } from './types';
import { projectPractice } from './projection';

export class PracticeState {
	kinds = $state.raw<readonly TraceKind[]>([]);
	versions = $state.raw<readonly TraceKindV[]>([]);
	scopes = $state.raw<readonly Scope[]>([]);
	links = $state.raw<readonly Intersection[]>([]);
	traces = $state.raw<readonly Trace[]>([]);
	source = $state.raw<PracticeSource | null>(null);
	targets = $state.raw<readonly PracticeTarget[]>([]);
	failure = $state.raw<unknown>(null);
	loading = $state(true);
	readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	readonly today = Temporal.Now.plainDateISO(this.timezone).toString();
	private stops: (() => void)[] = [];
	private recordsStop = () => {};
	private headsStop = () => {};
	private headsGeneration = 0;
	private generation = 0;
	private recordsGeneration = 0;
	private recordsKey = '';
	private idsKey = '';
	private fed = new SvelteSet<string>();
	constructor(
		private repository: PracticeRepository,
		private settings: PracticeSettingsRepository,
		private budgets?: Pick<PracticeTargetsRepository, 'subscribePracticeTargets'>
	) {}
	/** The weekly budget of an activity in the week holding `date`; null is «no goal». */
	targetFor(scopeId: string, date: string): number | null {
		return weeklyTargetFor(this.targets, scopeId, date);
	}
	get kind() {
		return this.kinds.find((kind) => kind.id === this.source?.kindId && !kind.isDeleted);
	}
	get validSource() {
		const source = this.source,
			kind = this.kind;
		const version = this.versions.find((value) => value.id === kind?.currentKindVId);
		return (
			!!source &&
			!!kind &&
			!!version &&
			practiceFields(version).some((leaf) => samePath(leaf.path, source.path))
		);
	}
	get projection() {
		return this.source && this.validSource
			? projectPractice(
					this.source,
					this.traces,
					this.versions,
					this.links,
					this.scopes.map((scope) => scope.id),
					this.timezone
				)
			: { entries: [], issues: [] };
	}
	get data(): PracticeDashboardData {
		const entries = this.projection.entries;
		const activities: PracticeActivity[] = this.source
			? this.source.scopeIds.flatMap((id) => {
					const scope = this.scopes.find((scope) => scope.id === id);
					return scope
						? [
								{
									id: scope.id,
									name: scope.name,
									note: '',
									weeklyMinutes: this.targetFor(scope.id, this.today),
									colour:
										scope.colorHue === null
											? null
											: {
													hue: scope.colorHue,
													chroma: scope.colorChroma,
													depth: scope.colorDepth ?? undefined
												}
								}
							]
						: [];
				})
			: [];
		return {
			entries,
			activities,
			today: this.today,
			start: entries.reduce(
				(earliest, entry) => (entry.date < earliest ? entry.date : earliest),
				addDays(this.today, -56)
			),
			kindId: this.source?.kindId ?? '',
			sourceName: this.kind?.name ?? ''
		};
	}
	start(): () => void {
		this.stop();
		const generation = ++this.generation;
		const mine = () => generation === this.generation;
		const fail = (cause: unknown) => {
			if (mine()) {
				this.failure = cause;
				this.loading = false;
			}
		};
		const received = (key: string) => {
			this.fed.add(key);
			this.loading = !['kinds', 'versions', 'scopes', 'links', 'source', 'records'].every((key) =>
				this.fed.has(key)
			);
		};
		this.failure = null;
		this.loading = true;
		this.fed.clear();
		this.stops = [
			this.repository.subscribeTraceKinds((rows) => {
				if (mine()) {
					this.kinds = rows;
					received('kinds');
					this.follow(received, fail, mine);
				}
			}, fail),
			this.repository.subscribeTraceKindVersions((rows) => {
				if (mine()) {
					this.versions = rows;
					received('versions');
					this.follow(received, fail, mine);
				}
			}, fail),
			this.repository.subscribeScopes((rows) => {
				if (mine()) {
					this.scopes = rows;
					received('scopes');
				}
			}, fail),
			this.repository.subscribeIntersections((rows) => {
				if (mine()) {
					this.links = rows;
					received('links');
				}
			}, fail),
			this.settings.subscribePracticeSource((source) => {
				if (mine()) {
					this.source = source;
					received('source');
					this.follow(received, fail, mine);
				}
			}, fail),
			this.budgets?.subscribePracticeTargets((rows) => {
				if (mine()) this.targets = rows;
			}, fail) ?? (() => {})
		];
		return () => {
			if (mine()) this.stop();
		};
	}
	private follow(
		received: (key: string) => void,
		fail: (cause: unknown) => void,
		alive: () => boolean
	): void {
		const source = this.source;
		const versions = this.versions.filter((version) => version.kindId === source?.kindId);
		const key = JSON.stringify([
			source?.kindId,
			source?.path,
			versions.map((version) => version.id),
			this.validSource
		]);
		if (key === this.recordsKey) return;
		this.recordsKey = key;
		const generation = ++this.recordsGeneration;
		this.fed.delete('records');
		this.loading = true;
		this.recordsStop();
		this.headsStop();
		this.headsGeneration++;
		this.idsKey = '';
		this.traces = [];
		if (!source || !this.validSource) {
			received('records');
			return;
		}
		const mine = () => alive() && generation === this.recordsGeneration;
		const failCurrent = (cause: unknown) => {
			if (mine()) fail(cause);
		};
		const summaries = versions.map((version) => ({
			kindVId: version.id,
			paths: practiceFields(version).some((leaf) => samePath(leaf.path, source.path))
				? [source.path]
				: []
		}));
		this.recordsStop = this.repository.subscribeKindIndex({ kindId: source.kindId }, (snapshot) => {
			if (!mine() || snapshot.status === 'loading') return;
			if (snapshot.status !== 'ready') {
				failCurrent(
					snapshot.status === 'error'
						? new Error(snapshot.message)
						: new CodedError('practice_source_field', 'The source is incompatible')
				);
				return;
			}
			const ids = snapshot.rows.map((row) => row.id).sort(),
				key = JSON.stringify(ids);
			if (key === this.idsKey) return;
			this.idsKey = key;
			this.headsStop();
			this.traces = [];
			this.fed.delete('records');
			this.loading = true;
			const headGeneration = ++this.headsGeneration;
			const headsAlive = () =>
				mine() && this.idsKey === key && this.headsGeneration === headGeneration;
			if (!ids.length) {
				received('records');
				return;
			}
			const failForIds = (cause: unknown) => {
				if (headsAlive()) fail(cause);
			};
			this.headsStop = this.repository.subscribeTraceHeads(
				{ ids, deleted: 'active', summaries },
				(rows) => {
					if (headsAlive()) {
						this.traces = rows;
						received('records');
					}
				},
				failForIds
			);
		});
	}
	stop(): void {
		this.generation++;
		this.recordsGeneration++;
		this.headsGeneration++;
		this.stops.splice(0).forEach((stop) => stop());
		this.recordsStop();
		this.headsStop();
		this.recordsKey = '';
		this.idsKey = '';
	}
}
