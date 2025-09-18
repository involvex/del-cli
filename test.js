import fs from 'node:fs';
import test from 'ava';
import tempWrite from 'temp-write';
import {execa} from 'execa';

test('main', async t => {
	const filename = tempWrite.sync('foo');
	await execa('./cli.js', ['--force', filename]);
	t.false(fs.existsSync(filename));
});

test('verbose file exists', async t => {
	const filename = tempWrite.sync('foo');
	const {stdout} = await execa('./cli.js', ['--force', '--verbose', filename]);
	t.is(stdout, filename);
});

test('verbose file does not exist', async t => {
	const {stdout} = await execa('./cli.js', ['--verbose', 'does-not-exist.txt']);
	t.is(stdout, '');
});

test('dry-run with files to delete', async t => {
	const filename = tempWrite.sync('foo');
	const {stdout} = await execa('./cli.js', ['--dry-run', '--force', filename]);
	t.is(stdout, filename);
	// File should still exist after dry run
	t.true(fs.existsSync(filename));
});

test('dry-run with no files to delete', async t => {
	const {stdout} = await execa('./cli.js', ['--dry-run', 'does-not-exist-*.txt']);
	t.is(stdout, '');
});

test('verbose + dry-run does not duplicate output', async t => {
	const filename = tempWrite.sync('foo');
	const {stdout} = await execa('./cli.js', ['--verbose', '--dry-run', '--force', filename]);
	// Should only print the filename once, not twice
	t.is(stdout, filename);
});

test('verbose + dry-run with multiple files', async t => {
	const file1 = tempWrite.sync('foo');
	const file2 = tempWrite.sync('bar');
	const {stdout} = await execa('./cli.js', ['--verbose', '--dry-run', '--force', file1, file2]);
	const lines = stdout.split('\n');
	// Should have exactly 2 lines (one per file)
	t.is(lines.length, 2);
	t.true(lines.includes(file1));
	t.true(lines.includes(file2));
});
