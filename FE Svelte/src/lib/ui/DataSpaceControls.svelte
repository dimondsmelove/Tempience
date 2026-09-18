<script lang="ts">
	import DataSpaceSwitcher from './DataSpaceSwitcher.svelte';
	import SyncStatus from './SyncStatus.svelte';
	import DataSpaceNotice from './DataSpaceNotice.svelte';
	let { identity = false }: { identity?: boolean } = $props();
</script>

<DataSpaceSwitcher />
{#if !identity}<DataSpaceNotice />{/if}
{#if identity}<div class="grow"></div>{/if}
<SyncStatus quiet={identity} />
