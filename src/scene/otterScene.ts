// Scène 3D de la loutre — portée depuis otter-scene.js (passation design).
// createOtterScene(el, { onPet }) → { dispose() }
// Le conteneur doit avoir une taille ; le canvas le remplit et suit ses redimensionnements.
import * as THREE from 'three'

export interface OtterSceneOptions {
  /** appelé à chaque caresse, avec la position écran (clientX / clientY) */
  onPet?: (x: number, y: number) => void
}

type V3 = [number, number, number]

const INK = 0x1b1a18
const PET_THROTTLE_MS = 140

export function createOtterScene(el: HTMLElement, { onPet }: OtterSceneOptions = {}) {
  let raf = 0

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.style.display = 'block'
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const FR = 7.2
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
  cam.position.set(12, 10.5, 12)
  cam.lookAt(0, 0, 0)
  const resize = () => {
    const W = el.clientWidth, H = el.clientHeight
    if (!W || !H) return
    renderer.setSize(W, H)
    const as = W / H
    // Sur écran étroit (mobile) on élargit le cadrage pour garder toute la flaque.
    const fr = as < 1 ? FR * Math.min(1.9, 1.15 / as) : FR
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
  const white = toon(0xffffff), fur = toon(0xf7f5f0), stone = toon(0xf4f2ee)

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
  const water = (geo: THREE.BufferGeometry, c: number, y: number, x = 0, z = 0) => {
    const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: c, gradientMap: grad, stencilWrite: true, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp }))
    m.rotation.x = -Math.PI / 2
    m.position.set(x, y, z)
    m.receiveShadow = true
    scene.add(m)
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
    add(new THREE.DodecahedronGeometry(r, 0), stone, scene, [x, y ?? r * s[1] * 0.55, z], [0.3, x, 0.2], s)
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
    addPeb(i % 5, stoneTones[i % 3], scene, [x, 0.04 * sc, z], [0, rp() * 6, 0], [1.35 * sc, 0.5 * sc, (0.9 + rp() * 0.4) * sc])
  })

  // ——— la loutre
  const otter = new THREE.Group()
  scene.add(otter)
  const body = new THREE.Group()
  body.position.y = 0.14
  body.rotation.z = 0.07
  otter.add(body)
  const prof = new THREE.SplineCurve(
    [[0, -0.78], [0.22, -0.74], [0.34, -0.6], [0.4, -0.35], [0.44, -0.05], [0.43, 0.22], [0.39, 0.45], [0.31, 0.64], [0.17, 0.76], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y)),
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
  add(torsoGeo, fur, body, [0, 0.05, 0], [0, 0, -Math.PI / 2])
  add(new THREE.CapsuleGeometry(0.42, 0.8, 6, 24), black, body, [0, -0.112, 0], [0, 0, Math.PI / 2], [0.04, 1, 0.95], false)
  add(new THREE.CapsuleGeometry(0.15, 0.7, 6, 16), fur, body, [-1.2, -0.06, 0], [0, 0, Math.PI / 2 + 0.1], [0.45, 1, 1.15])
  add(new THREE.CapsuleGeometry(0.22, 0.72, 6, 16), black, body, [-1.2, -0.112, 0], [0, 0, Math.PI / 2], [0.04, 1, 1], false)
  ;[-1, 1].forEach(sd => {
    add(new THREE.CapsuleGeometry(0.065, 0.14, 6, 12), fur, body, [-0.6, 0.36, sd * 0.16], [sd * 0.1, 0, 0.6])
    add(new THREE.SphereGeometry(0.13, 16, 12), fur, body, [-0.7, 0.5, sd * 0.17], [sd * 0.2, 0, 0.9 + sd * 0.1], [0.35, 1, 1.05])
    add(new THREE.CapsuleGeometry(0.055, 0.18, 6, 12), fur, body, [0.58, 0.44, sd * 0.15], [sd * 0.5, 0, 1.0])
    add(new THREE.SphereGeometry(0.065, 14, 10), fur, body, [0.47, 0.53, sd * 0.08], null, [1, 0.8, 1])
  })
  addPeb(2, stoneTones[1], body, [0.46, 0.6, 0], [0, 0.4, 0], [0.85, 0.45, 0.7])

  const head = new THREE.Group()
  head.position.set(0.98, 0.4, 0)
  body.add(head)
  add(new THREE.SphereGeometry(0.37, 28, 20), white, head, [0, 0, 0], null, [1.06, 0.95, 0.95])
  ;[-1, 1].forEach(sd => add(new THREE.SphereGeometry(0.13, 20, 14), white, head, [sd * 0.085, -0.09, 0.29], null, [1, 0.85, 0.8]))
  add(new THREE.SphereGeometry(0.07, 12, 8), black, head, [0, -0.01, 0.41], null, [1.35, 0.75, 0.7], false)
  const smile = new THREE.TorusGeometry(0.04, 0.007, 4, 10, Math.PI)
  ;[-1, 1].forEach(sd => {
    add(new THREE.SphereGeometry(0.075, 12, 10), white, head, [sd * 0.29, 0.25, -0.02], null, [1, 1, 0.6])
    add(smile, black, head, [sd * 0.15, 0.08, 0.33], [0, 0, 0], [1.1, 0.8, 1], false)
    add(smile, black, head, [sd * 0.04, -0.16, 0.3], [0, 0, Math.PI], null, false)
    ;[0.03, -0.03].forEach(dy => {
      const w = add(new THREE.CylinderGeometry(0.004, 0.004, 0.36, 4), black, head, [sd * 0.32, -0.1 + dy, 0.26], null, null, false)
      w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(sd, dy * 4 - 0.05, 0.25).normalize())
    })
  })

  // fourrure : petits « U » à l'encre
  const arcGeo = new THREE.TorusGeometry(0.045, 0.006, 4, 10, Math.PI)
  const tuft = (parent: THREE.Object3D, p: THREE.Vector3, n: THREE.Vector3, rotZ: number) => {
    const m = new THREE.Mesh(arcGeo, black)
    m.position.copy(p)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
    m.rotateZ(rotZ)
    parent.add(m)
  }
  const rnd = seeded(7)
  for (let i = 0; i < 26; i++) {
    const u = -0.62 + rnd() * 1.25, th = (rnd() - 0.5) * 2.2
    const r = 0.43 - Math.abs(u) * 0.12
    const n = new THREE.Vector3(0, Math.cos(th), Math.sin(th) * 0.92).normalize()
    const p = new THREE.Vector3(u, 0.05 + Math.cos(th) * r + 0.005, Math.sin(th) * r * 0.92)
    if (p.y < 0.12) continue
    tuft(body, p, n, Math.PI + (rnd() - 0.5) * 0.8)
  }
  for (let i = 0; i < 12; i++) {
    const th = rnd() * Math.PI * 2, ph = rnd() * 1.4
    const n = new THREE.Vector3(Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph))
    if (n.z > 0.35) continue
    tuft(head, n.clone().multiplyScalar(0.36), n, Math.PI + (rnd() - 0.5))
  }
  for (let i = 0; i < 5; i++) tuft(body, new THREE.Vector3(-0.95 - i * 0.12, 0.02, (rnd() - 0.5) * 0.1), new THREE.Vector3(0, 1, 0), Math.PI)

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
  const ripple = (big: boolean) => {
    const mat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.4, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc })
    const m = new THREE.Line(ringGeos[(Math.random() * 4) | 0], mat)
    m.renderOrder = 2
    m.position.set(otter.position.x + (Math.random() - 0.5) * 0.4, 0.025, otter.position.z + (Math.random() - 0.5) * 0.3)
    m.rotation.y = otter.rotation.y + (Math.random() - 0.5) * 0.4
    scene.add(m)
    ripples.push({ m, t: 0, big, s0: 0.55 + Math.random() * (big ? 0.8 : 0.6), asp: 1.3 + Math.random() * 0.6, life: big ? 1.4 + Math.random() * 0.6 : 2 + Math.random() * 1.5 })
    if (big) {
      const id = setTimeout(() => { timers.delete(id); ripple(false) }, 160)
      timers.add(id)
    }
  }

  // ——— interaction : clic ou glisser sur la loutre
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  let hop = 0, squish = 0, lastPet = 0, dragging = false
  const hits = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(ndc, cam)
    return raycaster.intersectObject(otter, true).length > 0
  }
  const pet = (e: PointerEvent, strong: boolean) => {
    lastPet = performance.now()
    if (strong) { hop = 1; ripple(true) }
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
    if (!dragging || !over) return
    if (performance.now() - lastPet < PET_THROTTLE_MS) return
    pet(e, false)
    if (Math.random() < 0.35) ripple(false)
  }
  const onUp = () => { dragging = false }
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)

  // ——— boucle
  const camDir = new THREE.Vector3(12, 10.5, 12).normalize().add(new THREE.Vector3(0, 0.35, 0)).normalize()
  const pos = new THREE.Vector2(0, 0), tgt = new THREE.Vector2(0, 0)
  const tmp = new THREE.Vector3()
  let idle = 0, heading = 0.3, nextRip = 0, last = performance.now()
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
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  // trait qui tremble : on re-tire l'épaisseur du contour toutes les 140 ms
  const boil = setInterval(() => { inkU.value = 0.038 + Math.random() * 0.016 }, 140)

  return {
    dispose() {
      cancelAnimationFrame(raf)
      clearInterval(boil)
      timers.forEach(clearTimeout)
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
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
