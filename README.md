### CSV Search (TypeScript CLI)

Small Node.js CLI to search across one or more CSV files for rows where a specific column contains a keyword. Outputs the matching rows as CSV, including headers.

### Requirements

- Node.js >= 22

### Install & Build

```bash
npm install
npm run build
```

Optional: link the CLI for a global command.

```bash
npm link
# Now available as: csv-search
```

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
