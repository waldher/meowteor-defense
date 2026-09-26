import * as T from "three";
/** Original placeholder artwork. An asset pack replaces this without changing gameplay. */
export class ProceduralCat {
  cat = new T.Group();
  head = new T.Group();
  tail = new T.Group();
  leftPaw = new T.Group();
  rightPaw = new T.Group();
  private materials = new Map<string, T.MeshStandardMaterial>();
  constructor(private software: boolean) {
    this.build();
  }
  material(color: string) {
    let m = this.materials.get(color);
    if (!m) {
      m = new T.MeshStandardMaterial({ color, roughness: 0.75 });
      this.materials.set(color, m);
    }
    return m;
  }
  ball(
    parent: T.Object3D,
    color: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    const m = new T.Mesh(
      new T.SphereGeometry(1, this.software ? 8 : 20, this.software ? 6 : 14),
      this.material(color),
    );
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  }
  build() {
    const fur = "#e6a35c",
      cream = "#ffe1ad",
      dark = "#50392c";
    this.ball(this.cat, fur, 0, 0, 0, 0.43, 0.61, 0.31);
    this.ball(this.cat, cream, 0, -0.01, 0.25, 0.29, 0.43, 0.1);
    this.ball(this.cat, fur, -0.29, -0.43, 0.04, 0.21, 0.21, 0.27);
    this.ball(this.cat, fur, 0.29, -0.43, 0.04, 0.21, 0.21, 0.27);
    this.head.position.y = 0.62;
    this.cat.add(this.head);
    this.ball(this.head, fur, 0, 0, 0.08, 0.49, 0.41, 0.35);
    for (const sign of [-1, 1]) {
      const ear = new T.Mesh(
        new T.ConeGeometry(0.26, 0.46, 3),
        this.material(fur),
      );
      ear.position.set(sign * 0.32, 0.34, 0.045);
      ear.rotation.y = Math.PI;
      ear.rotation.z = sign * -0.22;
      this.head.add(ear);
      const inner = new T.Mesh(
        new T.ConeGeometry(0.145, 0.27, 3),
        this.material("#ee938d"),
      );
      inner.position.set(sign * 0.32, 0.37, 0.18);
      inner.rotation.y = Math.PI;
      inner.rotation.z = sign * -0.22;
      this.head.add(inner);
      this.ball(this.head, cream, sign * 0.14, -0.13, 0.38, 0.19, 0.14, 0.07);
      this.ball(
        this.head,
        "#d4ef94",
        sign * 0.2,
        0.04,
        0.375,
        0.11,
        0.13,
        0.045,
      );
      this.ball(
        this.head,
        "#15252b",
        sign * 0.2,
        0.04,
        0.417,
        0.043,
        0.105,
        0.02,
      );
      this.ball(
        this.head,
        "#ffffff",
        sign * 0.18,
        0.075,
        0.437,
        0.027,
        0.033,
        0.013,
      );
      for (let i = 0; i < 3; i++) {
        const line = new T.Line(
          new T.BufferGeometry().setFromPoints([
            new T.Vector3(sign * 0.21, -0.13 - i * 0.045, 0.44),
            new T.Vector3(sign * 0.67, -0.1 - i * 0.085, 0.4),
          ]),
          new T.LineBasicMaterial({ color: 0xffe9ce }),
        );
        this.head.add(line);
      }
      for (let j = 0; j < 2; j++) {
        this.ball(
          this.head,
          dark,
          sign * (0.37 + j * 0.01),
          -0.01 - j * 0.105,
          0.29,
          0.105,
          0.029,
          0.026,
        );
      }
    }
    const nose = new T.Mesh(
      new T.ConeGeometry(0.078, 0.08, 3),
      this.material("#bd6673"),
    );
    nose.rotation.z = Math.PI;
    nose.position.set(0, -0.12, 0.46);
    this.head.add(nose);
    for (const x of [-0.13, 0, 0.13])
      this.ball(this.head, dark, x, 0.25, 0.3, 0.035, 0.12, 0.03);
    const collar = new T.Mesh(
      new T.TorusGeometry(0.33, 0.055, 8, 32),
      this.material("#9bf07b"),
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.31, 0);
    this.cat.add(collar);
    this.ball(this.cat, "#ffdf78", 0, 0.26, 0.34, 0.075, 0.09, 0.045);
    for (const [paw, sign] of [
      [this.leftPaw, -1],
      [this.rightPaw, 1],
    ] as const) {
      paw.position.set(sign * 0.35, 0.18, 0);
      this.cat.add(paw);
      this.ball(paw, fur, sign * 0.1, 0.17, 0.03, 0.17, 0.34, 0.18);
      this.ball(paw, cream, sign * 0.14, 0.42, 0.14, 0.2, 0.18, 0.2);
      this.ball(paw, "#e58a92", sign * 0.14, 0.43, 0.31, 0.095, 0.08, 0.027);
      for (let j = -1; j < 2; j++)
        this.ball(
          paw,
          "#e58a92",
          sign * 0.14 + j * 0.08,
          0.53,
          0.29,
          0.033,
          0.04,
          0.02,
        );
    }
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(0.3, -0.4, -0.1),
      new T.Vector3(0.8, -0.4, -0.2),
      new T.Vector3(1, -0.05, -0.1),
      new T.Vector3(0.9, 0.28, 0),
      new T.Vector3(0.7, 0.3, 0),
    ]);
    this.tail.add(
      new T.Mesh(
        new T.TubeGeometry(curve, 28, 0.11, 8, false),
        this.material(fur),
      ),
    );
    this.cat.add(this.tail);
  }
}
