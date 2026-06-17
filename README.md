# Agent Tools for Obsidian

Agent Tools is an Obsidian plugin for reviewing AI-generated specs and documents.

## MVP workflow

- Open **AI review** from the ribbon or command palette.
- Review Markdown files from configured folders.
- Add comments, replacement suggestions, and deletion suggestions from selected document text.
- Approve a document or request changes.
- Export review feedback as Markdown for an AI agent.
- Apply replacement/deletion suggestions when the original text anchor still matches.

## Development

1. Install dependencies:

   ```sh
   npm install
   ```

2. Build the plugin:

   ```sh
   npm run build
   ```

3. Link or copy this repository into a development vault:

   ```sh
   mkdir -p /path/to/dev-vault/.obsidian/plugins
   ln -s "$(pwd)" /path/to/dev-vault/.obsidian/plugins/obsidian-agenttools
   ```

4. Reload Obsidian, enable community plugins, then enable **Agent Tools**.

Use a dedicated development vault while testing plugin changes.

## Plugin files

Obsidian loads these files from `.obsidian/plugins/obsidian-agenttools/`:

- `main.js`
- `manifest.json`
- `styles.css`

`manifest.json` changes require an Obsidian restart. TypeScript changes require `npm run build` or `npm run dev`.

## Verification

```sh
npm test
npm run build
```
