/** 열린 대화상자의 첫·마지막 입력 사이에서 Tab 초점을 순환시킨다. 숨김·inert 영역은 제외한다. */
export function trapDialogFocus(event: { key: string; shiftKey: boolean; preventDefault: () => void }, dialog: HTMLElement | null) {
  if (event.key !== 'Tab' || !dialog) return
  const nodes = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
    .filter((node) => node.tabIndex >= 0 && node.getClientRects().length > 0 && !node.closest('[inert]'))
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (!first || !last) return
  if (!dialog.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) { event.preventDefault(); first.focus() }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
}
