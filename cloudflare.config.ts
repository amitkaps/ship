/** @prose
 * # The Worker
 *
 * What Cloudflare runs: its name, compatibility date, domain and how it serves the files. This
 * is cf's typed config, the shape `cf init` generates, and the long-term replacement for
 * `wrangler.toml` and `wrangler.jsonc`. The Vite plugin reads it at build time and writes it
 * into the Build Output, so `cf deploy` needs nothing else.
 *
 * Keep the name equal to the Worker connected to this repository in the dashboard. A different
 * name deploys to a different Worker. The build and deploy commands aren't here, since cf's config has no
 * field for them. They're set on the Worker, as [docs/standard.md](docs/standard.md) lists.
 */
import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "ship",
    compatibilityDate: "2026-10-09",
    domains: ["ship.amitkaps.com"],
    assets: {
      // Serve the 404.html prose writes for any missing address.
      notFoundHandling: "404-page",
    },
  },
});
