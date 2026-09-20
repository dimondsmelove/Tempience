import { describe, expect, it } from 'vitest';
import { hoverKey } from '$lib/model/Hover/Hover';
import type { HoverTarget } from '$lib/model/Hover/types';
import { LENS_ATTRIBUTE, TOUCH_FOCUS_GRACE_MS } from './constants';
import { lensSource } from './LensSource';
import type { LensElement, LensHover } from './types';

/** The hover as the store keeps it: a repeat of the same target is no change. */
const fakeHover = (): LensHover & { changes: number } => ({
	target: null,
	changes: 0,
	set(target) {
		if (hoverKey(this.target) === hoverKey(target)) return;
		this.target = target;
		this.changes += 1;
	},
	clear() {
		this.set(null);
	}
});

type Listener = (event: never) => void;
/** An element as the attachment sees it, with `closest` for what a leave lands in; `parent` is the source it sits in. */
class FakeElement implements LensElement {
	attributes = new Map<string, string>();
	listeners = new Map<string, Listener[]>();
	constructor(readonly parent: FakeElement | null = null) {}
	addEventListener(type: string, listener: unknown): void {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener as Listener]);
	}
	removeEventListener(type: string, listener: unknown): void {
		this.listeners.set(
			type,
			(this.listeners.get(type) ?? []).filter((item) => item !== listener)
		);
	}
	dispatchEvent(): boolean {
		return true;
	}
	setAttribute(name: string, value: string): void {
		this.attributes.set(name, value);
	}
	removeAttribute(name: string): void {
		this.attributes.delete(name);
	}
	/** The nearest attached element up the tree, this one included. */
	closest(selector: string): FakeElement | null {
		const name = selector.slice(1, -1);
		if (this.attributes.has(name)) return this;
		return this.parent?.closest(selector) ?? null;
	}
	fire(type: string, event: object = {}): void {
		for (const listener of this.listeners.get(type) ?? []) listener(event as never);
	}
	count(): number {
		return [...this.listeners.values()].reduce((sum, list) => sum + list.length, 0);
	}
}

const mouse = { pointerType: 'mouse', timeStamp: 1000, relatedTarget: null };
const touch = { pointerType: 'touch', timeStamp: 1000, relatedTarget: null };
const record: HoverTarget = { kind: 'trace', traceId: 't1' };
/** The microtask a blur's release waits for. */
const blurred = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve));
const scope: HoverTarget = { kind: 'scope', scopeId: 's1' };

