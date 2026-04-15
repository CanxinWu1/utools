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
