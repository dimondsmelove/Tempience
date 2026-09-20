/** Where a metric belongs in the editor; the group is named by the interface. */
export type MetricGroup = 'geometry' | 'typography';

// Every label is a key of the catalogs: the editor reads it in the language of the moment.
export const colorFields = {
	canvas: ['theme.color.canvas', '--cg-bg-canvas', 'background'],
	surface: ['theme.color.surface', '--cg-bg-surface', 'card'],
	raised: ['theme.color.raised', '--cg-bg-raised', ''],
	input: ['theme.color.input', '--cg-bg-input', 'background'],
	popover: ['theme.color.popover', '--cg-bg-popover', 'popover'],
	ink: ['theme.color.ink', '--cg-text-primary', 'foreground'],
	muted: ['theme.color.muted', '--cg-text-muted', 'muted-foreground'],
	border: ['theme.color.border', '--cg-border-default', 'border'],
	accent: ['theme.color.accent', '--cg-accent', 'primary'],
	accentInk: ['theme.color.accentInk', '--cg-text-on-accent', 'primary-foreground'],
	secondary: ['theme.color.secondary', '--cg-accent-secondary', 'accent'],
	secondaryInk: ['theme.color.secondaryInk', '--cg-text-on-secondary', 'accent-foreground'],
	focus: ['theme.color.focus', '--cg-focus', 'ring'],
	danger: ['theme.color.danger', '--cg-danger', 'destructive'],
	success: ['theme.color.success', '--cg-success', ''],
	warning: ['theme.color.warning', '--cg-warning', ''],
	event: ['theme.color.event', '--cg-event', ''],
	info: ['theme.color.info', '--cg-info', '']
} as const;

// Bounds keep controls readable; roles remain independent of any particular preset.
export const metricFields = {
	controlRadius: {
		label: 'theme.metric.controlRadius',
		group: 'geometry',
		value: 3,
		min: 0,
		max: 24,
		step: 1
	},
	surfaceRadius: {
		label: 'theme.metric.surfaceRadius',
		group: 'geometry',
		value: 6,
		min: 0,
		max: 32,
		step: 1
	},
	paddingX: {
		label: 'theme.metric.paddingX',
		group: 'geometry',
		value: 12,
		min: 4,
		max: 28,
		step: 1
	},
	paddingY: {
		label: 'theme.metric.paddingY',
		group: 'geometry',
		value: 6,
		min: 2,
		max: 16,
		step: 1
	},
	panelPadding: {
		label: 'theme.metric.panelPadding',
		group: 'geometry',
		value: 14,
		min: 4,
		max: 32,
		step: 1
	},
	gap: {
		label: 'theme.metric.gap',
		group: 'geometry',
		value: 8,
		min: 2,
		max: 24,
		step: 1
	},
	borderWidth: {
		label: 'theme.metric.borderWidth',
		group: 'geometry',
		value: 1,
		min: 0,
		max: 3,
		step: 0.5
	},
	shadow: {
		label: 'theme.metric.shadow',
		group: 'geometry',
		value: 16,
		min: 0,
		max: 40,
		step: 1
	},
	caption: {
		label: 'theme.metric.caption',
		group: 'typography',
		value: 12,
		min: 10,
		max: 20,
		step: 1
	},
	control: {
		label: 'theme.metric.control',
		group: 'typography',
		value: 13,
		min: 11,
		max: 22,
		step: 1
	},
	body: { label: 'theme.metric.body', group: 'typography', value: 14, min: 12, max: 24, step: 1 },
	section: {
		label: 'theme.metric.section',
		group: 'typography',
		value: 18,
		min: 14,
		max: 32,
		step: 1
	},
	screen: {
		label: 'theme.metric.screen',
		group: 'typography',
		value: 24,
		min: 18,
		max: 40,
		step: 1
	},
	lineHeight: {
		label: 'theme.metric.lineHeight',
		group: 'typography',
		value: 1.5,
		min: 1.2,
		max: 1.8,
		step: 0.1
	},
	weight: {
		label: 'theme.metric.weight',
		group: 'typography',
		value: 400,
		min: 400,
		max: 600,
		step: 100
	},
	axisMajor: {
		label: 'theme.metric.axisMajor',
		group: 'typography',
		value: 12,
		min: 10,
		max: 20,
		step: 1
	},
	axisMinor: {
		label: 'theme.metric.axisMinor',
		group: 'typography',
		value: 11,
		min: 9,
		max: 18,
		step: 1
	},
	axisWeek: {
		label: 'theme.metric.axisWeek',
		group: 'typography',
		value: 10,
		min: 9,
		max: 16,
		step: 1
	}
} as const;

export const uiFonts = {
	commissioner: { label: 'theme.font.commissioner', css: 'Commissioner, sans-serif' },
	system: { label: 'theme.font.system', css: 'system-ui, sans-serif' },
	serif: { label: 'theme.font.serif', css: 'Georgia, serif' }
} as const;
export const monoFonts = {
	geist: { label: 'theme.font.geist', css: "'Geist Mono', monospace" },
	system: { label: 'theme.font.mono', css: 'ui-monospace, monospace' }
} as const;
export const rowHeightBounds = { min: 52, max: 1200, step: 24 };
/** The strength of the lens veil, per cent: 0 is off (loop 008, B); the default is the mock's 55. */
export const lensBounds = { min: 0, max: 100, step: 5 };

export const defaultDevice = {
	formatVersion: 1 as const,
	themeId: null,
	mode: null,
	textScale: 1,
	density: 1,
	rowHeightPx: 52,
	railWidth: 264,
	contextWidth: 360,
	railOpen: true,
	contextOpen: true,
	legendOpen: true,
	rowArrangement: null,
	lens: 55
};
export const defaultAppearance = { themeId: 'graphite', mode: 'dark' as const };
