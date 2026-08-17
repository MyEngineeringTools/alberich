# Extensions

Companions next to `web/`.

```
extensions/
├── browser/          Chrome / Edge / Firefox companion
└── thunderbird/      MailExtension
```

Both keep their own copy of the crypto files until they actually import one
shared module. After browser panel edits run `browser/sync-from-chrome.sh`.

## Source tree vs packaged load

`extensions/browser/Chrome/shared` and `Edge/shared` are **symlinks** to
`extensions/browser/shared/`. That is fine in a git clone on Unix. It is
not fine as a GitHub “Download ZIP” on Windows.

### Developers with a git clone

Edit `extensions/browser/shared/` and the Chrome panel. Sync Firefox with
`browser/sync-from-chrome.sh`.

### Local testing on any OS

```bash
bash scripts/package-extensions.sh
```

Load unpacked from:

```text
dist/extensions/chrome/
dist/extensions/edge/
dist/extensions/firefox/
```

Those directories are real copies. Packaging fails if a symlink leaks in.

### Normal users

Use the GitHub Release ZIPs (`alberich-chrome-VERSION.zip`,
`alberich-edge-VERSION.zip`, `alberich-firefox-VERSION.zip`). Do not load
`extensions/browser/Chrome` from a source archive.

Thunderbird developers can load `extensions/thunderbird/manifest.json`
temporarily. Release users take the Thunderbird artefact from the same
GitHub Release.

Not here: Android sources, store login material, real month sheets.
