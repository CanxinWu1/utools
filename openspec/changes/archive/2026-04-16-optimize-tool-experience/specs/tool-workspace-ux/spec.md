## ADDED Requirements

### Requirement: Unified tool workspace shell
The system SHALL provide a consistent workspace shell for every tool, including title, short description, optional status, primary input area, result area, and action area.

#### Scenario: User opens any tool
- **WHEN** the user opens any registered tool
- **THEN** the tool displays a consistent title, description, input section, result section, and action area

### Requirement: Common result actions
The system SHALL provide common result actions for copy, clear, sample input, and output-to-input refill when the tool supports those actions.

#### Scenario: User copies a result
- **WHEN** a tool has a generated result and the user clicks its copy action
- **THEN** the system copies the current primary result to the clipboard

### Requirement: Inline validation feedback
The system SHALL show validation errors near the relevant input and MUST prevent destructive or invalid execution when the input cannot be processed.

#### Scenario: Input is invalid
- **WHEN** the user enters invalid content in a tool input
- **THEN** the tool displays an inline error and does not present the invalid result as successful

### Requirement: Responsive tool layout
The system SHALL keep tool inputs, actions, and result text readable without horizontal overflow in narrow windows.

#### Scenario: User resizes the app to a narrow width
- **WHEN** the application width is narrow
- **THEN** multi-column tool layouts collapse to a single column and controls remain reachable

### Requirement: Sensitive input is transient
The system MUST NOT persist sensitive tool input content such as HTTP body, JWT, JSON source, Base64 source, Hash input, or uploaded file content.

#### Scenario: User reloads the app after using a sensitive tool
- **WHEN** the user enters sensitive input and reloads the app
- **THEN** the sensitive input is not restored from persistent storage
