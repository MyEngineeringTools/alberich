# Extensions

Companions next to `web/`.

```
extensions/
├── browser/          Chrome / Edge / Firefox companion
└── thunderbird/      MailExtension
```

Both keep their own copy of the crypto files until they actually import one
shared module. After browser panel edits run `browser/sync-from-chrome.sh`.

Not here: Android, blog, Matomo, store login material, real month sheets.
