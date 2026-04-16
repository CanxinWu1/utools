export type KeyValueItem = {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
};

export function KeyValueEditor({
  rows,
  onChange,
  onAdd,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  addLabel = "添加",
}: {
  rows: KeyValueItem[];
  onChange: (rows: KeyValueItem[]) => void;
  onAdd: () => KeyValueItem;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
}) {
  function updateRow(id: string, patch: Partial<KeyValueItem>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    onChange(rows.filter((row) => row.id !== id));
  }

  return (
    <div className="kv-editor">
      {rows.map((row) => (
        <div key={row.id} className="kv-row">
          <input
            aria-label="启用"
            type="checkbox"
            checked={row.enabled}
            onChange={(event) => updateRow(row.id, { enabled: event.target.checked })}
          />
          <input value={row.key} onChange={(event) => updateRow(row.id, { key: event.target.value })} placeholder={keyPlaceholder} />
          <input value={row.value} onChange={(event) => updateRow(row.id, { value: event.target.value })} placeholder={valuePlaceholder} />
          <button type="button" onClick={() => removeRow(row.id)}>删除</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, onAdd()])}>{addLabel}</button>
    </div>
  );
}
