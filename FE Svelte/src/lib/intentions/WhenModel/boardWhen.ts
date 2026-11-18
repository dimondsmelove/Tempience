import type { TempienceRepository } from '$lib/state/triplit/repository';
import type { WhenChoice, WhenContext } from './types';
import { moveWhen } from './moveWhen';

export const boardWhenContext = Symbol('boardWhen');
export type BoardWhenContext = {
	context: () => WhenContext;
	pick: (id: string, choice: WhenChoice) => void;
};

export async function applyBoardWhen(
	repository: TempienceRepository,
	id: string,
	choice: WhenChoice,
	context: WhenContext,
	callbacks: {
		failure: (reason: string) => void;
		success: (operationId?: string) => Promise<void>;
		error: (cause: unknown) => void;
	}
): Promise<void> {
	try {
		const result = await moveWhen(repository, id, choice, context);
		if (!result.ok) {
			callbacks.failure(result.reason);
			return;
		}
		await callbacks.success(result.operationId);
	} catch (cause) {
		callbacks.error(cause);
	}
}
