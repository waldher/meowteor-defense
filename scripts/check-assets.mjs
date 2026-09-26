import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve("public");
const pack = JSON.parse(
  await readFile(resolve(root, "assets/manifest.json"), "utf8"),
);
if (pack.version !== 1) throw new Error("Unsupported manifest version");
const paths = [
  pack.cat.model,
  pack.planet.texture,
  ...Object.values(pack.asteroids),
  ...Object.values(pack.audio).map((a) => a.url),
  ...Object.values(pack.upgradeIcons),
].filter(Boolean);
for (const url of new Set(paths)) {
  if (!url.startsWith("/") || url.startsWith("//") || url.includes(".."))
    throw new Error(`Expected a local /assets path: ${url}`);
  const path = resolve(root, "." + url.split("?")[0]),
    info = await stat(path);
  if (!info.size) throw new Error(`Empty asset: ${url}`);
  if (path.endsWith(".glb")) {
    const bytes = await readFile(path);
    if (bytes.toString("utf8", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2)
      throw new Error(`Expected a glTF 2.0 binary: ${url}`);
  }
  console.log(`${url}: ${Math.round(info.size / 1024)} KiB`);
}
console.log("Every configured asset exists.");
