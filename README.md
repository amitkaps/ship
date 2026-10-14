# ship

How every repository builds, checks and deploys, kept as one working example. [The standard](docs/standard.md) says what the one way is, and [the lessons](docs/lessons.md) say why. [The docs](docs/README.md) also hold the design, the plan and how this repository is developed. This repository follows it exactly, and `pnpm drift` checks the others against it.

It's also a live site, at `ship.amitkaps.com`: a minimal static site, with one `index.html` and a `404.html`, built with Vite+ and deployed to Cloudflare with cf. Any new site starts by copying it. The home page shows the drift check as two tables, the checks and every repository's scripts, as of the last deploy. The docs are on the site too, rendered with markz, so the standard is at `ship.amitkaps.com/docs/standard.md`.

```sh
# needs Node 26: package.json (devEngines) pins it, and pnpm fetches its own pinned version
pnpm install
pnpm dev          # local dev server
pnpm verify       # check, test and build: what CI and every deploy run
pnpm ship         # upload the last build (normally left to the Git integration)
pnpm prose        # read the repository as a document
pnpm drift        # check every repository against the standard, as of GitHub's main
pnpm drift --local  # the same, from the checkouts next to this one
pnpm drift ../site  # one folder, listed or not
pnpm protect      # apply the branch rules, merge settings and package labels on GitHub
pnpm release sitez 0.5.0  # open the pull request that releases a package
pnpm new <name> --package  # start a repository that follows the standard, or --site, --tool
pnpm test         # generate each kind of repository, and check them
```

## What's here

```text
index.html, 404.html    the site's two pages, and style.css, which the docs pages share
vite.config.ts          the build: Vite+, and the Cloudflare plugin
cloudflare.config.ts    the Worker: name, domain and asset handling
pnpm-workspace.yaml     pnpm's settings, the same in every repository
.github/workflows/      CI, which runs pnpm run verify
docs/                   the design, the standard, the plan, the lessons and development
scripts/                the survey, pnpm drift, the home page's tables and the docs pages
tsconfig.json           the strict type checks, which lint runs
.github/ruleset.json    the branch rules every main has
.github/settings.json   the merge settings every repository has
.github/labels.json     the labels a package's release notes are grouped by
package/                the release files every package copies in
AGENTS.md, CLAUDE.md    instructions for agents, opening with the shared sections
```
