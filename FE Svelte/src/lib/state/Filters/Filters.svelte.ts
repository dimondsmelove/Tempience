/* eslint-disable svelte/prefer-svelte-reactivity -- these sets are immutable values replaced whole (ReadonlySet); reactivity is the reassignment, nothing is changed in place */
import type { LegendKey } from '$lib/model/Legend/types';
import type { LegendViewRepository } from '$lib/state/triplit/LegendView/LegendView';
import type { LegendView } from '$lib/state/triplit/LegendView/types';

/**
 * Legend kinds (hidden with Shift+click, or one kept alone with «соло», research
 * п. 17), hidden Scopes and «Только эти Scope» count together and reset
 * with one button (DESIGN.md §7). The record search sits beside them: it dims
 * what it misses instead of hiding anything, so it is not counted as a filter,
 * but «Сбросить всё» clears it too. Only the legend is persisted.
 */
export class FiltersState {
	hiddenLegend = $state<ReadonlySet<LegendKey>>(new Set());
	/** «Соло»: the one legend kind left on the ribbon; wins over `hiddenLegend` while set. */
	soloLegend = $state<LegendKey | null>(null);
	hiddenScopes = $state<ReadonlySet<string>>(new Set());
	shownKindIds = $state<ReadonlySet<string>>(new Set());
	onlyScopes = $state<ReadonlySet<string> | null>(null);
	scopeQuery = $state('');
	/** «Поиск по записям…»: title and description of the records on the axis. */
	recordQuery = $state('');

	private disconnect: (() => void) | null = null;
	private writer: LegendViewRepository | null = null;
	private generation = 0;
	private pending = 0;
	private revision = 0;
	private writes: Promise<void> = Promise.resolve();

	/** Follow one data space until disconnected; reconnecting starts with the default view. */
	connect(writer: LegendViewRepository): () => void {
		this.disconnect?.();
		const generation = ++this.generation;
		this.writer = writer;
		this.pending = 0;
		this.writes = Promise.resolve();
		this.hiddenLegend = new Set();
		this.soloLegend = null;
		const stop = writer.subscribeLegendView(
			(view) => {
				if (generation !== this.generation || this.pending || this.matches(view)) return;
				this.revision++;
				this.hiddenLegend = new Set(view.hiddenLegend);
				this.soloLegend = view.soloLegend;
			},
			(error) => console.warn('[tempience:legend] the legend feed failed', error)
		);
		const disconnect = () => {
			if (generation !== this.generation) return;
			++this.generation;
			stop();
			this.writer = null;
			this.disconnect = null;
		};
		this.disconnect = disconnect;
		return disconnect;
	}

	private matches(view: LegendView): boolean {
		return (
			this.soloLegend === view.soloLegend &&
			this.hiddenLegend.size === new Set(view.hiddenLegend).size &&
			view.hiddenLegend.every((key) => this.hiddenLegend.has(key))
		);
	}

	private persist(): void {
		const writer = this.writer;
		if (!writer) return;
		const generation = this.generation;
		const revision = ++this.revision;
		const view = { hiddenLegend: [...this.hiddenLegend], soloLegend: this.soloLegend };
		this.pending++;
		this.writes = this.writes.then(async () => {
			let saved = false;
			try {
				await writer.setLegendView(view);
				saved = true;
			} catch (error) {
				console.warn('[tempience:legend] saving the legend failed', error);
			} finally {
				if (generation === this.generation) {
					this.pending--;
					if (saved && this.pending === 0) {
						void writer.getLegendView().then(
							(latest) => {
								if (
									generation !== this.generation ||
									revision !== this.revision ||
									this.pending ||
									this.matches(latest)
								)
									return;
								this.hiddenLegend = new Set(latest.hiddenLegend);
								this.soloLegend = latest.soloLegend;
							},
							(error) => console.warn('[tempience:legend] reading the legend failed', error)
						);
					}
				}
			}
		});
	}

	get activeCount(): number {
		return (
			this.hiddenLegend.size +
			(this.soloLegend ? 1 : 0) +
			this.hiddenScopes.size +
			this.shownKindIds.size +
			(this.onlyScopes ? 1 : 0) +
			(this.scopeQuery.trim() ? 1 : 0)
		);
	}

	/** Whether marks of this kind are on the ribbon: the solo kind alone while set, else all but the hidden. */
	isShown(key: LegendKey): boolean {
		return this.soloLegend ? this.soloLegend === key : !this.hiddenLegend.has(key);
	}

	/** Shift+click: hides or shows one kind; a solo in force ends, as the mock does. */
	toggleLegend(key: LegendKey): void {
		this.soloLegend = null;
		const next = new Set(this.hiddenLegend);
		if (!next.delete(key)) next.add(key);
		this.hiddenLegend = next;
		this.persist();
	}

	/** Click: only this kind stays; the same kind again brings everything back. The hidden set waits underneath. */
	soloLegendKind(key: LegendKey): void {
		this.soloLegend = this.soloLegend === key ? null : key;
		this.persist();
	}

	toggleKind(kindId: string): void {
		const next = new Set(this.shownKindIds);
		if (!next.delete(kindId)) next.add(kindId);
		this.shownKindIds = next;
	}

	hideScope(scopeId: string): void {
		if (!this.hiddenScopes.has(scopeId))
			this.hiddenScopes = new Set(this.hiddenScopes).add(scopeId);
	}

	showScope(scopeId: string): void {
		if (!this.hiddenScopes.has(scopeId)) return;
		const next = new Set(this.hiddenScopes);
		next.delete(scopeId);
		this.hiddenScopes = next;
	}

	setOnly(scopeIds: readonly string[] | null): void {
		this.onlyScopes = scopeIds && scopeIds.length > 0 ? new Set(scopeIds) : null;
	}

	showAllScopes(): void {
		this.hiddenScopes = new Set();
	}

	reset(): void {
		this.shownKindIds = new Set();
		this.scopeQuery = '';
		this.recordQuery = '';
		const legendChanged = this.hiddenLegend.size > 0 || this.soloLegend !== null;
		this.hiddenLegend = new Set();
		this.soloLegend = null;
		if (legendChanged) this.persist();
		this.hiddenScopes = new Set();
		this.onlyScopes = null;
	}
}
