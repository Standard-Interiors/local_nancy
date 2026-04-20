# NANCY — Lessons Learned

Rules written after mistakes. Review at session start.

---

## L1 — Local-dev changes NEVER go on feature branches

**Incident (2026-04-19):** while preparing to commit `feature/customer_priority`, the commit candidate included `Startup.cs` (local-dev JWT patch) and a version of `appsettings.json` that had local-dev `PLACEHOLDER_*` scrubbing intermixed with legitimate `FeatureFlags:CustomerPriority` schema work.

**Rule:** before any commit to a `feature/*` branch in the API or frontend repos, scan the staged diff for:
- `Startup.cs` modifications that touch JWT, auth, DI
- `appsettings.json` lines that touch `PLACEHOLDER_`, `CustomerParentId: 0`, `d365bc-mock`, `auth-proxy`, `sqlserver:1433`, `LocalDev123!`, `minio:9000`, `dev.s10drd.com`
- Any `appsettings.Local.json`, `docker-compose*.yml`, `Dockerfile*`
- Files referencing local-only services (BC mock, auth-proxy, MinIO)

If the staged diff contains any of the above: STOP, restore those files from HEAD, re-stage only the feature-relevant lines.

**Authoritative enforcement:** see `CLAUDE.md` HARD CONSTRAINT #1.

**Split-diff drill for `appsettings.json`:**

```bash
# Reset the whole file
git checkout HEAD -- GEOFF.API/appsettings.json
# Re-apply ONLY the feature-relevant edit (e.g. FeatureFlags section)
$EDITOR GEOFF.API/appsettings.json
# Verify the resulting diff
git diff GEOFF.API/appsettings.json
# Should only show the feature addition, no PLACEHOLDER fiddling
```

**Pre-commit gate** (run before every `git commit` on a feature branch):

```bash
git diff --cached --name-only | grep -qE '(Startup\.cs|appsettings\.(Local|Development)\.json|docker-compose|Dockerfile)' \
  && { echo 'STOP: local-dev files are staged'; exit 1; }
git diff --cached GEOFF.API/appsettings.json 2>/dev/null | grep -qE '(PLACEHOLDER_|CustomerParentId|d365bc-mock|auth-proxy|LocalDev123)' \
  && { echo 'STOP: local-dev patches in appsettings.json'; exit 1; }
echo 'OK — feature-branch hygiene passes.'
```

---

## L2 — Never push without explicit user approval

All work stays local unless the user explicitly says "commit" or "push." If in doubt, ask.

---

## L3 — Feature flags default production-safe

New `FeatureFlags:*` entries in the real `appsettings.json` default to `false` (or the safer value). Local-dev override lives in `appsettings.Local.json` with whatever makes developer life easiest. This keeps merges to `blue` / `master` immediately production-safe — someone has to deliberately turn the flag on.
