/** @prose
 * # The docs pages
 *
 * Renders `docs/` with markz into the site's own pages, the way base renders its docs, so the
 * standard reads at `ship.amitkaps.com/docs/standard.md`, the address every `AGENTS.md` links to.
 * A doc's address is its path, and Cloudflare serves `docs/standard.md.html` there.
 * `docs/README.md` is the docs' own page, at `/docs/`.
 *
 * The bar on every page links the docs in the order `docs/README.md`'s `nav` lists them, so
 * GitHub and the site read them in one order. A link out of `docs/`, like one to
 * `scripts/survey.ts`, goes to the file on GitHub, since the site carries only the docs.
 *
 * markz keeps anything outside its dialect as literal text and warns, and a warning fails the
 * build, naming the file and line, as it does in base.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";
import { headings, html, parse, position } from "@amitkaps/markz";
import { OWNER } from "./survey.ts";

const DOCS = "docs";
const GITHUB = `https://github.com/${OWNER}/ship/blob/main`;

const escape = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

type Doc = { file: string; title: string; body: string };

function render(file: string): Doc {
  const path = join(DOCS, file);
  const source = readFileSync(path, "utf8");
  const doc = parse(source);
  if (doc.warnings.length) {
    const at = position(source);
    const issues = doc.warnings.map((w) => `line ${at(w.start).line}: ${w.message}`).join("; ");
    throw new Error(`${path}: ${issues}`);
  }
  const title = headings(doc)[0]?.text ?? file;
  return { file, title, body: links(html(doc)) };
}

// A link to another doc stays relative. One to the docs' README goes to `/docs/`, and one out of
// `docs/` goes to GitHub.
function links(body: string): string {
  return body.replace(/href="([^"#:]+)(#[^"]*)?"/g, (_, target: string, hash = "") => {
    const path = posix.normalize(posix.join(DOCS, target));
    if (path === `${DOCS}/README.md`) return `href="/docs/${hash}"`;
    if (path.startsWith(`${DOCS}/`)) return `href="/${path}${hash}"`;
    return `href="${GITHUB}/${path.replace(/\/$/, "")}${hash}"`;
  });
}

const all = (): Doc[] =>
  readdirSync(DOCS)
    .filter((file) => file.endsWith(".md"))
    .map(render);

function nav(): string[] {
  const index = parse(readFileSync(join(DOCS, "README.md"), "utf8"));
  const list = index.metadata?.["nav"];
  return Array.isArray(list) ? list.map(String) : [];
}

const address = (file: string): string => (file === "README.md" ? "/docs/" : `/docs/${file}`);

/** The bar at the top of every page: home, the docs in reading order, and GitHub. */
export function bar(current = ""): string {
  const titles = new Map(all().map((doc) => [doc.file, doc.title]));
  const items = nav()
    .filter((file) => titles.has(file))
    .map((file) => {
      const here = file === current ? ' aria-current="page"' : "";
      return `<a href="${address(file)}"${here}>${escape(titles.get(file) ?? file)}</a>`;
    });
  return `<header class="bar"><a class="home" href="/">ship</a><nav aria-label="Docs"><a href="/docs/"${
    current === "README.md" ? ' aria-current="page"' : ""
  }>Docs</a>${items.join("")}</nav><a href="https://github.com/${OWNER}/ship">GitHub</a></header>`;
}

// The docs pages carry the site's stylesheet inline, since Vite builds only the two HTML pages.
const style = (): string => readFileSync("style.css", "utf8");

const frame = (title: string, top: string, body: string, commit: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escape(title)} · ship</title>
    <style>${style()}</style>
  </head>
  <body>
    ${top}
    <main>${body}</main>
    <footer>commit ${commit}</footer>
  </body>
</html>
`;

/** Every doc as a page, with the file it's written to and the address it's served at. */
export function pages(commit: string): { fileName: string; address: string; html: string }[] {
  return all().map((doc) => ({
    fileName: doc.file === "README.md" ? "docs/index.html" : `docs/${doc.file}.html`,
    address: address(doc.file),
    html: frame(doc.title, bar(doc.file), `<article class="doc">${doc.body}</article>`, commit),
  }));
}
