# Kyivstar TV — LAMPA port (working branch: lampa-port)

This repository is a working area for porting and improving the Kyivstar TV plugin to LAMPA.

Scope (A–E):

- A) Audit original LAMPA plugin and collect issues & best-practices.
- B) Reuse Kyivstar Kodi logic where appropriate (network flows) and port to LAMPA.
- C) Analyze several popular LAMPA TV plugins and Jellyfin plugin to adopt patterns.
- D) Implement a modular LAMPA plugin: kyivstar_api.js, plugin.js, epg (IndexedDB), UI modules.
- E) Full EPG + catchup support (IndexedDB-based archive), channel categories (API + local overrides), session storage.

How to test locally

1. Open http://lampa.mx in Opera on the test machine (you gave permission).
2. In Developer Tools -> Sources, you can load local plugin script or serve from a static host.
3. The initial code lives in src/ and is a skeleton — implement and iterate.

Branch: lampa-port — all work will be pushed to this branch and a single PR will be opened at the end.

Files and structure created in this commit:
- msx.json (LAMPA manifest)
- src/plugin.js (main plugin integration / boot)
- src/kyivstar_api.js (API client — session handling + core endpoints)
- src/epg/indexeddb.js (IndexedDB helper skeleton for archive/EPG)
- .eslintrc.json (basic linter config)
- README.md (this file)

Next steps (immediate):
- Fork chosen example repos into your account and collect them in /forks/ (worked offline).
- Start a detailed audit and produce issues list (audit/ISSUES.md).


---

Created by Copilot on behalf of @rebik111. Work in progress — do not merge until reviewed.
