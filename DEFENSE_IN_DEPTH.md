# Defense in Depth

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.

Profile: npm library · public

## 1. Security docs

- [x] `SECURITY.md` present — contact info + "How this repository is secured" summary — PR #464
- [x] `DEFENSE_IN_DEPTH.md` present (this file) — PR #464

## 2. CODEOWNERS and cloud bootstrap

- [x] `.github/CODEOWNERS` covers `/.github/`, `/.vscode/`, `/.cursor/`, `/.devcontainer/`, `/scripts/` with owners the maintainer names — PR #499
- [x] Codespaces and Cursor Cloud Agents bootstrap Aikido Safe Chain via scripts/setup-cloud-environment.sh (--ci shims, frozen lockfile) — PR #478
- [x] Dev Container `image` pinned by digest (`name:<tag>@sha256:<digest>`; not a floating tag) — PR #493

## 3. Dependencies (pnpm)

- [x] `packageManager: pnpm@11.3+` pinned in `package.json` — verified 2026-09-19 (`pnpm@11.20.0`)
- [ ] 7-day cooldown: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `minimumReleaseAgeIgnoreMissingTime: false`; no first-party `minimumReleaseAgeExclude` (PR pending)
- [ ] `trustPolicy: no-downgrade`; no first-party `trustPolicyExclude`
- [x] Lifecycle scripts blocked: `strictDepBuilds: true`, `dangerouslyAllowAllBuilds: false`, `allowBuilds: {}` baseline — verified 2026-08-16 (reviewed exceptions for `esbuild`, `sharp`, and `workerd`)
- [x] `blockExoticSubdeps: true` — verified 2026-08-16
- [x] Lockfile committed; CI installs with `pnpm install --frozen-lockfile` — PR #465
- [x] No `.github/dependabot.yml`; other dependency-update tools (if any) open PRs only — never auto-merge — verified 2026-09-19

## 4. GitHub Actions

- [x] `permissions: contents: read` (or `{}` + per-job grants) on every workflow — PR #466
- [x] No `contents: write` except jobs whose purpose is mutating the repo (GitHub Release, Changesets version PR); generated output is a workflow artifact, never committed back from CI — verified 2026-09-19 (`build-binaries` writes only to upload release assets; binaries are also uploaded as artifacts)
- [x] Every action pinned to a full commit SHA (`npx actions-up`) — PR #492
- [x] Every job installs Socket Firewall (`SocketDev/action` SHA-pinned, `firewall-version` pinned); `pnpm install` / `npm install` run as `sfw pnpm install` / `sfw npm install` — PR #468, PR #476
- [x] `.github/workflows/check-workflows.yaml` lints workflows with zizmor on every PR — PR #469
- [ ] Workflow `name:` and job `name:` contain no spaces (kebab-case) so they can be set as required status checks
- [x] `persist-credentials: false` on checkouts that don't push — PR #467
- [x] No `pull_request_target` on workflows that run untrusted PR code — verified 2026-08-16
- [x] Artifact-publishing workflows disable `actions/setup-node` default caching (`package-manager-cache: false`) to prevent cache poisoning — PR #475
- [x] No npm tokens (or other registry credentials) in Actions secrets — verified 2026-08-16

## 5. npm publishing — npm libraries only

- [x] OIDC trusted publishing configured **stage-only** on npmjs.com for the publish workflow — it can stage, never publish live (manual) — verified 2026-08-16 (maintainer)
- [x] `.github/workflows/release.yaml` packs then stages with `pnpm stage publish ./packed/*.tgz --no-git-checks` — PR #485
- [x] Maintainer promotes staged versions with 2FA (manual) — verified 2026-08-16 (maintainer)
- [x] Drydock connected — staged releases reviewed before promotion (manual) — verified 2026-08-16 (maintainer)
- [x] No direct publish rights: package requires 2FA and disallows tokens (manual) — verified 2026-08-16 (maintainer)
- [x] `package.json` `repository.url` accurate so provenance maps to this repo — verified 2026-08-16

## 6. Security tooling

- [x] Aikido runs on every build — verified 2026-08-16 (GitHub check "Aikido Security: check code")
- [x] Aikido release gate: the release workflow's stage-publish job `needs:` a passing `scan-release` — PR #471
- [x] Socket reviews every PR that changes dependencies — verified 2026-08-16 (GitHub checks "Socket Security: Pull Request Alerts" and "Project Report")

## 7. Repository lockdown

- [x] Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub and npm accounts (manual) — verified 2026-08-16 (maintainer)
- [x] Recovery codes stored offline in a password manager (manual) — verified 2026-08-16 (maintainer)
- [ ] `lockdown-repo.sh` applied by a repo admin (never committed to this repo); `--check` with `--required-checks` and `--allowed-actions` passes (PRs required on the default branch, merges blocked unless required status checks pass, tag ruleset, immutable releases, fork-PR approval (public repos), read-only workflow tokens, Actions allowlist, secret scanning, Dependabot disabled, private vulnerability reporting (public repos))
