/**
 * 阶段 0 最小 WebGL 渲染：Three.js 场景骨架。
 * 展示确定性地形的方块网格；这是可运行画面，供 Stage 1+ 扩展光照与第一人称。
 */

import * as THREE from "three";
import type { GeneratedWorld } from "../world/generator";
import { CHUNK_SIZE } from "../world/types";
import type { BlockId } from "../world/types";
import { blockColor } from "../blocks/registry";

/** 取方块占位颜色（阶段 1 使用注册表；纹理接入由后续阶段完成）。 */
function colorOf(block: BlockId): number {
  return blockColor(block);
}

export class StageRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private meshes = new Map<string, THREE.Mesh>();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 30, 90);
    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      200
    );
    this.camera.position.set(8, 24, 12);
    this.camera.lookAt(8, 4, 8);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(10, 30, 10);
    this.scene.add(dir);
  }

  private key(lx: number, y: number, lz: number): string {
    return `${lx},${y},${lz}`;
  }

  renderWorld(world: GeneratedWorld, cx: number, cz: number): void {
    // 仅通过公共只读接口遍历当前区块。
    const seen = new Set<string>();
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const h = world.getHeight(wx, wz);
        for (let y = 0; y <= h; y++) {
          const block = world.getBlock({ x: wx, y, z: wz });
          if (block === "air" || block === "water") continue;
          const k = this.key(wx, y, wz);
          seen.add(k);
          let mesh = this.meshes.get(k);
          if (!mesh) {
            const geo = new THREE.BoxGeometry(1, 1, 1);
            const mat = new THREE.MeshLambertMaterial({
              color: colorOf(block),
            });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(wx - 0.5, y - 0.5, wz - 0.5);
            this.scene.add(mesh);
            this.meshes.set(k, mesh);
          } else {
            mesh.visible = true;
          }
        }
      }
    }
    // 隐藏不在本区块的旧方块（简单卸载）。
    for (const [k, m] of this.meshes) {
      if (!seen.has(k)) m.visible = false;
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
}
