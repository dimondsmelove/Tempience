<script lang="ts">
	import { dateTimeFormat } from '$lib/state/Locale/format';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';

	/**
	 * When the server was last read for the ribbon — the honest line of the sync popover
	 * (owner, 2026-09-20): the badge speaks of the outbox and the connection, this of the
	 * rows that came in. Null before the first answer of this session.
	 */
	let { lastReadAt }: { lastReadAt: string | null } = $props();

	const time = $derived.by(() => {
		if (!lastReadAt) return '';
		try {
			return dateTimeFormat(locale.current, { timeStyle: 'short' }).format(new Date(lastReadAt));
		} catch {
			return lastReadAt;
		}
	});
</script>

<div data-testid="sync-server-read" data-read-at={lastReadAt ?? undefined}>
	{lastReadAt ? t('sync.serverReadAt', { time }) : t('sync.serverReadNever')}
</div>
