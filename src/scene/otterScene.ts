// Scène 3D de la loutre — portée depuis otter-scene.js (passation design).
// createOtterScene(el, { onPet }) → { dispose() }
// Le conteneur doit avoir une taille ; le canvas le remplit et suit ses redimensionnements.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/** Une carte posée sur la table de blackjack. */
export interface TableCard { rank: string; suit: string; hidden?: boolean }

export interface OtterSceneOptions {
  /** appelé à chaque caresse, avec la position écran (clientX / clientY) */
  onPet?: (x: number, y: number) => void
  /** appelé une fois, après la première image dessinée */
  onReady?: () => void
  /** clic sur la table de blackjack */
  onTable?: () => void
}

type V3 = [number, number, number]

const INK = 0x1b1a18

/** Posé sur <html> quand le pointeur survole la loutre (le curseur main se met à caresser). */
export const OTTER_HOVER_ATTR = 'data-otter-hover'
const PET_THROTTLE_MS = 140

export function createOtterScene(el: HTMLElement, { onPet, onReady, onTable }: OtterSceneOptions = {}) {
  let raf = 0

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.domElement.style.display = 'block'
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const FR = 11.2
  /** Taille de la mare : 1 au départ, grandit avec la famille (voir growthFor). */
  let G = 1
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300)
  // Caméra en orbite autour du plateau : `yaw` (rotation, réglable par le joueur) et une
  // élévation un peu plus basse que l'isométrie stricte (35,26°) pour accentuer le relief.
  // Visée un peu en avant du centre : le bord avant du plateau reste visible en bas de l'écran,
  // le reste du plateau déborde et remplit toute la zone de jeu.
  const ELEVATION = THREE.MathUtils.degToRad(28)
  const AIM = 0.85
  let yaw = Math.PI / 4, yawTarget = yaw
  const camDir = new THREE.Vector3()
  const camEye = new THREE.Vector3()
  // zoom sur la table de blackjack : 0 = vue du plateau, 1 = cadré sur la table
  let focusK = 0, focusTarget = 0
  const focusPt = new THREE.Vector3()
  const aimCam = () => {
    camEye.set(Math.cos(ELEVATION) * Math.sin(yaw), Math.sin(ELEVATION), Math.cos(ELEVATION) * Math.cos(yaw))
    const e = focusK * focusK * (3 - 2 * focusK)
    const tx = Math.sin(yaw) * AIM * G * (1 - e) + focusPt.x * e, tz = Math.cos(yaw) * AIM * G * (1 - e) + focusPt.z * e
    cam.position.set(tx + camEye.x * 30, camEye.y * 30, tz + camEye.z * 30)
    cam.lookAt(tx, 0, tz)
    // direction vers laquelle les têtes se tournent (un peu au-dessus de la caméra)
    camDir.copy(camEye).add(new THREE.Vector3(0, 0.3, 0)).normalize()
  }
  aimCam()
  const resize = () => {
    const W = el.clientWidth, H = el.clientHeight
    if (!W || !H) return
    renderer.setSize(W, H)
    const as = W / H
    // Sur écran étroit (mobile) on élargit le cadrage pour garder toute la flaque.
    // la caméra recule au même rythme que le plateau grandit : il reste entier à l'écran
    const e = focusK * focusK * (3 - 2 * focusK)
    const zoom = FR * G * (1 - e) + 5.4 * e
    aimCam()
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
  sun.position.set(-8, 13, -1)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 })
  sun.shadow.bias = -0.0005
  scene.add(sun)
  // ——— le plateau : une dalle de terre en relief sous la mare, vue en isométrie
  // (dessus clair, tranche plus sombre, contour à l'encre) ; elle grandit avec la mare.
  const plateau = new THREE.Group()
  scene.add(plateau)
  const slabMat = new THREE.MeshToonMaterial({ color: 0xd7d2c8, gradientMap: grad })
  const topMat = new THREE.MeshToonMaterial({ color: 0xf3f0ea, gradientMap: grad })
  // Plateau carré, vu par un coin : son dessus remplit l'écran et le coin avant laisse voir
  // ses deux tranches. La vue tourne par quarts de tour, pour toujours garder un coin face à nous.
  const SLAB = 16.5
  const slabGeo = new RoundedBoxGeometry(SLAB, 0.8, SLAB, 4, 0.3)
  const slab = new THREE.Mesh(slabGeo, slabMat)
  slab.position.y = -0.42
  slab.receiveShadow = true
  plateau.add(slab)
  const top = new THREE.Mesh(new RoundedBoxGeometry(SLAB - 0.04, 0.06, SLAB - 0.04, 4, 0.03), topMat)
  top.position.y = -0.03
  top.receiveShadow = true
  plateau.add(top)
  // contour encre de la dalle
  const slabInk = new THREE.Mesh(slabGeo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }))
  slabInk.position.copy(slab.position)
  slabInk.scale.set(1.005, 1.05, 1.005)
  plateau.add(slabInk)
  // traits de terre sur les quatre tranches
  for (let i = 0; i < 36; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + (i % 3) * 0.3, 0.02), new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.45 }))
    const along = -SLAB / 2 + 1 + ((i * 7.3) % (SLAB - 2))
    const face = i % 4
    const y = -0.3 - (i % 3) * 0.15
    if (face === 0) m.position.set(along, y, SLAB / 2 + 0.01)
    else if (face === 1) { m.position.set(SLAB / 2 + 0.01, y, along); m.rotation.y = Math.PI / 2 }
    else if (face === 2) { m.position.set(along, y, -SLAB / 2 - 0.01); m.rotation.y = Math.PI }
    else { m.position.set(-SLAB / 2 - 0.01, y, along); m.rotation.y = -Math.PI / 2 }
    plateau.add(m)
  }
  // capteur d'ombres posé sur le plateau (et sur l'eau) : des ombres franches, comme les
  // ombres dures de l'interface, quelle que soit la lumière ambiante
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(SLAB, SLAB), new THREE.ShadowMaterial({ color: INK, opacity: 0.28 }))
  shadowCatcher.rotation.x = -Math.PI / 2
  shadowCatcher.position.y = 0.03
  shadowCatcher.receiveShadow = true
  shadowCatcher.renderOrder = 3
  plateau.add(shadowCatcher)

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
  const reeds: THREE.Group[] = []
  ;[[-3.0, -0.6], [-2.75, -0.45], [-2.9, -0.25], [3.1, 0.3], [3.35, 2.0], [0.3, 2.6], [0.6, 2.75], [-0.8, -2.5], [2.6, -2.3], [-2.6, 1.9], [1.1, -2.4]].forEach(([x, z], i) => {
    const sc = 0.6 + rp() * 0.8
    spreadAdd(addPeb(i % 5, stoneTones[i % 3], scene, [x, 0.04 * sc, z], [0, rp() * 6, 0], [1.35 * sc, 0.5 * sc, (0.9 + rp() * 0.4) * sc]))
  })

  // ——— décor d'ambiance (gratuit) : le plateau n'est jamais vide
  // Tout est placé en dehors de la mare (ellipse 3,4 × 2,6) et s'écarte quand elle grandit.
  const outsidePond = (x: number, z: number, margin = 0.5) => (x / (3.4 + margin)) ** 2 + (z / (2.6 + margin)) ** 2 > 1
  const rAmb = seeded(321)
  const spot = (rMin: number, rMax: number, margin = 0.5): [number, number] => {
    for (let k = 0; k < 40; k++) {
      const a = rAmb() * Math.PI * 2, r = rMin + rAmb() * (rMax - rMin)
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.85
      if (outsidePond(x, z, margin) && Math.abs(x) < 7.6 && Math.abs(z) < 7.6) return [x, z]
    }
    return [6.5, 0]
  }
  const cattailMat = toon(0x6f6a62), bushMat = toon(0xc4bfb5), flowerMat = toon(0xffffff)
  const bladeGeo = new THREE.CylinderGeometry(0.006, 0.018, 0.34, 4)
  bladeGeo.translate(0, 0.17, 0)
  // touffes d'herbe : trois brins d'encre penchés
  for (let i = 0; i < 32; i++) {
    const [x, z] = spot(3.2, 9.8)
    const tuftG = new THREE.Group()
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(bladeGeo, black)
      b.rotation.set((rAmb() - 0.5) * 0.6, rAmb() * 3, (k - 1) * 0.35)
      b.scale.setScalar(0.7 + rAmb() * 0.6)
      tuftG.add(b)
    }
    tuftG.position.set(x, 0, z)
    scene.add(tuftG)
    spreadAdd(tuftG)
  }
  // galets épars
  for (let i = 0; i < 26; i++) {
    const [x, z] = spot(3.4, 10)
    const sc = 0.45 + rAmb() * 0.7
    spreadAdd(addPeb(i % 5, stoneTones[i % 3], scene, [x, 0.04 * sc, z], [0, rAmb() * 6, 0], [1.3 * sc, 0.5 * sc, (0.9 + rAmb() * 0.4) * sc]))
  }
  // roseaux au bord de l'eau : tiges fines et épis sombres
  const stemGeo = new THREE.CylinderGeometry(0.012, 0.016, 1, 4)
  stemGeo.translate(0, 0.5, 0)
  const cattailGeo = new THREE.CapsuleGeometry(0.045, 0.16, 4, 8)
  ;[[3.3, 1.2], [-3.4, 1.0], [1.4, 2.6], [-1.6, -2.5], [3.0, -1.6], [-2.6, 2.1]].forEach(([x, z], c) => {
    const grp = new THREE.Group()
    const n = 3 + (c % 3)
    for (let k = 0; k < n; k++) {
      const h = 0.7 + rAmb() * 0.6
      const st = new THREE.Mesh(stemGeo, black)
      st.scale.set(1, h, 1)
      st.position.set((rAmb() - 0.5) * 0.35, 0, (rAmb() - 0.5) * 0.35)
      st.rotation.set((rAmb() - 0.5) * 0.25, 0, (rAmb() - 0.5) * 0.25)
      grp.add(st)
      if (k % 2 === 0) {
        const top = add(cattailGeo, cattailMat, st, [0, 0.82, 0])
        top.scale.set(1, 1 / h, 1)
      }
    }
    grp.position.set(x * 1.08, 0, z * 1.08)
    grp.userData.sway = c
    scene.add(grp)
    spreadAdd(grp)
    reeds.push(grp)
  })
  // petits buissons ronds
  const bushGeo = new THREE.SphereGeometry(0.28, 14, 10)
  for (let i = 0; i < 9; i++) {
    const [x, z] = spot(5.2, 9.6, 1)
    const grp = new THREE.Group()
    ;[[0, 0, 0, 1], [0.24, -0.05, 0.1, 0.75], [-0.2, -0.06, 0.12, 0.7]].forEach(([dx, dy, dz, sc]) =>
      add(bushGeo, bushMat, grp, [dx, 0.2 + dy, dz], null, [sc, sc * 0.85, sc]))
    grp.position.set(x, 0, z)
    grp.rotation.y = rAmb() * 6
    scene.add(grp)
    spreadAdd(grp)
  }
  // fleurs blanches dans l'herbe
  const petalSmall = new THREE.SphereGeometry(0.04, 8, 6)
  for (let i = 0; i < 18; i++) {
    const [x, z] = spot(3.4, 9.6)
    const f = new THREE.Group()
    for (let k = 0; k < 5; k++) add(petalSmall, flowerMat, f, [Math.cos(k * 1.26) * 0.05, 0.05, Math.sin(k * 1.26) * 0.05], null, [1, 0.5, 1])
    add(petalSmall, stoneTones[2], f, [0, 0.06, 0], null, [0.6, 0.5, 0.6], false)
    f.position.set(x, 0, z)
    scene.add(f)
    spreadAdd(f)
  }

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
  const headGeo = new THREE.SphereGeometry(0.34, 28, 20)
  const muzzleGeo = new THREE.SphereGeometry(0.12, 20, 14)
  const earGeo = new THREE.SphereGeometry(0.07, 12, 10)
  const noseGeo = new THREE.SphereGeometry(0.075, 14, 10)
  const arc = new THREE.TorusGeometry(0.045, 0.008, 4, 12, Math.PI)
  const whiskerGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.26, 4)

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
  const MOM_LOOK: Look = { fur: 0x99948c, pale: 0xfcf9f2, paw: 0x75716a, eyes: 'open', extra: 'none', ear: 1, size: 1, feet: 0.5 }
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
      eyes: pick(r, ['open', 'open', 'open', 'closed', 'wink', 'round'] as const),
      extra: pick(r, ['none', 'none', 'flower', 'scarf', 'pebble', 'mohawk', 'patch'] as const),
      ear: 0.8 + r() * 0.45,
      size: 0.85 + r() * 0.25,
      feet: 0.25 + r() * 0.6,
    }
  }
  const dotGeo = new THREE.SphereGeometry(0.036, 10, 8)
  const eyeGeo = new THREE.SphereGeometry(0.052, 14, 10)
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const ringGeo = new THREE.TorusGeometry(0.042, 0.009, 4, 14)
  const petalGeo = new THREE.SphereGeometry(0.055, 12, 8)
  const feather = toon(0xffffff)

  /**
   * Tête de loutre de mer (face vers +z) : large et un peu aplatie, petites oreilles basses,
   * deux gros coussinets de moustaches, une truffe sombre, des yeux petits et écartés.
   */
  const makeHead = (parent: THREE.Object3D, look: Look, seed: number, light = false) => {
    const head = new THREE.Group()
    parent.add(head)
    const mat = tone(look.pale), paw = tone(look.paw)
    // tête ronde et duveteuse, tournée vers nous
    add(headGeo, mat, head, [0, 0, 0], null, [1.06, 0.96, 0.94])
    ;[-1, 1].forEach(sd => {
      // petites oreilles rondes, en haut sur les côtés
      add(earGeo, paw, head, [sd * 0.27, 0.23, -0.01], null, [0.9 * look.ear, 0.9 * look.ear, 0.6])
      // coussinets de moustaches, ronds, sous la truffe, avec leurs petits points
      add(muzzleGeo, mat, head, [sd * 0.065, -0.105, 0.255], null, [1, 0.78, 0.75])
      ;[[0.1, -0.085], [0.13, -0.115], [0.085, -0.13]].forEach(([x, y]) =>
        add(dotGeo, black, head, [sd * x, y, 0.335], null, [0.28, 0.28, 0.28], false))
      // les yeux : grands, ronds et brillants (ou fermés, clin d'œil, étonnés)
      const eye: V3 = [sd * 0.125, 0.055, 0.29]
      const kind = look.eyes === 'wink' ? (sd < 0 ? 'closed' : 'open') : look.eyes
      if (kind === 'closed') add(arc, black, head, [eye[0], eye[1] - 0.01, eye[2] + 0.01], [0, 0, Math.PI], [1.05, 0.7, 1], false)
      else {
        add(eyeGeo, black, head, eye, null, kind === 'round' ? [1.15, 1.15, 0.7] : [1, 1.05, 0.7], false)
        add(dotGeo, glintMat, head, [eye[0] + 0.018, eye[1] + 0.022, eye[2] + 0.03], null, [0.38, 0.38, 0.38], false)
      }
      // la bouche : un petit « w » sous les coussinets
      add(arc, black, head, [sd * 0.032, -0.165, 0.275], [0, 0, Math.PI], [0.6, 0.6, 1], false)
      ;[0.02, -0.025].forEach(dy => {
        const w = add(whiskerGeo, black, head, [sd * 0.2, -0.1 + dy, 0.27], null, null, false)
        w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(sd, dy * 3 - 0.06, 0.12).normalize())
      })
    })
    // grosse truffe noire, arrondie, avec un reflet
    add(noseGeo, black, head, [0, -0.025, 0.315], null, [1.45, 1.1, 0.85], false)
    add(dotGeo, glintMat, head, [-0.03, 0.0, 0.375], null, [0.5, 0.3, 0.3], false)
    if (look.extra === 'patch') add(new THREE.SphereGeometry(0.1, 14, 10), paw, head, [0.125, 0.06, 0.24], null, [1, 0.9, 0.5])
    if (look.extra === 'flower') {
      // une fleur glissée derrière l'oreille
      const f = new THREE.Group()
      f.position.set(-0.25, 0.25, 0.08)
      head.add(f)
      for (let k = 0; k < 5; k++) add(petalGeo, feather, f, [Math.cos(k * 1.26) * 0.07, Math.sin(k * 1.26) * 0.07, 0], null, [1, 1, 0.6])
      add(petalGeo, stoneTones[2], f, [0, 0, 0.02], null, [0.6, 0.6, 0.6])
    }
    if (look.extra === 'mohawk') [-0.08, 0, 0.08].forEach((z, k) => add(new THREE.ConeGeometry(0.05, 0.16, 8), paw, head, [0, 0.33 - Math.abs(z), z - 0.05 * k], [-0.3 + k * 0.3, 0, 0]))
    const rnd = seeded(seed + 3)
    for (let i = 0; i < (light ? 0 : 14); i++) {
      // touffes sur le front et le pourtour du visage
      const a = -0.9 + rnd() * 1.8, ph = 0.35 + rnd() * 0.5
      const n = new THREE.Vector3(Math.sin(a) * Math.sin(ph * 2), Math.cos(a) * 0.9, 0.2 + rnd() * 0.25).normalize()
      tuft(head, n.clone().multiplyScalar(0.33).multiply(new THREE.Vector3(1.06, 0.96, 0.94)), n, Math.PI + (rnd() - 0.5) * 0.6)
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
    head.position.set(0.97, 0.4, 0)
    if (look.extra === 'scarf') {
      // écharpe tricotée autour du cou
      const sc = add(new THREE.TorusGeometry(0.27, 0.07, 8, 24), tone(0xd6d1c6), body, [0.84, 0.36, 0], [0, Math.PI / 2, 0.3])
      sc.scale.set(1, 1, 0.8)
    }
    if (look.extra === 'pebble') addPeb(1, stoneTones[0], chest, [0.05, 0.06, 0], [0, 0.4, 0], [0.8, 0.5, 0.7])

    const rnd = seeded(seed)
    for (let i = 0; i < (light ? 4 : 24); i++) {
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
  const CAP: Record<string, number> = { rocher: 12, nenuphar: 12, galet: 3, amie: 24, plume: 1, riviere: 1, noeud: 1, lunettes: 1, cousin: 1, echarpe: 1, couronne: 1, collier: 1, bateau: 6, parasol: 6, cascade: 1, avion: 1, blackjack: 1, phare: 1, jumeau: 1, grandmere: 1, sainte: 1, berceuse: 1, cape: 1, monocle: 1, moulin: 1, arcenciel: 1, voisins: 1 }

  // ——— la bande : la première amie tient la patte de la mère ; les autres forment de petits
  // groupes (2 à 4) qui dérivent chacun à leur rythme autour d'elle, sans ordre précis
  const GROUP_SIZES = [2, 3, 2, 4, 3, 2, 4, 3, 2, 3]
  const groupOf = (i: number) => {
    if (i === 0) return -1
    let k = i - 1, g = 0
    while (k >= GROUP_SIZES[g % GROUP_SIZES.length]) { k -= GROUP_SIZES[g % GROUP_SIZES.length]; g++ }
    return g
  }
  type Swim = { x: number; z: number; vx: number; vz: number; h: number; ox: number; oz: number; next: number }
  const swims = new Map<THREE.Object3D, Swim>()
  const anchors: { x: number; z: number; tx: number; tz: number; next: number }[] = []
  const rnd2 = seeded(99)
  const updateBand = (t: number, dt: number) => {
    const band = props.amie ?? []
    if (!band.length) return
    const rx = 3.0 * G, rz = 2.2 * G
    // les points de ralliement des groupes se promènent autour de la mère
    const nGroups = groupOf(band.length - 1) + 1
    while (anchors.length < nGroups) anchors.push({ x: NaN, z: NaN, tx: 0, tz: 0, next: 0 })
    anchors.forEach((a, g) => {
      if (t > a.next) {
        const ang = rnd2() * Math.PI * 2, r = (1.8 + rnd2() * 1.6) * Math.sqrt(G)
        a.tx = otter.position.x + Math.cos(ang) * r
        a.tz = otter.position.z + Math.sin(ang) * r * 0.8
        a.next = t + 7000 + rnd2() * 8000 + g * 500
        if (Number.isNaN(a.x)) { a.x = a.tx; a.z = a.tz } // nouveau groupe : il apparaît directement à sa place
      }
      a.x += (a.tx - a.x) * Math.min(1, dt * 0.25)
      a.z += (a.tz - a.z) * Math.min(1, dt * 0.25)
    })
    band.forEach((pr, i) => {
      const g = groupOf(i)
      let st = swims.get(pr.obj)
      // cible : à côté de la mère (patte dans la patte), ou dans son petit groupe
      let tx: number, tz: number
      if (g < 0) {
        const off = new THREE.Vector3(-0.1, 0, 0.98).applyAxisAngle(up, heading)
        tx = otter.position.x + off.x
        tz = otter.position.z + off.z
      } else {
        if (!st || t > st.next) {
          const ang = rnd2() * Math.PI * 2, r = 0.3 + rnd2() * 0.6
          if (st) { st.ox = Math.cos(ang) * r; st.oz = Math.sin(ang) * r; st.next = t + 4000 + rnd2() * 6000 }
          else st = { x: 0, z: 0, vx: 0, vz: 0, h: rnd2() * 6.28, ox: Math.cos(ang) * r, oz: Math.sin(ang) * r, next: t + 4000 + rnd2() * 6000 }
        }
        tx = anchors[g].x + st.ox
        tz = anchors[g].z + st.oz
      }
      if (!st) st = { x: tx, z: tz, vx: 0, vz: 0, h: heading, ox: 0, oz: 0, next: Infinity }
      if (!swims.has(pr.obj)) { st.x = tx; st.z = tz; swims.set(pr.obj, st) }
      // attirée par sa cible, repoussée par les loutres trop proches
      let ax = (tx - st.x) * 0.7, az = (tz - st.z) * 0.7
      const push = (x: number, z: number, minD: number) => {
        const dx = st!.x - x, dz = st!.z - z, d = Math.hypot(dx, dz) || 0.001
        if (d < minD) { ax += (dx / d) * (minD - d) * 4; az += (dz / d) * (minD - d) * 4 }
      }
      push(otter.position.x, otter.position.z, g < 0 ? 0.9 : 1.15)
      band.forEach((o, j) => { if (j !== i) { const so = swims.get(o.obj); if (so) push(so.x, so.z, groupOf(j) === g ? 1.0 : 1.3) } })
      st.vx = (st.vx + ax * dt) * (1 - Math.min(0.9, dt * 1.6))
      st.vz = (st.vz + az * dt) * (1 - Math.min(0.9, dt * 1.6))
      const sp = Math.hypot(st.vx, st.vz)
      if (sp > 0.55) { st.vx *= 0.55 / sp; st.vz *= 0.55 / sp }
      st.x += st.vx * dt
      st.z += st.vz * dt
      // on reste dans la mare
      const e = (st.x / rx) ** 2 + (st.z / rz) ** 2
      if (e > 1) { const k = 1 / Math.sqrt(e); st.x *= k; st.z *= k }
      // elle se tourne doucement dans le sens où elle dérive (la voisine de la mère reste alignée)
      const want = g < 0 ? heading : sp > 0.06 ? Math.atan2(-st.vz, st.vx) : st.h
      let da = want - st.h
      da = Math.atan2(Math.sin(da), Math.cos(da))
      st.h += da * Math.min(1, dt * (g < 0 ? 3 : 0.8))
      pr.obj.position.x = st.x
      pr.obj.position.z = st.z
    })
  }
  const PARASOLS: [number, number][] = [[-3.7, -1.9], [3.5, 2.1], [-5.6, 2.4], [5.2, -2.6], [0.6, -4.6], [-1.2, 4.4]]
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
  const ROCKS: [number, number, number][] = [[-4.3, 0.7, 0.42], [4.5, -0.5, 0.36], [-1.4, -3.1, 0.3], [2.6, 2.8, 0.34],
    [-6.6, -1.8, 0.5], [6.4, 1.6, 0.46], [-3.2, 4.6, 0.38], [3.6, -4.2, 0.4], [-7.6, 1.6, 0.34], [7.4, -2.8, 0.36], [0.8, 6.2, 0.42], [-0.6, -6.4, 0.44]]
  // nénuphars, sur l'eau
  const PADS: [number, number][] = [[2.3, 0.9], [-2.5, -0.3], [0.9, -1.8], [-1.1, 1.7], [2.7, -1.1], [-2.1, 1.1], [1.6, 1.9], [-1.7, -1.6], [2.9, 0.1], [-2.9, 0.6], [0.2, 2.2], [0.4, -2.2]]
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
        g.position.set(0, -0.31, 0.12)
        return { obj: g, parent: head, water: false }
      }
      case 'lunettes': {
        ;[-1, 1].forEach(sd => add(lensGeo, black, g, [sd * 0.13, 0, 0], [Math.PI / 2, 0, 0], [0.9, 1, 0.9], false))
        add(new THREE.BoxGeometry(0.08, 0.02, 0.02), black, g, [0, 0.02, 0], null, null, false)
        g.position.set(0, 0.06, 0.31)
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
        g.position.set(0, 0.31, -0.04)
        g.rotation.x = -0.3
        return { obj: g, parent: head, water: false }
      }
      case 'collier': {
        // collier de coquillages sous le menton
        for (let k = 0; k < 5; k++) {
          const a = -1.1 + (k / 4) * 2.2
          add(petalGeo, shellMat, g, [Math.sin(a) * 0.3, -Math.cos(a) * 0.09, Math.cos(a) * 0.08], null, [0.8, 0.65, 0.6])
        }
        g.position.set(0, -0.29, 0.1)
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
      case 'sainte': {
        // la sainte loutre : pelage presque blanc, grande mitre pointue, auréole qui flotte
        const o = makeOtter(613, { fur: 0xd8d3ca, pale: 0xffffff, paw: 0xa9a49b, eyes: 'closed', extra: 'none', ear: 0.9, size: 1, feet: 0.35 })
        const mitre = new THREE.Group()
        mitre.position.set(0, 0.26, -0.03)
        mitre.rotation.x = -0.22
        o.head.add(mitre)
        // la mitre : un grand chapeau en ogive, avec ses deux bandes et ses deux rubans
        const shape = new THREE.Shape()
        shape.moveTo(-0.27, 0)
        shape.lineTo(0.27, 0)
        shape.bezierCurveTo(0.31, 0.32, 0.17, 0.6, 0, 0.82)
        shape.bezierCurveTo(-0.17, 0.6, -0.31, 0.32, -0.27, 0)
        const mitreGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 })
        mitreGeo.translate(0, 0, -0.1)
        mitreGeo.computeVertexNormals()
        add(mitreGeo, tone(0xfbf8f1), mitre, [0, 0, 0])
        add(new THREE.BoxGeometry(0.07, 0.68, 0.27), tone(0x8f8a83), mitre, [0, 0.34, 0], null, null, false)
        add(new THREE.BoxGeometry(0.58, 0.08, 0.27), tone(0x8f8a83), mitre, [0, 0.05, 0], null, null, false)
        ;[-1, 1].forEach(sd => add(new THREE.BoxGeometry(0.05, 0.3, 0.02), tone(0x8f8a83), mitre, [sd * 0.12, -0.12, -0.13], [0.2, 0, sd * 0.15]))
        // l'auréole, au-dessus de la mitre
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.022, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }))
        halo.add(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.034, 6, 32), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })))
        halo.rotation.x = Math.PI / 2 - 0.3
        halo.position.set(0, 1.05, -0.06)
        o.head.add(halo)
        o.root.scale.setScalar(0.95)
        o.root.userData.rig = o
        o.root.userData.halo = halo
        o.root.position.set(-2.0 * G, 0, -1.15 * G)
        return { obj: o.root, parent: scene, water: true }
      }
      case 'grandmere': {
        // la grand-mère : pelage blanchi, lunettes rondes, châle, elle se berce à l'écart
        const o = makeOtter(77, { fur: 0xc9c4ba, pale: 0xfefcf7, paw: 0x9a958c, eyes: 'closed', extra: 'scarf', ear: 0.9, size: 1, feet: 0.3 })
        ;[-1, 1].forEach(sd => add(ringGeo, black, o.head, [sd * 0.125, 0.055, 0.315], null, [2, 2, 1], false))
        add(new THREE.BoxGeometry(0.06, 0.012, 0.012), black, o.head, [0, 0.065, 0.33], null, null, false)
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
      case 'cape': {
        // une cape sombre qui flotte à la surface, attachée au cou, et ondule derrière elle
        const sh = new THREE.Shape()
        sh.moveTo(0.85, 0.22)
        sh.bezierCurveTo(0.2, 0.75, -0.9, 0.95, -1.5, 0.75)
        sh.bezierCurveTo(-1.7, 0.2, -1.7, -0.2, -1.5, -0.75)
        sh.bezierCurveTo(-0.9, -0.95, 0.2, -0.75, 0.85, -0.22)
        sh.lineTo(0.85, 0.22)
        const cloth = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), tone(0x45433f))
        cloth.rotation.x = -Math.PI / 2
        cloth.position.y = 0.05
        cloth.receiveShadow = true
        g.add(cloth)
        add(new THREE.SphereGeometry(0.06, 10, 8), stoneTones[0], body, [0.84, 0.5, 0])
        g.userData.cloth = cloth
        return { obj: g, parent: otter, water: true }
      }
      case 'monocle': {
        add(ringGeo, black, g, [0, 0, 0], null, [2.5, 2.5, 1], false)
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.32, 4), black)
        chain.position.set(0.1, -0.17, -0.02)
        chain.rotation.z = 0.5
        g.add(chain)
        g.position.set(0.125, 0.055, 0.315)
        return { obj: g, parent: head, water: false }
      }
      case 'moulin': {
        // un petit moulin au bord de la flaque ; sa roue tourne dans l'eau
        add(new THREE.BoxGeometry(0.9, 0.8, 0.8), paperMat, g, [0, 0.4, 0])
        add(new THREE.ConeGeometry(0.75, 0.5, 4), bowMat, g, [0, 1.05, 0], [0, Math.PI / 4, 0])
        add(new THREE.BoxGeometry(0.2, 0.3, 0.02), black, g, [0, 0.25, 0.41], null, null, false)
        const wheel = new THREE.Group()
        wheel.position.set(0.62, 0.38, 0)
        g.add(wheel)
        add(new THREE.TorusGeometry(0.42, 0.035, 6, 24), stoneTones[2], wheel, [0, 0, 0], [0, Math.PI / 2, 0])
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2
          add(new THREE.BoxGeometry(0.16, 0.06, 0.2), paperMat, wheel, [0, Math.cos(a) * 0.42, Math.sin(a) * 0.42], [a, 0, 0])
        }
        g.userData.wheel = wheel
        g.position.set(-4.7, 0, 1.0)
        g.rotation.y = 0.6
        spreadAdd(g)
        return { obj: g, parent: scene, water: false }
      }
      case 'arcenciel': {
        // un arc-en-ciel léger : trois bandes fines et translucides, cernées d'un trait d'encre fin,
        // et deux petits nuages à ses pieds
        ;[0xffffff, 0xe2ded6, 0xc9c4ba].forEach((c, k) => {
          const band = new THREE.Mesh(new THREE.TorusGeometry(2.9 - k * 0.14, 0.07, 6, 72, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 }))
          g.add(band)
        })
        ;[2.99, 2.53].forEach(r => g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 4, 72, Math.PI), black)))
        ;[-2.75, 2.75].forEach(x => {
          const cloud = new THREE.Group()
          ;[[0, 0, 0, 0.32], [0.3, -0.05, 0.05, 0.24], [-0.28, -0.06, 0.04, 0.22]].forEach(([dx, dy, dz, r]) =>
            add(new THREE.SphereGeometry(r, 14, 10), feather, cloud, [dx, dy, dz]))
          cloud.position.set(x, 0.18, 0)
          g.add(cloud)
        })
        g.rotation.y = Math.PI / 4
        g.position.set(-3.2, 0, -3.2)
        spreadAdd(g)
        return { obj: g, parent: scene, water: false }
      }
      case 'blackjack': {
        // une table de blackjack en demi-lune, un croupier loutre derrière, un tabouret devant
        const wood = tone(0x5f5b55), card = tone(0xffffff), leather = tone(0x3a3935)
        const table = new THREE.Group()
        g.add(table)
        add(new THREE.CylinderGeometry(1.25, 1.25, 0.12, 48, 1, false, -Math.PI / 2, Math.PI), wood, table, [0, 0.78, 0])
        // le tapis imprimé : arcs, cases de mise, « blackjack paie 3 pour 2 »
        const feltCv = document.createElement('canvas')
        feltCv.width = feltCv.height = 512
        const fx = feltCv.getContext('2d')!
        const feltTex = new THREE.CanvasTexture(feltCv)
        feltTex.colorSpace = THREE.SRGBColorSpace
        const paintFelt = () => {
          fx.setTransform(1, 0, 0, 1, 0, 0)
          fx.fillStyle = '#a39e95'
          fx.fillRect(0, 0, 512, 512)
          // le côté du joueur (le bord arrondi) est à droite du canevas (cf. UV du cylindre)
          fx.translate(256, 256)
          fx.rotate(-Math.PI / 2)
          fx.strokeStyle = '#1b1a18'
          fx.fillStyle = '#1b1a18'
          fx.lineWidth = 5
          fx.beginPath(); fx.arc(0, 0, 175, 0.15, Math.PI - 0.15); fx.stroke()
          fx.lineWidth = 3
          fx.beginPath(); fx.arc(0, 0, 120, 0.35, Math.PI - 0.35); fx.stroke()
          // cinq cases de mise
          for (let k = 0; k < 5; k++) {
            const a = 0.45 + (k / 4) * (Math.PI - 0.9)
            fx.beginPath(); fx.arc(Math.cos(a) * 205, Math.sin(a) * 205, 22, 0, Math.PI * 2); fx.stroke()
          }
          // textes en arc
          const arcText = (txt: string, r: number, size: number) => {
            fx.font = `700 ${size}px "Space Mono", monospace`
            fx.textAlign = 'center'
            fx.textBaseline = 'middle'
            const span = txt.length * size * 0.62 / r
            for (let k = 0; k < txt.length; k++) {
              const a = Math.PI / 2 + span / 2 - (k + 0.5) * (span / txt.length)
              fx.save()
              fx.translate(Math.cos(a) * r, Math.sin(a) * r)
              fx.rotate(a - Math.PI / 2)
              fx.fillText(txt[k], 0, 0)
              fx.restore()
            }
          }
          arcText('BLACKJACK PAIE 3 POUR 2', 148, 19)
          arcText('LE CROUPIER S’ARRÊTE À 17', 96, 14)
          feltTex.needsUpdate = true
        }
        paintFelt()
        document.fonts?.ready.then(paintFelt)
        const feltTop = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.06, 48, 1, false, -Math.PI / 2, Math.PI), [toon(0xa39e95), new THREE.MeshToonMaterial({ map: feltTex, gradientMap: grad }), toon(0xa39e95)])
        feltTop.position.set(0, 0.86, 0.02)
        feltTop.receiveShadow = true
        table.add(feltTop)
        // boudin de cuir sur le bord arrondi
        const rail = add(new THREE.TorusGeometry(1.18, 0.075, 8, 48, Math.PI), leather, table, [0, 0.88, 0])
        rail.rotation.x = Math.PI / 2 // l'arc passe par +z : le bord arrondi, côté joueuse
        ;[-0.75, 0.75].forEach(x => add(new THREE.CylinderGeometry(0.06, 0.08, 0.78, 8), wood, table, [x, 0.39, 0.3]))
        add(new THREE.CylinderGeometry(0.06, 0.08, 0.78, 8), wood, table, [0, 0.39, 0.9])
        // côté croupier : râtelier de jetons et sabot de cartes
        ;[-0.62, -0.46, -0.3].forEach((x, k) => {
          for (let h = 0; h < 4 + k; h++) add(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 14), k % 2 ? card : leather, table, [x, 0.91 + h * 0.028, 0.08], null, null, h === 0)
        })
        add(new THREE.BoxGeometry(0.24, 0.13, 0.32), wood, table, [0.62, 0.96, 0.12], [0, -0.3, 0])
        add(new THREE.BoxGeometry(0.16, 0.012, 0.22), card, table, [0.6, 1.035, 0.12], [0, -0.3, 0])
        // les cartes de la main en cours, posées sur le tapis (cf. setCards)
        const cardsGroup = new THREE.Group()
        table.add(cardsGroup)
        g.userData.cards = cardsGroup
        // le tabouret du joueur
        add(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 18), wood, table, [0, 0.52, 1.55])
        add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), black, table, [0, 0.25, 1.55], null, null, false)
        // le croupier : une loutre assise derrière la table, nœud papillon noir et visière
        const seat = (seed: number, look: Look) => {
          const holder = new THREE.Group()
          const o = makeOtter(seed, look, true)
          o.root.rotation.z = Math.PI / 2 // debout : la tête en haut, le ventre vers l'avant
          o.root.position.y = 1.05
          holder.add(o.root)
          holder.scale.setScalar(0.55)
          return { holder, rig: o }
        }
        const dealer = seat(500, { ...lookFor(500), eyes: 'open', extra: 'none' })
        dealer.holder.position.set(0, 0.25, -0.55)
        dealer.holder.rotation.y = -Math.PI / 2 // le ventre (−x) vers +z, face au joueur
        table.add(dealer.holder)
        ;[-1, 1].forEach(sd => add(new THREE.ConeGeometry(0.06, 0.11, 10), bowMat, dealer.rig.head, [sd * 0.06, -0.3, 0.12], [0, 0, sd * Math.PI / 2]))
        const visor = add(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20, 1, false, -Math.PI / 2, Math.PI), tone(0xe6e2d9), dealer.rig.head, [0, 0.28, 0.08])
        visor.rotation.x = 0.35
        // la joueuse : la mère (même apparence), qui arrive de la mare quand on s'assoit
        const player = seat(7, MOM_LOOK)
        player.holder.rotation.y = Math.PI / 2 // face au croupier
        player.holder.visible = false
        table.add(player.holder)
        table.rotation.y = -Math.PI / 4 // vue de profil : croupier à droite, joueuse à gauche
        g.position.set(5.0, 0, -0.3)
        g.scale.setScalar(1.15)
        spreadAdd(g)
        g.userData.table = table
        g.userData.dealer = dealer.rig
        g.userData.player = player
        tableObj = g
        return { obj: g, parent: scene, water: false }
      }
      case 'avion': {
        // la loutre aviatrice : un biplan des années 1950 qui tourne au-dessus du plateau,
        // en tirant une banderole « I ♥ OTTER »
        const plane = new THREE.Group()
        g.add(plane)
        const hull = tone(0xf3f0ea), trim = tone(0x8f8a83)
        // fuselage (le nez vers +x) et capot moteur
        add(new THREE.CapsuleGeometry(0.28, 1.5, 6, 16), hull, plane, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.95])
        add(new THREE.CylinderGeometry(0.3, 0.3, 0.32, 16), trim, plane, [0.86, 0, 0], [0, 0, Math.PI / 2])
        // les deux ailes, reliées par des mâts
        ;[0.36, -0.22].forEach(y => add(new THREE.BoxGeometry(0.62, 0.05, 3.0), hull, plane, [0.25, y, 0]))
        ;[-1.05, 1.05].forEach(z => [0.05, 0.45].forEach(x => {
          const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.58, 4), black)
          strut.position.set(x, 0.07, z)
          plane.add(strut)
        }))
        // empennage
        add(new THREE.BoxGeometry(0.4, 0.04, 1.0), hull, plane, [-0.95, 0.05, 0])
        add(new THREE.BoxGeometry(0.38, 0.42, 0.04), trim, plane, [-0.98, 0.26, 0], [0, 0, -0.2])
        // train d'atterrissage
        ;[-0.32, 0.32].forEach(z => add(new THREE.SphereGeometry(0.09, 10, 8), black, plane, [0.42, -0.42, z], null, [1, 1, 0.6], false))
        // hélice qui tourne
        const prop = new THREE.Group()
        prop.position.set(1.04, 0, 0)
        plane.add(prop)
        add(new THREE.BoxGeometry(0.03, 0.85, 0.08), black, prop, [0, 0, 0], null, null, false)
        add(new THREE.SphereGeometry(0.07, 10, 8), trim, prop, [0.02, 0, 0])
        // la pilote : une tête de loutre avec ses lunettes d'aviatrice, une écharpe au vent
        const pilot = makeHead(plane, { ...MOM_LOOK, eyes: 'open' }, 77, true)
        pilot.position.set(-0.1, 0.36, 0)
        pilot.scale.setScalar(0.62)
        ;[-1, 1].forEach(sd => add(ringGeo, black, pilot, [sd * 0.125, 0.06, 0.3], null, [1.9, 1.9, 1], false))
        add(new THREE.BoxGeometry(0.46, 0.04, 0.04), black, pilot, [0, 0.1, 0.2], null, null, false)
        const scarf = add(new THREE.BoxGeometry(0.5, 0.05, 0.12), tone(0xd6d1c6), plane, [-0.42, 0.28, 0.12])
        // la banderole : deux faces (texte lisible des deux côtés), qui ondulent
        const cv = document.createElement('canvas')
        cv.width = 640
        cv.height = 128
        const ctx = cv.getContext('2d')!
        const tex = new THREE.CanvasTexture(cv)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 4
        const paint = () => {
          ctx.fillStyle = '#fbfaf8'
          ctx.fillRect(0, 0, 640, 128)
          ctx.strokeStyle = '#1b1a18'
          ctx.lineWidth = 8
          ctx.strokeRect(4, 4, 632, 120)
          ctx.fillStyle = '#1b1a18'
          ctx.font = '700 76px "Space Mono", monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('I ♥ OTTER', 320, 68)
          tex.needsUpdate = true
        }
        paint()
        document.fonts?.ready.then(paint)
        const bannerGeo = new THREE.PlaneGeometry(3.2, 0.64, 24, 1)
        const banner = new THREE.Group()
        banner.position.set(-3.6, 0.0, 0)
        plane.add(banner)
        const front = new THREE.Mesh(bannerGeo, new THREE.MeshBasicMaterial({ map: tex }))
        const back = new THREE.Mesh(bannerGeo, new THREE.MeshBasicMaterial({ map: tex }))
        back.rotation.y = Math.PI
        banner.add(front, back)
        // corde entre la queue (x = −1,1) et le bord avant de la banderole (x = −2,0)
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4), black)
        rope.rotation.z = Math.PI / 2
        rope.position.set(-1.55, 0, 0)
        plane.add(rope)
        plane.scale.setScalar(0.9)
        g.userData.plane = plane
        g.userData.prop = prop
        g.userData.scarf = scarf
        g.userData.banner = bannerGeo
        g.userData.base = bannerGeo.attributes.position.array.slice()
        return { obj: g, parent: scene, water: false }
      }
      case 'cascade': {
        // le ruisseau suit le plateau jusqu'au bord avant-droit, puis tombe dans le vide
        const ang = Math.PI / 2
        const ex = SLAB / 2, ez = 4.6
        const path = new THREE.CatmullRomCurve3([new THREE.Vector3(2.4, 0, 0.6), new THREE.Vector3(4.8, 0, 1.8), new THREE.Vector3(6.9, 0, 3.6), new THREE.Vector3(ex + 0.2, 0, ez)])
        const pts = path.getPoints(40)
        const side = (sgn: number) => pts.map((q, k) => {
          const tan = path.getTangent(k / 40)
          const w = 0.32 + 0.1 * Math.sin(k * 0.6) + (k / 40) * 0.25
          return new THREE.Vector2(q.x - tan.z * w * sgn, -(q.z + tan.x * w * sgn))
        })
        const sh = new THREE.Shape()
        const left = side(1), right = side(-1).reverse()
        sh.moveTo(left[0].x, left[0].y)
        left.concat(right).forEach(v => sh.lineTo(v.x, v.y))
        const stream = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshToonMaterial({ color: 0xdfdbd4, gradientMap: grad, stencilWrite: true, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp }))
        stream.rotation.x = -Math.PI / 2
        stream.position.y = 0.019
        g.add(stream)
        // la chute d'eau, accrochée à la tranche du plateau
        const fall = new THREE.Group()
        fall.position.set(ex, 0, ez)
        fall.rotation.y = ang
        g.add(fall)
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 9), new THREE.MeshBasicMaterial({ color: 0xe6e2da, side: THREE.DoubleSide }))
        sheet.position.set(0, -4.5, 0.06)
        fall.add(sheet)
        ;[-0.48, 0.48].forEach(x => {
          const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 9), black)
          edge.position.set(x, -4.5, 0.07)
          fall.add(edge)
        })
        const streaks: THREE.Mesh[] = []
        for (let k = 0; k < 10; k++) {
          const d = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.6 + (k % 3) * 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }))
          d.position.set(-0.36 + (k % 5) * 0.18, 0, 0.08)
          d.userData.u = k / 10
          fall.add(d)
          streaks.push(d)
        }
        // écume au départ de la chute
        ;[[-0.3, 0.1], [0.05, 0.16], [0.35, 0.08]].forEach(([x, z]) => add(new THREE.SphereGeometry(0.15, 12, 8), feather, fall, [x, 0.06, z], null, [1, 0.6, 1]))
        g.userData.streaks = streaks
        return { obj: g, parent: plateau, water: true }
      }
      case 'voisins': {
        // les voisins : leur propre petite flaque, juste à côté, et trois loutres
        const pool = new THREE.Mesh(blob(1.1, 1.4, 1, 1.7), new THREE.MeshToonMaterial({ color: 0xdfdbd4, gradientMap: grad, stencilWrite: true, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp }))
        pool.rotation.x = -Math.PI / 2
        pool.position.y = 0.02
        pool.receiveShadow = true
        g.add(pool)
        const trio: OtterRig[] = []
        ;[[-0.6, 0.2], [0.5, -0.3], [0.2, 0.55]].forEach(([x, z], k) => {
          const o = makeOtter(201 + k * 7, lookFor(201 + k * 7), true)
          o.root.scale.setScalar(0.62)
          o.root.position.set(x, 0, z)
          o.root.rotation.y = k * 2.1
          o.root.traverse(c => { c.castShadow = false })
          g.add(o.root)
          trio.push(o)
        })
        g.userData.trio = trio
        g.position.set(1.4, 0, 4.9)
        spreadAdd(g)
        return { obj: g, parent: scene, water: true }
      }
      case 'riviere': {
        // un bras de rivière qui arrive par l'arrière et se jette dans la flaque
        const sh = new THREE.Shape()
        const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-8.25, 0, -5.4), new THREE.Vector3(-6.0, 0, -4.2), new THREE.Vector3(-3.4, 0, -2.5), new THREE.Vector3(-1.8, 0, -1.2)])
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
        if (i >= 6) o.root.traverse(c => { c.castShadow = false })
        o.root.userData.rig = o
        // les pattes qui se tiennent (dessinées entre la mère et l'amie)
        const link = new THREE.Mesh(linkGeo, pawMat)
        link.add(new THREE.Mesh(linkGeo, inkMat))
        link.visible = i === 0
        scene.add(link)
        o.root.userData.link = link
        return { obj: o.root, parent: scene, water: true }
      }
      case 'cousin': {
        const o = makeOtter(41, { ...lookFor(41), extra: 'none', eyes: 'open' })
        o.root.scale.setScalar(0.9)
        // le chapeau du cousin
        add(new THREE.CylinderGeometry(0.15, 0.17, 0.22, 20), bowMat, o.head, [0, 0.42, -0.02], [-0.15, 0, 0.15])
        add(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 24), bowMat, o.head, [0, 0.31, 0], [-0.15, 0, 0.15])
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
    1 + 0.065 * Math.min(CAP.amie, owned.amie || 0) + ((owned.cousin || 0) > 0 ? 0.08 : 0) + ((owned.grandmere || 0) > 0 ? 0.08 : 0) + ((owned.voisins || 0) > 0 ? 0.12 : 0) + Math.min(0.3, 0.03 * (owned.colonie || 0)) + ((owned.riviere || 0) > 0 ? 0.1 : 0)
  const applyGrowth = () => {
    spread.forEach(({ o, x, z }) => o.position.set(x * G, o.position.y, z * G))
    pools.forEach(m => m.scale.set(G, G, 1))
    plateau.scale.set(G, 1, G)
    river?.scale.set(G, 1, G)
    const sh = 9 * G
    Object.assign(sun.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh })
    sun.shadow.camera.updateProjectionMatrix()
    resize()
  }

  let tableObj: THREE.Object3D | null = null
  // cartes à jouer : une texture par carte (dessinée une fois), à l'encre sur blanc
  const cardGeo = new THREE.PlaneGeometry(0.18, 0.25)
  const cardTex = new Map<string, THREE.Texture>()
  const cardTexture = (c: TableCard) => {
    const key = c.hidden ? 'dos' : c.rank + c.suit
    let tex = cardTex.get(key)
    if (tex) return tex
    const cv = document.createElement('canvas')
    cv.width = 144
    cv.height = 200
    const x = cv.getContext('2d')!
    x.fillStyle = '#ffffff'
    x.fillRect(0, 0, 144, 200)
    x.strokeStyle = '#1b1a18'
    x.lineWidth = 8
    x.strokeRect(4, 4, 136, 192)
    if (c.hidden) {
      // dos de carte : hachures
      x.lineWidth = 4
      for (let k = -200; k < 200; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 200, 200); x.stroke() }
      x.lineWidth = 8
      x.strokeRect(4, 4, 136, 192)
    } else {
      const soft = c.suit === '♥' || c.suit === '♦'
      x.fillStyle = soft ? '#6b6863' : '#1b1a18'
      x.font = '700 44px "Space Mono", monospace'
      x.textAlign = 'left'
      x.textBaseline = 'top'
      x.fillText(c.rank, 14, 10)
      x.font = '700 84px serif'
      x.textAlign = 'center'
      x.textBaseline = 'middle'
      x.fillText(c.suit, 72, 118)
    }
    tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    cardTex.set(key, tex)
    return tex
  }
  let atTable = false, leaving = false, seatStart = 0
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
        if (pr.obj === tableObj) tableObj = null
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
    const targets: THREE.Object3D[] = [otter, ...(props.amie ?? []).map(p => p.obj), ...(props.cousin ?? []).map(p => p.obj), ...(props.grandmere ?? []).map(p => p.obj), ...(props.sainte ?? []).map(p => p.obj)]
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
  // clic droit (ou molette) glissé : on fait tourner le plateau
  let turning = false, turnX = 0
  const hitsTable = (e: PointerEvent) => {
    if (!tableObj || !onTable) return false
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(ndc, cam)
    return raycaster.intersectObject(tableObj, true).length > 0
  }
  const onDown = (e: PointerEvent) => {
    if (e.button === 0 && !atTable && hitsTable(e)) { onTable?.(); return }
    if (e.button === 1 || e.button === 2) {
      turning = true
      turnX = e.clientX
      e.preventDefault()
      return
    }
    dragging = true
    if (hits(e)) pet(e, true)
  }
  const onMove = (e: PointerEvent) => {
    if (turning) {
      yawTarget -= (e.clientX - turnX) * 0.008
      yaw = yawTarget
      turnX = e.clientX
      aimCam()
      return
    }
    const over = hits(e)
    el.style.cursor = over ? (dragging ? 'grabbing' : 'grab') : 'default'
    document.documentElement.toggleAttribute(OTTER_HOVER_ATTR, over)
    if (!dragging || !over) return
    if (performance.now() - lastPet < PET_THROTTLE_MS) return
    pet(e, false)
    if (Math.random() < 0.35) ripple(false)
  }
  const onUp = () => {
    dragging = false
    if (turning) {
      // on se cale sur le coin le plus proche (45° + k × 90°)
      yawTarget = Math.PI / 4 + Math.round((yaw - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2)
    }
    turning = false
  }
  const noMenu = (e: Event) => e.preventDefault()
  const onLeave = () => document.documentElement.removeAttribute(OTTER_HOVER_ATTR)
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerleave', onLeave)
  el.addEventListener('contextmenu', noMenu)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)

  // ——— boucle
  const gUp = new THREE.Vector3(), gFwd = new THREE.Vector3(), gq = new THREE.Quaternion(), gp = new THREE.Vector3()
  /** Oriente une tête : face à nous, légèrement inclinée vers le ciel et vers l'avant. */
  const gaze = (h: THREE.Object3D) => {
    h.parent!.getWorldQuaternion(gq)
    gUp.set(0, 1, 0).applyQuaternion(gq)
    gFwd.set(1, 0, 0).applyQuaternion(gq)
    const dir = gUp.multiplyScalar(0.18).addScaledVector(gFwd, 0.08).addScaledVector(camDir, 1).normalize()
    h.lookAt(h.getWorldPosition(gp).add(dir))
  }
  const pos = new THREE.Vector2(0, 0), tgt = new THREE.Vector2(0, 0)

  let idle = 0, heading = 0.3, nextRip = 0, last = performance.now()
  let pupIn = 1, hug = 0, synced = false
  /** Met la scène en accord avec les achats (appelé à chaque changement de `owned`). */
  let prevOwned: Record<string, number> = {}
  const sync = (owned: Record<string, number>) => {
    syncProps(owned, synced)
    // un achat qui ne se voit pas (caresses) fait quand même réagir la loutre
    if (synced && ['patte', 'gant', 'bain', 'brosse', 'massage', 'chatouilles', 'concert', 'colonie'].some(k => (owned[k] || 0) > (prevOwned[k] || 0))) { hop = 1; squish = 1; ripple(true) }
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
    updateBand(t, dt)
    for (const kind in props) {
      for (const pr of props[kind]) {
        // arrivée : chute avec rebond, puis grande onde au contact de l'eau
        const k = (t - pr.born) / 650
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
            const rx = (2.4 + (pr.i % 3) * 0.3) * G, rz = (1.6 + (pr.i % 3) * 0.2) * G
            pr.obj.position.set(Math.cos(a) * rx, 0.02 + Math.sin(t / 600 + pr.i) * 0.02, Math.sin(a) * rz)
            pr.obj.rotation.set(Math.sin(t / 700 + pr.i) * 0.08, -a - Math.PI / 2, Math.sin(t / 900) * 0.06)
            break
          }
          case 'cape': {
            const cloth = pr.obj.userData.cloth as THREE.Mesh
            cloth.scale.set(1 + Math.sin(t / 900) * 0.03, 1 + Math.sin(t / 650) * 0.06, 1)
            break
          }
          case 'blackjack': {
            const dealer = pr.obj.userData.dealer as OtterRig
            const player = pr.obj.userData.player as { holder: THREE.Object3D; rig: OtterRig }
            dealer.root.position.y = 1.05 + Math.sin(t / 900) * 0.02
            pr.obj.updateMatrixWorld(true)
            gaze(dealer.head)
            // la joueuse vient s'asseoir : elle part du bord de la mare, saute jusqu'au tabouret
            const seatT = Math.min(1, Math.max(0, (t - seatStart) / 1400))
            player.holder.visible = atTable || seatT < 1 && seatStart > 0 && !leaving
            if (atTable) {
              const from = new THREE.Vector3(0, 0, 4.2), to = new THREE.Vector3(0, 0.3, 1.55)
              const p = from.lerp(to, seatT)
              player.holder.position.set(p.x, p.y + Math.abs(Math.sin(seatT * Math.PI * 3)) * 0.35 * (1 - seatT), p.z)
              gaze(player.rig.head)
            }
            break
          }
          case 'avion': {
            // grande boucle au-dessus du plateau ; l'avion s'incline dans le virage
            const plane = pr.obj.userData.plane as THREE.Object3D
            const a = t / 9000
            const rx = 6.2 * G, rz = 4.4 * G
            const x = Math.cos(a) * rx, z = Math.sin(a) * rz
            const dx = -Math.sin(a) * rx, dz = Math.cos(a) * rz
            plane.position.set(x, 5.4 + Math.sin(t / 1300) * 0.25, z)
            plane.rotation.set(0, Math.atan2(-dz, dx), 0)
            plane.rotateX(-0.28) // inclinaison vers l'intérieur du virage
            ;(pr.obj.userData.prop as THREE.Object3D).rotation.x = t / 25
            ;(pr.obj.userData.scarf as THREE.Object3D).rotation.y = Math.sin(t / 90) * 0.3
            // la banderole ondule
            const geo = pr.obj.userData.banner as THREE.PlaneGeometry
            const base = pr.obj.userData.base as Float32Array
            const pos = geo.attributes.position
            for (let k = 0; k < pos.count; k++) {
              const bx = base[k * 3]
              pos.setZ(k, Math.sin(bx * 2.2 - t / 140) * 0.12 * (1.6 - bx / 3.2))
            }
            pos.needsUpdate = true
            break
          }
          case 'cascade':
            ;(pr.obj.userData.streaks as THREE.Mesh[]).forEach(d => {
              const u = (d.userData.u + t / 1400) % 1
              d.position.y = -0.2 - u * 8.5
            })
            break
          case 'moulin':
            ;(pr.obj.userData.wheel as THREE.Object3D).rotation.x = -t / 1400
            break
          case 'arcenciel':
            pr.obj.scale.setScalar(G)
            break
          case 'voisins':
            ;(pr.obj.userData.trio as OtterRig[]).forEach((o, k) => {
              o.root.position.y = Math.sin(t / 900 + k * 2) * 0.03
              o.root.rotation.y = k * 2.1 + Math.sin(t / 5000 + k) * 0.4
              o.root.updateMatrixWorld(true)
              gaze(o.head)
            })
            break
          case 'phare':
            ;(pr.obj.userData.beam as THREE.Object3D).rotation.y = t / 1800
            break
          case 'jumeau': {
            const rig = pr.obj.userData.rig as { inner: THREE.Object3D; head: THREE.Object3D }
            rig.inner.scale.y = 1 + Math.sin(t / 470 + 1.3) * 0.04
            gaze(rig.head)
            rig.head.rotateX(Math.max(0, Math.sin(t / 2700 + 2)) * 0.25)
            break
          }
          case 'sainte': {
            // elle flotte, sereine, en tournant très lentement ; l'auréole monte et descend
            const rig = pr.obj.userData.rig as OtterRig
            pr.obj.position.set(-2.0 * G + Math.sin(t / 7000) * 0.3, Math.sin(t / 1200) * 0.04, -1.15 * G + Math.cos(t / 8000) * 0.2)
            pr.obj.rotation.set(Math.sin(t / 1600) * 0.05, -0.6 + t / 20000, 0)
            ;(pr.obj.userData.halo as THREE.Object3D).position.y = 1.05 + Math.sin(t / 700) * 0.04
            pr.obj.updateMatrixWorld(true)
            gaze(rig.head)
            break
          }
          case 'grandmere': {
            const rig = pr.obj.userData.rig as OtterRig
            pr.obj.position.set(-2.4 * G + Math.sin(t / 6000) * 0.3, Math.sin(t / 1100) * 0.03, 1.9 * G + Math.cos(t / 7000) * 0.2)
            pr.obj.rotation.set(Math.sin(t / 1400) * 0.08, 2.4 + Math.sin(t / 5000) * 0.3, 0)
            pr.obj.updateMatrixWorld(true)
            gaze(rig.head)
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
            // position et cap : calculés par updateBand (petits groupes qui dérivent)
            const side = 1
            const sw = swims.get(pr.obj)
            const hk = Math.max(0, 1 - (performance.now() - (pr.obj.userData.hopAt ?? -1e9)) / 330)
            pr.obj.position.y = Math.sin(t / 900 + pr.i * 1.7) * 0.03 + Math.sin(hk * Math.PI) * 0.14
            pr.obj.rotation.set(Math.sin(t / 1300 + pr.i) * 0.06, (sw?.h ?? heading) + Math.sin(t / 2100 + pr.i) * 0.08, 0)
            pr.obj.updateMatrixWorld(true)
            gaze(rig.head)
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
            gaze(rig.head)
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
    gaze(head)

    // bébé : arrivée en rebond, respiration, la mère le serre dans ses pattes
    if (pup.visible) {
      pupIn = Math.min(1, pupIn + dt / 0.7)
      const pop = pupIn < 1 ? 1 + Math.sin(pupIn * Math.PI) * 0.35 : 1
      const br = 1 + Math.sin(t / 520) * 0.04
      pupInner.scale.set(pupIn * pop, pupIn * pop * br, pupIn * pop)
      pupInner.position.y = Math.sin(pupIn * Math.PI) * 0.5
      gaze(pupHead)
      pupHead.rotateX(Math.max(0, Math.sin(t / 2300)) * 0.25) // relève la tête de temps en temps
    }
    pup.position.z += ((props.jumeau?.length ? 0.2 : 0) - pup.position.z) * Math.min(1, dt * 4)
    hug += ((pup.visible ? 1 : 0) - hug) * Math.min(1, dt * 4)
    mom.paws.forEach((a, i) => { a.rotation.x = (i ? 1 : -1) * (0.9 + 0.55 * hug) })
    favPebble.position.set(0.1 - 0.42 * hug, 0.06, 0)
    favPebble.visible = !props.galet?.length
    clock = t
    reeds.forEach(r => { r.rotation.z = Math.sin(t / 1300 + r.userData.sway * 1.7) * 0.05 })
    if (Math.abs(focusTarget - focusK) > 0.001) {
      focusK += (focusTarget - focusK) * Math.min(1, dt * 3.2)
      if (Math.abs(focusTarget - focusK) < 0.002) focusK = focusTarget
      resize()
    }
    if (Math.abs(yawTarget - yaw) > 0.0005) {
      yaw += (yawTarget - yaw) * Math.min(1, dt * 7)
      aimCam()
    }
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
    /** S'asseoir à la table de blackjack (zoom, la loutre arrive) ou la quitter. */
    setTable(on: boolean) {
      if (on === atTable || !tableObj) return
      atTable = on
      leaving = !on
      focusTarget = on ? 1 : 0
      if (on) {
        // la table se cadre dans le haut de l'écran : le panneau de jeu occupe le bas
        tableObj.getWorldPosition(focusPt)
        focusPt.x += Math.sin(yaw) * 0.85
        focusPt.z += Math.cos(yaw) * 0.85
        seatStart = performance.now()
      }
    },
    /** Pose sur le tapis les cartes de la main en cours ({ rank, suit, hidden }). */
    setCards(dealerCards: TableCard[], playerCards: TableCard[]) {
      const grp = tableObj?.userData.cards as THREE.Group | undefined
      if (!grp) return
      grp.children.slice().forEach(c => grp.remove(c))
      const lay = (list: TableCard[], z: number) => list.forEach((c, i) => {
        const m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: cardTexture(c) }))
        m.rotation.set(-Math.PI / 2, 0, 0)
        m.position.set((i - (list.length - 1) / 2) * 0.2, 0.895 + i * 0.002, z + (i % 2) * 0.02)
        m.rotateZ((i - (list.length - 1) / 2) * 0.06)
        grp.add(m)
      })
      lay(dealerCards, 0.32)
      lay(playerCards, 0.78)
    },
    /** Fait tourner la vue d'un quart de tour (dir = 1 ou -1). */
    rotate(dir: number) { yawTarget += (dir * Math.PI) / 2 },
    dispose() {
      cancelAnimationFrame(raf)
      clearInterval(boil)
      timers.forEach(clearTimeout)
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('contextmenu', noMenu)
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
