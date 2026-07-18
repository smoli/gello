---
name: gello-release
description: Cut a gello release — decide patch vs minor vs major from the commits since the last tag, bump every version file, update the changelog, commit, and create an annotated git tag. Use whenever the user asks to release, cut a version, bump the version, do a release, write release notes, or tag a new version of gello. Always propose the bump level but wait for the user's explicit go-ahead before changing anything, and never push.
---

# Cut a gello release

gello ships as a Tauri desktop app. A release is a version bump across every
file that declares the version, a changelog entry describing what changed, one
commit, and an annotated git tag. Pushing that tag is what triggers the release
CI (which builds installers and publishes a public GitHub release) — so this
skill deliberately stops *before* the push and hands that step back to the
human. Publishing is theirs to trigger.

The whole point is to make the version bump considered, not reflexive: propose a
level with reasoning, but let the human decide, because only they know whether
an unreleased change is really "just a fix" or a feature worth a minor bump.

## 1. Find where you are

```bash
git describe --tags --abbrev=0        # latest tag, e.g. v0.2.0
git log <latest-tag>..HEAD --oneline --no-merges   # what's unreleased
```

Read the current version from the source of truth (`package.json`'s `version`).
If there is no tag yet, treat everything as the first release and read the
version from `package.json` directly.

## 2. Decide the bump — propose, then ask

Read the unreleased commits and classify them (semver):

- **major** — a breaking change to the file format, board schema, or CLI/config
  contract. Rare; flag it explicitly if you see one.
- **minor** — any new user-facing capability (a feature, a new command, a new
  surface). If anything lands in an "Added" bucket, it's at least a minor.
- **patch** — bug fixes, internal/CI changes, docs, refactors only.

Propose the level with a one-line justification tied to the actual commits
(e.g. "minor: adds the app icon and Windows frameless chrome; the rest are
fixes"). **Then stop and ask for permission.** Do not touch any file until the
human confirms the level (or overrides it). This confirmation is the one
non-negotiable step — the bump is the human's call, always.

## 3. Bump every version declaration

Find the version everywhere it's declared rather than trusting a fixed list —
files get added over time. Grep for the current version string:

```bash
git grep -n "0\.2\.0"     # replace with the actual current version
```

Bump only the project's **own** version declarations, and review each match
before editing — a dependency pinned at the same version, or a lockfile hash,
is a coincidental match, not something to change. In a standard gello checkout
the real ones are:

- `package.json` — the top `"version"` key
- `src-tauri/Cargo.toml` — the `[package]` `version`
- `src-tauri/tauri.conf.json` — the top-level `"version"`
- `src-tauri/Cargo.lock` — the `version` line in the `[[package]] name = "gello"`
  entry (the app's own entry, not any dependency)

macOS `sed` lacks GNU range syntax; `perl -0pi -e 's/…/…/'` replaces the first
match cleanly. For `Cargo.lock`, anchor on the package name so you hit only the
gello entry:

```bash
perl -0pi -e 's/(name = "gello"\nversion = )"OLD"/$1"NEW"/' src-tauri/Cargo.lock
```

After editing, re-grep for the old version to confirm nothing project-owned was
missed.

## 4. Write the changelog

Update `CHANGELOG.md` at the repo root (create it if missing) in
[Keep a Changelog](https://keepachangelog.com/) style: newest version on top,
grouped **Added / Changed / Fixed**. Prepend the new section above the previous
one; never rewrite past entries.

Translate the commits into user-facing lines — what a person running gello would
notice, not the commit subject verbatim. Reference the card id in parentheses
where there is one (`(i0016)`), since the board is the project's memory. Drop
pure housekeeping (card edits, lockfile churn) — the changelog is for humans
deciding whether to upgrade.

```markdown
## [0.2.0] - 2026-07-17

One-line theme of the release.

### Added
- Real app icon across macOS/Windows/Linux (c0071).

### Fixed
- Windows: quick capture no longer creates the card twice (i0016).

### Changed
- Release workflow cuts one GitHub release per tag (i0021).
```

Use the current local date (`date +%F`) for the release date.

## 5. Commit and tag

Stage only the version files and the changelog — keep the release commit clean
of unrelated working-tree changes (the board often has loose card edits):

```bash
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json \
        src-tauri/Cargo.lock CHANGELOG.md    # plus any other bumped file
git commit -m "release: vX.Y.Z" -F -   # short body summarizing the highlights
git tag -a vX.Y.Z -m "gello vX.Y.Z"
```

End the commit body with the standard `Co-Authored-By` line if the project uses
it.

## 6. Stop and hand off

Do **not** push. Tell the human the release is committed and tagged locally, and
give them the command:

```bash
git push origin main --follow-tags
```

Remind them that pushing the tag triggers the release workflow (public GitHub
releases), so it's the deliberate publish step. If prior duplicate or throwaway
releases/tags exist, note that they may want to delete those first so the
releases list stays clean.
