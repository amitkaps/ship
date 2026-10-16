/** @prose
 * # This repository, as the standard
 *
 * What the other scripts read from this repository's own files: its folder, its owner on GitHub,
 * and its `package.json`, whose versions, engines and scripts are the standard's. It imports
 * nothing of theirs, so any of them can import it.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const OWNER = "amitkaps";

export const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const read = (file: string): string => (existsSync(file) ? readFileSync(file, "utf8") : "");

export type Pkg = {
  name?: string;
  private?: boolean;
  files?: string[];
  publishConfig?: { access?: string };
  packageManager?: string;
  devEngines?: {
    packageManager?: { name?: string; version?: string; onFail?: string };
    runtime?: { version?: string; onFail?: string };
  };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: { node?: string };
};

export const standard = JSON.parse(read(join(here, "package.json"))) as Pkg;

export const nodeMajor = /\d+/.exec(standard.engines?.node ?? "")?.[0];
