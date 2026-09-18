import type { ButtonSize, ButtonVariant } from './types';

/**
 * Token-only classes. The button is a native element, not a Flowbite one:
 * Flowbite's dark palette (gray-700/800) leaked through twMerge and read as
 * blue next to the teal accent.
 */
export const BUTTON_BASE_CLASS =
	'inline-flex cursor-pointer items-center justify-center cg-control font-medium whitespace-nowrap select-none transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50';

export const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
	primary: 'border border-transparent bg-accent text-accent-ink hover:brightness-110',
	default:
		'border border-outline bg-raised text-ink hover:border-[color:var(--cg-border-strong)] hover:text-ink',
	quiet: 'border border-transparent bg-transparent text-muted hover:bg-accent/10 hover:text-ink'
};

export const BUTTON_SIZE_CLASS: Record<ButtonSize, string> = {
	md: '',
	sm: 'cg-control-sm'
};

/** Square icon-only buttons keep the control height as their width. */
export const BUTTON_ICON_CLASS: Record<ButtonSize, string> = {
	md: 'cg-control-icon',
	sm: 'cg-control-icon-sm'
};

/** A pressed toggle reads at a glance: accent border and fill, plus an accent line underneath. */
export const BUTTON_PRESSED_CLASS =
	'border-accent bg-accent/25 text-ink shadow-[inset_0_-2px_0_0_var(--cg-accent)]';
