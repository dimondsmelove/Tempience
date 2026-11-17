import type { Attachment } from 'svelte/attachments';

// Track mounted sheets in display order so global affordances can remain above the top one.
const sheets: HTMLElement[] = [];
export const isTopSheet = (element: HTMLElement) => sheets.at(-1) === element;
const publish = () => {
	const sheet = sheets.at(-1);
	if (sheet)
		document.documentElement.style.setProperty(
			'--mobile-sheet-top',
			`${sheet.getBoundingClientRect().top}px`
		);
	else document.documentElement.style.removeProperty('--mobile-sheet-top');
	window.dispatchEvent(new Event('mobile-sheet-change'));
};
export const trackSheet: Attachment<HTMLElement> = (element) => {
	sheets.push(element);
	const observer = new ResizeObserver(publish);
	observer.observe(element);
	window.visualViewport?.addEventListener('resize', publish);
	window.visualViewport?.addEventListener('scroll', publish);
	requestAnimationFrame(publish);
	return () => {
		observer.disconnect();
		window.visualViewport?.removeEventListener('resize', publish);
		window.visualViewport?.removeEventListener('scroll', publish);
		const index = sheets.indexOf(element);
		if (index !== -1) sheets.splice(index, 1);
		publish();
	};
};
