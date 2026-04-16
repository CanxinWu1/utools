## 1. Shared Tool UX Framework

- [x] 1.1 Create `src/tools/ui/` with ToolWorkspace, ToolHeader, ToolPanel, ToolTabs, ResultViewer, CopyButton, StatusBadge, InlineError, EmptyHint, and KeyValueEditor components.
- [x] 1.2 Move generic shared UI behavior from `src/tools/shared.tsx` into the new UI component layer while keeping role tool files as tool logic owners.
- [x] 1.3 Add shared CSS rules for panels, tabs, result viewers, key-value editors, errors, copy feedback, and responsive collapse.
- [x] 1.4 Define sensitive-input persistence guardrails in code comments or helper naming so tool inputs are not added to localStorage accidentally.
- [x] 1.5 Run `pnpm build` and verify existing tools still render.

## 2. HTTP Request Tool

- [x] 2.1 Refactor HTTP into the shared ToolWorkspace shell with a fixed method, URL, and Send composer.
- [x] 2.2 Add Params tab with enabled key-value rows and URL query synchronization.
- [x] 2.3 Refine Headers tabs for table, JSON object, and raw `key: value` modes using shared KeyValueEditor.
- [x] 2.4 Refine Body tabs for JSON, form key-value, raw text, and x-www-form-urlencoded modes.
- [x] 2.5 Improve cURL parsing and import UI for common `-X`, `-H`, `-d`, `--data-*`, and quoted URL patterns.
- [x] 2.6 Add response tabs for Body, Headers, and Info with status, time, size, and copy actions.
- [x] 2.7 Add validation messages for URL, Headers JSON, Body JSON, raw header lines, and cURL parse failures.
- [x] 2.8 Manually verify GET, POST JSON, Params, Headers, and pasted cURL against a public test endpoint.

## 3. P0 Data and Editing Tools

- [x] 3.1 Refactor JSON tool into shared workspace with Format, Minify, Sort Keys, Escape, Unescape, statistics, and copy actions.
- [x] 3.2 Add JSON parse error guidance and block invalid output copy actions.
- [x] 3.3 Refactor URL tool with parsed protocol, host, path, hash, editable query params, rebuilt URL, encode/decode, and query JSON copy.
- [x] 3.4 Refactor Regex tool with flag checkboxes, match list, capture groups, replacement preview, highlighted matches, and templates.
- [x] 3.5 Refactor Text tool with cleanup, line operations, case conversion, format conversion, statistics, and explicit output refill.
- [x] 3.6 Run `pnpm build` and manually verify invalid and valid inputs for each P0 tool.

## 4. P1 Tool Coverage

- [x] 4.1 Refactor JWT tool with Header and Payload tabs, key claims, local time conversion, expiration status, and no-signature-verification notice.
- [x] 4.2 Refactor Base64 tool with Text, URL-safe, and File modes plus readable decode errors.
- [x] 4.3 Refactor CSV / JSON tool with delimiter selection, table preview, JSON-to-CSV field collection, and CSV-to-JSON options.
- [x] 4.4 Refactor QR tool with configurable colors, error correction explanation, preview, and PNG download size options.
- [x] 4.5 Refactor Color, Palette, Contrast, and Image Info tools according to design-and-generator specs.
- [x] 4.6 Run `pnpm build` and manually verify P1 tools in light and dark themes.

## 5. Navigation and Efficiency

- [x] 5.1 Add Enter-to-open-first-result behavior to the search box.
- [x] 5.2 Add Cmd/Ctrl+K search focus and Esc return-to-navigation behavior.
- [x] 5.3 Add a lightweight tool quick switcher on tool pages without requiring return to the home page.
- [x] 5.4 Rework home navigation sections to emphasize favorites, recents, and all tools.
- [x] 5.5 Simplify tool cards to emphasize name, category, keywords, and avoid long text overflow.
- [x] 5.6 Run responsive manual checks at narrow and desktop widths.

## 6. Verification and Release Readiness

- [x] 6.1 Run `pnpm build`.
- [x] 6.2 Run `pnpm tauri dev` and verify the desktop app starts.
- [x] 6.3 Verify global shortcut still shows/hides the window and focuses search.
- [x] 6.4 Confirm sensitive tool input is not persisted across reloads.
- [x] 6.5 Update docs with the final implemented behavior and any deferred items.
