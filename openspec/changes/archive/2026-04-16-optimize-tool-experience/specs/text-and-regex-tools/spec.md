## ADDED Requirements

### Requirement: Regex match visualization
The Regex tool SHALL support flags selection, match list, capture groups, replacement preview, and highlighted matches.

#### Scenario: User tests a regex with capture groups
- **WHEN** the regex matches text with capture groups
- **THEN** the tool displays each match index, match value, and captured groups

### Requirement: Regex templates
The Regex tool SHALL provide common regex templates for phone, email, URL, Chinese characters, number, UUID, and IP.

#### Scenario: User selects a template
- **WHEN** the user chooses the email template
- **THEN** the regex pattern is populated with an email matching expression

### Requirement: Text processing actions
The Text tool SHALL provide grouped actions for cleanup, line operations, case conversion, and format conversion.

#### Scenario: User removes duplicate lines
- **WHEN** the user chooses the deduplicate action
- **THEN** the output shows input lines with duplicates removed while preserving the source input

### Requirement: Output refill
The Text tool SHALL allow refilling generated output back into the input only after explicit user action.

#### Scenario: User refills output
- **WHEN** the user clicks refill after a text operation
- **THEN** the output replaces the input text

### Requirement: Markdown preview
The Markdown tool SHALL render a live preview and allow copying generated HTML.

#### Scenario: User writes Markdown
- **WHEN** the user enters Markdown text
- **THEN** the preview updates and the generated HTML can be copied

### Requirement: Diff summary
The Diff tool SHALL compare two text inputs and display added, removed, and changed line counts.

#### Scenario: User compares two texts
- **WHEN** the old and new text differ
- **THEN** the diff output shows line-level changes and summary counts
