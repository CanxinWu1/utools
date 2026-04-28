## 1. Role Workspace Model

- [x] 1.1 Extend tool role types with role workspace metadata for quick actions, recommended tool IDs, and grouped tool sections.
- [x] 1.2 Add workspace definitions for frontend, backend, QA, product, design, operations, and office roles.
- [x] 1.3 Add lookup helpers that resolve workspace tool IDs to registered tools and gracefully ignore missing IDs.

## 2. Navigation Behavior

- [x] 2.1 Keep the all-tools entry as the default active home view.
- [x] 2.2 Update role selection so non-all roles display a role workspace rather than only a filtered generic grid.
- [x] 2.3 Preserve global search behavior so queries can still find tools across the available catalog.

## 3. Role Workspace UI

- [x] 3.1 Render role workspace header content with compact role title and context.
- [x] 3.2 Render role quick actions that open their target tools and update recents.
- [x] 3.3 Render recommended tools and grouped role tool sections using existing tool card or compact button patterns.
- [x] 3.4 Render role-relevant recent tools without removing access to global favorites and recents.

## 4. Styling and Responsiveness

- [x] 4.1 Add responsive styles for role workspace sections at desktop and narrow widths.
- [x] 4.2 Ensure quick actions, group labels, and tool titles do not overflow their containers.
- [x] 4.3 Keep the visual treatment compact and consistent with the existing SwiftBox desktop UI.

## 5. Verification

- [x] 5.1 Run TypeScript and production build checks.
- [x] 5.2 Verify all-tools default view, role workspace navigation, quick action opening, recents updates, favorites visibility, and search behavior manually.
- [x] 5.3 Confirm no sensitive input is persisted by role workspace metadata or quick actions.
