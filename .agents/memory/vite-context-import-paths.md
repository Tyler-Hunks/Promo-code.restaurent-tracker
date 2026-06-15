---
name: Vite — import shared modules with one consistent specifier
description: Mixing alias (@/) and relative (./) imports of the SAME local file makes Vite load it twice; React context then breaks with "must be used within a Provider".
---

# One specifier per shared module (esp. React context)

If the file that creates a React Context (the Provider) and the files that consume it (the hook) import that module through **different specifiers** — e.g. the Provider via `./hooks/use-theme` (relative) and the consumer via `@/hooks/use-theme` (alias) — Vite can resolve them to two different module URLs (one ends up with a `?v=` optimizer query, the other doesn't). The browser then evaluates the module **twice**, creating **two distinct Context objects**: the Provider populates one, the consumer reads the other (empty), and you get `useTheme must be used within a ThemeProvider` together with React's misleading "Invalid hook call / more than one copy of React" warning — even though the Provider clearly wraps the consumer and a fresh reload doesn't help.

**Symptom signature:** the error stack shows the consumer module with a `?v=...` query but the context module without it (or vice-versa).

**Fix / rule:** import any shared module — especially context providers/hooks — through ONE consistent specifier across the whole app. This repo uses the `@/` alias everywhere, so match it (don't mix in `./...`).

**Why:** Vite keys modules by resolved URL; alias vs relative for the same file can yield two URLs → two instances → broken singletons (contexts, stores, etc.).
