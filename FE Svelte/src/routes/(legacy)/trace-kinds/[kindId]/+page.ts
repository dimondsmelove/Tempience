import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

/**
 * The retired capture screen's address: the Kind's page, whose «Записать» opens the one
 * shared form in the workbench — no second way of saving a record exists.
 */
export const load = ({ params, url }: { params: { kindId: string }; url: URL }) =>
	redirect(307, `${base}/forms/${encodeURIComponent(params.kindId)}${url.search}`);
