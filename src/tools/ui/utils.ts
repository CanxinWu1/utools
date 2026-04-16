export function copyText(value: string) {
  void navigator.clipboard.writeText(value);
}

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
