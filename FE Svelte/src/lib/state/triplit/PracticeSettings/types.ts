export type PracticeSource = Readonly<{
	id: 'source';
	kindId: string;
	path: readonly string[];
	scopeIds: readonly string[];
}>;
