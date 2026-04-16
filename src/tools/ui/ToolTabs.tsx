export type ToolTabItem<T extends string> = {
  id: T;
  label: string;
};

export function ToolTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<ToolTabItem<T>>;
  active: T;
  onChange: (tab: T) => void;
}) {
  return (
    <div className="segmented-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={active === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
