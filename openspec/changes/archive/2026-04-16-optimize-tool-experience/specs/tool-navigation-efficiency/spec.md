## ADDED Requirements

### Requirement: Search first result activation
The application SHALL allow opening the first matching tool from search using Enter.

#### Scenario: User presses Enter in search
- **WHEN** search has at least one matching tool and the user presses Enter
- **THEN** the first matching tool opens

### Requirement: Tool page quick switching
The application SHALL provide a lightweight way to switch tools without returning to the home page.

#### Scenario: User switches tool from tool page
- **WHEN** the user is on a tool page and selects another tool from the quick switcher
- **THEN** the selected tool opens and recent usage is updated

### Requirement: Favorites and recents prominence
The application SHALL display favorite and recent tools prominently before the full tool list.

#### Scenario: User has favorite tools
- **WHEN** the user views the tool navigation page
- **THEN** favorite tools are shown in a prominent section before all tools

### Requirement: Keyboard shortcuts
The application SHALL support keyboard shortcuts for focusing search, opening search result, returning to navigation, and executing the current tool primary action where available.

#### Scenario: User focuses search
- **WHEN** the user presses Cmd/Ctrl + K
- **THEN** the search input receives focus

### Requirement: Tool card simplification
The application SHALL keep tool cards concise by emphasizing name, category, and keywords over long descriptions.

#### Scenario: User scans all tools
- **WHEN** the user views the tool grid
- **THEN** each card presents the tool name and scannable metadata without long text overflow
