import { Tween, prefersReducedMotion } from 'svelte/motion';
import { cubicOut } from 'svelte/easing';
import {
	DAY_MS,
	CAMERA_DURATION_MS,
	DEFAULT_LIMITS,
	FIT_PAD_RATIO,
	FOLLOW_NOW_RATIO,
	PAN_STEP_RATIO,
	PRESET_PAST_RATIO,
	REVEAL_PAD_RATIO,
	ZOOM_STEP
} from './constants';
import {
	clampWindow,
	fitWindow,
	followWindow,
	panWindow,
	pxPerDay,
	spanOf,
	spanWindow,
	timeAtPx,
	zoomWindow
} from './math';
import type { TimeWindow, ViewportLimits, ViewportOptions } from './types';

/**
 * The visible window of the Time surface and the gestures that change it.
 * Projection-local by design: it never enters selection history (EXPLORER.md).
 */
export class ViewportState {
	readonly #camera: Tween<TimeWindow>;
	/** Enabled by the mounted surface; server and model-only callers stay synchronous. */
	motionEnabled = false;
	follow = $state(false);
	readonly limits: ViewportLimits;
	readonly #now: () => number;

	constructor(initial: TimeWindow, options: ViewportOptions = {}) {
		this.limits = { ...DEFAULT_LIMITS, ...options.limits };
		this.#now = options.now ?? (() => Date.now());
		this.#camera = new Tween(clampWindow(initial, this.limits), { easing: cubicOut });
	}

	get window(): TimeWindow {
		return this.#camera.current;
	}

	/** Pending destination lets repeated controls accumulate during a move. */
	get target(): TimeWindow {
		return this.#camera.target;
	}

	get moving(): boolean {
		return this.window !== this.target;
	}

	get now(): number {
		return this.#now();
	}

	get spanMs(): number {
		return spanOf(this.window);
	}

	get spanDays(): number {
		return this.spanMs / DAY_MS;
	}

	set(window: TimeWindow): void {
		void this.#camera.set(clampWindow(window, this.limits), { duration: 0 });
	}

	move(window: TimeWindow, duration = CAMERA_DURATION_MS): void {
		void this.#camera.set(clampWindow(window, this.limits), {
			duration: this.motionEnabled && !prefersReducedMotion.current ? duration : 0
		});
	}

	/** Zooms around `anchor`; while following, «сейчас» is the anchor regardless. */
	zoomAt(factor: number, anchor?: number, duration = CAMERA_DURATION_MS): void {
		const base = duration ? this.target : this.window;
		const centre = this.follow ? this.now : (anchor ?? (base.start + base.end) / 2);
		this.move(zoomWindow(base, factor, centre), duration);
	}

	zoomIn(anchor?: number): void {
		this.zoomAt(ZOOM_STEP, anchor);
	}

	zoomOut(anchor?: number): void {
		this.zoomAt(1 / ZOOM_STEP, anchor);
	}

	/** Any pan is a user leaving «сейчас», so following stops. */
	pan(deltaMs: number, duration = 0): void {
		this.stopFollow();
		this.move(panWindow(duration ? this.target : this.window, deltaMs), duration);
	}

	panByRatio(ratio: number): void {
		this.pan(spanOf(this.target) * ratio, CAMERA_DURATION_MS);
	}

	panStep(direction: -1 | 1): void {
		this.panByRatio(direction * PAN_STEP_RATIO);
	}

	setSpanDays(days: number): void {
		const spanMs = days * DAY_MS;
		if (this.follow) {
			this.move(followWindow(this.now, spanMs, FOLLOW_NOW_RATIO));
			return;
		}
		const centre = Math.min((this.target.start + this.target.end) / 2, this.now);
		this.move(spanWindow(centre, spanMs, PRESET_PAST_RATIO));
	}

	fit(start: number, end: number): void {
		this.stopFollow();
		this.move(fitWindow(start, end, FIT_PAD_RATIO));
	}

	/**
	 * DP7: brings a range into the window keeping the scale; a range longer
	 * than the window is fitted with 10 % margins. A range already in view
	 * stays put unless `force` asks to centre it anyway («к выбранному»).
	 */
	reveal(start: number, end: number, force = false): void {
		const span = spanOf(this.target);
		if (!force && start >= this.target.start && end <= this.target.end) return;
		this.stopFollow();
		if (end - start > span) {
			this.move(fitWindow(start, end, REVEAL_PAD_RATIO));
			return;
		}
		this.move(spanWindow((start + end) / 2, span, 0.5));
	}

	centreOn(t: number): void {
		this.stopFollow();
		this.move(spanWindow(t, spanOf(this.target), 0.5));
	}

	startFollow(): void {
		this.follow = true;
		this.move(followWindow(this.now, spanOf(this.target), FOLLOW_NOW_RATIO));
	}

	stopFollow(): void {
		this.follow = false;
	}

	toggleFollow(): void {
		if (this.follow) this.stopFollow();
		else this.startFollow();
	}

	/** Moves the window so «сейчас» stays at its ratio; a no-op unless following. */
	tick(now: number = this.now): void {
		if (!this.follow || this.moving) return;
		this.set(followWindow(now, this.spanMs, FOLLOW_NOW_RATIO));
	}

	timeAtPx(px: number, widthPx: number): number {
		return timeAtPx(this.window, px, widthPx);
	}

	pxPerDay(widthPx: number): number {
		return pxPerDay(this.window, widthPx);
	}
}
