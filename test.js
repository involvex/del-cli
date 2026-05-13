import process from 'node:process'
import tempWrite from 'temp-write'
import path from 'node:path'
import {execa} from 'execa'
import os from 'node:os'
import fs from 'node:fs'
import test from 'ava'

test('main', async t => {
	const filename = tempWrite.sync('foo')
	await execa('./cli.js', ['--force', filename])
	t.false(fs.existsSync(filename))
})

test('verbose file exists', async t => {
	const filename = tempWrite.sync('foo')
	const {stdout} = await execa('./cli.js', ['--force', '--verbose', filename])
	t.is(stdout, filename)
})

test('verbose file does not exist', async t => {
	const {stdout} = await execa('./cli.js', ['--verbose', 'does-not-exist.txt'])
	t.is(stdout, '')
})

test('dry-run with files to delete', async t => {
	const filename = tempWrite.sync('foo')
	const {stdout} = await execa('./cli.js', ['--dry-run', '--force', filename])
	t.is(stdout, filename)
	// File should still exist after dry run
	t.true(fs.existsSync(filename))
})

test('dry-run with no files to delete', async t => {
	const {stdout} = await execa('./cli.js', [
		'--dry-run',
		'does-not-exist-*.txt',
	])
	t.is(stdout, '')
})

test('verbose + dry-run does not duplicate output', async t => {
	const filename = tempWrite.sync('foo')
	const {stdout} = await execa('./cli.js', [
		'--verbose',
		'--dry-run',
		'--force',
		filename,
	])
	// Should only print the filename once, not twice
	t.is(stdout, filename)
})

test('verbose + dry-run with multiple files', async t => {
	const file1 = tempWrite.sync('foo')
	const file2 = tempWrite.sync('bar')
	const {stdout} = await execa('./cli.js', [
		'--verbose',
		'--dry-run',
		'--force',
		file1,
		file2,
	])
	const lines = stdout.split('\n')
	// Should have exactly 2 lines (one per file)
	t.is(lines.length, 2)
	t.true(lines.includes(file1))
	t.true(lines.includes(file2))
})

test('handles errors gracefully', async t => {
	// Test with an invalid operation that should throw an error
	const error = await t.throwsAsync(execa('./cli.js', ['--force', '/']), {
		instanceOf: Error,
	})

	// Should exit with code 1
	t.is(error.exitCode, 1)
})

test('handles directory paths with trailing slash', async t => {
	// Create a temp file and get its directory
	const filePath = tempWrite.sync('test')
	const directory = path.dirname(filePath)

	// Create a subdirectory to safely test
	const testDirectory = path.join(directory, 'test-del-dir')
	fs.mkdirSync(testDirectory, {recursive: true})
	fs.writeFileSync(path.join(testDirectory, 'file.txt'), 'test')

	// Test with trailing slash
	const {stdout: stdout1} = await execa('./cli.js', [
		'--dry-run',
		'--force',
		`${testDirectory}/`,
	])
	// Del-cli/del might return normalized path without trailing slash
	t.is(path.normalize(stdout1), path.normalize(testDirectory))

	// Test without trailing slash
	const {stdout: stdout2} = await execa('./cli.js', [
		'--dry-run',
		'--force',
		testDirectory,
	])
	t.is(path.normalize(stdout2), path.normalize(testDirectory))

	// Clean up
	fs.rmSync(testDirectory, {recursive: true, force: true})
})

test('deletes directories with trailing slash', async t => {
	// Create a temp file and get its directory
	const filePath = tempWrite.sync('test')
	const directory = path.dirname(filePath)

	// Create a subdirectory to safely test
	const testDirectory = path.join(directory, 'test-del-dir2')
	fs.mkdirSync(testDirectory, {recursive: true})
	fs.writeFileSync(path.join(testDirectory, 'file.txt'), 'test')

	// Delete with trailing slash
	await execa('./cli.js', ['--force', `${testDirectory}/`])

	// Directory should no longer exist
	t.false(fs.existsSync(testDirectory))
})

test('kill flag stops locking processes', async t => {
	// Create a temp file by copying the current node executable
	// This ensures it's a valid "module" on Windows and an open file on Unix
	const temporaryDir = path.join(os.tmpdir(), `del-cli-test-${Date.now()}`)
	fs.mkdirSync(temporaryDir, {recursive: true})
	const temporaryExecutable = path.join(
		temporaryDir,
		os.platform() === 'win32' ? 'locking.exe' : 'locking',
	)
	fs.copyFileSync(process.execPath, temporaryExecutable)

	// Run the executable in the background
	const child = execa(
		temporaryExecutable,
		['-e', 'setTimeout(() => {}, 10000)'],
		{
			cleanup: true,
		},
	)

	// Give it a moment to start and lock the file
	await new Promise(resolve => {
		setTimeout(resolve, 2000)
	})

	try {
		// Attempt to delete with the kill flag
		// We use 'y\n' as input to confirm the kill
		const {stdout} = await execa(
			'./cli.js',
			['--force', '--kill', temporaryExecutable],
			{
				input: 'y\n',
			},
		)

		t.true(stdout.includes('Killed'))
		t.false(fs.existsSync(temporaryExecutable))
	} finally {
		// Ensure the child is killed if the test fails
		child.kill('SIGKILL')
		try {
			await child
		} catch {}

		fs.rmSync(temporaryDir, {recursive: true, force: true})
	}
})

test('trash flag moves file to trash', async t => {
	const filename = tempWrite.sync('foo')
	await execa('./cli.js', ['--trash', '--force', filename])
	t.false(fs.existsSync(filename))
})

test('trash flag with dry-run', async t => {
	const filename = tempWrite.sync('foo')
	const {stdout} = await execa('./cli.js', [
		'--trash',
		'--dry-run',
		'--force',
		filename,
	])
	t.is(stdout, filename)
	t.true(fs.existsSync(filename))
})
