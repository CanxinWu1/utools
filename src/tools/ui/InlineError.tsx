export function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="tool-inline-error">{message}</p>;
}
