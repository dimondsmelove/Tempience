import { t } from '$lib/state/Locale/Locale.svelte';
import { SvelteDate } from 'svelte/reactivity';
import { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { clampWindow, zoomWindow } from '$lib/state/Viewport/math';
import type { TimeWindow } from '$lib/state/Viewport/types';
import { DAY, HOUR, MINUTE } from './constants';
import {
	addDays,
	changeEnd,
	changeStart,
	dayAt,
	dayWindow,
	snapped,
	shiftSelection,
	windowAt
} from './TimeInput';
import {
	amountLabel,
	matchesAmount,
	measuredAmount,
	measuredMinutes,
	measuredDuration
} from './duration';
import type { DurationAmount, DurationUnit, TimeDetail, RailMode, TimeSelection } from './types';

export class TimeInputState {
	value = $state.raw<TimeSelection>()!;
	draft = $state.raw<TimeSelection>()!;
	active = $state(false);
	pickingEnd = $state(false);
	edge = $state<'start' | 'end'>('start');
	mode = $state<RailMode>('day');
	input = $state<'picker' | 'timeline'>('picker');
	calendar = $state(false);
	timeView = $state<'wheels' | 'list'>('wheels');
	detail = $state<TimeDetail>('clock');
	readonly unplaced = $derived(this.draft.date === 'unknown' || this.draft.date === 'preserved');
	durationUnit = $state<DurationUnit>('hour');
	manualDuration = $state.raw<DurationAmount | null>(null);
	private clockAlternative: {
		value: TimeSelection;
		edge: 'start' | 'end';
		pending: boolean;
	} | null = null;
	private durationFromBounds: string | null = null;
	readonly durationNotice = $derived.by(() => {
		if (this.detail !== 'clock' || !this.manualDuration) return '';
		const measured = measuredDuration(this.draft);
		if (measured === null)
			return t('time.durationModeNotice', { amount: amountLabel(this.manualDuration) });
		return matchesAmount(this.manualDuration, measured)
			? ''
			: t('time.durationMismatch', {
					measured: amountLabel(measured),
					stated: amountLabel(this.manualDuration)
				});
	});
	readonly viewport: ViewportState;
	readonly point = $derived(
		this.edge === 'end' ? (this.draft.end ?? this.draft.start) : this.draft.start
	);

	constructor(initial: TimeSelection) {
		this.value = { ...initial };
		this.draft = { ...initial };
		this.viewport = new ViewportState(windowAt(initial.start, 'day'), {
			limits: {
				minSpanMs: 30 * MINUTE,
				maxSpanMs: 300 * 366 * DAY,
				minStart: new SvelteDate(1900, 0, 1).getTime(),
				maxEnd: new SvelteDate(2200, 0, 1).getTime()
			}
		});
		this.viewport.motionEnabled = true;
	}
	open(from?: TimeWindow) {
		this.draft = { ...this.value };
		this.detail = this.value.duration ? 'duration' : 'clock';
		this.manualDuration = this.value.duration ?? null;
		this.durationUnit = this.value.duration?.unit === 'day' ? 'day' : 'hour';
		this.clockAlternative = null;
		this.durationFromBounds = null;
		this.edge = 'start';
		this.pickingEnd = false;
		this.mode = 'day';
		this.input = 'picker';
		this.calendar = false;
		this.timeView = 'wheels';
		this.viewport.set(from ?? windowAt(this.point, 'day'));
		this.active = true;
		if (from) this.windowTo(windowAt(this.point, 'day'), 420);
	}
	apply() {
		this.value = { ...this.draft };
		this.active = false;
		this.pickingEnd = false;
	}
	cancel() {
		this.draft = { ...this.value };
		this.active = false;
		this.pickingEnd = false;
	}
	setDetail(detail: TimeDetail) {
		if (detail === this.detail) return;
		if (detail === 'duration') {
			this.clockAlternative = { value: this.draft, edge: this.edge, pending: this.pickingEnd };
			const measured = measuredDuration(this.draft);
			const key = measured ? `${measured.unit}:${measured.amount}` : null;
			if (measured !== null && key !== this.durationFromBounds) {
				this.manualDuration = measured;
				this.durationUnit = measured.unit === 'day' ? 'day' : 'hour';
				this.durationFromBounds = key;
			}
			this.draft = {
				...this.draft,
				start: dayAt(this.draft.start),
				end: this.draft.window ? this.draft.end : null,
				timed: false,
				duration: this.manualDuration ?? undefined
			};
			this.edge = 'start';
			this.pickingEnd = false;
		} else {
			const previous = this.clockAlternative;
			this.draft = previous
				? {
						...shiftSelection(previous.value, this.draft.start, 'day'),
						date: this.draft.date,
						approximate: this.draft.approximate
					}
				: {
						...this.draft,
						duration: undefined,
						end: this.draft.window ? this.draft.end : null,
						timed: false
					};
			this.edge = previous?.edge ?? 'start';
			this.pickingEnd = previous?.pending ?? false;
		}
		this.detail = detail;
		this.calendar = false;
		this.mode = this.draft.timed && this.input === 'timeline' ? 'minute' : 'day';
		this.windowTo(this.mode === 'minute' ? dayWindow(this.point) : windowAt(this.point, 'day'));
	}
	setDuration(amount: number | null, unit = this.durationUnit) {
		this.durationUnit = unit;
		this.manualDuration = amount === null ? null : { amount, unit };
		this.draft = {
			...this.draft,
			end: this.draft.window ? this.draft.end : null,
			timed: false,
			duration: this.manualDuration ?? undefined
		};
	}
	setDurationTime(hours: number, minutes: number) {
		const total = hours * 60 + minutes;
		if (!Number.isSafeInteger(total) || total < 0) return;
		const value = measuredAmount(total);
		this.setDuration(total === 0 ? null : value.amount, value.unit);
		this.durationUnit = 'hour';
	}
	windowTo(window: TimeWindow, duration = 0) {
		const day = dayWindow(this.point);
		this.viewport.move(
			clampWindow(
				window,
				this.mode === 'minute'
					? {
							minSpanMs: 30 * MINUTE,
							maxSpanMs: day.end - day.start,
							minStart: day.start,
							maxEnd: day.end
						}
					: { ...this.viewport.limits, minSpanMs: 3 * DAY, maxSpanMs: 62 * DAY }
			),
			duration
		);
	}
	zoom(factor: number, anchor?: number) {
		const base = this.viewport.target;
		this.windowTo(zoomWindow(base, factor, anchor ?? (base.start + base.end) / 2), 180);
	}
	focus(edge: 'start' | 'end') {
		this.edge = edge;
		this.pickingEnd = false;
		this.windowTo(
			this.mode === 'minute' ? dayWindow(this.point) : windowAt(this.point, 'day'),
			320
		);
	}
	days() {
		this.mode = 'day';
		this.windowTo(windowAt(this.point, 'day'), 320);
	}
	hours() {
		// Date-only noon is a visual coordinate. Precision changes only on this explicit action.
		if (!this.draft.timed) {
			this.draft = {
				...this.draft,
				timed: true,
				end: this.draft.end === this.draft.start ? this.draft.start + HOUR : this.draft.end
			};
		}
		this.mode = 'minute';
		this.windowTo(dayWindow(this.point), 320);
	}
	pick(target: number, edge = this.edge, step = MINUTE, base = this.draft) {
		if (this.mode === 'minute') {
			const day = dayWindow(edge === 'end' ? (base.end ?? base.start) : base.start);
			target = Math.max(day.start, Math.min(day.end - MINUTE, snapped(target, 'minute', step)));
		} else target = dayAt(target);
		this.edge = edge;
		this.pickingEnd = false;
		this.draft =
			edge === 'end' ? changeEnd(base, target, this.mode) : changeStart(base, target, this.mode);
		if (this.draft.date) this.draft = { ...this.draft, date: undefined };
	}
	translate(target: number, step = MINUTE, base = this.draft) {
		target = snapped(target, this.mode, step);
		if (this.mode === 'minute') {
			const bounds = dayWindow(base.start);
			target = Math.max(bounds.start, Math.min(bounds.end - MINUTE, target));
		}
		this.draft = shiftSelection(base, target, this.mode);
	}

	clock(hours: number, minutes: number) {
		const date = new SvelteDate(this.point);
		date.setHours(hours, minutes, 0, 0);
		const target = date.getTime();
		// A partial digit command must not clamp another clock column (e.g. 01 → 09:01 → 12:01).
		if (
			this.draft.timed &&
			(this.edge === 'end'
				? target <= this.draft.start
				: this.draft.end !== null && target >= this.draft.end)
		)
			return;
		if (!this.draft.timed) this.hours();
		this.mode = 'minute';
		this.pick(target);
	}
	chooseDay(target: number) {
		this.draft = { ...this.draft, date: undefined };
		this.mode = 'day';
		this.pick(target);
		this.calendar = false;
		this.windowTo(windowAt(this.point, 'day'));
	}
	switchInput(input: 'picker' | 'timeline') {
		this.input = input;
		if (input === 'timeline') {
			this.mode = this.draft.timed ? 'minute' : 'day';
			this.windowTo(this.mode === 'minute' ? dayWindow(this.point) : windowAt(this.point, 'day'));
		}
	}
	quickDay(offset: number) {
		this.mode = 'day';
		this.pick(addDays(Date.now(), offset));
		this.windowTo(windowAt(this.point, 'day'), 320);
	}
	beginEnd() {
		this.pickingEnd = !this.pickingEnd;
		this.edge = this.pickingEnd ? 'end' : 'start';
	}
	cancelEnd() {
		this.pickingEnd = false;
		this.edge = 'start';
	}

	removeEnd() {
		this.draft = { ...this.draft, end: null };
		this.focus('start');
	}
	removeTime() {
		const minutes = measuredMinutes(this.draft);
		if (minutes !== null) {
			this.manualDuration = measuredAmount(minutes);
			this.durationUnit = 'hour';
			this.setDetail('duration');
			return;
		}
		this.draft = {
			...this.draft,
			start: dayAt(this.draft.start),
			end: this.draft.end === null ? null : dayAt(this.draft.end),
			timed: false
		};
		this.days();
	}
}
