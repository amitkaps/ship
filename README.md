# ship

How every repository builds, checks and deploys, kept as one working example. [The standard](docs/standard.md) says what the one way is, and [the lessons](docs/lessons.md) say why. The site at [ship.amitkaps.com](https://ship.amitkaps.com) shows how far each repository has drifted from it.

```sh
pnpm drift                 # check every repository against the standard
pnpm align                 # bring every repository in line, a pull request each
pnpm release sitez 0.5.0   # open the pull request that releases a package
pnpm new <name> --package  # start a repository that follows the standard, or --site, --tool
```

[Usage](docs/usage.md) has the logins each needs and how to read what they print, and [the docs](docs/README.md) hold the rest.
