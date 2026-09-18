import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

export const load = ({ url }: { url: URL }) => redirect(307, `${base}/${url.search}`);
