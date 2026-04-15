import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import "./App.css";
import { usePreferences } from "./state/preferences";
import { roleFilters, tools } from "./tools/registry";
import type { ToolDefinition } from "./tools/types";

const HOTKEY_LABEL = "Cmd/Ctrl + Shift + Space";

function matchesTool(tool: ToolDefinition, query: string) {
  const haystack = [tool.title, tool.description, tool.category, ...tool.roles, ...tool.keywords]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function App() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeRole, setActiveRole] = useState<(typeof roleFilters)[number]["id"]>("all");
  const [activeToolId, setActiveToolId] = useState("http");
  const [view, setView] = useState<"home" | "tool">("home");
  const { favorites, recents, theme, toggleFavorite, touchRecent, toggleTheme } = usePreferences();

  useEffect(() => {
    const unlisten = listen("focus-search", () => {
      setView("home");
      window.setTimeout(() => searchRef.current?.focus(), 60);
    });
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  const visibleTools = useMemo(() => {
    return tools
      .filter((tool) => activeRole === "all" || tool.roles.includes(activeRole))
      .filter((tool) => !query.trim() || matchesTool(tool, query.trim()))
      .sort((left, right) => {
        const leftScore = Number(favorites.includes(left.id)) * 4 + Number(recents.includes(left.id)) * 2;
        const rightScore = Number(favorites.includes(right.id)) * 4 + Number(recents.includes(right.id)) * 2;
        return rightScore - leftScore || left.title.localeCompare(right.title);
      });
  }, [activeRole, favorites, query, recents]);

  const activeTool = tools.find((tool) => tool.id === activeToolId) ?? tools[0];
  const ActivePanel = activeTool.component;
  const recentTools = recents
    .map((id) => tools.find((tool) => tool.id === id))
    .filter((tool): tool is ToolDefinition => Boolean(tool))
    .slice(0, 4);

  function openTool(toolId: string) {
    setActiveToolId(toolId);
    touchRecent(toolId);
    setView("tool");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">Q</span>
          <div>
            <h1>QuickDesk</h1>
            <p>全岗位快捷工具</p>
          </div>
        </div>

        <nav className="role-nav" aria-label="岗位分类">
          {roleFilters.map((role) => (
            <button
              key={role.id}
              type="button"
              className={activeRole === role.id ? "active" : ""}
              onClick={() => setActiveRole(role.id)}
            >
              <span>{role.title}</span>
              <small>{role.hint}</small>
            </button>
          ))}
        </nav>

        <section className="recent-panel">
          <div className="panel-title">
            <span>最近使用</span>
            <small>{recentTools.length || 0}</small>
          </div>
          {recentTools.length ? (
            recentTools.map((tool) => (
              <button key={tool.id} type="button" onClick={() => openTool(tool.id)}>
                <strong>{tool.title}</strong>
                <span>{tool.description}</span>
              </button>
            ))
          ) : (
            <p>打开任意工具后会出现在这里。</p>
          )}
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <label className="command-search">
            <span>搜索</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索工具、岗位或关键词，例如 Postman、取色器、时间戳"
            />
            <kbd>Enter</kbd>
          </label>
          <button type="button" className="ghost-button" onClick={toggleTheme}>
            {theme === "light" ? "深色" : "浅色"}
          </button>
          <div className="hotkey">{HOTKEY_LABEL}</div>
        </header>

        {view === "home" ? (
          <section className="tool-board">
            <div className="section-heading">
              <div>
                <h2>工具导航</h2>
                <p>按岗位筛选或搜索工具，点击后进入独立使用页面。</p>
              </div>
              <span>{visibleTools.length} 个工具</span>
            </div>

            {visibleTools.length ? (
              <div className="tool-grid">
                {visibleTools.map((tool) => (
                  <article key={tool.id} className={activeTool.id === tool.id ? "tool-card selected" : "tool-card"}>
                    <button type="button" className="tool-open" onClick={() => openTool(tool.id)}>
                      <span className={`tool-icon category-${tool.category}`}>{tool.title.slice(0, 1)}</span>
                      <strong>{tool.title}</strong>
                      <small>{tool.description}</small>
                    </button>
                    <button
                      type="button"
                      className={favorites.includes(tool.id) ? "favorite on" : "favorite"}
                      aria-label={favorites.includes(tool.id) ? "取消收藏" : "收藏"}
                      onClick={() => toggleFavorite(tool.id)}
                    >
                      ★
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>没有找到工具</strong>
                <span>换个关键词，或切到全部工具。</span>
              </div>
            )}
          </section>
        ) : (
          <section className="tool-page">
            <div className="tool-page-bar">
              <button type="button" onClick={() => setView("home")}>
                返回工具导航
              </button>
              <div>
                <strong>{activeTool.title}</strong>
                <span>{activeTool.description}</span>
              </div>
              <button
                type="button"
                className={favorites.includes(activeTool.id) ? "favorite-action on" : "favorite-action"}
                onClick={() => toggleFavorite(activeTool.id)}
              >
                {favorites.includes(activeTool.id) ? "已收藏" : "收藏"}
              </button>
            </div>
            <ActivePanel />
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
