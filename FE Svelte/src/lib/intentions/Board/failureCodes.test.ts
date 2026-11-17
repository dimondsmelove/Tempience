import { describe, expect, it } from 'vitest';
import ru from '$lib/state/Locale/messages/ru/timeline.json';
import en from '$lib/state/Locale/messages/en/timeline.json';
import { intentionFailureCodes } from './failureCodes';

describe('intention failure messages', () => {
	it.each(intentionFailureCodes)('translates %s in both locales', (code) => {
		for (const catalog of [ru, en])
			expect(catalog[`intentions.${code}` as keyof typeof catalog]).toBeTruthy();
	});
});
