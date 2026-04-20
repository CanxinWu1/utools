import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import "./App.css";
import { usePreferences } from "./state/preferences";
import { roleFilters, tools } from "./tools/registry";
import type { ToolDefinition } from "./tools/types";

const HOTKEY_LABEL = "Cmd/Ctrl + Shift + Space（主窗口）";
const categoryLabels: Record<ToolDefinition["category"], string> = {
  developer: "开发",
  request: "请求",
  encoding: "编码",
  data: "数据",
  testing: "测试",
  writing: "文本",
  design: "设计",
};

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

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView("home");
        window.setTimeout(() => searchRef.current?.focus(), 30);
      }
      if (event.key === "Escape") {
        if (view === "tool") {
          setView("home");
          window.setTimeout(() => searchRef.current?.focus(), 30);
        } else if (query) {
          setQuery("");
        }
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [query, view]);

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
  const activeRoleInfo = roleFilters.find((role) => role.id === activeRole) ?? roleFilters[0];
  const ActivePanel = activeTool.component;
  const favoriteTools = tools.filter((tool) => favorites.includes(tool.id));
  const recentTools = recents
    .map((id) => tools.find((tool) => tool.id === id))
    .filter((tool): tool is ToolDefinition => Boolean(tool))
    .slice(0, 4);

  function openTool(toolId: string) {
    setActiveToolId(toolId);
    touchRecent(toolId);
    setView("tool");
  }

  function openFirstVisibleTool() {
    if (!visibleTools.length) return;
    openTool(visibleTools[0].id);
  }

  function selectRole(roleId: (typeof roleFilters)[number]["id"]) {
    setActiveRole(roleId);
    setView("home");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">QD</span>
          <div>
            <h1>SwiftBox</h1>
            <p>{HOTKEY_LABEL}</p>
          </div>
        </div>

        <div className="sidebar-label">岗位</div>
        <nav className="role-nav" aria-label="岗位分类">
          {roleFilters.map((role) => (
            <button
              key={role.id}
              type="button"
              className={activeRole === role.id ? "active" : ""}
              onClick={() => selectRole(role.id)}
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
          <div className="workspace-title">
            <span>{view === "home" ? "工具导航" : categoryLabels[activeTool.category]}</span>
            <strong>{view === "home" ? activeRoleInfo.title : activeTool.title}</strong>
          </div>
          <label className="command-search">
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") openFirstVisibleTool();
              }}
              placeholder="搜索工具、岗位或关键词，例如 Postman、取色器、时间戳"
            />
            <kbd>Enter</kbd>
          </label>
          <button type="button" className="ghost-button" onClick={toggleTheme}>
            {theme === "light" ? "深色" : "浅色"}
          </button>
        </header>

        {view === "home" ? (
          <section className="home-page">
            <div className="launch-summary">
              <div>
                <span className="eyebrow">Command center</span>
                <h2>选择一个工具开始</h2>
                <p>按岗位筛选、搜索关键词，打开后进入独立使用页面。</p>
              </div>
              <div className="summary-metrics" aria-label="工具概览">
                <span>
                  <strong>{visibleTools.length}</strong>
                  <small>当前工具</small>
                </span>
                <span>
                  <strong>{favoriteTools.length}</strong>
                  <small>收藏</small>
                </span>
                <span>
                  <strong>{recentTools.length}</strong>
                  <small>最近</small>
                </span>
              </div>
            </div>

            {(favoriteTools.length || recentTools.length) ? (
              <div className="quick-lanes">
                {favoriteTools.length ? (
                  <section>
                    <strong>收藏</strong>
                    <div className="quick-chip-row">
                      {favoriteTools.slice(0, 6).map((tool) => (
                        <button key={tool.id} type="button" onClick={() => openTool(tool.id)}>{tool.title}</button>
                      ))}
                    </div>
                  </section>
                ) : null}
                {recentTools.length ? (
                  <section>
                    <strong>最近</strong>
                    <div className="quick-chip-row">
                      {recentTools.map((tool) => (
                        <button key={tool.id} type="button" onClick={() => openTool(tool.id)}>{tool.title}</button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}

            {visibleTools.length ? (
              <div className="tool-grid">
                {visibleTools.map((tool) => (
                  <article key={tool.id} className={activeTool.id === tool.id ? "tool-card selected" : "tool-card"}>
                    <button type="button" className="tool-open" onClick={() => openTool(tool.id)}>
                      <span className={`tool-icon category-${tool.category}`}>{tool.title.slice(0, 1)}</span>
                      <span className="tool-copy">
                        <strong>{tool.title}</strong>
                        <small>{tool.description}</small>
                        <em>{categoryLabels[tool.category]} · {tool.roles.length} 个岗位</em>
                        <span className="keyword-line">{tool.keywords.slice(0, 3).join(" / ")}</span>
                      </span>
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
                返回
              </button>
              <div>
                <strong>{activeTool.title}</strong>
                <span>{activeTool.description}</span>
              </div>
              <select value={activeTool.id} onChange={(event) => openTool(event.target.value)} aria-label="快速切换工具">
                {tools.map((tool) => (
                  <option key={tool.id} value={tool.id}>{tool.title}</option>
                ))}
              </select>
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
