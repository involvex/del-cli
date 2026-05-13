# Plan: Implement -k flag to force stop processes locking files

Implement a new flag `-k` (or `--kill`) to `del-cli` that identifies and stops processes locking the files or folders being deleted.

## Proposed Changes

### 1. Dependencies

- Move `execa` from `devDependencies` to `dependencies` in `package.json`.
- Add `os` and `path` (built-in) to `cli.js`.

### 2. CLI Flag

- Update the `meow` configuration in `cli.js` to include the `kill` flag (short: `k`).
- Update the help text to describe the new flag.

### 3. Killing Logic

- Implement `killLockingProcesses(files, verbose)` in `cli.js`:
  - Convert file paths to absolute paths.
  - On Unix (macOS/Linux):
    - Use `lsof -t` to find PIDs of processes locking the files.
  - On Windows:
    - Use a PowerShell command to find PIDs of processes that have the files loaded as modules (best effort without external tools).
  - Kill the identified processes using `process.kill(pid, 'SIGKILL')`.
- Integrate this logic into the main execution flow:
  - If `--kill` is specified:
    - Perform a `dryRun` with `deleteAsync` to get the list of files that would be deleted.
    - Call `killLockingProcesses` with those files.
  - Proceed with the actual `deleteAsync` call.

### 4. Verification & Testing

- Add a test case in `test.js` that:
  - Creates a file.
  - (Optionally) locks it (simulated by a child process).
  - Runs `del-cli -k` and verifies the file is deleted.
- Run `npm test` and ensure all tests pass.
- Run `npx eslint .` and `npx prettier . --check` as per project rules.

## Detailed Implementation Steps

### Step 1: Update package.json

- Move `execa` to `dependencies`.

### Step 2: Update cli.js

- Add imports: `import os from 'node:os';`, `import path from 'node:path';`, `import {execa} from 'execa';`.
- Update `meow` flags and help text.
- Add `getLockingPids(filePath)` helper.
- Add `killLockingProcesses(files, verbose)` helper.
- Update the main logic to call `killLockingProcesses` if the `kill` flag is set.

### Step 3: Update test.js

- Add a new test case for the `--kill` flag.

## Alternatives Considered

- **Using `fkill`**: More robust but adds another dependency. Might be better if the current approach is too simplistic.
- **Using `fuser` on Linux**: Good alternative to `lsof`, but `lsof` is more common on macOS.
- **Advanced Windows Lock Detection**: Using `Restart Manager` API via a large PowerShell script. It's more accurate but significantly more complex to maintain in this codebase.
