# ship

How every repository builds, checks and deploys, kept as one working example. [The standard](docs/standard.md) says what the one way is, and [the lessons](docs/lessons.md) say why. [The dashboard](docs/dashboard.md) shows how far each repository has drifted from it.

```sh
pnpm drift                 # check every repository against the standard
pnpm align                 # bring each repository in line, by pull request
pnpm release sitez 0.5.0   # open the pull request that releases a package
pnpm new <name> --package  # start a repository, or --site or --tool
```

[Usage](docs/usage.md) has the logins each needs and how to read what they print, and [the docs](docs/README.md) hold the rest.
