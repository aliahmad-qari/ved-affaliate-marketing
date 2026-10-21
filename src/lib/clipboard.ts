/** Copies text unchanged. False means the caller must offer manual copying. */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    if (window.isSecureContext && typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* Permission denied: try the selection-based fallback. */ }

  const previousFocus = document.activeElement as HTMLElement | null;
  let textarea: HTMLTextAreaElement | undefined;
  try {
    if (typeof document.execCommand !== 'function') return false;
    textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.setAttribute('aria-label', 'Copy text');
    // Keep selectable on mobile without moving the viewport or showing a keyboard.
    textarea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;';
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    textarea?.remove();
    try { previousFocus?.focus({ preventScroll: true }); } catch { /* Detached trigger. */ }
  }
}
