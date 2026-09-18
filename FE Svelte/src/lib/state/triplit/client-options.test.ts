import { describe, expect, it } from 'vitest';
import { buildTriplitClientOptions } from './client-options';
import {
	BELGRADE_SCENARIO_DATA_SPACE_ID,
	CANONICAL_DATA_SPACE_ID,
	DATA_SPACES
} from './data-space';

describe('Triplit DataSpace client options', () => {
	it.each([{}, { serverUrl: 'https://sync.example.test' }, { token: 'device-token' }])(
		'does not connect personal data without both sync credentials: %j',
		(connection) => {
			expect(
				buildTriplitClientOptions(DATA_SPACES[CANONICAL_DATA_SPACE_ID], connection).autoConnect
			).toBe(false);
		}
	);

	it('preserves sync credentials only for canonical data', () => {
		const options = buildTriplitClientOptions(DATA_SPACES[CANONICAL_DATA_SPACE_ID], {
			serverUrl: 'https://sync.example.test',
			token: 'device-token'
		});

		expect(options).toMatchObject({
			autoConnect: true,
			serverUrl: 'https://sync.example.test',
			token: 'device-token',
			storage: { type: 'indexeddb', name: 'tempience-triplit' }
		});
	});

	it('strips every remote connection option from a scenario client', () => {
		const options = buildTriplitClientOptions(DATA_SPACES[BELGRADE_SCENARIO_DATA_SPACE_ID], {
			serverUrl: 'https://sync.example.test',
			token: 'device-token'
		});

		expect(options).toMatchObject({
			autoConnect: false,
			storage: { type: 'indexeddb', name: 'tempience-triplit-belgrade-what-if-v1' }
		});
		expect(options).not.toHaveProperty('serverUrl');
		expect(options).not.toHaveProperty('token');
	});
});
