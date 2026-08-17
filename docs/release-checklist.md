# Public release checklist

- [ ] `git status` is clean
- [ ] History backup bundle exists (do not rewrite history without it)
- [ ] Public root commit identity is deliberate
- [ ] No secrets (`bash scripts/test-repository.sh`)
- [ ] `bash scripts/test.sh`
- [ ] `bash scripts/test-research.sh`
- [ ] `node reference/generate-vectors.mjs`
- [ ] Python reference matches golden vectors
- [ ] Traditional golden vector unchanged
- [ ] V3 codebook negative tests
- [ ] `bash scripts/test-packaging.sh` — no symlinks in `dist/extensions`
- [ ] CSP / zero telemetry
- [ ] THIRD_PARTY says AGPL-3.0-only
- [ ] SPDX / DCO (`git commit -s`)
- [ ] VERSIONS matches README, SECURITY, manifests, About
- [ ] CHANGELOG updated
- [ ] `bash scripts/release.sh` → zip + SHA256SUMS
- [ ] Offline check: unzip web zip, `./start.sh`, disable network, generate a sheet
- [ ] Git tag
- [ ] GitHub Release with SHA256SUMS

Offline / courier:

1. Download the web zip
2. Check SHA-256
3. Copy to the offline machine
4. Start locally
5. Disconnect the network
6. Only then generate or import keys
