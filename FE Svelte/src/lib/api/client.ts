type ApiInit = RequestInit & {
	json?: unknown;
};

const trimSlash = (value: string): string => value.replace(/\/$/, '');

export const apiUrl = (path: string): string => {
	const base = trimSlash(import.meta.env.PUBLIC_API_URL ?? '');
	const normalized = path.startsWith('/') ? path : `/${path}`;
	return `${base}${normalized}`;
};

export const apiFetch = async <T>(path: string, init: ApiInit = {}): Promise<T> => {
	const headers = new Headers(init.headers);

	if (init.json !== undefined) {
		headers.set('content-type', 'application/json');
	}

	const response = await fetch(apiUrl(path), {
		...init,
		headers,
		body: init.json !== undefined ? JSON.stringify(init.json) : init.body
	});

	if (!response.ok) {
		let message = `API ${response.status}`;
		if (response.status === 404 && !import.meta.env.PUBLIC_API_URL) {
			message = 'API 404: start API (cd API && npm run dev) or set PUBLIC_API_URL';
		}
		try {
			const body = (await response.json()) as { error?: string };
			if (body.error) message = body.error;
		} catch {
			// ignore
		}
		throw new Error(message);
	}

	if (response.status === 204) return undefined as T;
	return (await response.json()) as T;
};
