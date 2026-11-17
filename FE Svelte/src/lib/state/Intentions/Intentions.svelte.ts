import { Temporal } from 'temporal-polyfill';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import { buildRepositoryExplorerSnapshot } from '$lib/state/Workbench/snapshot';
import { applyOrder, orderKey } from '$lib/intentions/Order/Order';
import type { IntentionOrdersRepository } from '$lib/state/triplit/IntentionOrders/IntentionOrders';
import { weekBuckets } from '$lib/intentions/WeekModel/WeekModel';
import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';

export class IntentionsState {
	snapshot = $state.raw<ExplorerSnapshot | null>(null);
	assessments = $state.raw<readonly IntentionAssessment[]>([]);
	orders = $state.raw<Record<string, string[]>>({});
	failure = $state.raw<unknown>(null);
	loading = $state(true);
	readonly timezone: string;
	now: number;
	anchor = $state(0);
	private generation = 0;
	private revision = 0;
	private stops: (() => void)[] = [];
	private orderRepository?: IntentionOrdersRepository;
	private suspended = 0;
	constructor(
		private repository: TempienceRepository,
		options: { now?: number; zone?: string; orders?: IntentionOrdersRepository } = {}
	) {
		this.orderRepository = options.orders;
		this.timezone = options.zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
		this.now = options.now ?? Date.now();
		this.anchor = this.now;
	}
	get today() {
		return Temporal.Instant.fromEpochMilliseconds(this.now)
			.toZonedDateTimeISO(this.timezone)
			.toPlainDate()
			.toString();
	}
	get buckets() {
		const buckets = weekBuckets(this.snapshot?.traces ?? [], this.anchor, this.now, this.timezone);
		const ordered = <T extends { id: string }>(items: T[], key: string) =>
			applyOrder(items, this.orders[key] ?? []);
		return {
			...buckets,
			days: buckets.days.map((day) => ({ ...day, items: ordered(day.items, `day:${day.dayKey}`) })),
			week: ordered(
				buckets.week,
				orderKey({ kind: 'week', weekStart: buckets.weekStart }, this.timezone)
			),
			later: ordered(buckets.later, 'later'),
			undated: ordered(buckets.undated, 'undated')
		};
	}
	async batch(action: () => Promise<void>): Promise<void> {
		this.suspended++;
		this.revision++;
		try {
			await action();
		} finally {
			this.suspended--;
			await this.refresh();
		}
	}
	async refresh(): Promise<void> {
		if (this.suspended) return;
		const generation = this.generation,
			revision = ++this.revision;
		try {
			const [snapshot, orders, assessments] = await Promise.all([
				buildRepositoryExplorerSnapshot(this.repository, 'intentions'),
				this.orderRepository?.list() ?? Promise.resolve([]),
				this.repository.listIntentionAssessments()
			]);
			if (generation === this.generation && revision === this.revision) {
				this.snapshot = snapshot;
				this.assessments = assessments;
				this.orders = Object.fromEntries(orders.map((order) => [order.id, order.ids]));
				this.failure = null;
				this.loading = false;
			}
		} catch (error) {
			if (generation === this.generation && revision === this.revision) {
				this.failure = error;
				this.loading = false;
			}
		}
	}
	start(): () => void {
		this.stop();
		const generation = this.generation;
		const changed = () => {
			if (generation === this.generation) void this.refresh();
		};
		const failed = (error: unknown) => {
			if (generation === this.generation) {
				this.failure = error;
				this.loading = false;
			}
		};
		this.stops = [
			this.repository.subscribeTraces(changed, failed),
			this.repository.subscribeScopes(changed, failed),
			this.repository.subscribeIntersections(changed, failed),
			this.repository.subscribeIntentionAssessments(changed, failed),
			...(this.orderRepository ? [this.orderRepository.subscribe(changed, failed)] : [])
		];
		void this.refresh();
		return () => this.stop();
	}
	stop(): void {
		this.generation++;
		this.stops.forEach((stop) => stop());
		this.stops = [];
	}
	shift(days: number): void {
		this.anchor = Temporal.Instant.fromEpochMilliseconds(this.anchor)
			.toZonedDateTimeISO(this.timezone)
			.add({ days }).epochMilliseconds;
	}
}
