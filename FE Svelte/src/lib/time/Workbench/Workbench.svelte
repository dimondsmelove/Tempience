<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import './Workbench.css';
	import { onMount, untrack } from 'svelte';
	import { workbench } from '$lib/state/Workbench/instance.svelte';
	import { scenarioImportRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { DEMO_DATA_SPACE_ID } from '$lib/state/triplit/data-space';
	import { inbound } from '$lib/state/Workbench/inbound.svelte';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { inboundFeed } from '$lib/state/triplit/inbound-sync-instance';
	import { consumeOpenAt } from '$lib/state/Workbench/open-at';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import { MIN_ROWS_HEIGHT_PX } from '$lib/model/Layout/constants';
	import { UNSCOPED_ROW_ID, UNSCOPED_ROW_KEY } from '$lib/model/Projection/constants';
	import { rowOfScope } from '$lib/model/Projection/rows';
	import { notedPeriods } from '$lib/model/PeriodContext/PeriodContext';
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
	import Legend from '$lib/time/Legend/Legend.svelte';
	import type { Panel } from '$lib/time/Toolbar/types';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { panelWidths } from '$lib/theme/resolve-appearance';
	import Context from '$lib/context/Context/Context.svelte';
	import UndoToast from '$lib/shell/UndoToast/UndoToast.svelte';
	import ArrangementToast from '$lib/time/ArrangementToast/ArrangementToast.svelte';
	import PanelResize from '$lib/ui/PanelResize/PanelResize.svelte';
	import { COMPACT_WIDTH_PX, PHONE_WIDTH_PX } from './constants';
	import MobilePanels from './MobilePanels.svelte';
	import { adoptContext } from './context-host';
	import { provideTimeInputHost } from '$lib/ui/TimeInput/host.svelte';
	import { provideLens } from '$lib/ui/LensSource';
	import { overlayScrollbar } from '$lib/ui/Scrollbar';
	import type { SheetPosition } from '$lib/ui/BottomSheet/types';

	let { preview }: { preview?: WorkbenchPreview } = $props();
	/** Import and Apply belong to the calibration scenarios; the demo is a scenario without them. */
	const calibrationSpace =
		activeDataSpace.kind === 'scenario' && activeDataSpace.id !== DEMO_DATA_SPACE_ID;
	const timeInput = provideTimeInputHost();
	// Every reference under the workbench — in the Context, the filters, the forms — lights the ribbon (loop 008, C3).
	provideLens(workbench.hover);
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
	/** Input is under way in the Context: a read from another device waits, with «Обновить» offered instead. */
	const inputUnderWay = (): boolean => workbench.inputOpen || draftGuard.dirty;
	onMount(() => {
		workbench.viewport.motionEnabled = true;
		if (preview) {
			mobilePanel = 'context';
			sheetPosition = 'full';
		}
		workbench.restoreProposals(localStorage);
		void workbench.load(loadWorkbenchSnapshot).then(() => {
			// A seed or an import asked, once, to open on a record: the Context and the ribbon go there.
			if (!preview && workbench.status === 'ready') consumeOpenAt(workbench, localStorage);
		});
		// Changes from other devices reach the ribbon for as long as the workbench is shown.
		const stopInbound = preview
			? () => {}
			: inbound.follow(inboundFeed, {
					workbench,
					loader: loadWorkbenchSnapshot,
					deferred: inputUnderWay
				});
		return () => {
			stopInbound();
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
	/** The lens veil's strength on this device (loop 008, B), 0–1. */
	const veil = $derived(appearance.device.lens / 100);
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
	/**
	 * The X, Escape, the empty canvas and the sheet: the form ends after its guard, the
	 * selection steps aside with the panel (pack 4, D), then the panel closes.
	 */
	const closeContext = (): void => {
		draftGuard.exit(() => {
			timeInput.editor?.close();
			workbench.closeContext();
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
	/** The legend strip is a view setting of this device, kept with the panels (PERSONALIZATION.md). */
	const legendOpen = $derived(appearance.device.legendOpen);
	const toggleLegend = (): void =>
		appearance.applyDevice({
			...appearance.savedDevice,
			legendOpen: !appearance.savedDevice.legendOpen
		});
	const resize = (panel: 'railWidth' | 'contextWidth', value: number) =>
		appearance.previewDevice({ ...appearance.savedDevice, [panel]: value });
	const commitResize = () => appearance.applyDevice({ ...appearance.device });

	const projection = $derived(workbench.projection);
	const selection = $derived(workbench.selection);
	/** The periods with a note, for the axis bars: one matcher per snapshot, not one per cell. */
	const hasNote = $derived(notedPeriods(workbench.view.periods));
	/** Every Scope by id, and «Без Scope» under its row id: what names a lane and its composition (Q1-A). */
	const scopesById: ReadonlyMap<string, Readonly<{ name: string }>> = $derived(
		new Map<string, Readonly<{ name: string }>>([
			...workbench.view.scopes.map((scope) => [scope.id, scope] as const),
			[UNSCOPED_ROW_ID, { name: t(UNSCOPED_ROW_KEY) }]
		])
	);

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
	// A read owed to another device's change follows by itself once the input it waited for ends.
	$effect(() => {
		if (!inbound.pending || inputUnderWay()) return;
		untrack(() => inbound.schedule());
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
	/**
	 * Scrolls the selected row to the middle of the lanes. A selection leaves a row already
	 * in view where it is; «К выбранному» centres it regardless, as far as the scroller
	 * allows (the last rows can only be brought into view).
	 */
	const scrollSelectedRow = (centre: boolean): void => {
		const traceId = selection.traceId;
		if (!scroller || !lanes || (!traceId && !selection.scopeId && !selection.rowId)) return;
		// A Scope's row, or the merged row whose lane holds it (п. 7); a merged row itself (C5); a record's first row — merged or not.
		const rowId = selection.scopeId
			? rowOfScope(projection.rows, selection.scopeId)?.id
			: (selection.rowId ?? (traceId ? projection.marksByTraceId.get(traceId)?.[0]?.rowId : null));
		const index = projection.rows.findIndex((row) => row.id === rowId);
		if (index < 0) return;
		const rowHeight = rowHeightPx;
		const lanesTop =
			lanes.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
		const rowTop = lanesTop + index * rowHeight;
		const covered = occludedHeight;
		const visibleTop = scroller.scrollTop + lanesTop;
		const visibleBottom = scroller.scrollTop + scroller.clientHeight - covered;
		if (visibleBottom <= visibleTop) return;
		if (!centre && rowTop >= visibleTop && rowTop + rowHeight <= visibleBottom) return;
		scroller.scrollTo({
			top: Math.max(
				0,
				rowTop - lanesTop - (scroller.clientHeight - covered - lanesTop - rowHeight) / 2
			),
			behavior: 'smooth'
		});
	};
	/** A selection made off the canvas also scrolls its row into view. */
	$effect(() => {
		void selection.revision;
		void mobilePanel;
		void scroller;
		void lanes;
		if (selection.source === 'canvas') return;
		// Resizing Context must not restart smooth scrolling behind the touch gesture.
		untrack(() => scrollSelectedRow(false));
	});
	// «К выбранному»: the row goes to the middle too, not only the time.
	$effect(() => {
		if (!workbench.revealRequest) return;
		untrack(() => scrollSelectedRow(true));
	});

	/** The Time surface: the rail, the ribbon, the legend and the toolbar; Ctrl+Z here takes the last change of the rows back. */
	let timeSection = $state<HTMLElement | null>(null);
	const onkeydown = (event: KeyboardEvent): void => {
		if (interaction) return;
		const target = event.target as HTMLElement | null;
		if (
			(event.ctrlKey || event.metaKey) &&
			!event.altKey &&
			!event.shiftKey &&
			(event.code === 'KeyZ' || event.key.toLowerCase() === 'z')
		) {
			// Q4-A: undo of the rows' arrangement while the surface has the focus; an editor's undo is its own.
			if (target?.closest('input, textarea, select, dialog, [contenteditable]')) return;
			if (target && target !== document.body && !timeSection?.contains(target)) return;
			if (workbench.arrangement.undo()) event.preventDefault();
			return;
		}
		if (
			target?.closest(
				'input, textarea, select, button, dialog, [role="separator"], [contenteditable]'
			)
		)
			return;
		if (event.key === 'Escape') {
			// An open popover (the colour flower, a menu) owns Escape: the browser closes it, nothing else steps back.
			if (document.querySelector(':popover-open')) return;
			// One step back per press: overlay panel, then «Записать», then the selection (C9a-1).
			if (mobilePanel === 'context') closeContext();
			else if (mobilePanel) mobilePanel = null;
			else if (workbench.capture) workbench.cancelCapture();
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
			{legendOpen}
			ontogglepanel={togglePanel}
			ontogglelegend={toggleLegend}
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
			scenarioSpace={calibrationSpace}
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
		filters={workbench.filters}
		disclosure={workbench.rows}
		arrangement={workbench.arrangement}
		{scopesById}
		selectedRowId={selection.scopeId ?? selection.rowId}
		litRowIds={workbench.lit.rowIds}
		lensRowIds={workbench.hover.target ? workbench.lens.rowIds : null}
		{veil}
		pulseRowIds={workbench.pulseSet.rowIds}
		onhoverrow={(rowId) => (rowId ? workbench.hover.row(rowId) : workbench.hover.clear())}
		onselectscope={(scopeId) => workbench.selectScope(scopeId)}
		onselectrow={(rowId, members) => workbench.selectRow(rowId, members)}
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
	data-focus={workbench.focusKind}
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
		class="relative flex min-h-0 min-w-0 flex-col border-r border-outline"
		aria-label="Time"
		inert={timeCovered}
		aria-hidden={timeCovered}
		bind:this={timeSection}
	>
		{#if !phone}{@render controls(false)}{/if}
		<!-- The legend on the ribbon (research п. 17): under the toolbar, above the lanes, as the mock's
		     key strip; the phone shows it in the «Фильтры» sheet instead. -->
		{#if !phone && !interaction && !workbench.forms.data}
			<Legend
				id="time-legend"
				filters={workbench.filters}
				present={projection.legendKeys}
				hidden={!legendOpen}
			/>
		{/if}

		<!-- The timeline scrolls as one; a Kind's table and the rail beside it scroll each on
		     its own. The gutter is reserved, so a row more or less never changes the width. -->
		<div
			class={[
				'time-scroller min-h-0 flex-1',
				workbench.forms.data && !interaction ? 'overflow-hidden' : 'overflow-auto'
			]}
			bind:this={scroller}
			bind:clientHeight={scrollerHeight}
			style:padding-bottom="{occludedHeight}px"
			{@attach overlayScrollbar}
		>
			{#if workbench.forms.data && !interaction}
				<div
					class="kinds-layout grid h-full min-h-0"
					style:grid-template-columns={(!compact && railOpen ? widths.rail : 0) +
						'px minmax(0, 1fr)'}
				>
					{#if railOpen && !phone}
						<aside
							class={[
								'scope-rail min-h-0 overflow-auto border-r border-outline bg-canvas',
								compact && 'mobile-panel'
							]}
							id="time-scope"
							aria-label="Scope"
							{@attach overlayScrollbar}
						>
							{@render scopeContent(false)}
						</aside>
					{/if}
					<div
						class="col-start-2 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto"
						{@attach overlayScrollbar}
					>
						<DataSurface {workbench} />
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
						class="sticky top-0 z-10 col-start-2 row-start-1 flex flex-col justify-between overflow-hidden border-b border-outline bg-surface"
						bind:clientHeight={axisHeaderHeight}
					>
						{#if interaction}{@render interaction.header()}{:else}
							<Overview
								{phone}
								canReveal={Boolean(workbench.selectedRange)}
								onreveal={() => workbench.goToSelected()}
								{viewport}
								extent={projection.extent}
								rows={projection.rows}
								dimmed={workbench.dimmed}
								inWindow={workbench.inWindow}
							/>
							<Axis
								window={viewport.window}
								now={viewport.now}
								selected={selection.period}
								{hasNote}
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
						{veil}
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
		{#if !phone}<ArrangementToast arrangement={workbench.arrangement} {scopesById} />{/if}
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
