---
name: Theming this app (tokens, scoped overrides, dual-use secondary)
description: How to add/modify a color theme safely given that the page hardcodes many Tailwind utilities and the --secondary token is used two conflicting ways.
---

# Adding or changing a theme

The app is single-theme by default (a light "default" + a dormant `.dark` block) with a runtime toggle that adds a `theme-<name>` class to `<html>`.

## Gotcha 1 — the main page hardcodes ~99 color utilities
The primary page renders its own page background, header, panels, table, and status badges with literal Tailwind classes (`bg-gray-50`, `text-gray-*`, `border-gray-200`, plus `bg-green/red/orange/blue-*` for status). These do NOT follow the shadcn CSS-variable tokens.

**Implication:** a new theme cannot be done purely by re-defining tokens. Re-skin the structural grays/whites with a few high-specificity, theme-scoped CSS overrides (e.g. `:root.theme-x .bg-gray-50 { ... }`, escaping `:` in hover variants as `.hover\:bg-gray-50:hover`). Leave the green/red/orange status colors alone — they carry meaning (available/used/expired) and should read the same in every theme.

**Why:** editing those 99 utilities in JSX would also change the *default* theme's look (e.g. its `--muted-foreground` is near-black, not a mid gray), which we must preserve. Scoped CSS keeps the default byte-for-byte and only paints the alternate theme.

## Gotcha 2 — `--secondary` is used two conflicting ways
- As a foreground/border on a white surface: `text-secondary` / `border-secondary` (needs a dark/saturated color).
- As a button/badge background with light text: `bg-secondary` + `text-secondary-foreground` or `hover:text-white` (needs a dark color with light foreground).
- BUT one button uses `bg-secondary` while inheriting the default button's `text-primary-foreground`. If a theme makes BOTH `--secondary` and `--primary-foreground` dark, that button is dark-on-dark.

**How to apply:** make a theme's `--secondary` a single dark color (works as text-on-white and as bg-with-light-text), and ensure any `bg-secondary` element also carries `text-secondary-foreground` (default-safe, since default `--secondary-foreground` is white = same as its `--primary-foreground`).

## Other notes
- Tokens store full color functions (`hsl(...)`), and Tailwind maps colors as `var(--x)` directly — so `/opacity` modifiers on these tokens don't behave like normal Tailwind palette colors.
- Avoid FOUC by setting the saved theme class in an inline `<head>` script before React mounts; the provider then keeps the class in sync with its stored preference (an effect will *remove* a class the inline script added if the stored value disagrees).
- The toggle lives in the authenticated header only; the login screen still themes via tokens but has no switcher.
