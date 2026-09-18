export type ScopeHierarchySnapshotScope = {
	id: string;
};

export type ScopeHierarchySnapshotIntersection = {
	id: string;
	fromId: string;
	toId: string;
	kind: string;
	isDeleted: boolean;
};

export type ScopeHierarchyIntegrityIssue =
	| {
			kind: 'missing_scope';
			intersectionId: string;
			endpoint: 'child' | 'parent';
			scopeId: string;
	  }
	| {
			kind: 'multiple_parents';
			childScopeId: string;
			parentScopeIds: string[];
			intersectionIds: string[];
	  }
	| {
			kind: 'cycle';
			scopeIds: string[];
			intersectionIds: string[];
	  };

export type ScopeHierarchyIntegrityReport = {
	ok: boolean;
	issues: ScopeHierarchyIntegrityIssue[];
};

type ChildOfEdge = ScopeHierarchySnapshotIntersection;

const byId = <Value extends { id: string }>(left: Value, right: Value): number =>
	left.id.localeCompare(right.id);

export const inspectScopeHierarchyIntegrity = (
	scopes: readonly ScopeHierarchySnapshotScope[],
	intersections: readonly ScopeHierarchySnapshotIntersection[]
): ScopeHierarchyIntegrityReport => {
	const scopeIds = new Set(scopes.map((scope) => scope.id));
	const activeEdges = intersections
		.filter((intersection) => intersection.kind === 'child_of' && !intersection.isDeleted)
		.toSorted(byId);
	const issues: ScopeHierarchyIntegrityIssue[] = [];
	const validEdges: ChildOfEdge[] = [];

	for (const edge of activeEdges) {
		let hasMissingEndpoint = false;
		if (!scopeIds.has(edge.fromId)) {
			issues.push({
				kind: 'missing_scope',
				intersectionId: edge.id,
				endpoint: 'child',
				scopeId: edge.fromId
			});
			hasMissingEndpoint = true;
		}
		if (!scopeIds.has(edge.toId)) {
			issues.push({
				kind: 'missing_scope',
				intersectionId: edge.id,
				endpoint: 'parent',
				scopeId: edge.toId
			});
			hasMissingEndpoint = true;
		}
		if (!hasMissingEndpoint) validEdges.push(edge);
	}

	const edgesByChild = new Map<string, ChildOfEdge[]>();
	for (const edge of validEdges) {
		const childEdges = edgesByChild.get(edge.fromId) ?? [];
		childEdges.push(edge);
		edgesByChild.set(edge.fromId, childEdges);
	}
	for (const [childScopeId, childEdges] of [...edgesByChild].toSorted(([left], [right]) =>
		left.localeCompare(right)
	)) {
		const parentScopeIds = [...new Set(childEdges.map((edge) => edge.toId))].toSorted();
		if (parentScopeIds.length <= 1) continue;
		issues.push({
			kind: 'multiple_parents',
			childScopeId,
			parentScopeIds,
			intersectionIds: childEdges.map((edge) => edge.id).toSorted()
		});
	}

	const visitState = new Map<string, 'visiting' | 'visited'>();
	const nodeStack: string[] = [];
	const edgeStack: string[] = [];
	const stackIndexByScopeId = new Map<string, number>();
	const reportedCycles = new Set<string>();

	const visit = (scopeId: string): void => {
		visitState.set(scopeId, 'visiting');
		stackIndexByScopeId.set(scopeId, nodeStack.length);
		nodeStack.push(scopeId);

		for (const edge of (edgesByChild.get(scopeId) ?? []).toSorted(byId)) {
			const parentState = visitState.get(edge.toId);
			if (parentState === undefined) {
				edgeStack.push(edge.id);
				visit(edge.toId);
				edgeStack.pop();
				continue;
			}
			if (parentState !== 'visiting') continue;

			const cycleStart = stackIndexByScopeId.get(edge.toId);
			if (cycleStart === undefined) continue;
			const intersectionIds = [...edgeStack.slice(cycleStart), edge.id];
			const signature = intersectionIds.toSorted().join('\u0000');
			if (reportedCycles.has(signature)) continue;
			reportedCycles.add(signature);
			issues.push({
				kind: 'cycle',
				scopeIds: [...nodeStack.slice(cycleStart), edge.toId],
				intersectionIds
			});
		}

		nodeStack.pop();
		stackIndexByScopeId.delete(scopeId);
		visitState.set(scopeId, 'visited');
	};

	for (const scopeId of [...scopeIds].toSorted()) {
		if (visitState.has(scopeId)) continue;
		visit(scopeId);
	}

	return { ok: issues.length === 0, issues };
};

const describeIssue = (issue: ScopeHierarchyIntegrityIssue): string => {
	if (issue.kind === 'missing_scope') {
		return `child_of ${issue.intersectionId} references missing ${issue.endpoint} Scope ${issue.scopeId}`;
	}
	if (issue.kind === 'multiple_parents') {
		return `Scope ${issue.childScopeId} has multiple structural parents: ${issue.parentScopeIds.join(', ')}`;
	}
	return `cycle ${issue.scopeIds.join(' -> ')}`;
};

export const assertScopeHierarchyIntegrity = (report: ScopeHierarchyIntegrityReport): void => {
	if (report.ok) return;
	throw new Error(
		`Scope hierarchy integrity conflict: ${report.issues.map(describeIssue).join('; ')}`
	);
};
