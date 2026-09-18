import type { TOptions } from 'i18next';
import { CodedError } from '$lib/model/Errors/CodedError';
import { hasMessage, t } from './Locale.svelte';

/**
 * What the user reads for a failure, in the current language: the interface's copy for a
 * coded refusal, with the refusal's details as parameters and its `reason` choosing the
 * variant; or, for anything else, that something unexpected happened and what it said. A
 * message the repository wrote for a log is never the copy shown.
 */
export const errorText = (cause: unknown): string => {
	if (cause instanceof CodedError) {
		const key = `error.${cause.code}`;
		if (hasMessage(key)) {
			const reason = cause.details.reason;
			return t(key, {
				...cause.details,
				...(typeof reason === 'string' ? { context: reason } : {})
			} as TOptions);
		}
	}
	const message = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
	return message ? t('error.unexpected', { message }) : t('error.unknown');
};
