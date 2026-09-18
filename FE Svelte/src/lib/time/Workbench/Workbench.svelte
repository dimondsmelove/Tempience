<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import './Workbench.css';
	import { onMount, untrack } from 'svelte';
	import { workbench } from '$lib/state/Workbench/instance.svelte';
	import { scenarioImportRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import { MIN_ROWS_HEIGHT_PX } from '$lib/model/Layout/constants';
	import { WHEEL_DURATION_MS } from '$lib/state/Viewport/constants';
	import { spanOf } from '$lib/state/Viewport/math';
	import Axis from '$lib/time/Axis/Axis.svelte';
	import Overview from '$lib/time/Overview/Overview.svelte';
	import { OVERVIEW_HEIGHT_PX } from '$lib/time/Overview/constants';
	import ScopeRail from '$lib/time/ScopeRail/ScopeRail.svelte';
	import Parked from '$lib/time/Parked/Parked.svelte';
	import DataSurface from '$lib/forms/TraceDataset/DataSurface.svelte';
	import TimelineSurface from './TimelineSurface.svelte';
	import type { WorkbenchPreview } from './types';
	import { observeWidth } from '$lib/time/TimelineInput/measure';
	import Toolbar from '$lib/time/Toolbar/Toolbar.svelte';
	import type { Panel } from '$lib/time/Toolbar/types';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { panelWidths } from '$lib/theme/resolve-appearance';
	import Context from '$lib/context/Context/Context.svelte';
	import UndoToast from '$lib/shell/UndoToast/UndoToast.svelte';
	import PanelResize from '$lib/ui/PanelResize/PanelResize.svelte';
	import { COMPACT_WIDTH_PX, PHONE_WIDTH_PX } from './constants';
	import MobilePanels from './MobilePanels.svelte';
	import { adoptContext } from './context-host';
	import { provideTimeInputHost } from '$lib/ui/TimeInput/host.svelte';
	import type { SheetPosition } from '$lib/ui/BottomSheet/types';

	let { preview }: { preview?: WorkbenchPreview } = $props();
	const timeInput = provideTimeInputHost();
	const interaction = $derived(
		preview?.interaction ??
			(timeInput.editor?.picker.input === 'timeline'
				? {
						viewport: timeInput.editor.picker.viewport,
						header: timeInput.editor.header,
						overlay: timeInput.editor.overlay
					}
				: undefined)
	);
	const viewport = $derived(interaction?.viewport ?? workbench.viewport);
	onMount(() => {
		workbench.viewport.motionEnabled = true;
		if (preview) {
			mobilePanel = 'context';
			sheetPosition = 'full';
		}
		workbench.restoreProposals(localStorage);
		void workbench.load(loadWorkbenchSnapshot);
		return () => {
			workbench.viewport.motionEnabled = false;
			workbench.viewport.set(workbench.viewport.window);
		};
	});

	let width = $state(0);
	let mobilePanel = $state<Panel | null>(null);
	let sheetPosition = $state<SheetPosition>('half');
	const contextPosition = $derived(
		preview?.contextPosition ?? (timeInput.editor ? timeInput.position : sheetPosition)
	);
	function setContextPosition(position: SheetPosition) {
		sheetPosition = position;
		if (timeInput.editor) timeInput.position = position;
		preview?.oncontextposition?.(position);
	}
	let sheetHeight = $state(0);
	const phone = $derived(width > 0 && width < PHONE_WIDTH_PX);
	const occludedHeight = $derived(phone && mobilePanel === 'context' ? sheetHeight : 0);
	const timeCovered = $derived(
		phone && mobilePanel !== null && (mobilePanel !== 'context' || contextPosition === 'full')
	);
	let railHeaderHeight = $state(0);
	const measured = $derived(width > 0);
	const compact = $derived(measured && width < COMPACT_WIDTH_PX);
	const measureWidth = observeWidth((px) => {
		width = px;
		timeInput.phone = px > 0 && px < PHONE_WIDTH_PX;
	});
	const rowHeightPx = $derived(appearance.device.rowHeightPx);
	const widths = $derived(panelWidths(width, appearance.device));
	const contextOpen = $derived(
		compact ? mobilePanel === 'context' : Boolean(preview) || appearance.device.contextOpen
	);
	const railOpen = $derived(compact ? mobilePanel === 'rail' : appearance.device.railOpen);
	/**
	 * The Context is one component for the whole workbench. Its DOM is parked here and
	 * adopted by whichever host shows it — the desktop panel or the phone sheet — so a
	 * layout change moves an open form with the text the browser has not parsed yet
	 * instead of ending it. It is destroyed only when no host shows it and no form is open.
	 */
	let contextParking = $state<HTMLDivElement | null>(null);
	let contextKeeper = $state<HTMLDivElement | null>(null);
	const contextHosted = $derived(!preview && (phone ? mobilePanel === 'context' : contextOpen));
	const contextAlive = $derived(contextHosted || workbench.formOpen);
	/** The X, Escape, the empty canvas and the sheet: the form ends after its guard, then the panel. */
	const closeContext = (): void => {
		draftGuard.exit(() => {
			timeInput.editor?.close();
			workbench.closeForms();
			applyPanel('context', false);
		});
	};
	const togglePanel = (panel: Panel, open: boolean): void => {
		if (!open && panel === 'context') closeContext();
		else applyPanel(panel, open);
	};
	const applyPanel = (panel: Panel, open: boolean): void => {
		if (compact) {
			if (open && panel === 'context' && (mobilePanel !== 'context' || workbench.capture))
				setContextPosition(workbench.capture ? 'full' : 'half');
			if (open && panel !== 'context') sheetPosition = 'half';
			mobilePanel = open ? panel : null;
		} else
			appearance.applyDevice({
				...appearance.savedDevice,
				[panel === 'rail' ? 'railOpen' : 'contextOpen']: open
			});
	};
	const resize = (panel: 'railWidth' | 'contextWidth', value: number) =>
		appearance.previewDevice({ ...appearance.savedDevice, [panel]: value });
	const commitResize = () => appearance.applyDevice({ ...appearance.device });

	const projection = $derived(workbench.projection);
	const selection = $derived(workbench.selection);

	// A new selection opens Context once; closing the panel is not another selection.
	// Initial selection waits until ResizeObserver establishes the responsive layout.
	$effect(() => {
		void selection.revision;
		if (!measured) return;
		untrack(() => {
			if (selection.current && !contextOpen) togglePanel('context', true);
		});
	});

	// Catalog entry also opens a previously closed Context; data selection reveals the phone canvas.
	$effect(() => {
		void workbench.forms.revision;
		if (!measured) return;
		untrack(() => {
			if (workbench.forms.open) {
				togglePanel('context', true);
				if (phone) setContextPosition('full');
			}
		});
	});
	// A Kind chosen for its table on a phone reveals the canvas under the sheet. The choice
	// is a change of the table shown, not the first measurement of the layout: a record
	// selected on the way in (a row of the standalone Kind page) keeps the sheet it opened.
	$effect(() => {
		const data = workbench.forms.data;
		untrack(() => {
			if (data && phone) mobilePanel = null;
		});
	});
	// A language switch redisplays the typed records without a read; the first language is the load's.
	$effect(() => {
		const language = locale.current;
		untrack(() => workbench.redisplay(language));
	});
	// The timeline shown again after records were committed behind a table or a catalog.
	$effect(() => {
		if (workbench.timelineCovered || !workbench.stale) return;
		untrack(() => void workbench.load(loadWorkbenchSnapshot));
	});
	// A form started outside the toolbar (a Context action, the catalog route) shows the panel too.
	$effect(() => {
		void workbench.forms.captureRevision;
		if (!measured) return;
		untrack(() => {
			if (workbench.capture && !contextOpen) togglePanel('context', true);
		});
	});
	// A phone shows an open form in the sheet, including one carried over from a wider layout.
	$effect(() => {
		if (!workbench.formOpen || !phone) return;
		untrack(() => {
			if (mobilePanel === null) mobilePanel = 'context';
			if (workbench.capture) setContextPosition('full');
		});
	});

	let scroller = $state<HTMLDivElement | null>(null);
	let scrollerHeight = $state(0);
	let axisHeaderHeight = $state(0);
	const minCanvasHeight = $derived(
		phone || interaction ? Math.max(0, scrollerHeight - axisHeaderHeight) : 0
	);
	const canvasHeight = $derived(
		Math.max(
			minCanvasHeight,
			projection.rows.length ? projection.rows.length * rowHeightPx : MIN_ROWS_HEIGHT_PX
		)
	);
	let lanes = $state<HTMLDivElement | null>(null);
	/** A selection made off the canvas also scrolls its row into view. */
	$effect(() => {
		void selection.revision;
		void mobilePanel;
		const traceId = selection.traceId;
		if (!scroller || !lanes || (!traceId && !selection.scopeId) || selection.source === 'canvas')
			return;
		const rowId =
			selection.scopeId ?? (traceId ? projection.marksByTraceId.get(traceId)?.[0]?.rowId : null);
		const index = projection.rows.findIndex((row) => row.id === rowId);
		if (index < 0) return;
		const rowHeight = rowHeightPx;
		const lanesTop =
			lanes.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
		const rowTop = lanesTop + index * rowHeight;
		// Resizing Context must not restart smooth scrolling behind the touch gesture.
		const covered = untrack(() => occludedHeight);
		const visibleTop = scroller.scrollTop + lanesTop;
		const visibleBottom = scroller.scrollTop + scroller.clientHeight - covered;
		if (visibleBottom <= visibleTop) return;
		if (rowTop >= visibleTop && rowTop + rowHeight <= visibleBottom) return;
		scroller.scrollTo({
			top: Math.max(
				0,
				rowTop - lanesTop - (scroller.clientHeight - covered - lanesTop - rowHeight) / 2
			),
			behavior: 'smooth'
		});
	});

	const onkeydown = (event: KeyboardEvent): void => {
		if (interaction) return;
		const target = event.target as HTMLElement | null;
		if (
			target?.closest(
				'input, textarea, select, button, dialog, [role="separator"], [contenteditable]'
			)
		)
			return;
		if (event.key === 'Escape') {
			// One step back per press: overlay panel, then «Записать», then the selection (C9a-1).
			if (mobilePanel === 'context') closeContext();
			else if (mobilePanel) mobilePanel = null;
			else if (workbench.capture) workbench.closeCapture();
			else if (selection.current) workbench.rest();
			else return;
			event.preventDefault();
			return;
		}
		if (event.altKey && event.key === 'ArrowLeft') workbench.back();
		else if (event.altKey && event.key === 'ArrowRight') workbench.forward();
		else if (event.key === '+' || event.key === '=') viewport.zoomIn();
		else if (event.key === '-') viewport.zoomOut();
		else if (event.key === 'ArrowLeft') viewport.panStep(-1);
		else if (event.key === 'ArrowRight') viewport.panStep(1);
		else return;
		event.preventDefault();
	};
</script>

<svelte:window {onkeydown} />

{#snippet controls(phoneControls: boolean)}
	{#if timeInput.editor && phoneControls}{@render timeInput.editor.actions()}{:else if phoneControls && preview?.mobileActions}{@render preview.mobileActions()}{:else if interaction}{@render interaction.actions?.()}{:else}
		<Toolbar
			phone={phoneControls}
			{workbench}
			railOpen={!compact && railOpen}
			contextOpen={!compact && contextOpen}
			ontogglepanel={togglePanel}
			oncapture={() => {
				workbench.openCapture(
					workbench.forms.data
						? {
								...workbench.forms.data,
								scopeId: workbench.forms.scopeId
							}
						: undefined
				);
				togglePanel('context', true);
			}}
			scenarioSpace={activeDataSpace.kind === 'scenario'}
			onapply={() => {
				void workbench.applyProposals(
					scenarioImportRepository,
					activeDataSpace,
					loadWorkbenchSnapshot,
					localStorage
				);
			}}
		/>
	{/if}
{/snippet}

{#snippet scopeContent(onCanvas: boolean)}
	<ScopeRail
		{onCanvas}
		rows={projection.rows}
		scopes={workbench.snapshot.scopes}
		filters={workbench.filters}
		disclosure={workbench.rows}
		selectedScopeId={selection.scopeId}
		onselectscope={(scopeId) => workbench.selectScope(scopeId)}
		oncreate={() => {
			workbench.createScope(null);
			togglePanel('context', true);
		}}
		bind:headerHeight={railHeaderHeight}
		{rowHeightPx}
		widthPx={widths.rail}
		compact={compact || onCanvas}
		onclose={() => togglePanel('rail', false)}
		onpreview={(value) => resize('railWidth', value)}
		oncommit={commitResize}
		oncancel={() => appearance.cancel()}
	/>
{/snippet}

<div
	class={['workbench relative grid h-full min-h-0', phone && 'phone-workbench']}
	{@attach measureWidth}
	data-testid="time-workbench"
	data-phone={phone}
	data-camera-moving={viewport.moving}
	data-window-start={viewport.window.start}
	data-window-end={viewport.window.end}
	data-status={workbench.status}
	style:--time-header-height={interaction
		? `${axisHeaderHeight}px`
		: `max(calc(var(--cg-axis-height) + ${phone ? 44 : OVERVIEW_HEIGHT_PX}px + var(--cg-border-width)), ${!compact && railOpen ? railHeaderHeight + 1 : 0}px)`}
	style:grid-template-columns={!compact && contextOpen
		? `minmax(0, 1fr) ${widths.context}px`
		: 'minmax(0, 1fr)'}
>
	<section
		class="flex min-h-0 min-w-0 flex-col border-r border-outline"
		aria-label="Time"
		inert={timeCovered}
		aria-hidden={timeCovered}
	>
		{#if !phone}{@render controls(false)}{/if}

		<div
			class="min-h-0 flex-1 overflow-auto"
			bind:this={scroller}
			bind:clientHeight={scrollerHeight}
			style:padding-bottom="{occludedHeight}px"
		>
			{#if workbench.forms.data && !interaction}
				<div
					class="grid min-h-full"
					style:grid-template-columns={(!compact && railOpen ? widths.rail : 0) +
						'px minmax(0, 1fr)'}
				>
					{#if railOpen && !phone}
						<aside
							class={['scope-rail border-r border-outline bg-canvas', compact && 'mobile-panel']}
							id="time-scope"
							aria-label="Scope"
						>
							{@render scopeContent(false)}
						</aside>
					{/if}
					<div class="col-start-2 min-w-0">
						<DataSurface
							{workbench}
							oncapture={(preset) => {
								workbench.openCapture(preset);
								togglePanel('context', true);
							}}
						/>
					</div>
				</div>
			{:else}
				<div
					class="grid"
					style:grid-template-rows={`${interaction ? 'auto' : 'var(--time-header-height)'} ${canvasHeight}px auto`}
					style:grid-template-columns={`${!compact && railOpen ? widths.rail : 0}px minmax(0, 1fr)`}
				>
					{#if railOpen && !phone}
						<aside
							class={['scope-rail border-r border-outline bg-canvas', compact && 'mobile-panel']}
							id="time-scope"
							aria-label="Scope"
							inert={Boolean(interaction)}
							style:width={compact
								? Math.min(appearance.device.railWidth, width * 0.9) + 'px'
								: undefined}
						>
							{@render scopeContent(false)}
						</aside>
					{/if}
					<div
						class="sticky top-0 z-10 col-start-2 row-start-1 flex flex-col justify-between border-b border-outline bg-surface"
						bind:clientHeight={axisHeaderHeight}
					>
						{#if interaction}{@render interaction.header()}{:else}
							<Overview
								{phone}
								canReveal={Boolean(workbench.selectedRange)}
								onreveal={() => workbench.goToSelected()}
								{viewport}
								extent={projection.extent}
								times={projection.timeByTraceId}
								inWindow={workbench.inWindow}
							/>
							<Axis
								window={viewport.window}
								now={viewport.now}
								selected={selection.period}
								onpan={(ratio) => viewport.pan(ratio * spanOf(viewport.target), WHEEL_DURATION_MS)}
								onselectperiod={(period) => {
									workbench.selectPeriod(period);
									togglePanel('context', true);
								}}
							/>
						{/if}
					</div>
					<TimelineSurface
						{workbench}
						{viewport}
						{rowHeightPx}
						{phone}
						{scopeContent}
						{interaction}
						linksShown={contextOpen}
						minHeightPx={minCanvasHeight}
						bind:element={lanes}
						onscrollrows={(delta) => scroller?.scrollBy(0, delta)}
						onempty={closeContext}
					/>

					{#if projection.parked.length && !phone && !interaction}
						<Parked
							traces={projection.parked}
							selectedTraceId={selection.traceId}
							railOpen={!compact && railOpen}
							onselect={(traceId) => {
								workbench.selectTrace(traceId, 'parked');
								togglePanel('context', true);
							}}
						/>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	{#if contextOpen && !phone}
		<aside
			class={['context-panel relative flex min-h-0 flex-col bg-canvas', compact && 'mobile-panel']}
			id="time-context"
			aria-label="Context"
			style:width={compact
				? Math.min(appearance.device.contextWidth, width * 0.9) + 'px'
				: undefined}
		>
			{#if !compact}<PanelResize
					label={t('panel.contextWidth')}
					controls="time-context"
					value={widths.context}
					min={240}
					max={600}
					side="left"
					onpreview={(value) => resize('contextWidth', value)}
					oncommit={commitResize}
					oncancel={() => appearance.cancel()}
				/>{/if}

			{#if preview}{@render preview.context(false)}{:else}<div
					class="contents"
					{@attach adoptContext(contextKeeper, contextParking)}
				></div>{/if}
		</aside>
	{/if}
	{#if phone}
		<MobilePanels
			contextContent={preview?.context}
			contextHost={adoptContext(contextKeeper, contextParking)}
			oncontextclose={preview
				? () => {
						preview.oncontextclose?.();
						mobilePanel = null;
					}
				: closeContext}
			{workbench}
			{scopeContent}
			{controls}
			bind:panel={mobilePanel}
			bind:position={() => contextPosition, setContextPosition}
			bind:sheetHeight
		/>
	{/if}
	<div hidden bind:this={contextParking}>
		{#if contextAlive}
			<div class="contents" bind:this={contextKeeper}>
				<Context
					{workbench}
					sections={!phone && !compact}
					onclose={closeContext}
					onexpand={phone
						? () =>
								setContextPosition(
									contextPosition === 'peek' ? 'half' : contextPosition === 'half' ? 'full' : 'half'
								)
						: undefined}
				/>
			</div>
		{/if}
	</div>
	<UndoToast undo={workbench.undo} />
</div>
