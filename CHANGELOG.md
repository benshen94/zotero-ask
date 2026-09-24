# Changelog

## 0.2.1 — 2026-09-24

- Account and settings panel (gear button) shows whether Codex is signed in, loading, signed out, or unavailable, with **Sign in** (opens the ChatGPT sign-in page in your browser), **Cancel**, and **Sign out of Codex on this Mac…**. Sign-out asks for confirmation because it signs out the Codex CLI shared with Reader and other Codex apps; it is unavailable while a question is running.
- After signing in or out, Ask drops stale Codex threads, restarts its connection, and reloads the model list. Saved conversations are kept. An expired sign-in shows a **Sign in** prompt in the panel.
- The account check can no longer stay on “Checking Codex sign-in…”: it has a deadline, status updates reach every open panel, and failures show a short, redacted reason (Codex’s exit status, the request that timed out, and its last output). The same details go to Zotero’s debug output.
- Zotero Ask loads its scripts without the subscript cache and checks at startup that its core matches, so reinstalling can no longer mix an old core.js with a new bootstrap.js.
- Editable **Response instructions** with Reset, saved as a Zotero preference (up to 10,000 characters) and sent with every question. The fixed read-only and untrusted-document rules stay separate and cannot be edited.

## 0.1.9 — 2026-09-23

- Typesets LaTeX in questions and answers (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`) with a bundled KaTeX 0.18.7; no network access. Code stays literal, prices such as `$5` stay plain text, and math KaTeX cannot render is shown as its source.
- Enter sends a question and Shift+Enter starts a new line; Cmd/Ctrl+Enter still sends. Input-method composition, key repeat, and blank or in-progress questions no longer submit.
- The composer now explains how to focus a question on a highlighted passage.

## 0.1.8 — 2026-09-23

- Public-ready Zotero PDF reader sidebar with local per-paper conversation history.
- Live Codex model discovery each time the sidebar opens.
- PDF-aware prompts with up to eight question-relevant page images.
- Compact light/dark interface refinements and improved keyboard focus.
