# AGENTS.md

This repo is a [Termix](https://github.com/Termix-SSH/Termix) plugin. These notes are for AI coding tools.

## Read first

Before changing anything, read `node_modules/@termix-ssh/plugin-sdk/PLUGIN-GUIDE.md`. It covers the
manifest, backend, database, frontend, UI, testing, releasing and submitting to the community registry,
and it matches the SDK version installed here. If it is missing, run `npm install`. If it is still missing,
the SDK is older than 1.0.6: run `npm install -D @termix-ssh/plugin-sdk@latest` or read
https://docs.termix.site/develop instead.

If the guide and the SDK's TypeScript types disagree, the types are right.

## Commands

```bash
npm run build        # bundle into dist/
npm test             # run the tests
npm run typecheck    # type check
npm run validate     # check manifest.json, migrations, changelog and docs
npm run migrations   # write migrations after changing src/backend/tables.ts
npm run pack         # write <id>-<version>.tmxplug
npm run format       # format with Prettier
```

`npx termix-plugin dev --server <url> --key <tmx_...>` installs the plugin on a Termix server with
developer mode on and reinstalls it on every save. Don't start it unless the user asks.

## Releasing

Bump the version in `manifest.json` and `package.json`, add a `## X.Y.Z` section to `CHANGELOG.md`, merge
to `main`, then push a tag: `git tag vX.Y.Z && git push origin vX.Y.Z`. `.github/workflows/release.yml`
checks the tag matches the versions, tests, builds, packs and publishes a GitHub release with the
`.tmxplug`, `SHA256SUMS` and build provenance. A version with a suffix (`1.1.0-beta.1`) is a prerelease.

## Done means

- `npm test`, `npm run typecheck`, `npm run validate`, `npm run build` and `npm run format:check` pass
- New UI text is in `locales/en.json`, new routes have an `@openapi` block and a test
- `docs/` and the section below still match what the plugin does
- User facing changes are in `CHANGELOG.md` under the version they ship in

## About this plugin

Better Termix is UI CSS plus opt-in server file patches. It has no tables, routes or migrations.

- `src/frontend/better-termix.css`: every rule is gated by a `bt-*` class on `<html>`. Selectors follow
  Classic Layout's markup (dashboard `Facts` for the IP; for name colors, a hidden `[data-bt-status]` marker
  this plugin's host badge renders in the name row, with the row's `.host-status-stripe` classes as fallback). Check them against Classic Layout when it updates.
- `src/frontend/index.tsx`: a hidden `shell.overlay` slot component reads the user settings and toggles
  the classes and `--bt-*` variables. It caches them, plus the theme's body background, in localStorage
  `better-termix:boot`.
- `src/backend/terminal-input-patch.ts`: the admin `terminalInputFix` setting adds a marked early
  return to SSH Terminal's known `resolveLocalEchoMode` function in its frontend bundle, forcing local
  echo off for all users. Validates the owning manifest and resolver before writing; removes only its
  override on disable, without restoring a stale backup. Re-applied on start/settings changes.
- `src/backend/boot-script.ts`: the script that runs in `<head>` before Termix loads. It is shipped as its
  function's source text, so it must stay self-contained.
- `src/backend/index-patch.ts`: with the admin setting `bootPatch` on, writes `better-termix-boot.js` next
  to Termix's `index.html` (default `/app/html` in Docker) and adds a marked `<script src>` tag as the last child of `<head>`: the theme `<link>` it writes must
  come after Termix's own stylesheet, or core's `:root` defaults win the cascade tie. An inline
  script would be blocked by Termix's nginx CSP. Re-applied on every start, removed on disable.
