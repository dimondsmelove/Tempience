/**
 * Whether the tour («Как устроено Tempience») is open over the app. The first run shows the
 * tour as a screen of its own; from the menu it is an overlay in the root layout, closed by
 * «Закрыть», «Начать со своих записей» or Escape.
 */
export class TourState {
	open = $state(false);
	// Arrow properties: the methods are passed as callbacks (`onclose={tour.hide}`).
	show = (): void => {
		this.open = true;
	};
	hide = (): void => {
		this.open = false;
	};
}

export const tour = new TourState();
