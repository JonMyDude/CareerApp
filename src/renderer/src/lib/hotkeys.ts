import { useEffect } from 'react'
import { useNavStore, type TabId } from '../store/useNavStore'

/**
 * Keyboard shortcuts, and the two questions every handler has to ask before
 * acting on a key: is the user typing, and is the key already going to press
 * a button?
 */

/** A field the user is typing into — its keys are text, not shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * A focused, enabled button. Enter and Space already click it natively, so a
 * shortcut on those keys must stand back — otherwise one press acts twice
 * (Enter on a focused "Naprej" would skip a question).
 */
export function isActivatableButton(target: EventTarget | null): boolean {
  return target instanceof HTMLButtonElement && !target.disabled
}

/**
 * Ctrl+1…4 switch tabs in rail order and Ctrl+, opens Settings. These work even
 * while typing: a Ctrl chord never types a character.
 *
 * Matched on `code`, not `key`, so the digits work on any keyboard layout.
 */
export function useGlobalHotkeys(tabs: readonly { id: TabId }[]): void {
  const setTab = useNavStore((state) => state.setTab)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return

      if (event.code === 'Comma' || event.key === ',') {
        event.preventDefault()
        setTab('settings')
        return
      }

      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code)
      const tab = digit ? tabs[Number(digit[1]) - 1] : undefined
      if (!tab) return
      event.preventDefault()
      setTab(tab.id)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setTab, tabs])
}
