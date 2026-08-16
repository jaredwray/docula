# Defense in Depth

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.

Profile: npm library · public

## 1. Security docs

- [x] `SECURITY.md` present — contact info + "How this repository is secured" summary — PR #464
- [x] `DEFENSE_IN_DEPTH.md` present (this file) — PR #464

## 2. Repository lockdown

- [ ] Lockdown script run; `lockdown-repo.sh --check` passes clean
- [ ] Pull requests required on the default branch (1 approving review of the latest push; only the repository owner can merge, and they may merge without a review); force pushes and deletion blocked
- [ ] Merges blocked unless required status checks pass (`--required-checks "<repo's CI jobs>"`)
- [ ] Tag ruleset "Tags only by admins" active
- [ ] Workflow runs from all outside collaborators require approval
- [ ] Default workflow token read-only; Actions cannot create or approve PRs
- [ ] Actions allowlist: GitHub-owned + verified + explicit patterns only (`--allowed-actions`)
- [ ] Secret scanning + push protection enabled *(plan-gated on private repos)*
- [ ] Private vulnerability reporting enabled *(public repos only)*
- [ ] Dependabot alerts enabled
- [ ] Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub and npm accounts (manual)
- [ ] Recovery codes stored offline in a password manager (manual)
- [ ] Dev/release VM network egress filtered by a firewall (e.g. PMG) (manual)

## 3. Dependencies (pnpm)

- [x] `packageManager: pnpm@11.x` pinned in `package.json` — verified 2026-08-16 (`pnpm@11.20.0`)
- [x] 7-day cooldown: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `minimumReleaseAgeIgnoreMissingTime: false` — verified 2026-08-16 (`pnpm-workspace.yaml`; first-party exclude: `writr`, `ecto`, `hashery`)
- [x] Lifecycle scripts blocked: `strictDepBuilds: true`, `dangerouslyAllowAllBuilds: false`, `allowBuilds: {}` baseline — verified 2026-08-16 (default-deny; reviewed exceptions for `esbuild`, `sharp`, and `workerd`)
- [x] `blockExoticSubdeps: true` — verified 2026-08-16
- [x] Lockfile committed; CI installs with `pnpm install --frozen-lockfile` — PR #465
- [x] Dependency-update tooling opens PRs only — never auto-merge — verified 2026-08-16 (no auto-merge config in-repo; upgrades via reviewed PRs)
- [x] New direct dependencies get human review; prefer `~` ranges over `^` — verified 2026-08-16 (all changes via PR; existing runtime deps stay on `^`; new runtime deps prefer `~`)

## 4. GitHub Actions

- [x] `permissions: contents: read` (or `{}` + per-job grants) on every workflow — PR #466
- [x] Every action pinned to a full commit SHA (`npx actions-up`) — verified 2026-08-16
- [ ] Every job installs Socket Firewall (`SocketDev/action` SHA-pinned, `firewall-version` pinned) (PR #468 pending)
- [ ] `.github/workflows/check-workflows.yaml` lints workflows with zizmor on every PR
- [x] `persist-credentials: false` on checkouts that don't push — PR #467
- [x] No `pull_request_target` on workflows that run untrusted PR code — verified 2026-08-16
- [x] No npm tokens (or other registry credentials) in Actions secrets — verified 2026-08-16 (no workflow references `NPM_TOKEN` / `NODE_AUTH_TOKEN`; publish uses OIDC provenance)

## 5. npm publishing — npm libraries only

- [ ] OIDC trusted publishing configured **stage-only** on npmjs.com for the publish workflow — it can stage, never publish live (manual)
- [ ] Staged publishing: CI runs `npm stage publish`; a maintainer promotes with 2FA (manual)
- [ ] Drydock connected — staged releases reviewed before promotion (manual)
- [ ] No direct publish rights: package requires 2FA and disallows tokens (manual)
- [x] `package.json` `repository.url` accurate so provenance maps to this repo — verified 2026-08-16

## 6. Security tooling

- [x] Aikido runs on every build — verified 2026-08-16 (GitHub check "Aikido Security: check code" on PR #462)
- [ ] Aikido release gate: the release workflow's stage-publish job `needs:` a passing `scan-release`
- [x] Socket reviews every PR that changes dependencies — verified 2026-08-16 (GitHub checks "Socket Security: Pull Request Alerts" and "Project Report" on PR #462)
