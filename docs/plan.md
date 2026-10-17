# Plan

## Where it is

### The docs

Every repository serves its docs on its site, and ship's are at `ship.amitkaps.com/docs/`, so every `AGENTS.md` can link to the standard there. Every repository has the same docs, checked by the survey and written by `pnpm new`, and pagez's design moved to it from sitez. `prose check` runs in every `verify`, so a mistake in a doc stops a merge.

### Dependencies

pnpm's one-day wait is on everywhere, with our own scope excluded. Versions and actions move from here, so Dependabot is gone. The dashboard links each repository's site and npm release.

### Releases and new repositories

Merging a version bump releases a package, with npm's 2FA approval the one step by hand. A package's pull request needs one release-notes label, and CI fails without it. `pnpm new` starts a repository that passes from its first commit, by writing its own files and running every fix `pnpm align` runs, and pagez was the first.

### The standard

The toolchain, scripts, branch rules, agents' instructions and release files are the same everywhere, and `pnpm drift` and the dashboard check them. `pnpm drift` only reads, and `pnpm align` writes: a pull request for each repository's files, and their GitHub and Worker settings directly. Versions come from this repository, not from npm. Its first run by hand moved vite-plus 1.3.0 through every repository, with exact pins kept exact. Each rule has an id, stated once in the standard, with its check and its fix in `scripts/rules.ts`. Every repository opens its pull requests with `pnpm pr` and cleans up with `pnpm gone`, from files copied from here.

### Sites

ship, markz, prose and sitez are [prose sites](standard.md#a-prose-site): Vite hands `.prose` to Cloudflare's plugin, and `cf deploy --prebuilt` uploads it. base is [the app](standard.md#an-app), SvelteKit with `adapter-cloudflare`, kept for a site that needs code on the server. It stays on wrangler until cf can deploy what the adapter writes. Every Worker builds and deploys `main` with the same settings.

## Deferred

- **Shared scripts without copies.** `pr.ts`, `gone.ts`, the release workflow and CI's Label step are copied into each repository, with a rule checking each copy. An npm package, a reusable workflow, or running them from a checkout of this repository would remove the copies. It's deferred, since copying works: `pnpm align` carried a new `pr.ts` to five repositories in one run, and the rules catch a copy that drifts.

## Later

- The beta packages move to their releases, when they graduate, as [development](development.md#beta-packages) lists.
- base moves to cf when SvelteKit's adapter writes cf's Build Output, and wrangler leaves the catalog with it.
- base moves to TypeScript 7 when svelte-check's peer range takes it.

## Open questions

- **Keeping the docs fresh.** The docs are checked for their files, not their sections, and that stays. What goes stale is what they say, like `development.md` describing a setting the standard has moved past, and a check can't tell. One cheap signal: the dashboard could show when each doc last changed beside when the code did, so a doc untouched through many changes stands out, without failing anything.
