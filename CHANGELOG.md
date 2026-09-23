# Changelog

## 0.1.9 — 2026-09-23

- Typesets LaTeX in questions and answers (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`) with a bundled KaTeX 0.18.7; no network access. Code stays literal, prices such as `$5` stay plain text, and math KaTeX cannot render is shown as its source.
- Enter sends a question and Shift+Enter starts a new line; Cmd/Ctrl+Enter still sends. Input-method composition, key repeat, and blank or in-progress questions no longer submit.
- The composer now explains how to focus a question on a highlighted passage.

## 0.1.8 — 2026-09-23

- Public-ready Zotero PDF reader sidebar with local per-paper conversation history.
- Live Codex model discovery each time the sidebar opens.
- PDF-aware prompts with up to eight question-relevant page images.
- Compact light/dark interface refinements and improved keyboard focus.
