## MODIFIED Requirements

### Requirement: Favorites and recents prominence
The application SHALL display favorite and recent tools prominently before the full tool list on the all-tools home view, and SHALL keep favorites and recent access available when a role workspace is active.

#### Scenario: User has favorite tools
- **WHEN** the user views the all-tools navigation page
- **THEN** favorite tools are shown in a prominent section before all tools

#### Scenario: User views a role workspace
- **WHEN** the user selects a non-all role
- **THEN** favorite or recent access remains available without replacing the role-specific workspace content

### Requirement: Role navigation opens workspaces
The application SHALL keep the all-tools navigation entry as the default home view and SHALL open role-specific workspaces when users select non-all role entries.

#### Scenario: User opens the application
- **WHEN** the application starts with no active tool page selected
- **THEN** the all-tools navigation view is active by default

#### Scenario: User selects a role entry
- **WHEN** the user selects a non-all role entry from navigation
- **THEN** the application displays the workspace for that role

#### Scenario: User selects all tools
- **WHEN** the user selects the all-tools navigation entry
- **THEN** the application displays the full tool navigation view
