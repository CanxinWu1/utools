## Why

SwiftBox already groups tools by role, but role selection currently behaves like a filter rather than a focused work surface. As the tool catalog grows, SwiftBox needs to keep "All tools" as the welcoming default while giving frequent users role-specific shortcuts that feel faster and more intentional.

## What Changes

- Keep "All tools" as the default navigation entry and first-run home experience.
- Upgrade role entries from simple filters into role workspaces for frontend, backend, QA, product, design, operations, and office users.
- Add role workspace content blocks for quick actions, recommended tools, grouped role tools, and role-relevant recent usage.
- Preserve global search, favorites, and cross-role recent tools so role workspaces accelerate access without hiding the broader toolbox.
- Introduce role workspace metadata that can be maintained alongside the existing tool registry.
- Defer plugin systems, full workflow builders, cloud sync, and sensitive-input persistence.

## Capabilities

### New Capabilities
- `role-workspaces`: Role-specific workspace behavior, content structure, and quick-action expectations.

### Modified Capabilities
- `tool-navigation-efficiency`: The default navigation behavior and role navigation behavior will change so "All tools" remains the default entry while role choices open focused workspaces instead of only filtering the same grid.

## Impact

- Affected frontend areas: `src/App.tsx`, `src/tools/registry.ts`, `src/tools/types.ts`, and related app styling in `src/App.css`.
- The change should reuse existing tool definitions, favorites, recents, and workspace shell patterns.
- No new runtime dependencies are expected.
- No changes to Tauri commands, persistent sensitive input behavior, or build tooling are expected.
