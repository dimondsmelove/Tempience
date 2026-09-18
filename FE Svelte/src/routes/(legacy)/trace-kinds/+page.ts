import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

/** The retired builder's address: the catalog of Kinds is where every Kind is made now. */
export const load = ({ url }: { url: URL }) => redirect(307, `${base}/forms${url.search}`);
