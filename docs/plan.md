# Plan

## Where it is

### The docs

Every repository serves its docs on its site, and ship's are at `ship.amitkaps.com/docs/`, so every `AGENTS.md` can link to the standard there. Every repository has the same docs, checked by the survey and written by `pnpm new`, and pagez's design moved to it from sitez.

### Dependencies

pnpm's one-day wait is on everywhere, with our own scope excluded. Versions and actions move from here, so Dependabot is gone. The dashboard links each repository's site and npm release.

### Releases and new repositories

Merging a version bump releases a package, with npm's 2FA approval the one step by hand. `pnpm new` starts a repository that passes from its first commit, and pagez was the first.

### The standard

The toolchain, scripts, branch rules, agents' instructions and release files are the same everywhere, and `pnpm drift` and the dashboard check them. `pnpm drift` only reads, and `pnpm align` writes: a pull request for each repository's files, and their GitHub and Worker settings directly. Versions come from this repository, not from npm.

## Next, in order

1. Run `pnpm align` by hand, the first time, and fix what it trips on: opening the pull requests, and whether exact pins stay exact.
2. The static-site pattern in the standard. ship's own site is the first: `.prose` is Vite's `publicDir`, the Cloudflare plugin's `assetsOnly` hands it on, and `ship` runs `cf deploy --prebuilt`. Once its first deploy from `main` serves, the pattern goes in the standard with its check in `cloudflare.config.ts`, wrangler leaves the catalog, and its holds go. `pnpm align` carries it to each site.
3. A SvelteKit app on cf, with `adapter-static`, written into the standard once it builds and deploys.

## Later

- The beta packages move to their releases, when they graduate, as [development](development.md#beta-packages) lists.

## Open questions

- **Pages that aren't the repository.** ship's dashboard is now a doc with empty sections that a script fills after `prose build`, so it has prose's bar and styles. markz's quality page still sits outside prose's frame with no bar. It could become a doc the same way, or prose could take a page for a section, so the trick isn't needed.

- Should a site's docs be checked for the same sections, or only for the files?
