# CODEX PROMPT: Arabic Text Encoding Cleanup in Dashboard and Workforce Modules

## Objective
Identify and fix Arabic text encoding artifacts (mojibake, broken Unicode sequences, or incorrect escaping) in the Performance Dashboard and Workforce/Relief Calculator modules, ensuring all Arabic strings render correctly and are properly localized rather than hardcoded with encoding issues.

## Context
The repo review flagged that "some dashboard and workforce UI text appears to contain encoding artifacts in Arabic text." For a Bahrain-facing product, this is user-visible daily and affects perceived product quality. The fix should result in correctly encoded, properly localized Arabic strings — not removal of Arabic text, unless a specific string is determined to be genuinely unused/dead code.

## Files To Inspect First
- app/ (dashboard and workforce module components and their localization/string files)
- Any i18n/localization config or string constant files referenced by these modules

## Scope
- Search the dashboard and workforce module source files for Arabic-language strings, paying particular attention to: incorrectly escaped Unicode sequences, mojibake patterns (text that looks like garbled Latin-1/UTF-8 mismatches), and any strings containing replacement characters or unexpected byte sequences.
- For each artifact found, determine the intended correct Arabic string (from context, surrounding English equivalents, or other correctly-encoded instances of the same string elsewhere in the codebase) and fix the encoding so the string displays correctly.
- If the codebase has a localization system (i18n keys/files), move corrected strings into that system if they are currently hardcoded inline, following the existing localization pattern used elsewhere in the app. If no such system exists for these modules, fix the encoding in place without introducing a new i18n system (that would be a separate, larger task).
- Produce a short `docs/ARABIC_ENCODING_FIX_REPORT.md` listing each artifact found, its location (file/component), and the fix applied.

## Out Of Scope
- Do not introduce a new internationalization framework or restructure how localization works across the app.
- Do not translate any English strings to Arabic or vice versa — only fix existing Arabic strings that are encoded incorrectly.
- Do not modify Arabic strings that render correctly already.

## Data And Security Notes
- None — this is a UI text correctness task.

## Verification
- Visually inspect the dashboard and workforce screens in the running app (`npm run dev`) with the relevant strings present, confirming Arabic text renders correctly (proper Arabic characters, correct RTL where applicable, no replacement characters or garbled text).
- `npm run typecheck` and `npm run build` pass.

## Acceptance Criteria
- `docs/ARABIC_ENCODING_FIX_REPORT.md` exists listing every artifact found and its fix.
- All previously-broken Arabic strings in the dashboard and workforce modules render correctly in the running app.
- `npm run typecheck` and `npm run build` pass.
