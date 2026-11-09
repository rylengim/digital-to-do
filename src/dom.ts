export function element<T extends HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Missing element: ${selector}`);
  return result;
}

export function isImeKey(event: KeyboardEvent): boolean {
  // The final IME key can follow compositionend; 229 still identifies it.
  // https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event#keydown_events_with_ime
  return event.isComposing || event.keyCode === 229;
}
