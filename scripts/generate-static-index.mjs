import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const clientDir = "dist/client";
const serverBundle = "../dist/server/server.js";

const routes = [
  "/",
  "/login",
  "/dashboard",
  "/assistant",
  "/reports",
  "/alerts",
  "/municipality",
  "/technician",
  "/settings",
  "/ussd",
  "/meter/NXM-001-TZN",
];

const { default: server } = await import(serverBundle);

async function renderRoute(route) {
  const response = await server.fetch(new Request(`https://wattwise.local${route}`), {}, {});
  if (!response.ok) {
    throw new Error(`Could not prerender ${route}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error(`Could not prerender ${route}: expected HTML, got ${contentType}`);
  }

  return response.text();
}

async function writeRoute(route, html) {
  const normalized = route === "/" ? "index.html" : join(route.slice(1), "index.html");
  const target = join(clientDir, normalized);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, html);
  return target;
}

for (const route of routes) {
  const html = await renderRoute(route);
  const target = await writeRoute(route, html);
  console.log(`Prerendered ${route} -> ${target}`);
}
