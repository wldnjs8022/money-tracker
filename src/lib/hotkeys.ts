"use client";

import { useEffect, useEffectEvent } from "react";

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

/** Rendered on screen. Routes preserved by Activity stay in the DOM with display: none. */
function isRendered(el: Element): boolean {
  return el.getClientRects().length > 0;
}

// Open overlays only: Radix dialogs/menus, an open Radix Select (role=listbox with data-state),
// and anything Radix positions in a popper (popover, dropdown, popper-positioned select).
// A cmdk list or an in-page list never counts.
const OVERLAY_SELECTOR = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"][data-state="open"]',
  "[data-radix-popper-content-wrapper]",
].join(", ");

/** True while a dialog, menu, popover or select is open, so page shortcuts don't fire underneath it. */
export function isOverlayOpen(): boolean {
  for (const el of document.querySelectorAll(OVERLAY_SELECTOR)) {
    // A tooltip is a popper too, but it never takes the keyboard.
    if (el.hasAttribute("data-radix-popper-content-wrapper") && el.querySelector('[role="tooltip"]')) continue;
    if (isRendered(el)) return true;
  }
  return false;
}

/**
 * The page's own search field, if the current page has one (`data-page-search` on the input).
 * The global "/" shortcut focuses it instead of opening the command palette.
 */
export function findPageSearch(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>("[data-page-search]")) {
    if (isRendered(el)) return el;
  }
  return null;
}

/**
 * Layout-independent key name: with the Korean IME on, pressing N gives event.key "ㅜ",
 * so letters are read from the physical key (event.code "KeyN" → "n").
 */
export function hotkeyName(event: KeyboardEvent): string {
  const letter = /^Key([A-Z])$/.exec(event.code);
  return letter ? letter[1].toLowerCase() : event.key;
}

// Keys a focused control already uses for itself. Pressing Backspace on a focused button must never
// delete a record, and Enter/Space on a tab or combobox belongs to that control.
const ACTIVATION_KEYS = new Set(["Backspace", "Delete", "Enter", " "]);
const ACTIVATABLE_SELECTOR = 'button, a, [role="button"], [role="combobox"], [role="tab"]';

function isControlActivation(event: KeyboardEvent): boolean {
  if (!ACTIVATION_KEYS.has(event.key)) return false;
  return event.target instanceof Element && event.target.closest(ACTIVATABLE_SELECTOR) !== null;
}

/** Plain single-key shortcuts only fire when the user isn't typing and nothing is open. */
export function shouldIgnoreHotkey(event: KeyboardEvent): boolean {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.isComposing ||
    isTypingTarget(event.target) ||
    isControlActivation(event) ||
    isOverlayOpen()
  );
}

// Two-key chords ("G then D"). The state lives here, not in UIProvider, so page shortcuts can
// stand aside while the second key of a chord is awaited (otherwise "G C" would also fire a page's C).
const CHORD_TIMEOUT_MS = 1200;
let chordStartedAt = 0;

/** Starts a chord: the next key pressed within 1.2s belongs to it. */
export function startChord() {
  chordStartedAt = Date.now();
}

/** True while the second key of a chord is awaited. */
export function isChordPending(): boolean {
  return chordStartedAt > 0 && Date.now() - chordStartedAt < CHORD_TIMEOUT_MS;
}

export function endChord() {
  chordStartedAt = 0;
}

/**
 * Keys a focused widget cancelled only to stop its own default (a closed Select's letter typeahead)
 * that the shortcuts should still see. Handling one as a shortcut takes it out again.
 */
const widgetOnly = new WeakSet<Event>();

/** After preventDefault() for a widget's own behaviour: leave the key to the shortcuts anyway. */
export function passKeyToShortcuts(event: Event) {
  widgetOnly.add(event);
}

/** A key is handled once something other than a passKeyToShortcuts() widget prevented it. */
export function isKeyHandled(event: KeyboardEvent): boolean {
  return event.defaultPrevented && !widgetOnly.has(event);
}

/**
 * Registers single-key page shortcuts, e.g. useHotkeys({ "[": prev, "]": next }).
 * Keys are matched by hotkeyName() first (physical letters), then by event.key ("/", "ArrowDown").
 *
 * Listens on `document`, which a keydown reaches before `window`, so page shortcuts always run
 * before UIProvider's global ones whatever the mount order. A handled key is preventDefault()-ed and
 * the global handler skips it. Events another handler already prevented are skipped here too, and
 * nothing fires while a chord is pending.
 */
export function useHotkeys(map: Record<string, (event: KeyboardEvent) => void>) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (isKeyHandled(event) || isChordPending() || shouldIgnoreHotkey(event)) return;
    const handler = map[hotkeyName(event)] ?? map[event.key];
    if (handler) {
      event.preventDefault();
      widgetOnly.delete(event);
      handler(event);
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
}
