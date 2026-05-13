#!/usr/bin/env node
import {isPresentableError} from 'presentable-error'
import {setTimeout} from 'node:timers/promises'
import readline from 'node:readline/promises'
import process from 'node:process'
import {deleteAsync} from 'del'
import path from 'node:path'
import {execa} from 'execa'
import trash from 'trash'
import os from 'node:os'
import meow from 'meow'

const logEvent = event => {
	if (event.path !== undefined) {
		console.log(event.path)
	}
}

const noop = () => {}

const cli = meow(
	`
	Usage
	  $ del <path|glob> …

	Options
	  --force, -f    Allow deleting the current working directory and outside
	  --dry-run, -d  List what would be deleted instead of deleting (silent if no matches)
	  --verbose, -v  Display the absolute path of files and directories as they are deleted
	  --kill, -k     Force stop processes that are locking the files (requires confirmation)
	  --trash, -t    Move to trash instead of permanent deletion

	Examples
	  $ del unicorn.png rainbow.png
	  $ del "*.png" "!unicorn.png"
	  $ del node_modules -k
`,
	{
		importMeta: import.meta,
		flags: {
			force: {
				type: 'boolean',
				shortFlag: 'f',
			},
			dryRun: {
				type: 'boolean',
				shortFlag: 'd',
			},
			verbose: {
				type: 'boolean',
				shortFlag: 'v',
			},
			kill: {
				type: 'boolean',
				shortFlag: 'k',
			},
			trash: {
				type: 'boolean',
				shortFlag: 't',
			},
		},
	},
)

const getWin32LockingProcesses = async absolutePath => {
	try {
		const {stdout} = await execa('powershell', [
			'-NoProfile',
			'-Command',
			`Get-Process | Where-Object { $_.Modules.FileName -eq "${absolutePath}" } | Select-Object Id, ProcessName | ConvertTo-Json`,
		])

		if (!stdout) {
			return []
		}

		const result = JSON.parse(stdout)
		return Array.isArray(result) ? result : [result]
	} catch {
		return []
	}
}

const getUnixLockingProcesses = async absolutePath => {
	try {
		const {stdout: pids} = await execa('lsof', ['-t', absolutePath])
		if (!pids) {
			return []
		}

		const results = await Promise.all(
			pids
				.split('\n')
				.map(pidString => pidString.trim())
				.filter(Boolean)
				.map(async pidString => {
					const pid = Number.parseInt(pidString, 10)
					if (Number.isNaN(pid)) {
						return null
					}

					try {
						const {stdout: name} = await execa('ps', ['-p', pid, '-o', 'comm='])
						return {Id: pid, ProcessName: name.trim()}
					} catch {
						return {Id: pid, ProcessName: 'unknown'}
					}
				}),
		)

		return results.filter(Boolean)
	} catch {
		return []
	}
}

const getLockingProcesses = async files => {
	const processes = new Map()
	const platform = os.platform()

	const allResults = await Promise.all(
		files.map(async file => {
			const absolutePath = path.resolve(file)
			return platform === 'win32'
				? getWin32LockingProcesses(absolutePath)
				: getUnixLockingProcesses(absolutePath)
		}),
	)

	for (const list of allResults) {
		for (const p of list) {
			processes.set(p.Id, p.ProcessName)
		}
	}

	return [...processes.entries()].map(([pid, name]) => ({pid, name}))
}

const confirmAndKill = async processes => {
	console.log('The following processes are locking the files:')
	for (const p of processes) {
		console.log(`- ${p.name} (PID: ${p.pid})`)
	}

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})

	const answer = await rl.question(
		'Do you want to kill these processes? (y/N) ',
	)
	rl.close()

	if (answer.toLowerCase() === 'y') {
		for (const p of processes) {
			try {
				process.kill(p.pid, 'SIGKILL')
				console.log(`Killed ${p.name} (PID: ${p.pid})`)
			} catch (error) {
				console.error(
					`Failed to kill ${p.name} (PID: ${p.pid}): ${error.message}`,
				)
			}
		}

		// Give the OS some time to release file handles
		await setTimeout(500)

		return true
	}

	return false
}

const handleKillFlag = async (cliInput, flags) => {
	const filesToCheck = await deleteAsync(cliInput, {
		...flags,
		dryRun: true,
	})

	if (filesToCheck.length === 0) {
		return true
	}

	const lockingProcesses = await getLockingProcesses(filesToCheck)
	if (lockingProcesses.length === 0) {
		return true
	}

	const killed = await confirmAndKill(lockingProcesses)
	if (!killed) {
		console.log('Skipping deletion as processes were not killed.')
		return false
	}

	return true
}

const handleTrashFlag = async (cliInput, dryRun, verbose, flags) => {
	const filesToTrash = await deleteAsync(cliInput, {
		...flags,
		dryRun: true,
	})

	if (filesToTrash.length === 0) {
		return
	}

	if (dryRun) {
		console.log(filesToTrash.join('\n'))
		return
	}

	await trash(filesToTrash)

	if (verbose) {
		for (const file of filesToTrash) {
			console.log(file)
		}
	}
}

const run = async () => {
	if (cli.input.length === 0) {
		console.error('Specify at least one path')
		process.exitCode = 1
		return
	}

	try {
		const {verbose, dryRun, kill, trash: isTrash, ...flags} = cli.flags

		if (kill && !dryRun) {
			const shouldContinue = await handleKillFlag(cli.input, flags)
			if (!shouldContinue) {
				return
			}
		}

		if (isTrash) {
			await handleTrashFlag(cli.input, dryRun, verbose, flags)
			return
		}

		// Only use onProgress for verbose mode when not in dry-run
		// In dry-run mode, we print the files at the end instead
		const onProgress = verbose && !dryRun ? logEvent : noop

		const files = await deleteAsync(cli.input, {onProgress, dryRun, ...flags})

		if (dryRun && files.length > 0) {
			console.log(files.join('\n'))
		}
	} catch (error) {
		if (isPresentableError(error)) {
			console.error(error.message)
		} else {
			throw error
		}

		process.exitCode = 1
	}
}

await run()
