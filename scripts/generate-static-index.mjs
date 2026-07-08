import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const clientDir = "dist/client";
const assetsDir = join(clientDir, "assets");

const files = await readdir(assetsDir);
const entryScript = files.find((file) => /^index-[\w-]+\.js$/.test(file));
const stylesheet = files.find((file) => /^styles-[\w-]+\.css$/.test(file));

if (!entryScript) {
  throw new Error("Could not find built client entry asset in dist/client/assets.");
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WattWise</title>
    <meta
      name="description"
      content="Smart electricity monitoring and civic reporting for South African households and municipalities."
    />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
    />
    ${stylesheet ? `<link rel="stylesheet" href="/assets/${stylesheet}" />` : ""}
    <script type="module" crossorigin src="/assets/${entryScript}"></script>
  </head>
  <body></body>
</html>
`;

await writeFile(join(clientDir, "index.html"), html);
console.log(`Generated ${join(clientDir, "index.html")} for Azure Static Web Apps.`);
