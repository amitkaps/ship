# Plan

## Where it is

### The docs

Every repository serves its docs on its site, and ship's are at `ship.amitkaps.com/docs/`, so every `AGENTS.md` can link to the standard there. Every repository has the same docs, checked by the survey and written by `pnpm new`, and pagez's design moved to it from sitez.

### Dependencies

pnpm's one-day wait is on everywhere, with our own scope excluded. Versions and actions move from here, so Dependabot is gone. The home page links each repository's site and npm release.

### Releases and new repositories

Merging a version bump releases a package, with npm's 2FA approval the one step by hand. `pnpm new` starts a repository that passes from its first commit, and pagez was the first.

### The standard

The toolchain, scripts, branch rules, agents' instructions and release files are the same everywhere, and `pnpm drift` and the home page check them. `pnpm drift` only reads, and `pnpm align` writes: a pull request for each repository's files, and their GitHub and Worker settings directly. Versions come from this repository, not from npm.

## Next, in order

1. Run `pnpm align` by hand, the first time, and fix what it trips on: opening the pull requests, and whether exact pins stay exact.
2. The static-site pattern in the standard: a site is a folder, Vite's `publicDir` with the Cloudflare plugin's `assetsOnly`, and `ship` runs `cf deploy --prebuilt`. Then `cloudflare.config.ts` is checked for it, wrangler leaves the catalog, and its holds go. `pnpm align` carries it to each site.
3. A SvelteKit app on cf, with `adapter-static`, written into the standard once it builds and deploys.

## Later

- The beta packages move to their releases, when they graduate, as [development](development.md#beta-packages) lists.

## Open questions

- **Pages that aren't the repository.** markz's quality page and ship's dashboard are built pages, not files in the commit. As things are, the quality page sits outside prose's frame with no bar, and ship renders its docs with markz beside a hand-written page. Either the page is hidden from the rest of the site, or each site grows a small generator of its own, without prose's styles or syntax highlighting, repeating what prose already does. prose has said it isn't a site generator, so the answer may be a way to hand prose a page, sitez publishing a package's site, or something else.

- Should a site's docs be checked for the same sections, or only for the files?
