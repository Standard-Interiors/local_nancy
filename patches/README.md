# Local-dev working-tree patches

Patches in this folder are **working-tree-only** changes for the API / frontend repos that make local dev work but MUST NOT be committed to any feature or production branch. Per `CLAUDE.md` HARD CONSTRAINT #1, local-dev changes never live on `feature/*` branches.

## When to apply

If you rebuild an API container from a clean feature branch checkout and get JWT auth errors like `IDX20803: Unable to obtain configuration`, the local-dev Startup.cs patch got stomped. Re-apply it from here.

## Patches

| Patch | Target repo | Purpose |
|-------|-------------|---------|
| `geoff-api-local-jwt-hs256.patch` | `GeoffERP-API` | Replaces the production Cognito OIDC JWT validator with the same HS256 symmetric-key validator the `AccessToken` scheme already uses — so tokens issued by the local auth-proxy validate offline. |

## How to apply

```bash
cd ~/NANCY/GeoffERP-API
# Make sure Startup.cs is at its feature-branch state
git checkout HEAD -- GEOFF.API/Startup.cs
# Apply the patch to the working tree (do NOT commit)
git apply ~/NANCY/local-dev/patches/geoff-api-local-jwt-hs256.patch
# Verify: working tree has the patch but nothing is staged
git status --short
# Should show:  M GEOFF.API/Startup.cs  (unstaged)
# Rebuild the API container
cd ~/NANCY/local-dev/docker
docker compose -p local-dev up -d --build --force-recreate api
```

## Pre-commit gate — keep the patch out of feature commits

```bash
cd ~/NANCY/GeoffERP-API
git diff --cached --name-only | grep -qE 'Startup\.cs$' \
  && { echo 'STOP: Startup.cs is staged'; exit 1; } \
  || echo '✓ Startup.cs is not staged'
```

If the gate trips, run `git restore --staged GEOFF.API/Startup.cs` and re-stage only the feature files.
