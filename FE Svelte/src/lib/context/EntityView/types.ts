import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
export type EntityViewProps = Readonly<{ workbench: WorkbenchState; entityId: string }>;
