import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import BackupImport from './BackupImport.svelte';

it('asks for a file before offering to create a database', () => {
	const { body } = render(BackupImport);
	expect(body).toContain('JSON-файл с данными');
	expect(body).toContain('type="file"');
	expect(body).not.toContain('Создать базу из файла');
});
