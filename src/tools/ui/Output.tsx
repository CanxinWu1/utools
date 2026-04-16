export function Output({ value }: { value: string }) {
  return <pre className="output">{value || "结果会显示在这里"}</pre>;
}
