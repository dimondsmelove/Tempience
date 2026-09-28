import { formatDayShort } from '$lib/model/Chapters';
import type { ChapterRecord } from '$lib/model/Chapters/types';
import type { RecordItem } from '$lib/context/RecordList/types';
import type { Locale } from '$lib/state/Locale/types';

/** A chapter's records as the Context lists records: day and title. */
export const recordItems = (
	records: readonly ChapterRecord[],
	timeZone: string,
	language: Locale,
	now: number
): RecordItem[] =>
	records.map((record) => ({
		traceId: record.id,
		date: formatDayShort(record.at, timeZone, language, now),
		title: record.title,
		at: record.at
	}));
