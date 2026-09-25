# Changelog

## 0.2.4 — 2026-09-25

- Ask now sits beside the PDF instead of on top of it: opening Ask narrows the reader's document area, so zoomed-in text is never hidden behind the panel, and resizing Ask moves the edge with it. The panel starts below the reader toolbar, so the toolbar stays usable.
- A calmer panel: the composer is just the text box and Ask. The save note, instructions line, key hint, and privacy line moved into Account and settings (the key hint is still announced to screen readers and shown as a tooltip).
- Answers render formatted Markdown, lists, and math while they stream, and the conversation only follows new text when you are already at the bottom.
- Bulleted and numbered lists now render as lists.

## 0.2.3 — 2026-09-24

- Typing in Ask no longer triggers Zotero reader shortcuts. Zotero's reader did not treat Ask's text boxes as text fields, so r or l started Read Aloud, other letters switched tools or highlight colors and were swallowed, Backspace could delete a selected annotation, and Tab jumped out of the panel. Ask now runs in its own document inside the reader, so typing, ⌘A, ⌘C, ⌘V, Backspace, and Tab behave normally, and answer text can be selected and copied.
- Long answers are no longer cut off after 4 minutes. A question now stops only if Codex sends nothing for 5 minutes (30 minutes at most), any text that already arrived is kept, and Codex's own retries are shown.
- The status line shows elapsed time (“Thinking… 12 s”, then “Writing… 40 s”) so a long answer visibly makes progress.
- A question running in one chat no longer blocks the others; Stop applies to the chat on screen.
- Faster answers: the paper text is read when Ask opens rather than when you ask, and follow-up questions only attach page images the chat has not already sent.
- Selecting text in the PDF while Ask is open attaches it to your next question automatically.
- Dragging the panel edge to resize now follows the pointer over the PDF and the panel, always ends on release, keeps both Ask and the PDF usable, and double-click resets the width.

## 0.2.2 — 2026-09-24

- **Ask about selection** now always opens or focuses Ask instead of closing an open panel, and shows the attached passage above the input with its page number and a × to remove it. Previously the passage was attached invisibly and stayed attached until the next question.
- The selected passage is labelled with the page it came from, not the page currently in view.
- The sign-out confirmation no longer names other apps.

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
