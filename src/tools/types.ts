import type { ComponentType } from "react";

export type ToolRole = "frontend" | "backend" | "qa" | "product" | "design" | "operations" | "office";

export type ToolCategory =
  | "developer"
  | "request"
  | "encoding"
  | "data"
  | "testing"
  | "writing"
  | "design";

export interface ToolDefinition {
  id: string;
  title: string;
  description: string;
  roles: ToolRole[];
  category: ToolCategory;
  keywords: string[];
  component: ComponentType;
}

export interface RoleDefinition {
  id: "all" | ToolRole;
  title: string;
  hint: string;
}

export interface RoleQuickAction {
  id: string;
  title: string;
  description: string;
  toolId: string;
  intent?: string;
}

export interface RoleToolGroup {
  title: string;
  description: string;
  toolIds: string[];
}

export interface RoleWorkspaceDefinition {
  role: ToolRole;
  eyebrow: string;
  title: string;
  description: string;
  quickActions: RoleQuickAction[];
  recommendedToolIds: string[];
  groups: RoleToolGroup[];
}

export interface ResolvedRoleWorkspace
  extends Omit<RoleWorkspaceDefinition, "quickActions" | "recommendedToolIds" | "groups"> {
  quickActions: Array<RoleQuickAction & { tool: ToolDefinition }>;
  recommendedTools: ToolDefinition[];
  groups: Array<Omit<RoleToolGroup, "toolIds"> & { tools: ToolDefinition[] }>;
}
