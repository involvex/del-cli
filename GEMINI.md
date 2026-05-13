# Project Context: @involvex/del-cli

Delete files and directories - Cross-platform.

## Project Overview
`del-cli` is a command-line interface for the `del` package, allowing permanent deletion of files and directories using glob patterns. It is designed to be safer than `rimraf` or `rm -rf` by preventing accidental deletion of parent directories unless forced, and by providing a dry-run mode.

### Main Technologies
- **Node.js**: Minimum version >= 18.
- **ES Modules**: The project uses `"type": "module"`.
- **del**: The underlying API for deletion.
- **meow**: CLI argument parsing.
- **ava**: Test runner.
- **xo**: Pluggable ESLint wrapper for code style.
- **prettier**: Code formatting.

## Building and Running
The project does not require a build step as it's a direct Node.js script.

### Key Commands
- **Test**: `npm test` - Runs linting (`xo`) and tests (`ava`).
- **Format**: `npm run format` - Formats the codebase using `prettier`.
- **Run Local**: `node cli.js <glob>` or `./cli.js <glob>` (on Unix-like systems).

## Development Conventions
- **ESM**: Always use modern ES6+ features and `node:` prefixes for built-in modules.
- **Linting**: XO is used for linting. Adhere to the rules enforced by `xo`.
- **Formatting**: Use the shared `@involvex/prettier-config` via `npm run format`.
- **Testing**: New features or bug fixes should be accompanied by tests in `test.js` using `ava` and `execa` for CLI integration testing.
- **Binary**: The CLI is exposed as both `del` and `del-cli`.

## CLI Usage Reference
```
$ del <path|glob> …

Options:
  --force, -f    Allow deleting the current working directory and outside.
  --dry-run, -d  List what would be deleted instead of deleting.
  --verbose, -v  Display the absolute path of files and directories as they are deleted.
```
