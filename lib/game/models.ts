import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { AssetManifest, ModelClip } from "./assets";
export function fitModel(
  model: T.Object3D,
  size: number,
  dimension: "height" | "diameter",
) {
  const bounds = new T.Box3().setFromObject(model),
    extent = bounds.getSize(new T.Vector3()),
    center = bounds.getCenter(new T.Vector3());
  const measured =
    dimension === "height" ? extent.y : Math.max(extent.x, extent.y, extent.z);
  if (!Number.isFinite(measured) || measured <= 0)
    throw new Error("Model has no measurable geometry");
  const pivot = new T.Group(),
    alignment = new T.Group();
  model.position.sub(center);
  alignment.add(model);
  alignment.scale.setScalar(size / measured);
  pivot.add(alignment);
  return pivot;
}
/** Cache each GLB once; instances share materials/geometry but have separate skeletons. */
export class ModelAssets {
  private loaded = new Map<string, GLTF>();
  manifest: AssetManifest;
  constructor(manifest: AssetManifest) {
    this.manifest = manifest;
  }
  async load() {
    const urls = [
      this.manifest.cat.model,
      ...Object.values(this.manifest.asteroids),
    ].filter((u): u is string => !!u);
    await Promise.all(
      [...new Set(urls)].map(async (url) => {
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const model = await new GLTFLoader().parseAsync(
            await response.arrayBuffer(),
            url.slice(0, url.lastIndexOf("/") + 1),
          );
          fitModel(clone(model.scene), 1, "diameter");
          this.loaded.set(url, model);
        } catch (e) {
          console.warn(`Model ${url} unavailable; keeping built-in art.`, e);
        }
      }),
    );
    return this;
  }
  instantiate(
    url: string | null,
    size: number,
    dimension: "height" | "diameter",
  ) {
    const gltf = url ? this.loaded.get(url) : undefined;
    if (!gltf) return null;
    return {
      root: fitModel(clone(gltf.scene), size, dimension),
      animations: gltf.animations,
    };
  }
  dispose() {
    const geos = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    for (const gltf of this.loaded.values())
      gltf.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          geos.add(o.geometry);
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            materials.add(m);
            for (const v of Object.values(m))
              if (v instanceof T.Texture) textures.add(v);
          }
        }
      });
    geos.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    this.loaded.clear();
  }
}
export class CatAnimation {
  private mixer: T.AnimationMixer;
  private idle: T.AnimationAction | null = null;
  private action: T.AnimationAction | null = null;
  private clips: T.AnimationClip[];
  private names: Record<ModelClip, string>;
  constructor(
    root: T.Object3D,
    clips: T.AnimationClip[],
    names: Record<ModelClip, string>,
  ) {
    this.clips = clips;
    this.names = names;
    this.mixer = new T.AnimationMixer(root);
    const clip = clips.find((c) => c.name === names.idle);
    if (clip) {
      this.idle = this.mixer.clipAction(clip);
      this.idle.play();
    }
    this.mixer.addEventListener("finished", () => {
      this.action?.fadeOut(0.12);
      this.idle?.reset().fadeIn(0.15).play();
    });
  }
  play(name: Exclude<ModelClip, "idle">) {
    const clip = this.clips.find((c) => c.name === this.names[name]);
    if (!clip) return;
    this.action?.stop();
    const action = this.mixer.clipAction(clip);
    action.reset().setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(0.08).play();
    this.idle?.fadeOut(0.08);
    this.action = action;
  }
  tick(dt: number) {
    this.mixer.update(dt);
  }
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
