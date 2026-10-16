# Dashboard

How far each repository has drifted from [the standard](standard.md), as of the site's last deploy. `pnpm drift` prints the same checks, and [usage](usage.md#checking) says how to read them.

Each column is a repository, as it is on `main`. A check that passes is green, one that has drifted is red with what's off, and a held one is amber with the reason the tool can't follow yet.

## Checks

{@section #checks-table}
The build writes the checks here. Run `pnpm dashboard` after `pnpm prose build` to see them.
{/section}

## Scripts

Every script by name, the shared ones first, so a name that means different things in two repositories is easy to spot.

{@section #scripts-table}
The build writes the scripts here.
{/section}

```=html
<style>
  :is(#checks-table, #scripts-table) {
    & col.ask {
      width: 12rem;
    }
    & th small {
      display: block;
      font-weight: normal;
      color: var(--muted);
    }
    & .group th {
      color: var(--muted);
      font-size: var(--text-xs);
      font-weight: normal;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    & td ul {
      margin: 0;
      padding-left: 1.1em;
    }
    & code span {
      white-space: nowrap;
    }
    & .na,
    & .why {
      color: var(--muted);
    }
    & .ok {
      color: var(--success);
    }
    & .bad {
      color: var(--danger);
      background: var(--danger-soft);
    }
    & .held {
      color: var(--warning);
      background: var(--warning-soft);
    }
  }
</style>
```