describe('lensSource', () => {
	it('sets the hover on enter and on focus, releases it on leave and on blur, and marks the element', async () => {
		const hover = fakeHover();
		const element = new FakeElement();
		const detach = lensSource(hover, record)!(element)!;
		expect(element.attributes.get(LENS_ATTRIBUTE)).toBe('trace:t1');
		element.fire('pointerenter', mouse);
		expect(hover.target).toEqual(record);
		element.fire('pointerleave', mouse);
		expect(hover.target).toBeNull();
		element.fire('focusin', { timeStamp: 5000 });
		expect(hover.target).toEqual(record);
		// A blur releases a microtask later: not inside the block that may be removing the element.
		element.fire('focusout', { relatedTarget: null });
		expect(hover.target).toEqual(record);
		await blurred();
		expect(hover.target).toBeNull();
		detach();
		expect(element.attributes.has(LENS_ATTRIBUTE)).toBe(false);
		expect(element.count()).toBe(0);
	});

	it('releases only its own target: a source entered later keeps the hover', async () => {
		const hover = fakeHover();
		const first = new FakeElement();
		const second = new FakeElement();
		lensSource(hover, record)!(first);
		lensSource(hover, scope)!(second);
		first.fire('pointerenter', mouse);
		second.fire('pointerenter', mouse);
		expect(hover.target).toEqual(scope);
		// The first is left after the second took over (the events arrive out of order): nothing changes.
		first.fire('pointerleave', mouse);
		expect(hover.target).toEqual(scope);
		first.fire('focusout', { relatedTarget: null });
		await blurred();
		expect(hover.target).toEqual(scope);
		second.fire('pointerleave', mouse);
		expect(hover.target).toBeNull();
	});

	it('hands the hover back to the source the pointer left into: a chip inside a row gives the row back', async () => {
		const hover = fakeHover();
		const row = new FakeElement();
		const chip = new FakeElement(row);
		const inner = new FakeElement(chip);
		lensSource(hover, record)!(row);
		lensSource(hover, scope)!(chip);
		row.fire('pointerenter', mouse);
		chip.fire('pointerenter', mouse);
		expect(hover.target).toEqual(scope);
		// Back onto the row's own text: the row's target again, at once.
		chip.fire('pointerleave', { ...mouse, relatedTarget: row });
		expect(hover.target).toEqual(record);
		chip.fire('pointerenter', mouse);
		// The focus moves into the chip's own button, then out to the row: the same hand-over.
		chip.fire('focusout', { relatedTarget: inner });
		await blurred();
		expect(hover.target).toEqual(scope);
		chip.fire('focusout', { relatedTarget: row });
		await blurred();
		expect(hover.target).toEqual(record);
		// Out of both: nothing, whichever leave arrives first.
		chip.fire('pointerleave', { ...mouse, relatedTarget: null });
		row.fire('pointerleave', { ...mouse, relatedTarget: null });
		expect(hover.target).toBeNull();
	});

	it('ignores touch pointers and the focus a tap leaves behind, but not a later keyboard focus', () => {
		const hover = fakeHover();
		const element = new FakeElement();
		lensSource(hover, record)!(element);
		element.fire('pointerenter', touch);
		expect(hover.target).toBeNull();
		element.fire('pointerdown', touch);
		element.fire('focusin', { timeStamp: touch.timeStamp + TOUCH_FOCUS_GRACE_MS });
		expect(hover.target).toBeNull();
		element.fire('focusin', { timeStamp: touch.timeStamp + TOUCH_FOCUS_GRACE_MS + 1 });
		expect(hover.target).toEqual(record);
		// A touch leave does not release what a mouse set either.
		element.fire('pointerleave', touch);
		expect(hover.target).toEqual(record);
	});

	it('clears its own hover on detach and leaves another source’s alone', () => {
		const hover = fakeHover();
		const element = new FakeElement();
		const other = new FakeElement();
		const detach = lensSource(hover, record)!(element)!;
		const detachOther = lensSource(hover, scope)!(other)!;
		element.fire('pointerenter', mouse);
		detachOther();
		expect(hover.target).toEqual(record);
		detach();
		expect(hover.target).toBeNull();
	});

	it('attaches nothing without a hover or without a target', () => {
		expect(lensSource(null, record)).toBeUndefined();
		expect(lensSource(fakeHover(), null)).toBeUndefined();
	});

	it('is one change per real move between things, as the store counts them', async () => {
		const hover = fakeHover();
		const element = new FakeElement();
		lensSource(hover, record)!(element);
		element.fire('pointerenter', mouse);
		element.fire('focusin', { timeStamp: 5000 });
		expect(hover.changes).toBe(1);
		element.fire('focusout', { relatedTarget: null });
		element.fire('pointerleave', mouse);
		await blurred();
		expect(hover.changes).toBe(2);
	});

	it('a blur while the element is being removed changes nothing inside the removal: the detach clears the hover first', async () => {
		const hover = fakeHover();
		const element = new FakeElement();
		const detach = lensSource(hover, record)!(element)!;
		element.fire('focusin', { timeStamp: 5000 });
		expect(hover.target).toEqual(record);
		element.fire('focusout', { relatedTarget: null });
		detach();
		expect(hover.target).toBeNull();
		expect(hover.changes).toBe(2);
		await blurred();
		expect(hover.changes).toBe(2);
	});
});
