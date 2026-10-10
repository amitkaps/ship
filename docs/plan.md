# Plan

## Where it is

### The docs

Every repository serves its docs on its site, and ship's are at `ship.amitkaps.com/docs/`, so every `AGENTS.md` can link to the standard there.

### Dependencies

pnpm's one-day wait is on everywhere, with our own scope excluded. Versions and actions move from here, so Dependabot is gone. The home page links each repository's site and npm release.

### Releases and new repositories

Merging a version bump releases a package, with npm's 2FA approval the one step by hand. `pnpm new` starts a repository that passes from its first commit, and pagez was the first.

### The standard

The toolchain, scripts, branch rules, agents' instructions and release files are the same everywhere, and `pnpm drift` and the home page check them.

## Next, in order

1. The docs every repository has, for a package and for a site, checked by the survey and written by `pnpm new`.
2. Every `AGENTS.md` links to the standard at `ship.amitkaps.com/docs/standard.md`.
3. Bring the docs in line: markz, then sitez, then base, which reads its site's pages from `docs/`.
4. pagez's first pull request: its docs, its command, and what moves from sitez.
5. sitez bundles pagez.
6. pagez's first release, by hand, with npm's trusted publisher set up after.

## Later

- base moves to cf, when cf can deploy SvelteKit.
- markz and prose move to cf, when cf's config takes an assets folder.
- The beta packages move to their releases, when they graduate, as [development](development.md#beta-packages) lists.

## Open questions

- **Pages that aren't the repository.** markz's quality page and ship's dashboard are built pages, not files in the commit. As things are, the quality page sits outside prose's frame with no bar, and ship renders its docs with markz beside a hand-written page. Either the page is hidden from the rest of the site, or each site grows a small generator of its own, without prose's styles or syntax highlighting, repeating what prose already does. prose has said it isn't a site generator, so the answer may be a way to hand prose a page, sitez publishing a package's site, or something else.

- Should a site's docs be checked for the same sections, or only for the files?
