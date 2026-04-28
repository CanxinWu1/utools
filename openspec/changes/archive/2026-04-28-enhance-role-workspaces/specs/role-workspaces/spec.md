## ADDED Requirements

### Requirement: Role workspace view
The application SHALL provide a focused workspace view for each non-all role that includes role-specific quick actions, recommended tools, grouped tool sections, and role-relevant recent tools.

#### Scenario: User selects a role workspace
- **WHEN** the user selects a non-all role from navigation
- **THEN** the application displays a role workspace for that role instead of only displaying the generic tool grid filtered by role

#### Scenario: User views role workspace content
- **WHEN** a role workspace is displayed
- **THEN** the workspace shows quick actions, recommended tools, grouped tool sections, and role-relevant recent tools when configured

### Requirement: Role quick actions
The application SHALL provide role-specific quick actions that open existing tools relevant to common role tasks.

#### Scenario: User activates a quick action
- **WHEN** the user activates a role quick action with a target tool
- **THEN** the target tool opens and recent usage is updated for that tool

#### Scenario: Quick action target is unavailable
- **WHEN** a configured quick action references a missing tool
- **THEN** the application omits or disables that quick action without blocking the rest of the workspace

### Requirement: Role recommendations
The application SHALL provide curated recommended tools and grouped tool sections for each role using existing registered tool IDs.

#### Scenario: User opens a recommended tool
- **WHEN** the user selects a recommended tool from a role workspace
- **THEN** the selected tool opens and recent usage is updated

#### Scenario: Role group contains unavailable tools
- **WHEN** a role group references tool IDs that are not registered
- **THEN** the application displays the available tools in that group without failing the workspace

### Requirement: Global access preservation
Role workspaces MUST preserve access to global search, favorites, and the full tool catalog.

#### Scenario: User searches from a role workspace
- **WHEN** the user enters a search query while a role workspace is active
- **THEN** the search behavior continues to find matching tools across the available catalog

#### Scenario: User returns to all tools
- **WHEN** the user selects the all-tools navigation entry from a role workspace
- **THEN** the application returns to the default all-tools home view

### Requirement: Sensitive input avoidance
Role workspace metadata and quick actions MUST NOT persist sensitive tool input such as request bodies, tokens, uploaded file content, or source text.

#### Scenario: Quick action opens a sensitive tool
- **WHEN** a quick action opens a tool that can process sensitive input
- **THEN** the application opens the tool without restoring sensitive user-entered content from persistent role workspace data
