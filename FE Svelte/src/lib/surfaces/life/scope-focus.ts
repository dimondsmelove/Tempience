export type LifeScopeFocus = {
	id: string;
};

export const parseLifeScopeFocus = (params: URLSearchParams): LifeScopeFocus | null => {
	const id = params.get('scope_id') ?? params.get('scope_uid');
	return id ? { id } : null;
};

export const scopeFocusKey = (focus: LifeScopeFocus): string => focus.id;

export const parseScopeFocusKey = (value: string): LifeScopeFocus | null =>
	value ? { id: value } : null;
