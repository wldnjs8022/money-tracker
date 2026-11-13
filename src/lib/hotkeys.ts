"use client";

import { useEffect, useRef } from "react";

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

/** True while any dialog, menu or dropdown is open, so page shortcuts don't fire underneath it. */
export function isOverlayOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'));
}

/**
 * Layout-independent key name: with the Korean IME on, pressing N gives event.key "ㅜ",
 * so letters are read from the physical key (event.code "KeyN" → "n").
 */
export function hotkeyName(event: KeyboardEvent): string {
  const letter = /^Key([A-Z])$/.exec(event.code);
  return letter ? letter[1].toLowerCase() : event.key;
}

/** Plain single-key shortcuts only fire when the user isn't typing and nothing is open. */
export function shouldIgnoreHotkey(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target) || isOverlayOpen();
}

/** Registers single-key shortcuts, e.g. useHotkeys({ "[": prev, "]": next }). */
export function useHotkeys(map: Record<string, (event: KeyboardEvent) => void>) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreHotkey(event)) return;
      const handler = ref.current[hotkeyName(event)] ?? ref.current[event.key];
      if (handler) {
        event.preventDefault();
        handler(event);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
