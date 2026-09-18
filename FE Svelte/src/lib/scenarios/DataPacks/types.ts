import type { BuiltInDataSpaceId } from '$lib/state/triplit/data-space';

export type DataPack = Readonly<{
	id: string;
	dataSpaceId: Exclude<BuiltInDataSpaceId, 'canonical'>;
	manifestId: string;
	markerKey: string;
	public: boolean;
	source: string;
}>;
