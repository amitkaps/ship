# Scripts

Tools for keeping the repositories in step. Each runs with Node, which reads TypeScript as it is, so there's no build.

- [survey.ts](survey.ts) reads every repository and checks it against [the standard](../docs/standard.md). The others are read from GitHub's `main`, and this one from disk. It can also check a folder that isn't on GitHub yet.
- [drift.ts](drift.ts) is `pnpm drift`, which prints what the survey found and exits 1 if anything has drifted. `--local` reads the other repositories from the folders next to this one instead, to check a fix before it's pushed. `--cloudflare` also checks each Worker's build settings, and needs `cf` logged in and `CLOUDFLARE_ACCOUNT_ID` set.
- [protect.ts](protect.ts) is `pnpm protect`, which applies the branch rules and merge settings on GitHub, and a package's labels.
- [release.ts](release.ts) is `pnpm release <repo> <version>`, which opens the pull request that bumps a package's version, with auto-merge on. Merging it releases the package.
- [new.ts](new.ts) is `pnpm new <name> --package|--site|--tool [--internal]`, which starts a repository that follows the standard, built from this one's files. [new.test.ts](new.test.ts) checks what it writes against the survey and runs its `verify`.
- [tables.ts](tables.ts) turns the survey into the two tables on the home page, the checks and every repository's scripts. The build writes them in, so the live site shows the drift as of its last deploy.
- [docs.ts](docs.ts) renders `docs/` with markz into the site's docs pages, and the bar every page opens with.
