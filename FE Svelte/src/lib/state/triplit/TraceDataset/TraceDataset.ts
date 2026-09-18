import type { TempienceTriplitClient } from '../client';
import { fetchReplica } from '../replica-fetch';
import { normalizeKindVersions, traceDatasetCompatibilityIssues } from './compatibility';
import { errorMessage, noop } from './helpers';
import { indexRows } from './kind-index';
import { projectRows } from './projection';
import { buildKindIndexQuery, buildTraceQuery } from './query';
import { validateIndexRequest, validateRequest } from './request';
import { subscribeKindRows } from './subscription';
import type { TraceDatasetReader } from './types';

export const createTraceDatasetReader = (client: TempienceTriplitClient): TraceDatasetReader => ({
	subscribeTraceDataset: (request, callback) => {
		try {
			validateRequest(request);
		} catch (cause: unknown) {
			callback({
				kindId: request.kindId,
				resolvedScopeIds: request.scope ? [] : null,
				status: 'error',
				message: errorMessage(cause)
			});
			return noop;
		}
		// A page of no ids is an empty page: nothing is read for it.
		if (request.ids && request.ids.length === 0) {
			callback({ kindId: request.kindId, resolvedScopeIds: null, status: 'ready', rows: [] });
			return noop;
		}
		return subscribeKindRows(
			client,
			{
				kindId: request.kindId,
				scope: request.scope,
				kindVId: request.kindVId,
				compatibility: request,
				query: (resolvedScopeIds) => buildTraceQuery(client, request, resolvedScopeIds),
				project: (values, knownKindVIds) => projectRows(values, request, knownKindVIds)
			},
			callback
		);
	},
	readTraceDataset: async (request) => {
		const base = { kindId: request.kindId, resolvedScopeIds: null };
		try {
			validateRequest(request);
			if (request.scope) throw new Error('A read of a Trace dataset does not resolve a Scope');
		} catch (cause: unknown) {
			return { ...base, status: 'error', message: errorMessage(cause) };
		}
		if (request.ids && request.ids.length === 0) return { ...base, status: 'ready', rows: [] };
		try {
			const versions = normalizeKindVersions(
				await fetchReplica(
					client,
					client
						.query('traceKindVersions')
						.Where('kindId', '=', request.kindId)
						.Select(['id', 'generation', 'dataSchema'])
				)
			).filter((kindV) => request.kindVId === undefined || kindV.id === request.kindVId);
			if (versions.length === 0) {
				return {
					...base,
					status: 'error',
					message:
						request.kindVId === undefined
							? `TraceKind ${request.kindId} has no versions`
							: `TraceKindV ${request.kindVId} is not a version of TraceKind ${request.kindId}`
				};
			}
			const issues = traceDatasetCompatibilityIssues(versions, request);
			if (issues.length > 0) return { ...base, status: 'incompatible', issues };
			const values = await fetchReplica(client, buildTraceQuery(client, request, null, 'read'));
			return {
				...base,
				status: 'ready',
				rows: projectRows(values, request, new Set(versions.map((kindV) => kindV.id)))
			};
		} catch (cause: unknown) {
			return { ...base, status: 'error', message: errorMessage(cause) };
		}
	},
	subscribeKindIndex: (request, callback) => {
		try {
			validateIndexRequest(request);
		} catch (cause: unknown) {
			callback({
				kindId: request.kindId,
				resolvedScopeIds: request.scope ? [] : null,
				status: 'error',
				message: errorMessage(cause)
			});
			return noop;
		}
		return subscribeKindRows(
			client,
			{
				kindId: request.kindId,
				scope: request.scope,
				compatibility: { kindId: request.kindId, columns: [], filters: request.filters },
				query: (resolvedScopeIds) => buildKindIndexQuery(client, request, resolvedScopeIds),
				project: indexRows
			},
			callback
		);
	}
});
