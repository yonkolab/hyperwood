import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { validateOpenApi, writeBundledOpenApi } from "./openapi.mjs";

const require = createRequire(import.meta.url);
const referenceDir = resolve(process.cwd(), "docs/reference");
const bundledSpecPath = resolve(referenceDir, "openapi.json");
const htmlPath = resolve(referenceDir, "index.html");
const scalarScriptPath = resolve(referenceDir, "scalar.js");

const scalarPackageEntrypoint = require.resolve("@scalar/api-reference");
const scalarStandalonePath = resolve(
  dirname(dirname(scalarPackageEntrypoint)),
  "dist/browser/standalone.js",
);

await validateOpenApi();
await mkdir(referenceDir, { recursive: true });
await writeBundledOpenApi(bundledSpecPath);
await copyFile(scalarStandalonePath, scalarScriptPath);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hyperwood API Reference</title>
    <style>
      html, body, #app {
        margin: 0;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="./scalar.js"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: './openapi.json',
        title: 'Hyperwood API Reference',
      });
    </script>
  </body>
</html>
`;

await writeFile(htmlPath, html, "utf8");

console.log(`Scalar reference written to ${htmlPath}`);
