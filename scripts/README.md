# Scripts

Tools for keeping the repositories in step. Each runs with Node, which reads TypeScript as it is, so there's no build.

- [survey.ts](survey.ts) reads every repository and checks it against [the standard](../docs/standard.md). The others are read from GitHub's `main`, and this one from disk. It can also check a folder that isn't on GitHub yet.
- [drift.ts](drift.ts) is `pnpm drift`, which prints what the survey found, and the GitHub and Worker settings when `gh` and `cf` are logged in, and exits 1 if anything has drifted. A folder named after it is checked from disk instead, to see a fix before it's pushed.
- [align.ts](align.ts) is `pnpm align`, which moves this repository's versions, then opens a pull request in each other repository that brings it in line, and writes their GitHub and Worker settings.
- [settings.ts](settings.ts) reads and writes what lives outside the repositories: the merge settings, branch rules and labels on GitHub, and each Worker's build settings on Cloudflare.
- [release.ts](release.ts) is `pnpm release <repo> <version>`, which opens the pull request that bumps a package's version, with auto-merge on. Merging it releases the package.
- [new.ts](new.ts) is `pnpm new <name> --package|--site|--tool [--internal]`, which starts a repository that follows the standard, built from this one's files. [new.test.ts](new.test.ts) checks what it writes against the survey and runs its `verify`.
- [dashboard.ts](dashboard.ts) is `pnpm dashboard`, which writes the survey into the dashboard page `prose build` made from `docs/dashboard.md`. `verify` runs it, so the live site shows the drift as of its last deploy.
- [tables.ts](tables.ts) turns the survey into the dashboard's two tables, the checks and every repository's scripts.
