### CSV Search (TypeScript CLI)

Small Node.js CLI to search across one or more CSV files for rows where a specific column contains a keyword. Outputs the matching rows as CSV, including headers.

### Requirements

- Node.js >= 22

### Install & Build (monorepo root)

```bash
npm ci --include-workspace-root
npm run -ws build
```

Optional: you can link the CLI globally; see the macOS instructions below.

### Usage

```bash
# Using the compiled file directly
node dist/index.js -c <column> -k <keyword> <file1.csv> [file2.csv ...]

# If linked globally
csv-search -c <column> -k <keyword> <file1.csv> [file2.csv ...]
```

- **-c, --column <name>**: Column header to search (required)
- **-k, --keyword <value>**: Keyword to search for (required)
- **--case-sensitive**: Make the search case-sensitive (default: case-insensitive)
- **-h, --help**: Show help

### Examples

```bash
# Case-insensitive (default)
node dist/index.js -c name -k alice data1.csv data2.csv

# Case-sensitive
node dist/index.js -c name -k Alice --case-sensitive data.csv
```

Example output:

```csv
name,age,city
Alice,30,London
Alice,22,NYC
```

### Notes

- When multiple files are searched, headers in the output are the union of headers encountered (first-seen order).
- Files must include a header row. A warning is printed if the specified column is missing.

### Global link on macOS (no sudo)

Link the CLI globally in a user-writable location so `csv-search` is available on your PATH without sudo.

```bash
# 1) Ensure Node >= 22
nvm install 22 && nvm use 22   # if you use nvm

# 2) Install and build from repo root (monorepo)
npm ci --include-workspace-root
npm run -ws build

# 3) Configure a user-level npm prefix and PATH (one-time)
mkdir -p "$HOME/.npm-global/bin"
npm config set prefix "$HOME/.npm-global"
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.zshrc"
exec zsh -l  # reload PATH in the current shell

# 4) Link the CLI workspace globally
npm -w @csv-utils/cli link

# 5) Verify
which csv-search
csv-search -h
```

Alternative linking methods:

- From the CLI package directory:
  ```bash
  cd apps/cli && npm link
  ```
- Or with an absolute path from repo root:
  ```bash
  npm link "$PWD/apps/cli"
  ```

Troubleshooting:

- If you run `npm link apps/cli` (without a path), npm may misinterpret it as a Git URL. Use a workspace-aware link (`npm -w @csv-utils/cli link`) or an absolute path instead.
- If you see EBADENGINE about Node version, upgrade to Node 22 and rebuild.
