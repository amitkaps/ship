# Design

## What it is

ship is the one way every repository builds, checks, deploys and releases, and the repository that shows it working. [The standard](standard.md) says what that way is. This repository follows it exactly, and `pnpm drift` and [the dashboard](dashboard.md) show how far each of the others has drifted from it.

## Why

Each repository used to make the same choices on its own, and they drifted: four ways of protecting `main`, three copies of one release workflow, one script name running two commands. A choice made once, here, is paid for once. A change starts here, and the survey lists every repository to bring in line, so nothing depends on remembering.

The standard is read from this repository's own files, not written out twice. The versions come from its `package.json`, the strict options from its `tsconfig.json`, and the release workflow from [package/](../package/README.md). So the example can't disagree with the rule, and `pnpm new` builds a repository from the same files, through the same fixes `pnpm align` runs.

## What it isn't

- **Not a template.** Nothing is copied from here and left to drift. `pnpm new` builds from this repository's files, and the survey keeps checking afterwards.
- **Not a monorepo.** Each repository stays its own, with its own releases. Only how they're built and shipped is shared.
- **Not a place for preference.** A repository can't opt out of a check. When a tool can't support the standard yet, the check is held, with a reason and a condition for looking again.
