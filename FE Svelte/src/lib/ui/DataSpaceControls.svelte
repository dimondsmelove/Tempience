<script lang="ts">
	import DataSpaceSwitcher from './DataSpaceSwitcher.svelte';
	import SyncStatus from './SyncStatus.svelte';
	import DataSpaceNotice from './DataSpaceNotice.svelte';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { DEMO_DATA_SPACE_ID } from '$lib/state/triplit/data-space';
	let { identity = false }: { identity?: boolean } = $props();
	// The identity bar carries no scenario menu (c5ab937); «Удалить демо» has no other way in.
	const demo = activeDataSpace.id === DEMO_DATA_SPACE_ID;
</script>

<DataSpaceSwitcher />
<!-- The phone bar has no room for the demo trigger (it wrapped to a second row); there the local-data menu carries the same actions. -->
{#if !identity || demo}
	<div class={identity ? 'hidden sm:contents' : 'contents'}>
		<DataSpaceNotice align={identity ? 'start' : 'end'} />
	</div>
{/if}
{#if identity}<div class="grow"></div>{/if}
<SyncStatus quiet={identity} />
