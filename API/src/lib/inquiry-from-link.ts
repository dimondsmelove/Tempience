import type { CreateLinkInput } from '@chronograph/shared';

type SuggestedLink = Pick<CreateLinkInput, 'from_uid' | 'to_uid' | 'link_kind' | 'evidence_refs'> & {
	uid: string;
};

export const buildInquiryFromSuggestedLink = (link: SuggestedLink) => {
	const wording =
		link.link_kind === 'replaced_by'
			? 'Связать эти моменты?'
			: 'Подтвердить предложенную связь?';

	const evidence_refs =
		link.evidence_refs && link.evidence_refs.length > 0
			? link.evidence_refs
			: [
					{ kind: 'trace' as const, uid: link.from_uid },
					{ kind: 'trace' as const, uid: link.to_uid }
				];

	return {
		trigger_kind: 'link_suggestion' as const,
		subject_kind: 'link' as const,
		subject_uid: link.uid,
		wording,
		options: ['да', 'отдельно', 'не сейчас'],
		evidence_refs
	};
};
