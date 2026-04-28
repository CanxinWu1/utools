## Context

SwiftBox currently models role navigation with `roleFilters` and uses the selected role to filter the shared tool grid. This keeps the app simple, but it makes frontend, backend, QA, product, design, operations, and office entries feel like labels instead of purpose-built workspaces.

The product direction is to keep "All tools" as the default entry while making each role a focused acceleration layer. Search, favorites, and global recents remain the fastest cross-tool access paths; role workspaces add curated quick actions and grouped recommendations without hiding the rest of the catalog.

## Goals / Non-Goals

**Goals:**
- Keep "All tools" as the default home view and the safe first-run experience.
- Represent role workspace metadata in a maintainable structure close to the existing tool registry.
- Show each role workspace with quick actions, recommended tools, grouped tool sections, and role-relevant recent tools.
- Preserve global favorites, search, and recent behavior across all roles.
- Keep the UI compact and desktop-productivity focused.

**Non-Goals:**
- Do not introduce a plugin system.
- Do not build a full workflow editor or multi-step automation engine.
- Do not add cloud sync, accounts, or cross-device persistence.
- Do not persist sensitive tool input.
- Do not change Tauri commands or backend behavior.

## Decisions

### Decision: Keep "All tools" as default

"All tools" remains the initial active navigation entry. This preserves the current onboarding shape and avoids asking new users to choose a role before they understand the catalog.

Alternative considered: default to the last selected role. This would feel faster for returning users, but it risks hiding the full catalog and making first-run behavior depend on previous state. Remembering the last role can be explored later as a preference, but it is not required for this change.

### Decision: Add role workspace metadata beside the tool registry

Role workspace content should be declared in TypeScript data rather than embedded directly in `App.tsx`. The metadata can reference existing tool IDs for recommended tools and grouped sections, and can define quick actions as lightweight entries that open an existing tool, optionally with a named intent for future prefill behavior.

Alternative considered: derive all workspace content automatically from each tool's `roles`. This keeps maintenance low, but it cannot express role-specific priorities or task language such as "Paste cURL" or "Decode JWT".

### Decision: Quick actions open tools before they automate work

Quick actions should initially behave as role-specific shortcuts into existing tools. They may carry an action label and optional target tool ID, but they should not require cross-tool state transfer or workflow execution in this phase.

Alternative considered: build a generic action execution system now. That would unlock richer flows, but it would expand scope beyond the current product decision and could make the lightweight desktop experience feel heavy.

### Decision: Use role workspaces as an acceleration layer, not a gated mode

Search should continue to search all tools by default, favorites should remain global, and users should always have a route back to the full catalog. Role workspaces should promote relevant tools without making unrelated tools feel unavailable.

Alternative considered: constrain each role view to only role-matching tools. This is simpler, but it turns roles back into filters and conflicts with the goal of making roles feel like work surfaces.

## Risks / Trade-offs

- Role metadata can drift from the tool registry -> Keep workspace entries based on tool IDs and handle missing tools gracefully.
- Too many quick actions can clutter the role page -> Start with a small curated set per role and prefer task language over exhaustive shortcuts.
- Role pages may duplicate "All tools" content -> Separate role-specific quick actions and grouped sections from the global favorites/recent areas.
- Users may expect quick actions to perform full automation -> Use labels and behavior that make them feel like shortcuts into tools, not workflow execution.
- The home page can become visually dense -> Keep sections compact and reuse existing visual hierarchy instead of adding marketing-style panels.

## Migration Plan

1. Add role workspace data structures and metadata.
2. Update the home view so "All tools" remains the default catalog view.
3. Render role workspace sections when a specific role is selected.
4. Connect quick actions and role tool entries to the existing `openTool` path so recents continue to update.
5. Verify search, favorites, recents, role selection, and tool opening still behave consistently.

Rollback is straightforward: remove the role workspace rendering and return role navigation to the existing filtered grid behavior.

## Open Questions

- Should the app remember the last selected role after this change, or keep every launch on "All tools"?
- Which quick actions should be included for each role in the first release?
- Should role-relevant recents be filtered from global recents or shown as a dedicated subset alongside global recents?
