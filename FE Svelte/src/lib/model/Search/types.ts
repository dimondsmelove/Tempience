/** What the record search reads: the title as shown, the plain title and the description. */
export type Searchable = Readonly<{
	id: string;
	content: string;
	description?: string | null;
	displayTitle?: string;
}>;
