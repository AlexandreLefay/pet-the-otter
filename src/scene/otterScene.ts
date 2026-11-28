// Scène 3D de la loutre — portée depuis otter-scene.js (passation design).
// createOtterScene(el, { onPet }) → { dispose() }
// Le conteneur doit avoir une taille ; le canvas le remplit et suit ses redimensionnements.
import * as THREE from 'three'

export interface OtterSceneOptions {
  /** appelé à chaque caresse, avec la position écran (clientX / clientY) */
  onPet?: (x: number, y: number) => void
  /** appelé une fois, après la première image dessinée */
  onReady?: () => void
}

type V3 = [number, number, number]

const INK = 0x1b1a18

/** Posé sur <html> quand le pointeur survole la loutre (le curseur main se met à caresser). */
export const OTTER_HOVER_ATTR = 'data-otter-hover'
const PET_THROTTLE_MS = 140

export function createOtterScene(el: HTMLElement, { onPet, onReady }: OtterSceneOptions = {}) {
  let raf = 0

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.style.display = 'block'
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const FR = 8.6
  /** Taille de la mare : 1 au départ, grandit avec la famille (voir growthFor). */
  let G = 1
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
  cam.position.set(12, 10.5, 12)
  cam.lookAt(0, 0, 0)
  const resize = () => {
    const W = el.clientWidth, H = el.clientHeight
    if (!W || !H) return
    renderer.setSize(W, H)
    const as = W / H
    // Sur écran étroit (mobile) on élargit le cadrage pour garder toute la flaque.
    // on recule un peu moins vite que la mare ne grandit : les loutres restent lisibles
    const zoom = FR * (1 + (G - 1) * 0.85)
    const fr = as < 1 ? zoom * Math.min(1.9, 1.15 / as) : zoom
    cam.left = (-fr * as) / 2
    cam.right = (fr * as) / 2
    cam.top = fr / 2
    cam.bottom = -fr / 2
    cam.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(el)

  // ——— matériaux
  const grad = new THREE.DataTexture(new Uint8Array([170, 170, 170, 255, 225, 225, 225, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat)
  grad.minFilter = grad.magFilter = THREE.NearestFilter
  grad.needsUpdate = true
  const toon = (c: number) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad })
  const inkU = { value: 0.035 }
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
  inkMat.onBeforeCompile = sh => {
    sh.uniforms.th = inkU
    sh.vertexShader = 'uniform float th;\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * th;')
  }
  const black = new THREE.MeshBasicMaterial({ color: INK })
  const stone = toon(0xf4f2ee)

  // ——— lumières + sol (ombre seule)
  scene.add(new THREE.AmbientLight(0xffffff, 1.15))
  const sun = new THREE.DirectionalLight(0xffffff, 1.9)
  sun.position.set(-4, 12, 6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 })
  sun.shadow.bias = -0.0005
  scene.add(sun)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: INK, opacity: 0.1 }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  // ——— flaque (écrit dans le stencil → les ondes y sont masquées)
  const blob = (R: number, sx: number, sz: number, ph: number, n = 72) => {
    const s = new THREE.Shape()
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2
      const r = R * (1 + 0.16 * Math.sin(2 * t + ph) + 0.09 * Math.sin(3 * t + ph * 2) + 0.06 * Math.sin(5 * t + 1))
      const x = Math.cos(t) * r * sx, y = Math.sin(t) * r * sz
      if (i) s.lineTo(x, y)
      else s.moveTo(x, y)
    }
    return new THREE.ShapeGeometry(s)
  }
  // objets du décor dont la position s'écarte avec la mare (x, z de départ)
  const spread: { o: THREE.Object3D; x: number; z: number }[] = []
  const spreadAdd = (o: THREE.Object3D) => { spread.push({ o, x: o.position.x, z: o.position.z }) }
  const pools: THREE.Mesh[] = []
  const water = (geo: THREE.BufferGeometry, c: number, y: number, x = 0, z = 0) => {
    const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: c, gradientMap: grad, stencilWrite: true, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp }))
    m.rotation.x = -Math.PI / 2
    m.position.set(x, y, z)
    m.receiveShadow = true
    scene.add(m)
    pools.push(m)
    spreadAdd(m)
    return m
  }
  water(blob(2.4, 1.35, 1, 0.6), 0xdfdbd4, 0.02)
  water(blob(0.26, 1.3, 1, 2), 0xdfdbd4, 0.02, 3.8, 1.9)
  water(blob(0.16, 1, 1, 4), 0xdfdbd4, 0.02, -3.5, 2.2)
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
  ;([[-1.2, -0.9, 0.7], [1.6, 0.9, 0.5], [-0.4, 1.4, 0.4], [2.2, -0.6, 0.35]] as V3[]).forEach(([x, z, l]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(l, 0.025), shine)
    m.rotation.set(-Math.PI / 2, 0, Math.PI / 4)
    m.position.set(x, 0.024, z)
    scene.add(m)
    spreadAdd(m)
  })

  // ——— helper : mesh + contour encre (double en BackSide gonflé)
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, p: V3, r?: V3 | null, s?: V3 | null, ink = true) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(...p)
    if (r) m.rotation.set(...r)
    if (s) m.scale.set(...s)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    if (ink) m.add(new THREE.Mesh(geo, inkMat))
    return m
  }

  // ——— rochers et galets
  const rocks: [number, number, number, V3, number?][] = [
    [-3.4, -1.4, 0.62, [1.3, 0.75, 1]],
    [3.6, 1.2, 0.42, [1, 0.9, 1.2]],
    [1.5, -1.5, 0.3, [1.4, 0.55, 1], 0.03],
    [-1.9, 1.3, 0.22, [1.3, 0.5, 1], 0.03],
  ]
  rocks.forEach(([x, z, r, s0, y]) => {
    const s: V3 = [s0[0], s0[1] * 0.6, s0[2]]
    spreadAdd(add(new THREE.DodecahedronGeometry(r, 0), stone, scene, [x, y ?? r * s[1] * 0.55, z], [0.3, x, 0.2], s))
  })
  const stoneTones = [0xf4f2ee, 0xe4e1da, 0xd6d2ca].map(c => toon(c))
  const pebGeo = (seed: number) => {
    const g = new THREE.IcosahedronGeometry(0.13, 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      const k = 1 + 0.1 * Math.sin(x * 23 + seed) * Math.cos(z * 19 + seed * 2) + 0.06 * Math.sin(y * 31 + seed)
      p.setXYZ(i, x * k, y * k, z * k)
    }
    g.computeVertexNormals()
    return g
  }
  const pebs = [0, 1, 2, 3, 4].map(pebGeo)
  const pebInk = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
  const pebInkGeo = new THREE.SphereGeometry(0.152, 20, 12)
  const addPeb = (i: number, mat: THREE.Material, parent: THREE.Object3D, p: V3, r: V3, s: V3) => {
    const m = add(pebs[i], mat, parent, p, r, s, false)
    m.add(new THREE.Mesh(pebInkGeo, pebInk))
    return m
  }
  const seeded = (s: number) => () => (s = (s * 16807) % 2147483647) / 2147483647
  const rp = seeded(11)
  ;[[-3.0, -0.6], [-2.75, -0.45], [-2.9, -0.25], [3.1, 0.3], [3.35, 2.0], [0.3, 2.6], [0.6, 2.75], [-0.8, -2.5], [2.6, -2.3], [-2.6, 1.9], [1.1, -2.4]].forEach(([x, z], i) => {
    const sc = 0.6 + rp() * 0.8
    spreadAdd(addPeb(i % 5, stoneTones[i % 3], scene, [x, 0.04 * sc, z], [0, rp() * 6, 0], [1.35 * sc, 0.5 * sc, (0.9 + rp() * 0.4) * sc]))
  })

  // ——— loutre de mer : sur le dos, tête claire, pattes sur la poitrine, pieds hors de l'eau.
  // Modèle réutilisable (la mère, et plus tard les amies et le cousin).
  const pawMat = toon(0x75716a)
  const prof = new THREE.SplineCurve(
    [[0, -0.8], [0.22, -0.76], [0.35, -0.6], [0.42, -0.35], [0.46, -0.05], [0.45, 0.22], [0.4, 0.45], [0.31, 0.64], [0.17, 0.76], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y)),
  ).getPoints(40)
  prof[0].x = 0
  prof[prof.length - 1].x = 0
  const torsoGeo = new THREE.LatheGeometry(prof, 40)
  const tp = torsoGeo.attributes.position
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i)
    const k = 1 + 0.035 * Math.sin(y * 9 + Math.atan2(z, x) * 3) + 0.025 * Math.sin(y * 17)
    tp.setXYZ(i, x * k, y, z * k * 0.92)
  }
  torsoGeo.computeVertexNormals()
  const waterlineGeo = new THREE.CapsuleGeometry(0.44, 0.8, 6, 24)
  const tailGeo = new THREE.CapsuleGeometry(0.15, 0.62, 6, 16)
  const footGeo = new THREE.SphereGeometry(0.15, 16, 12)
  const toeGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4)
  const pawGeo = new THREE.SphereGeometry(0.085, 14, 10)
  const armGeo = new THREE.CapsuleGeometry(0.07, 0.16, 6, 12)
  const headGeo = new THREE.SphereGeometry(0.37, 28, 20)
  const muzzleGeo = new THREE.SphereGeometry(0.13, 20, 14)
  const earGeo = new THREE.SphereGeometry(0.07, 12, 10)
  const noseGeo = new THREE.SphereGeometry(0.075, 14, 10)
  const arc = new THREE.TorusGeometry(0.045, 0.008, 4, 12, Math.PI)
  const whiskerGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.36, 4)

  // fourrure : petits « U » à l'encre
  const arcGeo = new THREE.TorusGeometry(0.045, 0.006, 4, 10, Math.PI)
  const tuft = (parent: THREE.Object3D, p: THREE.Vector3, n: THREE.Vector3, rotZ: number) => {
    const m = new THREE.Mesh(arcGeo, black)
    m.position.copy(p)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
    m.rotateZ(rotZ)
    parent.add(m)
  }

  // ——— apparence : chaque loutre a son pelage, ses yeux, sa taille et parfois un détail
  type Eyes = 'closed' | 'open' | 'wink' | 'round'
  type Extra = 'none' | 'flower' | 'scarf' | 'pebble' | 'mohawk' | 'patch'
  interface Look { fur: number; pale: number; paw: number; eyes: Eyes; extra: Extra; ear: number; size: number; feet: number }
  const MOM_LOOK: Look = { fur: 0x99948c, pale: 0xfcf9f2, paw: 0x75716a, eyes: 'closed', extra: 'none', ear: 1, size: 1, feet: 0.5 }
  const tones = new Map<number, THREE.Material>()
  const tone = (c: number) => {
    let m = tones.get(c)
    if (!m) tones.set(c, (m = toon(c)))
    return m
  }
  const pick = <T,>(r: () => number, list: readonly T[]) => list[Math.floor(r() * list.length) % list.length]
  const lookFor = (seed: number): Look => {
    const r = seeded(seed * 97 + 13)
    const fur = pick(r, [0x99948c, 0x837e76, 0xaba69d, 0x8f877b, 0x726e68, 0xb7b1a6] as const)
    return {
      fur,
      pale: pick(r, [0xfcf9f2, 0xf0ebe1, 0xf6f0e4, 0xe6e1d7] as const),
      paw: fur - 0x222222,
      eyes: pick(r, ['closed', 'closed', 'open', 'wink', 'round'] as const),
      extra: pick(r, ['none', 'none', 'flower', 'scarf', 'pebble', 'mohawk', 'patch'] as const),
      ear: 0.8 + r() * 0.45,
      size: 0.85 + r() * 0.25,
      feet: 0.25 + r() * 0.6,
    }
  }
  const dotGeo = new THREE.SphereGeometry(0.036, 10, 8)
  const ringGeo = new THREE.TorusGeometry(0.042, 0.009, 4, 14)
  const petalGeo = new THREE.SphereGeometry(0.055, 12, 8)
  const feather = toon(0xffffff)

  /** Tête de loutre (face vers +z) : claire, oreilles rondes, grosse truffe ; yeux et détails selon `look`. */
  const makeHead = (parent: THREE.Object3D, look: Look, seed: number, light = false) => {
    const head = new THREE.Group()
    parent.add(head)
    const mat = tone(look.pale), paw = tone(look.paw)
    add(headGeo, mat, head, [0, 0, 0], null, [1.06, 0.95, 0.95])
    ;[-1, 1].forEach(sd => {
      add(muzzleGeo, mat, head, [sd * 0.085, -0.1, 0.29], null, [1, 0.85, 0.8])
      add(earGeo, paw, head, [sd * 0.31, 0.22, -0.04], null, [look.ear, look.ear, 0.6])
      // les yeux : fermés « ‿ », ouverts « • », un clin d'œil, ou ronds d'étonnement
      const eye: V3 = [sd * 0.14, 0.07, 0.335]
      const kind = look.eyes === 'wink' ? (sd < 0 ? 'closed' : 'open') : look.eyes
      if (kind === 'closed') add(arc, black, head, eye, [0, 0, Math.PI], [1.15, 0.7, 1], false)
      else if (kind === 'open') add(dotGeo, black, head, eye, null, [1, 1.15, 0.6], false)
      else {
        add(ringGeo, black, head, eye, null, null, false)
        add(dotGeo, black, head, eye, null, [0.45, 0.45, 0.45], false)
      }
      add(arc, black, head, [sd * 0.04, -0.19, 0.3], [0, 0, Math.PI], [0.8, 0.8, 1], false)
      ;[0.03, -0.03].forEach(dy => {
        const w = add(whiskerGeo, black, head, [sd * 0.32, -0.11 + dy, 0.26], null, null, false)
        w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(sd, dy * 4 - 0.05, 0.25).normalize())
      })
    })
    add(noseGeo, black, head, [0, -0.02, 0.405], null, [1.45, 0.85, 0.7], false)
    if (look.extra === 'patch') add(new THREE.SphereGeometry(0.12, 14, 10), paw, head, [0.14, 0.08, 0.27], null, [1, 0.85, 0.5])
    if (look.extra === 'flower') {
      // une fleur glissée derrière l'oreille
      const f = new THREE.Group()
      f.position.set(-0.3, 0.3, 0.08)
      head.add(f)
      for (let k = 0; k < 5; k++) add(petalGeo, feather, f, [Math.cos(k * 1.26) * 0.07, Math.sin(k * 1.26) * 0.07, 0], null, [1, 1, 0.6])
      add(petalGeo, stoneTones[2], f, [0, 0, 0.02], null, [0.6, 0.6, 0.6])
    }
    if (look.extra === 'mohawk') [-0.08, 0, 0.08].forEach((z, k) => add(new THREE.ConeGeometry(0.05, 0.16, 8), paw, head, [0, 0.38 - Math.abs(z), z - 0.05 * k], [-0.3 + k * 0.3, 0, 0]))
    const rnd = seeded(seed + 3)
    for (let i = 0; i < (light ? 0 : 10); i++) {
      const th = rnd() * Math.PI * 2, ph = rnd() * 1.4
      const n = new THREE.Vector3(Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph))
      if (n.z > 0.3) continue
      tuft(head, n.clone().multiplyScalar(0.36), n, Math.PI + (rnd() - 0.5))
    }
    return head
  }

  interface OtterRig {
    root: THREE.Group
    body: THREE.Group
    head: THREE.Group
    /** pattes avant (pour bercer le bébé, tenir un galet…) */
    paws: THREE.Object3D[]
    /** point d'appui sur la poitrine (le bébé, le galet) */
    chest: THREE.Group
  }
  /** light : sans les touffes de fourrure, pour les loutres du fond (moins d'objets à dessiner). */
  const makeOtter = (seed: number, look: Look = MOM_LOOK, light = false): OtterRig => {
    const fur = tone(look.fur), pale = tone(look.pale), pawMat = tone(look.paw)
    const root = new THREE.Group()
    const body = new THREE.Group()
    body.position.y = 0.14
    body.rotation.z = 0.07
    root.add(body)
    add(torsoGeo, fur, body, [0, 0.05, 0], [0, 0, -Math.PI / 2])
    add(waterlineGeo, black, body, [0, -0.112, 0], [0, 0, Math.PI / 2], [0.04, 1, 0.95], false)
    // plastron clair : le cou et le haut de la poitrine, comme la tête
    add(new THREE.SphereGeometry(0.33, 22, 16), pale, body, [0.7, 0.18, 0], null, [0.95, 0.75, 0.9])
    // queue plate
    add(tailGeo, fur, body, [-1.15, -0.04, 0], [0, 0, Math.PI / 2 + 0.12], [0.42, 1, 1.15])
    add(new THREE.CapsuleGeometry(0.2, 0.62, 6, 16), black, body, [-1.15, -0.112, 0], [0, 0, Math.PI / 2], [0.04, 1, 1], false)
    // pieds palmés dressés hors de l'eau
    ;[-1, 1].forEach(sd => {
      const foot = new THREE.Group()
      foot.position.set(-0.7, 0.36, sd * 0.2)
      foot.rotation.set(sd * 0.3, 0, look.feet)
      body.add(foot)
      add(footGeo, pawMat, foot, [0, 0.08, 0], null, [0.36, 0.95, 1.35])
      ;[-0.07, 0, 0.07].forEach(z => {
        const t = new THREE.Mesh(toeGeo, black)
        t.position.set(0.056, 0.12, z * 1.25)
        t.rotation.x = z * 2
        foot.add(t)
      })
    })
    // pattes avant repliées sur la poitrine
    const paws: THREE.Object3D[] = []
    ;[-1, 1].forEach(sd => {
      const arm = new THREE.Group()
      arm.position.set(0.42, 0.4, sd * 0.22)
      arm.rotation.set(sd * 0.9, 0, 1.25)
      body.add(arm)
      add(armGeo, pawMat, arm, [0, 0.1, 0])
      add(pawGeo, pawMat, arm, [0, 0.22, -sd * 0.02], null, [1, 0.8, 1.1])
      paws.push(arm)
    })
    const chest = new THREE.Group()
    chest.position.set(0.18, 0.5, 0)
    body.add(chest)

    const head = makeHead(body, look, seed, light)
    head.position.set(1.0, 0.4, 0)
    if (look.extra === 'scarf') {
      // écharpe tricotée autour du cou
      const sc = add(new THREE.TorusGeometry(0.27, 0.07, 8, 24), tone(0xd6d1c6), body, [0.84, 0.36, 0], [0, Math.PI / 2, 0.3])
      sc.scale.set(1, 1, 0.8)
    }
    if (look.extra === 'pebble') addPeb(1, stoneTones[0], chest, [0.05, 0.06, 0], [0, 0.4, 0], [0.8, 0.5, 0.7])

    const rnd = seeded(seed)
    for (let i = 0; i < (light ? 8 : 24); i++) {
      const u = -0.62 + rnd() * 1.1, th = (rnd() - 0.5) * 2.2
      const r = 0.45 - Math.abs(u) * 0.12
      const n = new THREE.Vector3(0, Math.cos(th), Math.sin(th) * 0.92).normalize()
      const p = new THREE.Vector3(u, 0.05 + Math.cos(th) * r + 0.005, Math.sin(th) * r * 0.92)
      if (p.y < 0.12) continue
      tuft(body, p, n, Math.PI + (rnd() - 0.5) * 0.8)
    }
    for (let i = 0; i < 5; i++) tuft(body, new THREE.Vector3(-0.92 - i * 0.12, 0.03, (rnd() - 0.5) * 0.1), new THREE.Vector3(0, 1, 0), Math.PI)
    return { root, body, head, paws, chest }
  }

  // ——— la mère
  const mom = makeOtter(7)
  const otter = mom.root
  const body = mom.body
  const head = mom.head
  scene.add(otter)
  // son galet préféré, posé sur la poitrine
  const favPebble = addPeb(2, stoneTones[1], mom.chest, [0.1, 0.06, 0], [0, 0.4, 0], [0.85, 0.45, 0.7])

  // ——— le bébé : couché sur le ventre de sa mère, la tête vers elle, endormi
  const pupFur = toon(0xc9c4bb), pupPale = toon(0xf1ede5)
  const makePup = (fur: THREE.Material = pupFur, pale: THREE.Material = pupPale) => {
    const g = new THREE.Group()
    const inner = new THREE.Group() // respiration et arrivée
    g.add(inner)
    g.scale.setScalar(1.15)
    add(new THREE.SphereGeometry(0.22, 20, 14), fur, inner, [-0.06, 0.07, 0], null, [1.35, 0.7, 1])
    ;[-1, 1].forEach(sd => add(new THREE.SphereGeometry(0.06, 10, 8), pawMat, inner, [-0.33, 0.05, sd * 0.12], null, [1, 0.6, 1]))
    const h = new THREE.Group()
    h.position.set(0.22, 0.15, 0)
    inner.add(h)
    add(new THREE.SphereGeometry(0.16, 20, 14), pale, h, [0, 0, 0])
    ;[-1, 1].forEach(sd => {
      add(earGeo, pawMat, h, [sd * 0.13, 0.1, -0.03], null, [0.6, 0.6, 0.45])
      add(arc, black, h, [sd * 0.06, 0.03, 0.148], [0, 0, Math.PI], [0.6, 0.45, 1], false)
    })
    add(noseGeo, black, h, [0, -0.035, 0.158], null, [0.7, 0.45, 0.4], false)
    return { g, inner, head: h }
  }
  const firstPup = makePup()
  const pup = firstPup.g, pupInner = firstPup.inner, pupHead = firstPup.head
  pup.visible = false
  mom.chest.add(pup)

  // ——— ondes
  const ringGeos = [0, 1, 2, 3].map(k => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * Math.PI * 2
      const r = 1 + 0.05 * Math.sin(3 * t + k * 1.7) + 0.035 * Math.sin(5 * t + k)
      pts.push(new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  })
  type Ripple = { m: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>; t: number; big: boolean; s0: number; asp: number; life: number }
  const ripples: Ripple[] = []
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const ripple = (big: boolean, at?: THREE.Vector3) => {
    const mat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.4, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc })
    const m = new THREE.Line(ringGeos[(Math.random() * 4) | 0], mat)
    m.renderOrder = 2
    const c = at ?? otter.position
    m.position.set(c.x + (Math.random() - 0.5) * 0.4, 0.025, c.z + (Math.random() - 0.5) * 0.3)
    m.rotation.y = (at ? Math.random() * 6 : otter.rotation.y) + (Math.random() - 0.5) * 0.4
    scene.add(m)
    ripples.push({ m, t: 0, big, s0: 0.55 + Math.random() * (big ? 0.8 : 0.6), asp: 1.3 + Math.random() * 0.6, life: big ? 1.4 + Math.random() * 0.6 : 2 + Math.random() * 1.5 })
    if (big) {
      const id = setTimeout(() => { timers.delete(id); ripple(false, at) }, 160)
      timers.add(id)
    }
  }

  // ——— les achats, visibles dans la scène
  // Chaque objet acheté tombe du ciel (rebond + grande onde), puis vit sa vie.
  type Prop = { obj: THREE.Object3D; born: number; y0: number; splash: boolean; water: boolean; i: number }
  const props: Record<string, Prop[]> = {}
  let clock = 0 // ms, mis à jour par la boucle
  const CAP: Record<string, number> = { rocher: 4, nenuphar: 6, galet: 3, amie: 10, plume: 1, riviere: 1, noeud: 1, lunettes: 1, cousin: 1, echarpe: 1, couronne: 1, collier: 1, bateau: 3, parasol: 2, phare: 1, jumeau: 1, grandmere: 1, berceuse: 1 }

  // places du radeau autour de la mère (repère de la mère : +x vers sa tête)
  const RAFT: [number, number][] = [[-0.15, 1.05], [-0.15, -1.05], [-2.7, 0.65], [-2.7, -0.65], [2.6, 0.7], [2.6, -0.7], [-0.15, 2.5], [-0.15, -2.5], [-2.7, 1.95], [-2.7, -1.95]]
  const PARASOLS: [number, number][] = [[-3.7, -1.9], [3.5, 2.1]]
  const paperMat = toon(0xffffff), shellMat = toon(0xefe9dd), algaeMat = toon(0xb9b4aa)
  // bateau en papier : coque trapézoïdale et voile triangulaire, extrudées
  const boatShape = new THREE.Shape([new THREE.Vector2(-0.32, 0.1), new THREE.Vector2(0.32, 0.1), new THREE.Vector2(0.2, -0.04), new THREE.Vector2(-0.2, -0.04)])
  const sailShape = new THREE.Shape([new THREE.Vector2(-0.16, 0.1), new THREE.Vector2(0.16, 0.1), new THREE.Vector2(0, 0.36)])
  const hullGeo = new THREE.ExtrudeGeometry(boatShape, { depth: 0.18, bevelEnabled: false })
  hullGeo.translate(0, 0, -0.09)
  const sailGeo = new THREE.ExtrudeGeometry(sailShape, { depth: 0.02, bevelEnabled: false })
  sailGeo.translate(0, 0, -0.01)
  const noteMat = () => new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0 })
  // rochers « embauchés », au bord de la flaque
  const ROCKS: [number, number, number][] = [[-4.3, 0.7, 0.42], [4.5, -0.5, 0.36], [-1.4, -3.1, 0.3], [2.6, 2.8, 0.34]]
  // nénuphars, sur l'eau
  const PADS: [number, number][] = [[2.3, 0.9], [-2.5, -0.3], [0.9, -1.8], [-1.1, 1.7], [2.7, -1.1], [-2.1, 1.1]]
  const padMat = toon(0xedeae3)
  const padGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.035, 28, 1, false, 0.35, Math.PI * 2 - 0.7)
  const bowMat = toon(0x3a3935)
  const lensGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20)
  const linkGeo = new THREE.CapsuleGeometry(0.05, 1, 4, 10)

  const makeProp = (kind: string, i: number): { obj: THREE.Object3D; parent: THREE.Object3D; water: boolean } | null => {
    const g = new THREE.Group()
    switch (kind) {
      case 'rocher': {
        const [x, z, r] = ROCKS[i]
        add(new THREE.DodecahedronGeometry(r, 0), stone, g, [0, r * 0.35, 0], [0.4, i * 1.7, 0.2], [1.25, 0.65, 1])
        g.position.set(x, 0, z)
        spreadAdd(g)
        return { obj: g, parent: scene, water: false }
      }
      case 'nenuphar': {
        const [x, z] = PADS[i]
        add(padGeo, padMat, g, [0, 0, 0], [0, i * 2.1, 0])
        if (i % 2 === 0) {
          // une fleur : cinq pétales ronds autour d'un cœur
          for (let k = 0; k < 5; k++) add(petalGeo, feather, g, [Math.cos(k * 1.26) * 0.075, 0.06, Math.sin(k * 1.26) * 0.075], null, [1, 0.6, 1])
          add(petalGeo, stoneTones[2], g, [0, 0.08, 0], null, [0.6, 0.5, 0.6])
        }
        g.position.set(x, 0.035, z)
        return { obj: g, parent: scene, water: true }
      }
      case 'noeud': {
        ;[-1, 1].forEach(sd => add(new THREE.ConeGeometry(0.08, 0.15, 12), bowMat, g, [sd * 0.08, 0, 0], [0, 0, sd * Math.PI / 2]))
        add(new THREE.SphereGeometry(0.04, 10, 8), bowMat, g, [0, 0, 0.01])
        g.position.set(0, -0.37, 0.16)
        return { obj: g, parent: head, water: false }
      }
      case 'lunettes': {
        ;[-1, 1].forEach(sd => add(lensGeo, black, g, [sd * 0.14, 0, 0], [Math.PI / 2, 0, 0], null, false))
        add(new THREE.BoxGeometry(0.1, 0.02, 0.02), black, g, [0, 0.02, 0], null, null, false)
        g.position.set(0, 0.08, 0.35)
        return { obj: g, parent: head, water: false }
      }
      case 'plume': {
        add(new THREE.SphereGeometry(0.1, 14, 10), feather, g, [0, 0.18, 0], null, [0.55, 2.1, 0.18])
        const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.006, 0.55, 5), black)
        spine.position.y = 0.16
        g.add(spine)
        g.position.set(0.3, 1.4, 0.6)
        return { obj: g, parent: otter, water: false }
      }
      case 'galet': {
        addPeb(i % 5, stoneTones[(i + 1) % 3], g, [0, 0, 0], [0, i, 0], [0.62, 0.56, 0.6])
        g.position.set(0.2, 0.7, 0)
        return { obj: g, parent: body, water: false }
      }
      case 'echarpe': {
        // écharpe tricotée autour du cou de la mère, un pan qui pend
        add(new THREE.TorusGeometry(0.27, 0.07, 8, 24), tone(0xd6d1c6), g, [0, 0, 0], [0, Math.PI / 2, 0.3], [1, 1, 0.8])
        add(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8), tone(0xd6d1c6), g, [-0.05, 0.12, 0.25], [0.3, 0, 1.2])
        g.position.set(0.84, 0.36, 0)
        return { obj: g, parent: body, water: false }
      }
      case 'couronne': {
        // couronne d'algues : un anneau et des brins dressés
        add(new THREE.TorusGeometry(0.22, 0.035, 6, 20), algaeMat, g, [0, 0, 0], [Math.PI / 2, 0, 0])
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2
          add(new THREE.ConeGeometry(0.04, 0.17, 6), algaeMat, g, [Math.cos(a) * 0.2, 0.08, Math.sin(a) * 0.2], [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25])
        }
        g.position.set(0, 0.36, -0.08)
        g.rotation.x = -0.45
        return { obj: g, parent: head, water: false }
      }
      case 'collier': {
        // collier de coquillages sous le menton
        for (let k = 0; k < 5; k++) {
          const a = -1.1 + (k / 4) * 2.2
          add(petalGeo, shellMat, g, [Math.sin(a) * 0.3, -Math.cos(a) * 0.09, Math.cos(a) * 0.08], null, [0.8, 0.65, 0.6])
        }
        g.position.set(0, -0.33, 0.12)
        return { obj: g, parent: head, water: false }
      }
      case 'bateau': {
        add(hullGeo, paperMat, g, [0, 0, 0])
        add(sailGeo, paperMat, g, [0, 0.0, 0])
        g.position.set(0, 0.02, 0)
        return { obj: g, parent: scene, water: true }
      }
      case 'parasol': {
        const [x, z] = PARASOLS[i]
        add(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), black, g, [0, 0.75, 0], null, null, false)
        add(new THREE.ConeGeometry(0.8, 0.34, 8, 1, true), paperMat, g, [0, 1.5, 0])
        // rayures du parasol : des baleines à l'encre
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2
          const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.86, 4), black)
          rib.position.set(Math.cos(a) * 0.4, 1.5, Math.sin(a) * 0.4)
          rib.lookAt(new THREE.Vector3(Math.cos(a) * 0.8, 1.33, Math.sin(a) * 0.8))
          rib.rotateX(Math.PI / 2)
          g.add(rib)
        }
        g.position.set(x, 0, z)
        g.rotation.z = (i ? -1 : 1) * 0.12
        spreadAdd(g)
        return { obj: g, parent: scene, water: false }
      }
      case 'phare': {
        // un phare sur son rocher, au bord de la flaque ; son faisceau tourne
        add(new THREE.DodecahedronGeometry(0.6, 0), stone, g, [0, 0.15, 0], null, [1.3, 0.5, 1.1])
        add(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 16), paperMat, g, [0, 1.0, 0])
        ;[0.6, 1.1].forEach(y => add(new THREE.CylinderGeometry(0.262 - y * 0.06, 0.27 - y * 0.06, 0.16, 16), bowMat, g, [0, y, 0]))
        add(new THREE.CylinderGeometry(0.17, 0.17, 0.22, 12), stoneTones[2], g, [0, 1.86, 0])
        add(new THREE.ConeGeometry(0.24, 0.22, 12), bowMat, g, [0, 2.08, 0])
        const beam = new THREE.Mesh(new THREE.ConeGeometry(0.32, 3.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }))
        beam.geometry.translate(0, -1.6, 0)
        beam.rotation.z = Math.PI / 2
        const pivotB = new THREE.Group()
        pivotB.position.y = 1.86
        pivotB.add(beam)
        g.add(pivotB)
        g.userData.beam = pivotB
        g.position.set(4.8, 0, -2.3)
        spreadAdd(g)
        return { obj: g, parent: scene, water: false }
      }
      case 'jumeau': {
        const tw = makePup(tone(0xbcb6ac), tone(0xf6f2ea))
        tw.g.userData.rig = tw
        tw.g.position.set(-0.02, 0, -0.2)
        tw.g.rotation.y = 0.25
        return { obj: tw.g, parent: mom.chest, water: false }
      }
      case 'grandmere': {
        // la grand-mère : pelage blanchi, lunettes rondes, châle, elle se berce à l'écart
        const o = makeOtter(77, { fur: 0xc9c4ba, pale: 0xfefcf7, paw: 0x9a958c, eyes: 'closed', extra: 'scarf', ear: 0.9, size: 1, feet: 0.3 })
        ;[-1, 1].forEach(sd => add(ringGeo, black, o.head, [sd * 0.14, 0.07, 0.36], null, [2.2, 2.2, 1], false))
        add(new THREE.BoxGeometry(0.08, 0.012, 0.012), black, o.head, [0, 0.08, 0.37], null, null, false)
        o.root.scale.setScalar(0.85)
        o.root.userData.rig = o
        o.root.position.set(-2.4 * G, 0, 1.9 * G)
        return { obj: o.root, parent: scene, water: true }
      }
      case 'berceuse': {
        // notes de musique qui montent au-dessus des bébés
        for (let k = 0; k < 4; k++) {
          const n = new THREE.Group()
          const m = noteMat()
          const headN = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), m)
          headN.scale.set(1.3, 0.9, 0.6)
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), m)
          stem.position.set(0.07, 0.11, 0)
          n.add(headN, stem)
          n.userData.phase = k / 4
          n.userData.mat = m
          g.add(n)
        }
        return { obj: g, parent: otter, water: false }
      }
      case 'riviere': {
        // un bras de rivière qui arrive par l'arrière et se jette dans la flaque
        const sh = new THREE.Shape()
        const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-11, 0, -7), new THREE.Vector3(-6.5, 0, -4.4), new THREE.Vector3(-3.6, 0, -2.6), new THREE.Vector3(-1.8, 0, -1.2)])
        const pts = path.getPoints(40)
        const side = (sgn: number) => pts.map((q, k) => {
          const tan = path.getTangent(k / 40)
          const w = 0.55 + 0.25 * Math.sin(k * 0.5) + (k / 40) * 0.3
          return new THREE.Vector2(q.x - tan.z * w * sgn, -(q.z + tan.x * w * sgn))
        })
        const left = side(1), right = side(-1).reverse()
        sh.moveTo(left[0].x, left[0].y)
        left.concat(right).forEach(v => sh.lineTo(v.x, v.y))
        const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshToonMaterial({ color: 0xdfdbd4, gradientMap: grad, stencilWrite: true, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp }))
        m.rotation.x = -Math.PI / 2
        m.position.y = 0.018
        m.receiveShadow = true
        g.add(m)
        // reflets qui descendent le courant
        for (let k = 0; k < 9; k++) {
          const d = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.03), shine)
          d.rotation.x = -Math.PI / 2
          d.userData.u = k / 9
          d.userData.off = (k % 3 - 1) * 0.25
          g.add(d)
        }
        g.userData.path = path
        river = g
        return { obj: g, parent: scene, water: true }
      }
      case 'amie': {
        const look = lookFor(11 + i * 5)
        const o = makeOtter(11 + i * 5, look, i >= 2)
        o.root.scale.setScalar(0.78 * look.size)
        // au-delà des quatre premières, pas d'ombre portée : la mare reste fluide
        if (i >= 4) o.root.traverse(c => { c.castShadow = false })
        o.root.userData.rig = o
        // les pattes qui se tiennent (dessinées entre la mère et l'amie)
        const link = new THREE.Mesh(linkGeo, pawMat)
        link.add(new THREE.Mesh(linkGeo, inkMat))
        link.visible = i < 2
        scene.add(link)
        o.root.userData.link = link
        return { obj: o.root, parent: scene, water: true }
      }
      case 'cousin': {
        const o = makeOtter(41, { ...lookFor(41), extra: 'none', eyes: 'open' })
        o.root.scale.setScalar(0.9)
        // le chapeau du cousin
        add(new THREE.CylinderGeometry(0.17, 0.19, 0.24, 20), bowMat, o.head, [0, 0.45, -0.02], [-0.2, 0, 0.15])
        add(new THREE.CylinderGeometry(0.31, 0.31, 0.03, 24), bowMat, o.head, [0, 0.34, 0], [-0.2, 0, 0.15])
        o.root.userData.rig = o
        o.root.position.set(2.6 * G, 0, -1.6 * G)
        return { obj: o.root, parent: scene, water: true }
      }
    }
    return null
  }

  let river: THREE.Object3D | null = null
  let gTarget = 1
  /** La mare grandit avec la famille (plafonnée avec le nombre d'amies affichées). */
  const growthFor = (owned: Record<string, number>) =>
    1 + 0.1 * Math.min(CAP.amie, owned.amie || 0) + ((owned.cousin || 0) > 0 ? 0.08 : 0) + ((owned.grandmere || 0) > 0 ? 0.08 : 0) + ((owned.riviere || 0) > 0 ? 0.1 : 0)
  const applyGrowth = () => {
    spread.forEach(({ o, x, z }) => o.position.set(x * G, o.position.y, z * G))
    pools.forEach(m => m.scale.set(G, G, 1))
    river?.scale.set(G, 1, G)
    const sh = 9 * G
    Object.assign(sun.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh })
    sun.shadow.camera.updateProjectionMatrix()
    resize()
  }

  const syncProps = (owned: Record<string, number>, animate: boolean) => {
    gTarget = growthFor(owned)
    if (!animate) { G = gTarget; applyGrowth() }
    for (const kind of Object.keys(CAP)) {
      const want = Math.min(CAP[kind], owned[kind] || 0)
      const list = (props[kind] ??= [])
      while (list.length < want) {
        const made = makeProp(kind, list.length)
        if (!made) break
        made.parent.add(made.obj)
        if (!animate) applyGrowth()
        list.push({ obj: made.obj, born: animate ? clock : -1e9, y0: made.obj.position.y, splash: !animate, water: made.water, i: list.length })
      }
      while (list.length > want) {
        const pr = list.pop()!
        pr.obj.removeFromParent()
        ;(pr.obj.userData.link as THREE.Object3D | undefined)?.removeFromParent()
      }
    }
  }

  // ——— interaction : clic ou glisser sur une loutre
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  let hop = 0, squish = 0, lastPet = 0, dragging = false
  const hits = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(ndc, cam)
    const targets: THREE.Object3D[] = [otter, ...(props.amie ?? []).map(p => p.obj), ...(props.cousin ?? []).map(p => p.obj), ...(props.grandmere ?? []).map(p => p.obj)]
    return raycaster.intersectObjects(targets, true).length > 0
  }
  const pet = (e: PointerEvent, strong: boolean) => {
    lastPet = performance.now()
    if (strong) {
      hop = 1
      ripple(true)
      // la bande saute en chaîne, une loutre après l'autre
      ;(props.amie ?? []).forEach((p, k) => { p.obj.userData.hopAt = performance.now() + 140 * (k + 1) })
    }
    squish = 1
    onPet?.(e.clientX, e.clientY)
  }
  const onDown = (e: PointerEvent) => {
    dragging = true
    if (hits(e)) pet(e, true)
  }
  const onMove = (e: PointerEvent) => {
    const over = hits(e)
    el.style.cursor = over ? (dragging ? 'grabbing' : 'grab') : 'default'
    document.documentElement.toggleAttribute(OTTER_HOVER_ATTR, over)
    if (!dragging || !over) return
    if (performance.now() - lastPet < PET_THROTTLE_MS) return
    pet(e, false)
    if (Math.random() < 0.35) ripple(false)
  }
  const onUp = () => { dragging = false }
  const onLeave = () => document.documentElement.removeAttribute(OTTER_HOVER_ATTR)
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerleave', onLeave)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)

  // ——— boucle
  const camDir = new THREE.Vector3(12, 10.5, 12).normalize().add(new THREE.Vector3(0, 0.35, 0)).normalize()
  const pos = new THREE.Vector2(0, 0), tgt = new THREE.Vector2(0, 0)
  const tmp = new THREE.Vector3()
  let idle = 0, heading = 0.3, nextRip = 0, last = performance.now()
  let pupIn = 1, hug = 0, synced = false
  /** Met la scène en accord avec les achats (appelé à chaque changement de `owned`). */
  let prevOwned: Record<string, number> = {}
  const sync = (owned: Record<string, number>) => {
    syncProps(owned, synced)
    // un achat qui ne se voit pas (caresses) fait quand même réagir la loutre
    if (synced && ['patte', 'gant', 'bain', 'brosse', 'massage'].some(k => (owned[k] || 0) > (prevOwned[k] || 0))) { hop = 1; squish = 1; ripple(true) }
    prevOwned = owned
    const wantPup = (owned.bebe || 0) > 0
    if (wantPup && !pup.visible) {
      pup.visible = true
      pupIn = synced ? 0 : 1
      if (synced) { hop = 1; ripple(true) }
    } else if (!wantPup) pup.visible = false
    synced = true
  }
  const wp = new THREE.Vector3(), wq = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
  let tickleUntil = 0, nextTickle = 4000
  const animateProps = (t: number, dt: number) => {
    for (const kind in props) {
      for (const pr of props[kind]) {
        // arrivée : chute avec rebond, puis grande onde au contact de l'eau
        const k = (t - pr.born) / 650
        if (k < 1 && kind === 'amie' && !pr.obj.userData.placed) {
          // une nouvelle amie tombe directement à sa place dans le radeau
          const [ox, oz] = RAFT[pr.i]
          const off = new THREE.Vector3(ox, 0, oz).applyAxisAngle(up, heading).add(otter.position)
          pr.obj.position.x = off.x
          pr.obj.position.z = off.z
          pr.obj.userData.placed = true
        }
        if (k < 1) {
          const b = 1 - Math.abs(Math.cos(k * Math.PI * 1.5)) * (1 - k) // rebond amorti
          pr.obj.position.y = pr.y0 + (1 - b) * 2.2
          pr.obj.scale.setScalar((pr.obj.userData.s0 ??= pr.obj.scale.x) * Math.min(1, k * 2.5))
        } else if (!pr.splash) {
          pr.splash = true
          pr.obj.position.y = pr.y0
          pr.obj.scale.setScalar(pr.obj.userData.s0 ?? pr.obj.scale.x)
          if (pr.water || kind === 'rocher') ripple(true, pr.obj.getWorldPosition(wp))
          if (pr.obj.parent === otter || pr.obj.parent === body || pr.obj.parent === head) { squish = 1; hop = Math.max(hop, 0.6) }
        }
        if (k < 1) continue
        switch (kind) {
          case 'nenuphar': {
            const [x, z] = PADS[pr.i]
            pr.obj.position.set(x * G + Math.sin(t / 3100 + pr.i) * 0.18, 0.035, z * G + Math.cos(t / 2700 + pr.i * 2) * 0.14)
            pr.obj.rotation.y = Math.sin(t / 4000 + pr.i) * 0.6
            break
          }
          case 'galet': {
            // elle jongle au-dessus de son ventre (le bébé dort plus haut, sur la poitrine) :
            // chaque galet monte en arc d'une patte à l'autre, puis redescend
            const n = props.galet.length
            const ph = (t / 1500 + pr.i / n) % 1
            const a = ph * Math.PI * 2
            pr.obj.position.set(-0.3 + Math.cos(a) * 0.2, 0.62 + Math.max(0, Math.sin(a)) * 0.85, Math.cos(a) * 0.18)
            pr.obj.rotation.set(a * 1.5, a, a * 2)
            break
          }
          case 'plume': {
            // de temps en temps, la plume descend lui chatouiller le ventre
            const tick = t < tickleUntil
            const tx = tick ? 0.35 : 0.3, ty = tick ? 0.75 + Math.sin(t / 45) * 0.05 : 1.4 + Math.sin(t / 700) * 0.12
            pr.obj.position.x += (tx - pr.obj.position.x) * Math.min(1, dt * 6)
            pr.obj.position.y += (ty - pr.obj.position.y) * Math.min(1, dt * 6)
            pr.obj.position.z += ((tick ? 0.1 : 0.6) - pr.obj.position.z) * Math.min(1, dt * 6)
            pr.obj.rotation.set(tick ? Math.sin(t / 40) * 0.5 : 0.3, t / 1500, tick ? 1.2 : 0.4 + Math.sin(t / 900) * 0.3)
            if (tick) { squish = Math.max(squish, 0.5 + Math.random() * 0.5) }
            break
          }
          case 'bateau': {
            // les bateaux font le tour de la mare, chacun à son rythme
            const a = t / (14000 + pr.i * 3000) + pr.i * 2.1
            const rx = (2.6 + pr.i * 0.35) * G, rz = (1.75 + pr.i * 0.2) * G
            pr.obj.position.set(Math.cos(a) * rx, 0.02 + Math.sin(t / 600 + pr.i) * 0.02, Math.sin(a) * rz)
            pr.obj.rotation.set(Math.sin(t / 700 + pr.i) * 0.08, -a - Math.PI / 2, Math.sin(t / 900) * 0.06)
            break
          }
          case 'phare':
            ;(pr.obj.userData.beam as THREE.Object3D).rotation.y = t / 1800
            break
          case 'jumeau': {
            const rig = pr.obj.userData.rig as { inner: THREE.Object3D; head: THREE.Object3D }
            rig.inner.scale.y = 1 + Math.sin(t / 470 + 1.3) * 0.04
            rig.head.lookAt(rig.head.getWorldPosition(wq).add(camDir))
            rig.head.rotateX(Math.max(0, Math.sin(t / 2700 + 2)) * 0.25)
            break
          }
          case 'grandmere': {
            const rig = pr.obj.userData.rig as OtterRig
            pr.obj.position.set(-2.4 * G + Math.sin(t / 6000) * 0.3, Math.sin(t / 1100) * 0.03, 1.9 * G + Math.cos(t / 7000) * 0.2)
            pr.obj.rotation.set(Math.sin(t / 1400) * 0.08, 2.4 + Math.sin(t / 5000) * 0.3, 0)
            pr.obj.updateMatrixWorld(true)
            rig.head.lookAt(rig.head.getWorldPosition(wq).add(camDir))
            break
          }
          case 'berceuse':
            pr.obj.children.forEach((n, k) => {
              const ph = (t / 3200 + (n.userData.phase as number)) % 1
              n.position.set(0.2 + Math.sin(ph * 6 + k) * 0.25, 0.9 + ph * 1.3, Math.cos(ph * 5 + k) * 0.2)
              n.rotation.z = Math.sin(ph * 8) * 0.3
              ;(n.userData.mat as THREE.MeshBasicMaterial).opacity = Math.sin(ph * Math.PI) * 0.85
            })
            break
          case 'riviere': {
            const path = pr.obj.userData.path as THREE.CatmullRomCurve3
            pr.obj.children.slice(1).forEach(d => {
              const u = (d.userData.u + t / 9000) % 1
              path.getPointAt(u, wq)
              const tan = path.getTangentAt(u)
              d.position.set(wq.x - tan.z * d.userData.off, 0.03, wq.z + tan.x * d.userData.off)
              d.rotation.z = Math.atan2(tan.z, tan.x)
            })
            break
          }
          case 'amie': {
            // la bande flotte en radeau autour de la mère, et se tient la patte
            const rig = pr.obj.userData.rig as OtterRig
            const side = pr.i === 0 ? 1 : -1
            const [ox, oz] = RAFT[pr.i]
            const off = new THREE.Vector3(ox, 0, oz)
            off.applyAxisAngle(up, heading).add(otter.position)
            // première image : directement à sa place, ensuite elle suit la mère avec un peu de retard
            const follow = pr.obj.userData.placed ? Math.min(1, dt * 1.5) : 1
            pr.obj.userData.placed = true
            pr.obj.position.x += (off.x - pr.obj.position.x) * follow
            pr.obj.position.z += (off.z - pr.obj.position.z) * follow
            const hk = Math.max(0, 1 - (performance.now() - (pr.obj.userData.hopAt ?? -1e9)) / 330)
            pr.obj.position.y = Math.sin(t / 900 + pr.i * 1.7) * 0.03 + Math.sin(hk * Math.PI) * 0.14
            pr.obj.rotation.set(Math.sin(t / 1300 + pr.i) * 0.06, heading + Math.sin(t / 2100 + pr.i) * 0.12, 0)
            pr.obj.updateMatrixWorld(true)
            rig.head.lookAt(rig.head.getWorldPosition(wq).add(camDir))
            const link = pr.obj.userData.link as THREE.Mesh
            if (link.visible) {
              // patte de la mère ↔ patte de l'amie
              body.localToWorld(wp.set(0.35, 0.3, side * 0.42))
              rig.body.localToWorld(wq.set(0.35, 0.3, -side * 0.42))
              link.position.copy(wp).add(wq).multiplyScalar(0.5)
              const len = wp.distanceTo(wq)
              link.scale.set(1, Math.max(0.01, len - 0.12), 1)
              link.quaternion.setFromUnitVectors(up, wq.sub(wp).normalize())
            }
            break
          }
          case 'cousin': {
            // le cousin dérive tout seul, en tournant lentement sur lui-même
            const rig = pr.obj.userData.rig as OtterRig
            pr.obj.position.set(2.6 * G + Math.sin(t / 5200) * 0.4, Math.sin(t / 800) * 0.03, -1.6 * G + Math.cos(t / 6100) * 0.3)
            pr.obj.rotation.set(0, t / 9000, Math.sin(t / 1500) * 0.04)
            pr.obj.updateMatrixWorld(true)
            rig.head.lookAt(rig.head.getWorldPosition(wq).add(camDir))
            break
          }
        }
      }
    }
    // cycle de chatouille de la plume, plus fréquent avec plusieurs plumes achetées
    if (props.plume?.length && t > nextTickle) {
      tickleUntil = t + 900
      nextTickle = t + 900 + 4500 / (1 + 0.2 * ((prevOwned.plume || 1) - 1))
      ripple(false)
    }
  }
  const loop = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000)
    last = t
    const d = tgt.clone().sub(pos)
    if (d.length() < 0.05) {
      idle -= dt
      if (idle <= 0) {
        const a = Math.random() * 6.283, rr = Math.random()
        tgt.set(Math.cos(a) * 1.0 * rr, Math.sin(a) * 0.6 * rr)
        idle = 3 + Math.random() * 5
      }
    } else {
      pos.add(d.normalize().multiplyScalar(0.16 * dt))
      const want = Math.atan2(-(tgt.y - pos.y), tgt.x - pos.x)
      let da = want - heading
      da = Math.atan2(Math.sin(da), Math.cos(da))
      heading += da * dt * 0.25
    }
    hop = Math.max(0, hop - dt * 3)
    squish = Math.max(0, squish - dt / 0.12)
    otter.position.set(pos.x, Math.sin(t / 900) * 0.03 + Math.sin(hop * Math.PI) * 0.18, pos.y)
    otter.rotation.set(Math.sin(t / 1300) * 0.06, heading, Math.sin(t / 1700) * 0.03)
    // écrasement 0,94 sur 120 ms à chaque caresse
    const sq = 1 - 0.06 * Math.sin(squish * Math.PI)
    body.scale.set(1 + (1 - sq) * 0.8, sq, 1 + (1 - sq) * 0.8)
    otter.updateMatrixWorld(true)
    const hp = head.getWorldPosition(tmp)
    head.lookAt(hp.add(camDir))

    // bébé : arrivée en rebond, respiration, la mère le serre dans ses pattes
    if (pup.visible) {
      pupIn = Math.min(1, pupIn + dt / 0.7)
      const pop = pupIn < 1 ? 1 + Math.sin(pupIn * Math.PI) * 0.35 : 1
      const br = 1 + Math.sin(t / 520) * 0.04
      pupInner.scale.set(pupIn * pop, pupIn * pop * br, pupIn * pop)
      pupInner.position.y = Math.sin(pupIn * Math.PI) * 0.5
      pupHead.lookAt(pupHead.getWorldPosition(tmp).add(camDir))
      pupHead.rotateX(Math.max(0, Math.sin(t / 2300)) * 0.25) // relève la tête de temps en temps
    }
    pup.position.z += ((props.jumeau?.length ? 0.2 : 0) - pup.position.z) * Math.min(1, dt * 4)
    hug += ((pup.visible ? 1 : 0) - hug) * Math.min(1, dt * 4)
    mom.paws.forEach((a, i) => { a.rotation.x = (i ? 1 : -1) * (0.9 + 0.55 * hug) })
    favPebble.position.set(0.1 - 0.42 * hug, 0.06, 0)
    favPebble.visible = !props.galet?.length
    clock = t
    if (Math.abs(gTarget - G) > 0.001) {
      // la mare s'élargit et la caméra recule doucement (environ 2 s)
      G += (gTarget - G) * Math.min(1, dt * 1.6)
      applyGrowth()
    }
    animateProps(t, dt)
    if (t > nextRip) { ripple(false); nextRip = t + 900 + Math.random() * 2200 }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]
      r.t += dt
      const k = r.t / r.life
      const s = r.s0 + k * (r.big ? 1.5 : 0.8)
      r.m.scale.set(s * r.asp, 1, s)
      r.m.material.opacity = 0.38 * (1 - k) * Math.min(1, k * 6)
      if (k >= 1) { scene.remove(r.m); r.m.material.dispose(); ripples.splice(i, 1) }
    }
    renderer.render(scene, cam)
    if (onReady) { onReady(); onReady = undefined }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  // trait qui tremble : on re-tire l'épaisseur du contour toutes les 140 ms
  const boil = setInterval(() => { inkU.value = 0.038 + Math.random() * 0.016 }, 140)

  return {
    sync,
    dispose() {
      cancelAnimationFrame(raf)
      clearInterval(boil)
      timers.forEach(clearTimeout)
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      onLeave()
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      scene.traverse(o => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
