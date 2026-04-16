## ADDED Requirements

### Requirement: JSON transformation workspace
The JSON tool SHALL support format, minify, sort keys, escape, unescape, structure statistics, and copy actions.

#### Scenario: User enters valid JSON
- **WHEN** the user enters valid JSON
- **THEN** the tool shows formatted output, minified output, sorted-key output, and structure statistics

### Requirement: JSON error guidance
The JSON tool SHALL show user-readable parse errors and MUST NOT mark invalid JSON as valid.

#### Scenario: User enters invalid JSON
- **WHEN** the user enters malformed JSON
- **THEN** the tool displays the parse error and disables invalid output copy actions

### Requirement: URL parsing and rebuilding
The URL tool SHALL parse protocol, host, path, query params, and hash, and rebuild the URL when query params are edited.

#### Scenario: User edits a query param
- **WHEN** the user changes a query param value in the URL tool
- **THEN** the rebuilt URL reflects the new query value

### Requirement: Base64 modes
The Base64 tool SHALL support text Base64, URL-safe Base64, and file mode without persisting source content.

#### Scenario: User decodes URL-safe Base64
- **WHEN** the user selects URL-safe mode and enters valid URL-safe Base64
- **THEN** the tool displays the decoded UTF-8 text or a readable decode error

### Requirement: CSV and JSON conversion
The CSV / JSON tool SHALL support CSV preview, delimiter selection, CSV-to-JSON, JSON-to-CSV, and copyable output.

#### Scenario: User converts CSV to JSON
- **WHEN** the user enters CSV with a header row and chooses CSV-to-JSON
- **THEN** the tool outputs a JSON array using the header names as object keys

### Requirement: Time and unit utilities
Timestamp and CSS unit tools SHALL provide common presets, live conversion, and one-click copy of generated output.

#### Scenario: User enters a Unix timestamp
- **WHEN** the user enters a valid Unix timestamp
- **THEN** the timestamp tool displays local time, UTC time, ISO time, seconds, and milliseconds
