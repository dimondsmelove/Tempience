import { randomUUID } from 'node:crypto';

export const newUid = (): string => randomUUID();

export const nowIso = (): string => new Date().toISOString();
