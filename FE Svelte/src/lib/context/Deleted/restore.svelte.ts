import { contextWork } from '$lib/context/pending';
import { readContext } from '$lib/context/reload';
import { writeThenRead } from '$lib/context/write';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import type { RecordsReader } from '$lib/state/Records/Records.svelte';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';

export type RestoreOwners = Readonly<{
	repository: Pick<TempienceRepository, 'setTraceDeleted'>;
	workbench: WorkbenchState;
	records: RecordsReader;
	loader: () => Promise<ExplorerSnapshot>;
}>;

/**
 * Bringing a record back is an ordinary later action with its own cause, not the inverse of
 * the deletion: the rules of its role and of its own integrity are checked again now. This is
 * its boundary, and it lives above the panels: the write is issued once, and once it is
 * accepted the record is back whatever the reading after it does — only that reading is ever
 * offered again. The panel that offered the restore gives way to the ordinary one as soon as
 * the record is known to be back, so what is left to say survives here.
 */
export class RestoreState {
	busy = $state(false);
	/** The repository accepted the restore: the record is back, and nothing writes it again. */
	committed = $state(false);
	/** What the restore was refused with, or null; the record is still deleted. */
	refusal = $state.raw<unknown>(null);
	/** What the reading after the accepted restore failed with, or null; reading again is offered. */
	readFailure = $state.raw<unknown>(null);
	readonly traceId: string;
	/** The deletion this is the way back from: the record's lifecycle revision, when known. */
	readonly deletion: string | null;
	private readonly owners: RestoreOwners;

	constructor(traceId: string, deletion: string | null, owners: RestoreOwners) {
		this.traceId = traceId;
		this.deletion = deletion;
		this.owners = owners;
	}

	/** The timeline and the record's own rows, through the owners that keep a refused read. */
	private readonly read = async (): Promise<void> => {
		await readContext(this.owners.workbench, this.owners.records, this.owners.loader);
		this.owners.workbench.selectTrace(this.traceId, 'context');
	};

	async run(): Promise<void> {
		if (this.busy || this.committed) return;
		this.busy = true;
		this.refusal = null;
		const outcome = await writeThenRead(
			() => this.owners.repository.setTraceDeleted(this.traceId, false, 'user').then(() => {}),
			this.read,
			() => {
				this.committed = true;
			}
		);
		this.refusal = outcome.refusal;
		this.readFailure = outcome.readFailure;
		this.busy = false;
	}

	/** Reads again what could not be shown; the restore itself is never issued a second time. */
	async retry(): Promise<void> {
		if (this.busy || !this.committed) return;
		this.busy = true;
		try {
			await contextWork.hold(this.read());
			this.readFailure = null;
		} catch (cause) {
			this.readFailure = cause ?? new Error();
		} finally {
			this.busy = false;
		}
	}
}

/**
 * The way back of the selected record, one per deletion. It is kept across the record's
 * return — a committed restore whose reading failed keeps saying so, and never writes again —
 * and replaced when a different deletion of the same record is shown: a record deleted again,
 * on another device or here, is a new episode with a way back of its own. The earlier restore
 * keeps its own state and gives way; nothing of it is reset.
 */
export class RestoreEpisodes {
	private current: RestoreState | null = null;
	/** The owners as they are when a way back is made; a prop is read then, not captured once. */
	private readonly owners: () => RestoreOwners;

	constructor(owners: () => RestoreOwners) {
		this.owners = owners;
	}

	/** The restore for what is shown: `deletion` is the record's lifecycle revision while deleted. */
	for(traceId: string | null, deletion: string | null): RestoreState | null {
		if (!traceId) return (this.current = null);
		const kept = this.current;
		if (kept && kept.traceId === traceId && (deletion === null || kept.deletion === deletion)) {
			return kept;
		}
		return (this.current = new RestoreState(traceId, deletion, this.owners()));
	}
}
