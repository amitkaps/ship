# Development

How this repository is built and changed. What every repository shares is in [the standard](standard.md), and isn't repeated here.

## Changing the standard

A change to how things are done starts here, in the config and in [the standard](standard.md). When it can be checked, it's also a rule. That's a list item in the standard that opens with an id, like ``- `scripts.verify`: …``, and a check under the same id in [scripts/rules.ts](../scripts/rules.ts), with a fix when one can be automated. [rules.test.ts](../scripts/rules.test.ts) fails if either has an id the other doesn't. `pnpm drift` then lists the repositories to bring in line, each with its own pull request. What the change taught goes in [the lessons](lessons.md), in the same pull request.

## The scripts

The scripts keep the repositories in step, and run with Node, so there's no build. [Usage](usage.md) says how to run them, and [scripts/](../scripts/README.md) says what each one does.

## The site

The site is `prose build`, like a package's, so the README is its home page and the standard reads at `ship.amitkaps.com/docs/standard.md`. [The dashboard](dashboard.md) is a doc too, and `pnpm dashboard` writes the survey's tables into the page prose built from it. Vite hands the folder to Cloudflare, as [vite.config.ts](../vite.config.ts) says.

`pnpm dev` reads the working tree with prose, as it's written, with the dashboard's tables left out. To see them, commit, then run `pnpm verify` and `pnpm preview`.

The Worker `ship` is connected to this repository, and each push to `main` builds and deploys it. Its settings on Cloudflare are the ones every Worker has, listed in [the standard](standard.md#cloudflare).

## Beta packages

The packages still on a beta are the ones [`versions.beta`](standard.md#other-versions) names, and `package.json` has their builds. `pnpm align` leaves them alone, since their tags don't say which build goes with which. It lists one in its pull request once npm's latest for it is a release at the beta's major or later.

To move one, pin the release in `package.json` and take it out of `versions.beta`. Then run `pnpm run verify` and a deploy from the Git-connected Worker before you rely on it.
