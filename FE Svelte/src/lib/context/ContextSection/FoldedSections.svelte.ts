import { readFolded, writeFolded } from '$lib/context/Context/sections';

/**
 * The folded sections of one kind of Context, remembered across entities and reloads under a
 * key of its own (C9a-1): anything missing, malformed or unreachable reads as open.
 */
export class FoldedSections<Id extends string> {
	collapsed: Record<Id, boolean>;
	readonly #key: string;
	readonly #storage: Storage | undefined;

	constructor(ids: readonly Id[], key: string, storage?: Storage) {
		this.#key = key;
		this.#storage = storage;
		this.collapsed = $state(readFolded(ids, key, storage));
	}

	toggle(id: Id): void {
		this.collapsed[id] = !this.collapsed[id];
		writeFolded(this.#key, { ...this.collapsed } as Record<string, boolean>, this.#storage);
	}

	/** A section that must show — a note being written — opens, whatever was remembered. */
	open(id: Id): void {
		if (this.collapsed[id]) this.toggle(id);
	}
}
