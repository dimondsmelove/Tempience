import { describe, expect, it } from 'vitest';
import { publicScreen, type PublicScreenInput } from './screen';

const screen = (over: Partial<PublicScreenInput> = {}) =>
	publicScreen({ ready: true, empty: true, completed: true, skipped: false, ...over });

describe('which screen the public app shows', () => {
	it('reads the records before deciding anything', () => {
		expect(screen({ ready: false })).toBe('reading');
		expect(screen({ ready: false, empty: false })).toBe('reading');
	});

	it('gives an empty own space the tour once, then the first Scope', () => {
		expect(screen({ completed: false })).toBe('tour');
		expect(screen()).toBe('firstScope');
	});

	it('opens the workbench as soon as there is anything to show', () => {
		expect(screen({ empty: false, completed: false })).toBe('workbench');
		expect(screen({ empty: false })).toBe('workbench');
	});

	it('«Начать без Scope» opens the workbench at once, and only for this session', () => {
		// The press is visible: the workbench appears (the host opens the capture form with it).
		expect(screen({ skipped: true })).toBe('workbench');
		// A reload starts over: the space is still empty, so the first Scope is offered again.
		expect(screen({ skipped: false })).toBe('firstScope');
		// A skip never hides the tour from someone who has not seen it.
		expect(screen({ skipped: true, completed: false })).toBe('tour');
	});
});
