# Plan

## Where it is

### The docs

Every repository serves its docs on its site, and ship's are at `ship.amitkaps.com/docs/`, so every `AGENTS.md` can link to the standard there. Every repository has the same docs, checked by the survey and written by `pnpm new`, and pagez's design moved to it from sitez. `prose check` runs in every `verify`, so a mistake in a doc stops a merge.

### Dependencies

pnpm's one-day wait is on everywhere, with our own scope excluded. Versions and actions move from here, so Dependabot is gone. The dashboard links each repository's site and npm release.

### Releases and new repositories

Merging a version bump releases a package, with npm's 2FA approval the one step by hand. A package's pull request needs one release-notes label, and CI fails without it. `pnpm new` starts a repository that passes from its first commit, and pagez was the first.

### The standard

The toolchain, scripts, branch rules, agents' instructions and release files are the same everywhere, and `pnpm drift` and the dashboard check them. `pnpm drift` only reads, and `pnpm align` writes: a pull request for each repository's files, and their GitHub and Worker settings directly. Versions come from this repository, not from npm. Each rule has an id, stated once in the standard, with its check and its fix in `scripts/rules.ts`. Every repository opens its pull requests with `pnpm pr` and cleans up with `pnpm gone`, from files copied from here.

### Sites

ship, markz, prose and sitez are [prose sites](standard.md#a-prose-site): Vite hands `.prose` to Cloudflare's plugin, and `cf deploy --prebuilt` uploads it. base is [the app](standard.md#an-app), SvelteKit with `adapter-cloudflare`, kept for a site that needs code on the server. It stays on wrangler until cf can deploy what the adapter writes. Every Worker builds and deploys `main` with the same settings.

## Next, in order

1. Build `pnpm new` from the fixes, so a new repository is an empty one with every fix applied, and the generator can't follow the standard any less than `pnpm align` does.
2. Run `pnpm align` by hand, the first time, and fix what it trips on: opening the pull requests, and whether exact pins stay exact.
3. Decide how the shared scripts and workflows reach the repositories without being copied. Copying, with a rule that checks each copy, works until then. The options include an npm package, a GitHub reusable workflow, and running them from a checkout of this repository.

## Later

- The beta packages move to their releases, when they graduate, as [development](development.md#beta-packages) lists.
- base moves to cf when SvelteKit's adapter writes cf's Build Output, and wrangler leaves the catalog with it.
- base moves to TypeScript 7 when svelte-check's peer range takes it.

## Open questions

- **Pages that aren't the repository.** ship's dashboard is now a doc with empty sections that a script fills after `prose build`, so it has prose's bar and styles. markz's quality page still sits outside prose's frame with no bar. It could become a doc the same way, or prose could take a page for a section, so the trick isn't needed.

- **A site's docs.** Should they be checked for the same sections, or only for the files?

- **A deploy by hand picks no account.** The login sees two Cloudflare accounts, so `pnpm ship` on a laptop stops and asks for `CLOUDFLARE_ACCOUNT_ID`. Workers Builds isn't affected, and `pnpm align` picks the account by name. The account could go in `cloudflare.config.ts`, or a deploy by hand could stay rare enough to set the variable.

- **The dashboard is only as fresh as ship's last deploy.** It's built when ship deploys, so a change merged in another repository doesn't show until ship merges something. After the AGENTS.md change, it showed four repositories as drifting that had already moved. A daily rebuild, an Actions cron calling a deploy hook, would keep it within a day.
