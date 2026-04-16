# http-request-tool Specification

## Purpose
TBD - created by archiving change optimize-tool-experience. Update Purpose after archive.
## Requirements
### Requirement: Request composer
The HTTP tool SHALL provide a primary request composer with method, URL, and send action visible at the top of the tool.

#### Scenario: User sends a valid request
- **WHEN** the user enters a valid HTTP or HTTPS URL and clicks Send
- **THEN** the system invokes the local Tauri HTTP request command with the selected method, URL, headers, and body

### Requirement: Query params editor
The HTTP tool SHALL provide a key-value Params editor whose enabled rows are reflected in the request URL query string.

#### Scenario: User adds a query param
- **WHEN** the user adds an enabled Params row with key `q` and value `swiftbox`
- **THEN** the request URL includes `q=swiftbox` when sent

### Requirement: Headers input modes
The HTTP tool SHALL support Headers input as key-value table, JSON object, and raw `key: value` lines.

#### Scenario: User switches Headers to JSON mode
- **WHEN** the user enters a valid JSON object in Headers JSON mode
- **THEN** the system converts it to request headers before sending

### Requirement: Body input modes
The HTTP tool SHALL support Body input as JSON, key-value form, raw text, and x-www-form-urlencoded where enabled.

#### Scenario: User sends JSON body
- **WHEN** the user enters valid JSON in Body JSON mode and sends a POST request
- **THEN** the request body is sent as normalized JSON text

### Requirement: cURL import and execution
The HTTP tool SHALL parse common cURL commands into method, URL, headers, and body, and SHALL allow executing the parsed request.

#### Scenario: User runs a pasted cURL command
- **WHEN** the user pastes a supported cURL command and chooses to execute it
- **THEN** the tool parses the command and sends the equivalent HTTP request

### Requirement: Response viewer
The HTTP tool SHALL display response Body, Headers, and Info with status code, elapsed time, and response size.

#### Scenario: Request succeeds
- **WHEN** an HTTP request returns a response
- **THEN** the tool displays status, elapsed time, response headers count, response size, and formatted response body when JSON

### Requirement: HTTP validation
The HTTP tool SHALL block sending and show readable errors for invalid URL, invalid Headers JSON, invalid Body JSON, and malformed raw headers.

#### Scenario: Headers JSON is invalid
- **WHEN** the user enters invalid JSON in Headers JSON mode
- **THEN** the Send action is disabled and an inline error explains the Headers JSON problem

