# DeepSeek Web window

The row sits in the sidebar footer, directly above **Баланс**, and opens the real
`chat.deepseek.com` in a compact window above itself: as wide as the sidebar, resizable from its
right edge, with only a reload / open-in-browser / close header around the page.

## Why it exists

A short question to the main agent costs the whole context window it rides on. The browser version
of DeepSeek answers the same trivia for web usage limits instead of API tokens and without touching
the session at all.

## Using it

1. Click **DeepSeek Web** above the balance. The window opens with the site.
2. Sign in on first use in this app run.
3. Header: **↻** reloads (and rebuilds a failed page), **↗** opens the site in the system browser,
   **×** closes the window; Escape closes it while focus is on the window's own controls.
   Links the page opens in a new window stay inside this window, keeping its sign-in.
4. Drag the right edge to resize; double-click the edge to return to the sidebar width. The chosen
   width is remembered across reloads.

## Limits

- Desktop app only. In a browser-only Harness the row opens the site in a tab.
- Sign-in lasts one app run: the guest uses a temporary browser profile.
- Popups, downloads and permission prompts are blocked by the desktop guest policy.
- The page itself stores whatever the site stores; the plugin adds no data of its own except the
  remembered width.
- DeepSeek's web app can change without notice; this plugin embeds it as-is.
