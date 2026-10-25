# Better Termix

A [Termix](https://github.com/Termix-SSH/Termix) plugin (26.10.5+) with four small UI fixes:

- Hide host IP addresses on the dashboard (Host Status list and pinned hosts)
- Host status in the sidebar as a colored name, a dot left of the name, or both
- No white flash before your theme on reload (opt-in admin setting)
- An interface size between Normal and Large

See [docs/index.md](docs/index.md) for how each one works.

## Install

Download `better-termix-<version>.tmxplug` from [Releases](https://github.com/DegreeCode/better-termix/releases).
In Termix: Settings, General, turn on Plugin developer mode; then Plugins, Install from file.

## Build from source

```bash
npm install
npm run build
npm run pack
```

## Release

Bump the version in `manifest.json` and `package.json`, add it to `CHANGELOG.md`, then push a tag:

```bash
git tag v1.0.2
git push origin v1.0.2
```

GitHub Actions tests, builds and publishes the release with the `.tmxplug` attached.
