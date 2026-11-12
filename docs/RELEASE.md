# Release checklist

## Pre-release

- [ ] `node --test test/audit.test.mjs` passes
- [ ] `node test/browser-smoke.mjs` passes on Windows
- [ ] `node test/soak.mjs` passes (repeat scans, heap growth)
- [ ] `node --check index.js` and `node --check client.js`
- [ ] version updated in `package.json`
- [ ] market index version updated in `site/index.json`
- [ ] README / PRIVACY / COMPATIBILITY / CHANGELOG updated
- [ ] no new known P0/P1 security issue

## Publish

- [ ] push to GitHub `main`
- [ ] GitHub Actions: Windows + Ubuntu unit tests, Windows browser smoke
- [ ] publish npm `@tomjerrygit/dsh-workspace-audit@x.y.z`
- [ ] GitHub Release with notes
- [ ] GitHub Pages market index contains the new version
- [ ] comment/update the plugin hub submission

## Post-release

- [ ] install from npm in a clean profile
- [ ] verify sidebar entry, scan, cancel, baseline, export
- [ ] check npm dist-tag `latest`
- [ ] verify market index URL over HTTPS

## Rollback

- [ ] mark GitHub Release as prerelease or delete it
- [ ] deprecate the npm version, publish a fixed patch
- [ ] restore previous market index version if needed
