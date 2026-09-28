/** «Показать главу на ленте» fits an open chapter up to three weeks past «сейчас» or its start. */
export const OPEN_CHAPTER_FIT_DAYS = 21;

/** The longest delay a browser timer holds (2³¹ − 1 ms, about 24.8 days); a farther boundary is waited for in steps. */
export const MAX_TIMER_MS = 2_147_483_647;

/** «Мой порядок строк» remembered on this device (owner 2026-09-28). */
export const ROWS_OFF_STORAGE_KEY = 'tempience.chapters.rows-off.v1';
