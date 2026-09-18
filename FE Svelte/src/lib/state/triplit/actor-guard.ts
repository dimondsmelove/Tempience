import type { LogActor } from './types';

const MUTATION = /^(create|edit|set|link|bump|migrate|correct|ensure|save|undo)/;

export const AI_WRITE_MESSAGE =
	'AI не пишет в ядро напрямую: записи идут через предложения на проверке.';

/**
 * DP25: a mutating repository call with `actor: 'ai'` is refused. Machine
 * output reaches a DataSpace only as proposals applied by the user through
 * scenario-import, which writes in its own transaction.
 */
export const guardAiWrites = <T extends object>(repository: T): T =>
	new Proxy(repository, {
		get(target, prop, receiver) {
			const value: unknown = Reflect.get(target, prop, receiver);
			if (typeof value !== 'function' || typeof prop !== 'string' || !MUTATION.test(prop))
				return value;
			return (...args: unknown[]) => {
				if (args[args.length - 1] === ('ai' satisfies LogActor)) throw new Error(AI_WRITE_MESSAGE);
				return Reflect.apply(value, target, args);
			};
		}
	});
