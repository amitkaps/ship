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

Two packages are still beta. Check them with `pnpm view <name> dist-tags`.

| Package                   | Pinned                     | Status (2026-10-16)                 | Done when                      |
| ------------------------- | -------------------------- | ----------------------------------- | ------------------------------ |
| `@cloudflare/vite-plugin` | `2.0.0-beta.sha-67fa336fd` | `beta` tag only; `latest` is 1.64.0 | `latest` is a 2.x release      |
| `cf`                      | `1.0.0-beta.17`            | `latest` is the beta                | `latest` is a non-beta release |

`pnpm align` leaves both alone, since their tags don't say which build goes with which. When a package graduates, update the pins in `package.json` and the table above. Then run `pnpm run verify` and a deploy from the Git-connected Worker before you rely on it.
