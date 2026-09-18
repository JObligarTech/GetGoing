// MapLibre 6 ships its worker as an ES module that imports a shared chunk. Bundlers
// rewrite that pair inconsistently (the worker then dies on start and nothing that
// needs it — GeoJSON lines — renders), so we serve the two files ourselves from
// public/maplibre and point MapLibre at them with setWorkerUrl(). Runs before dev/build.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const { version } = JSON.parse(readFileSync(join(dist, "..", "package.json"), "utf8"));
const out = new URL("../public/maplibre/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(dist, f), join(out, f));
writeFileSync(join(out, "VERSION"), `${version}\n`);
console.log(`maplibre worker ${version} → public/maplibre`);
