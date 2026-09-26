import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
// @ts-ignore Node type-stripping uses the source extension.
import { DEFAULT_ASSETS, parseManifest } from "../lib/game/assets.ts";
// @ts-ignore Node type-stripping uses the source extension.
import { fitModel } from "../lib/game/models.ts";
test("default pack is valid; model and sound replacements preserve the contract", () => {
  const pack = structuredClone(DEFAULT_ASSETS);
  pack.cat.model = "/assets/models/cat.glb";
  pack.audio.upgrade.url = "/assets/audio/real-cat.ogg";
  pack.upgradeIcons.power = "/assets/ui/heavy-paws.png";
  assert.equal(parseManifest(pack), pack);
});
test("malformed packs fail deliberately instead of misconfiguring gameplay", () => {
  for (const mutate of [
    (p: any) => (p.version = 2),
    (p: any) => (p.cat.height = 0),
    (p: any) => (p.audio.upgrade.volume = 10),
    (p: any) => (p.planet.texture = "https://example.com/earth.jpg"),
    (p: any) => (p.cat.model = "/../private.glb"),
  ]) {
    const p = structuredClone(DEFAULT_ASSETS);
    mutate(p);
    assert.throws(() => parseManifest(p));
  }
});
test("artist models are centered and normalized independently of source units", () => {
  const model = new T.Mesh(
    new T.BoxGeometry(2, 6, 3),
    new T.MeshBasicMaterial(),
  );
  model.position.set(10, -15, 3);
  const root = fitModel(model, 1.8, "height");
  const box = new T.Box3().setFromObject(root),
    size = box.getSize(new T.Vector3()),
    center = box.getCenter(new T.Vector3());
  assert.ok(Math.abs(size.y - 1.8) < 1e-6);
  assert.ok(center.length() < 1e-6);
  const asteroid = new T.Mesh(
    new T.BoxGeometry(20, 10, 5),
    new T.MeshBasicMaterial(),
  );
  const normalized = fitModel(asteroid, 2, "diameter");
  const extent = new T.Box3()
    .setFromObject(normalized)
    .getSize(new T.Vector3());
  assert.equal(Math.max(extent.x, extent.y, extent.z), 2);
});
test("empty models fail with a useful error", () => {
  assert.throws(
    () => fitModel(new T.Group(), 1.8, "height"),
    /no measurable geometry/,
  );
});

test("a self-contained artist GLB actually loads and creates independent instances", async () => {
  // @ts-ignore Node type-stripping uses the source extension.
  const { ModelAssets } = await import("../lib/game/models.ts");
  const vertices = new Float32Array([-1, 0, 0, 1, 0, 0, 0, 2, 0]);
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: vertices.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: vertices.byteLength },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-1, 0, 0],
        max: [1, 2, 0],
      },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(bytes.length / 4) * 4, 32);
  bytes.copy(padded);
  const total = 12 + 8 + padded.length + 8 + vertices.byteLength;
  const glb = Buffer.alloc(total);
  glb.write("glTF", 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(total, 8);
  glb.writeUInt32LE(padded.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(glb, 20);
  const offset = 20 + padded.length;
  glb.writeUInt32LE(vertices.byteLength, offset);
  glb.writeUInt32LE(0x004e4942, offset + 4);
  Buffer.from(vertices.buffer).copy(glb, offset + 8);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(glb);
  const pack = structuredClone(DEFAULT_ASSETS);
  pack.cat.model = "/assets/models/artist.glb";
  const bank = new ModelAssets(pack);
  try {
    await bank.load();
    const first = bank.instantiate(pack.cat.model, 1.8, "height"),
      second = bank.instantiate(pack.cat.model, 1.8, "height");
    assert.ok(first);
    assert.ok(second);
    assert.notEqual(first.root, second.root);
    const height = new T.Box3()
      .setFromObject(first.root)
      .getSize(new T.Vector3()).y;
    assert.ok(Math.abs(height - 1.8) < 1e-6);
  } finally {
    globalThis.fetch = oldFetch;
    bank.dispose();
  }
});
