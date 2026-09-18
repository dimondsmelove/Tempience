import type { Locale } from '$lib/state/Locale/types';
import { traceFormDisplay } from '$lib/model/TraceForm/display';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import type { KindCatalog } from '$lib/model/TraceForm/summary';

/** The catalog by id, indexed once per catalog object: a hundred thousand rows ask. */
const versionIndex = new WeakMap<KindCatalog, Map<string, KindCatalog['versions'][number]>>();
const kindIndex = new WeakMap<KindCatalog, Map<string, string>>();
const versionOf = (catalog: KindCatalog, id: string) => {
	let index = versionIndex.get(catalog);
	if (!index) {
		versionIndex.set(
			catalog,
			(index = new Map(catalog.versions.map((entry) => [entry.id, entry])))
		);
	}
	return index.get(id);
};
const kindNameOf = (catalog: KindCatalog, id: string) => {
	let index = kindIndex.get(catalog);
	if (!index) {
		kindIndex.set(catalog, (index = new Map(catalog.kinds.map((kind) => [kind.id, kind.name]))));
	}
	return index.get(id);
};

/**
 * A typed record with its display fields read through its own Kind version. A schema without
 * its own title is named by its Kind, never by a generic word. A reading that fails must not
 * hide the record or the rest of the feed: the record is shown as stored, without them.
 */
export const displayedTrace = (
	trace: ExplorerTrace,
	catalog: KindCatalog,
	language: Locale = 'ru'
): ExplorerTrace => {
	const version = trace.kindVId ? versionOf(catalog, trace.kindVId) : undefined;
	if (!version || !trace.data) return trace;
	const kindName = trace.kindId ? kindNameOf(catalog, trace.kindId) : undefined;
	try {
		return {
			...trace,
			...traceFormDisplay(version, trace.data, kindName, language),
			kindGeneration: version.generation
		};
	} catch {
		console.warn('Cannot format typed trace', trace.id, version.id);
		return trace;
	}
};
