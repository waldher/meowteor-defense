import * as T from "three";
import { ProceduralCat } from "./procedural-cat";
import { ModelAssets, CatAnimation } from "./models";
import { DEFAULT_ASSETS, type AssetManifest } from "./assets";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { Game, type Effect, type Rock } from "./simulation";
const TAU = Math.PI * 2;
export class SpaceScene {
  private vocalTime = 0;
  private catAnimation: CatAnimation | null = null;
  renderer: T.WebGLRenderer | SVGRenderer;
  software = false;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(38, 1, 0.1, 100);
  game: Game;
  cat = new T.Group();
  world = new T.Group();
  earth: T.Mesh;
  atmosphere: T.Mesh;
  orbit: T.Mesh;
  stars: T.Points;
  leftPaw = new T.Group();
  rightPaw = new T.Group();
  tail = new T.Group();
  head = new T.Group();
  rockMeshes = new Map<number, T.Group>();
  effects: {
    mesh: T.Object3D;
    age: number;
    life: number;
    velocity?: T.Vector3;
  }[] = [];
  width = 1;
  height = 1;
  frame = 0;
  menuShift = 0;
  shake = 0;
  clock = 0;
  quality = 1;
  disposed = false;
  ro: ResizeObserver;
  onLost: () => void;
  canvas: HTMLCanvasElement;
  private rockGeo = new T.IcosahedronGeometry(1, 1);
  private particleGeo = new T.IcosahedronGeometry(0.065, 0);
  private materials = new Map<string, T.MeshStandardMaterial>();
  constructor(
    canvas: HTMLCanvasElement,
    game: Game,
    onLost: () => void,
    private assets: AssetManifest = DEFAULT_ASSETS,
    private models: ModelAssets = new ModelAssets(assets),
  ) {
    this.canvas = canvas;
    this.game = game;
    this.onLost = onLost;
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl2", {
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {}
    if (gl) {
      const renderer = new T.WebGLRenderer({
        canvas,
        context: gl,
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
      renderer.setClearColor(0x070b17, 0);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      this.renderer = renderer;
    } else {
      this.software = true;
      const renderer = new SVGRenderer();
      renderer.setQuality("low");
      renderer.setPrecision(2);
      renderer.setClearColor(new T.Color(0x070b17), 1);
      renderer.domElement.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0";
      canvas.parentElement!.appendChild(renderer.domElement);
      this.renderer = renderer;
    }
    this.camera.position.set(0, 0, 24);
    this.scene.add(new T.AmbientLight(0xa6bbec, 2));
    const light = new T.DirectionalLight(0xffe1b5, 3.5);
    light.position.set(-6, 8, 12);
    this.scene.add(light);
    const rim = new T.DirectionalLight(0x858bff, 3);
    rim.position.set(6, -2, 3);
    this.scene.add(rim);
    this.scene.add(this.world);
    const em = new T.MeshStandardMaterial({
      color: 0x237be6,
      roughness: 0.83,
      metalness: 0.06,
    });
    this.earth = new T.Mesh(
      new T.SphereGeometry(
        1.45,
        this.software ? 32 : 48,
        this.software ? 20 : 32,
      ),
      em,
    );
    this.earth.rotation.z = 0.22;
    this.world.add(this.earth);
    new T.TextureLoader().load(
      assets.planet.texture,
      (tex) => {
        if (this.disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = T.SRGBColorSpace;
        if (this.software) {
          const c = document.createElement("canvas");
          c.width = tex.image.width;
          c.height = tex.image.height;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(tex.image, 0, 0);
          const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
          const geo = this.earth.geometry.toNonIndexed();
          const uv = geo.getAttribute("uv");
          const colors = [];
          for (let i = 0; i < uv.count; i += 3) {
            let u = 0,
              v = 0;
            for (let j = 0; j < 3; j++) {
              u += uv.getX(i + j) / 3;
              v += uv.getY(i + j) / 3;
            }
            const x = Math.min(
                c.width - 1,
                Math.max(0, Math.floor(u * c.width)),
              ),
              y = Math.min(
                c.height - 1,
                Math.max(0, Math.floor((1 - v) * c.height)),
              );
            const ix = (y * c.width + x) * 4;
            const color = new T.Color(
              pixels[ix] / 255,
              pixels[ix + 1] / 255,
              pixels[ix + 2] / 255,
            ).convertSRGBToLinear();
            for (let j = 0; j < 3; j++) colors.push(color.r, color.g, color.b);
          }
          geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
          this.earth.geometry.dispose();
          this.earth.geometry = geo;
          em.vertexColors = true;
          tex.dispose();
        } else em.map = tex;
        em.color.set(0xffffff);
        em.needsUpdate = true;
      },
      undefined,
      () => {},
    );
    this.atmosphere = new T.Mesh(
      new T.SphereGeometry(1.54, 40, 28),
      new T.ShaderMaterial({
        transparent: true,
        side: T.BackSide,
        depthWrite: false,
        blending: T.AdditiveBlending,
        uniforms: {},
        vertexShader:
          "varying vec3 vN; varying vec3 vP; void main(){vN=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.0);vP=p.xyz;gl_Position=projectionMatrix*p;}",
        fragmentShader:
          "varying vec3 vN;varying vec3 vP;void main(){float a=pow(1.0-abs(dot(normalize(vN),normalize(-vP))),3.0);gl_FragColor=vec4(0.19,0.52,1.0,a*0.75);}",
      }),
    );
    this.atmosphere.visible = !this.software;
    this.world.add(this.atmosphere);
    this.orbit = new T.Mesh(
      new T.RingGeometry(2.5, 2.52, 128),
      new T.MeshBasicMaterial({
        color: 0xb9fd7c,
        transparent: true,
        opacity: 0.15,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    this.orbit.position.z = -0.5;
    this.world.add(this.orbit);
    const orbit2 = new T.Mesh(
      new T.RingGeometry(3.78, 3.79, 128),
      new T.MeshBasicMaterial({
        color: 0xb9fd7c,
        transparent: true,
        opacity: 0.08,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    orbit2.position.z = -0.5;
    this.orbit.add(orbit2);
    const positions = new Float32Array(750 * 3),
      colors = new Float32Array(750 * 3);
    for (let i = 0; i < 750; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 65;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = -8 - Math.random() * 20;
      const c = new T.Color().setHSL(
        0.55 + Math.random() * 0.2,
        0.3,
        0.45 + Math.random() * 0.45,
      );
      colors.set(c.toArray(), i * 3);
    }
    const bg = new T.BufferGeometry();
    bg.setAttribute("position", new T.BufferAttribute(positions, 3));
    bg.setAttribute("color", new T.BufferAttribute(colors, 3));
    this.stars = new T.Points(
      bg,
      new T.PointsMaterial({
        size: 0.055,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
      }),
    );
    this.scene.add(this.stars);
    if (this.software) {
      this.scene.traverse((o) => {
        if (o instanceof T.DirectionalLight) o.intensity *= 0.32;
      });
    }
    const custom = !this.software
      ? models.instantiate(assets.cat.model, assets.cat.height, "height")
      : null;
    if (custom) {
      this.cat.add(custom.root);
      this.catAnimation = new CatAnimation(
        custom.root,
        custom.animations,
        assets.cat.clips,
      );
    } else {
      const fallback = new ProceduralCat(this.software);
      this.cat = fallback.cat;
      this.head = fallback.head;
      this.tail = fallback.tail;
      this.leftPaw = fallback.leftPaw;
      this.rightPaw = fallback.rightPaw;
    }
    this.world.add(this.cat);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    canvas.addEventListener("webglcontextlost", this.contextLost);
    this.resize();
  }
  contextLost = (e: Event) => {
    e.preventDefault();
    this.onLost();
  };
  material(color: string) {
    let m = this.materials.get(color);
    if (!m) {
      m = new T.MeshStandardMaterial({ color, roughness: 0.75 });
      this.materials.set(color, m);
    }
    return m;
  }
  resize() {
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    if (!this.width || !this.height) return;
    if (this.renderer instanceof T.WebGLRenderer)
      this.renderer.setSize(this.width, this.height, false);
    else this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    const vertical = this.camera.aspect < 1 ? 8.45 / this.camera.aspect : 8.7;
    this.camera.position.z = vertical / Math.tan(T.MathUtils.degToRad(19));
    this.camera.updateProjectionMatrix();
  }
  point(x: number, y: number, z = 0) {
    const v = new T.Vector3(
      x + this.world.position.x,
      y + this.world.position.y,
      z,
    ).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.width,
      y: (-0.5 * v.y + 0.5) * this.height,
    };
  }
  unproject(x: number, y: number) {
    const v = new T.Vector3(
      (x / this.width) * 2 - 1,
      (-y / this.height) * 2 + 1,
      0.5,
    ).unproject(this.camera);
    const d = v.sub(this.camera.position).normalize();
    const p = this.camera.position
      .clone()
      .add(d.multiplyScalar(-this.camera.position.z / d.z));
    return { x: p.x - this.world.position.x, y: p.y - this.world.position.y };
  }
  addRock(r: Rock) {
    const group = new T.Group();
    const custom = !this.software
      ? this.models.instantiate(this.assets.asteroids[r.kind], 2, "diameter")
      : null;
    if (custom) {
      custom.root.scale.setScalar(r.radius);
      group.add(custom.root);
      this.world.add(group);
      this.rockMeshes.set(r.id, group);
      return group;
    }
    const color =
      r.kind === "splitter"
        ? "#cb78b4"
        : r.kind === "iron"
          ? "#789cbf"
          : r.kind === "comet"
            ? "#83dce5"
            : r.kind === "boss"
              ? "#986583"
              : "#ac8270";
    const mesh = new T.Mesh(this.rockGeo, this.material(color));
    mesh.scale.set(r.radius, r.radius * 0.86, r.radius);
    group.add(mesh);
    const wire = new T.Mesh(
      this.rockGeo,
      new T.MeshBasicMaterial({
        color:
          r.kind === "iron"
            ? 0xc1dafa
            : r.kind === "splitter"
              ? 0xff91c3
              : 0xffcc94,
        wireframe: true,
        transparent: true,
        opacity: r.kind === "rock" ? 0.09 : 0.3,
      }),
    );
    wire.scale.copy(mesh.scale).multiplyScalar(1.008);
    group.add(wire);
    const trail = new T.Mesh(
      new T.ConeGeometry(r.radius * 0.65, r.radius * 5, 6, 1, true),
      new T.MeshBasicMaterial({
        color:
          r.kind === "splitter"
            ? 0xff66ac
            : r.kind === "iron"
              ? 0x8fb5ff
              : 0xffa962,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    trail.position.set(0, r.radius * 2.3, -0.1);
    group.add(trail);
    this.world.add(group);
    this.rockMeshes.set(r.id, group);
    return group;
  }
  effect(e: Effect) {
    if (e.type === "levelComplete") {
      this.vocalTime = 2;
      this.catAnimation?.play("celebrate");
      return;
    }
    if (e.type === "upgrade") {
      this.vocalTime = 0.8;
      this.catAnimation?.play("upgrade");
      return;
    }
    if (e.type === "swat") {
      this.catAnimation?.play("swat");
      const ring = new T.Mesh(
        new T.RingGeometry(0.25, 0.31, 32),
        new T.MeshBasicMaterial({
          color: e.color,
          transparent: true,
          opacity: 0.9,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.position.set(e.x, e.y, 0.5);
      this.world.add(ring);
      this.effects.push({ mesh: ring, age: 0, life: 0.3 });
      return;
    }
    if (e.type === "purr") {
      const ring = new T.Mesh(
        new T.RingGeometry(1.4, 1.53, 96),
        new T.MeshBasicMaterial({
          color: e.color,
          transparent: true,
          opacity: 0.8,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      this.world.add(ring);
      this.effects.push({ mesh: ring, age: 0, life: 1 });
    }
    if (e.type === "impact") this.shake = 0.18;
    const count = e.type === "purr" ? 30 : 12;
    for (let i = 0; i < count; i++) {
      if (this.effects.length > 230) break;
      const mesh = new T.Mesh(this.particleGeo, this.material(e.color));
      mesh.position.set(e.x, e.y, 0.3);
      this.world.add(mesh);
      const a = Math.random() * TAU,
        s = 1.3 + Math.random() * 3;
      this.effects.push({
        mesh,
        age: 0,
        life: 0.45 + Math.random() * 0.45,
        velocity: new T.Vector3(
          Math.cos(a) * s,
          Math.sin(a) * s,
          (Math.random() - 0.3) * 2,
        ),
      });
    }
  }
  render(dt: number) {
    this.clock += dt;
    this.vocalTime = Math.max(0, this.vocalTime - dt);
    this.catAnimation?.tick(dt);
    const menu = this.game.mode === "menu";
    const portrait = this.width < this.height;
    const goal = menu && !portrait ? 3.3 : 0;
    this.world.position.x = T.MathUtils.lerp(this.world.position.x, goal, 0.06);
    this.world.position.y = T.MathUtils.lerp(
      this.world.position.y,
      menu && portrait ? 7.4 : 0,
      0.06,
    );
    this.earth.rotation.y += dt * 0.08;
    this.stars.rotation.z += dt * 0.003;
    this.earth.scale.setScalar(menu ? (portrait ? 2 : 1.7) : 1);
    this.atmosphere.scale.copy(this.earth.scale);
    this.orbit.visible = !menu;
    let a = menu
      ? 1.02 + Math.sin(this.clock * 0.3) * 0.08
      : this.game.targetAngle;
    const diff = Math.atan2(
      Math.sin(a - this.game.catAngle),
      Math.cos(a - this.game.catAngle),
    );
    this.game.catAngle += diff * Math.min(1, dt * 16);
    a = this.game.catAngle;
    const reach = Math.sin(this.game.leap * Math.PI);
    const targetR = Math.hypot(this.game.targetX, this.game.targetY);
    const radius = menu
      ? portrait
        ? 4.1
        : 3.6
      : 2.15 + reach * Math.max(0, targetR - 2.15);
    this.cat.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0.65);
    this.cat.rotation.z =
      a -
      Math.PI / 2 +
      (this.vocalTime > 0 ? Math.sin(this.clock * 12) * 0.025 : 0);
    this.cat.scale.setScalar(menu ? (portrait ? 2.5 : 1.7) : 1);
    this.head.rotation.z =
      Math.sin(this.clock * 1.6) * 0.045 +
      (this.vocalTime > 0 ? Math.sin(this.clock * 9) * 0.08 : 0);
    this.tail.rotation.z = Math.sin(this.clock * 2.5) * 0.18;
    this.leftPaw.rotation.z = -0.45 - Math.sin(this.game.leap * Math.PI) * 1.6;
    this.rightPaw.rotation.z = 0.45 + Math.sin(this.game.leap * Math.PI) * 1.6;
    const alive = new Set(this.game.rocks.map((r) => r.id));
    for (const [id, obj] of this.rockMeshes)
      if (!alive.has(id)) {
        this.world.remove(obj);
        obj.children.forEach((m) => {
          if (m instanceof T.Mesh && m.material instanceof T.MeshBasicMaterial)
            m.material.dispose();
        });
        this.rockMeshes.delete(id);
      }
    for (const r of this.game.rocks) {
      const obj = this.rockMeshes.get(r.id) ?? this.addRock(r);
      obj.position.set(r.x, r.y, 0.1);
      obj.rotation.z = Math.atan2(r.y, r.x) - Math.PI / 2;
      const mesh = obj.children[0];
      mesh.rotation.x = this.clock * 0.8 + r.spin;
      mesh.rotation.y = this.clock * 0.5;
      mesh.scale.setScalar(r.radius * (r.flash > 0 ? 1.2 : 1));
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.age += dt;
      if (e.age > e.life) {
        this.world.remove(e.mesh);
        if (!e.velocity) {
          (e.mesh as T.Mesh).geometry.dispose();
          ((e.mesh as T.Mesh).material as T.Material).dispose();
        }
        this.effects.splice(i, 1);
        continue;
      }
      if (e.velocity) {
        e.mesh.position.addScaledVector(e.velocity, dt);
        e.mesh.scale.setScalar(1 - e.age / e.life);
      } else {
        e.mesh.scale.setScalar(1 + e.age * 7);
        ((e.mesh as T.Mesh).material as T.MeshBasicMaterial).opacity =
          (1 - e.age / e.life) * 0.85;
      }
    }
    this.shake = Math.max(0, this.shake - dt);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.camera.position.x =
      this.shake && !reduced ? (Math.random() - 0.5) * 0.12 : 0;
    this.camera.position.y =
      this.shake && !reduced ? (Math.random() - 0.5) * 0.12 : 0;
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.disposed = true;
    this.catAnimation?.dispose();
    this.models.dispose();
    this.ro.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    const geos = new Set<T.BufferGeometry>(),
      mats = new Set<T.Material>();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Points || o instanceof T.Line) {
        geos.add(o.geometry);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          mats.add(m),
        );
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => {
      if ((m as T.MeshStandardMaterial).map)
        (m as T.MeshStandardMaterial).map?.dispose();
      m.dispose();
    });
    if (this.renderer instanceof T.WebGLRenderer) this.renderer.dispose();
    else this.renderer.domElement.remove();
  }
}
