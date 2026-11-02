export type PracticeSource = Readonly<{
	id: 'source';
	kindId: string;
	path: readonly string[];
	/** Legacy metadata from the former global activity filter; weekly plans ignore it. */
	scopeIds: readonly string[];
}>;
