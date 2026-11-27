// Curseur « main 3D » : une petite main gantée, même rendu que la scène (toon + contour encre
// qui tremble), dessinée dans un mini canvas qui suit le pointeur.
// createHandCursor() → { dispose() } · inactif sur écran tactile (pointer: coarse).
import * as THREE from 'three'

const INK = 0x1b1a18
const SIZE = 96 // taille CSS du canvas, en px

/** Posé par la scène quand le pointeur survole la loutre (la main se fait caressante). */
export const OTTER_HOVER_ATTR = 'data-otter-hover'

export function createHandCursor() {
  if (!window.matchMedia('(pointer: fine)').matches) return { dispose() {} }

  const root = document.documentElement
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.setSize(SIZE, SIZE)
  const cv = renderer.domElement
  cv.className = 'hand-cursor'
  cv.setAttribute('aria-hidden', 'true')
  document.body.appendChild(cv)
  root.classList.add('has-hand-cursor')

  const scene = new THREE.Scene()
  const F = 1.2
  const cam = new THREE.OrthographicCamera(-F, F, F, -F, 0.1, 50)
  cam.position.set(2.2, 2.6, 6)
  cam.lookAt(0, 0, 0)
  scene.add(new THREE.AmbientLight(0xffffff, 1.2))
  const sun = new THREE.DirectionalLight(0xffffff, 1.8)
  sun.position.set(-3, 5, 4)
  scene.add(sun)

  // ——— matériaux (copie du langage visuel de la scène)
  const grad = new THREE.DataTexture(new Uint8Array([170, 170, 170, 255, 225, 225, 225, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat)
  grad.minFilter = grad.magFilter = THREE.NearestFilter
  grad.needsUpdate = true
  const glove = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad })
  const cuffMat = new THREE.MeshToonMaterial({ color: 0xf4f2ee, gradientMap: grad })
  const black = new THREE.MeshBasicMaterial({ color: INK })
  const inkU = { value: 0.045 }
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
  inkMat.onBeforeCompile = sh => {
    sh.uniforms.th = inkU
    sh.vertexShader = 'uniform float th;\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * th;')
  }
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, p: [number, number, number], s?: [number, number, number], ink = true) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(...p)
    if (s) m.scale.set(...s)
    parent.add(m)
    if (ink) m.add(new THREE.Mesh(geo, inkMat))
    return m
  }

  // ——— la main (dos de la main vers l'écran, doigts vers le haut)
  const pivot = new THREE.Group() // inclinaison « flèche de curseur » + réactions
  scene.add(pivot)
  const hand = new THREE.Group()
  pivot.add(hand)
  add(new THREE.SphereGeometry(0.5, 24, 18), glove, hand, [0, 0, 0], [1, 1.08, 0.5])
  // trois coutures de gant sur le dos de la main
  const seam = new THREE.CylinderGeometry(0.012, 0.012, 0.34, 4)
  ;[-0.15, 0, 0.15].forEach(x => {
    const s = new THREE.Mesh(seam, black)
    s.position.set(x, 0.08, 0.245)
    hand.add(s)
  })

  const fingers: THREE.Group[] = []
  const tips: THREE.Object3D[] = []
  ;([[-0.33, 0.38], [-0.11, 0.46], [0.11, 0.44], [0.32, 0.34]] as const).forEach(([x, len], i) => {
    const f = new THREE.Group()
    f.position.set(x, 0.42, 0)
    f.rotation.z = -x * 0.35
    hand.add(f)
    add(new THREE.CapsuleGeometry(0.115, len, 6, 14), glove, f, [0, len / 2 + 0.06, 0], [1, 1, 0.9])
    const tip = new THREE.Object3D()
    tip.position.set(0, len + 0.18, 0)
    f.add(tip)
    fingers.push(f)
    tips.push(tip)
    f.userData.phase = i * 0.9
  })
  const thumb = new THREE.Group()
  thumb.position.set(-0.4, -0.12, 0.05)
  thumb.rotation.z = 0.95
  hand.add(thumb)
  add(new THREE.CapsuleGeometry(0.12, 0.28, 6, 14), glove, thumb, [0, 0.2, 0])

  // manchette
  add(new THREE.CylinderGeometry(0.4, 0.44, 0.32, 24), cuffMat, hand, [0, -0.66, 0], [1, 1, 0.62])
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.014, 4, 32), black)
  band.rotation.x = Math.PI / 2
  band.scale.set(1, 0.62, 1)
  band.position.y = -0.58
  hand.add(band)

  const BASE_TILT = 0.42
  pivot.rotation.z = BASE_TILT
  pivot.position.set(0.2, -0.25, 0)

  // point chaud : le bout de doigt le plus en haut à gauche, projeté dans le canvas
  scene.updateMatrixWorld(true)
  cam.updateMatrixWorld()
  const v = new THREE.Vector3()
  let hx = SIZE * 0.25, hy = SIZE * 0.1, best = Infinity
  tips.forEach(t => {
    t.getWorldPosition(v).project(cam)
    const x = ((v.x + 1) / 2) * SIZE, y = ((1 - v.y) / 2) * SIZE
    if (x + y < best) { best = x + y; hx = x; hy = y }
  })

  // ——— pointeur
  let px = -999, py = -999, lastX = 0, visible = false, down = false
  let vx = 0, press = 0, curl = 0, sway = 0
  const show = (on: boolean) => {
    if (on === visible) return
    visible = on
    cv.style.opacity = on ? '1' : '0'
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    px = e.clientX
    py = e.clientY
    show(true)
  }
  const onDown = (e: PointerEvent) => { if (e.pointerType !== 'touch') down = true }
  const onUp = () => { down = false }
  const onOut = (e: MouseEvent) => { if (!e.relatedTarget) show(false) }
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  document.addEventListener('mouseout', onOut)
  window.addEventListener('blur', onUp)

  // ——— boucle
  let raf = 0, last = performance.now()
  const ease = (cur: number, to: number, k: number, dt: number) => cur + (to - cur) * (1 - Math.exp(-k * dt))
  const loop = (t: number) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.05, (t - last) / 1000)
    last = t
    if (!visible) return
    cv.style.transform = `translate3d(${px - hx}px, ${py - hy}px, 0)`

    const over = root.hasAttribute(OTTER_HOVER_ATTR)
    vx = ease(vx, dt > 0 ? (px - lastX) / dt : 0, 10, dt)
    lastX = px
    press = ease(press, down ? 1 : 0, 28, dt)
    curl = ease(curl, over ? 1 : 0, 10, dt)
    sway = ease(sway, over && down ? 1 : 0, 8, dt)

    // la main penche dans le sens du mouvement, s'enfonce au clic, frotte en caressant
    const lean = THREE.MathUtils.clamp(-vx / 2500, -0.35, 0.35)
    pivot.rotation.z = BASE_TILT + lean + Math.sin(t / 70) * 0.16 * sway
    pivot.rotation.x = -0.15 + press * 0.55 + curl * 0.2
    pivot.position.y = -0.25 + Math.sin(t / 600) * 0.03 * (1 - press)
    const s = 1 - press * 0.1
    pivot.scale.set(s, s, s)
    fingers.forEach(f => {
      f.rotation.x = -curl * 0.45 - press * 0.25 + Math.sin(t / 90 + f.userData.phase) * 0.12 * sway
    })
    thumb.rotation.x = -curl * 0.3
    renderer.render(scene, cam)
  }
  raf = requestAnimationFrame(loop)
  const boil = setInterval(() => { inkU.value = 0.045 + Math.random() * 0.02 }, 140)

  return {
    dispose() {
      cancelAnimationFrame(raf)
      clearInterval(boil)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.removeEventListener('mouseout', onOut)
      window.removeEventListener('blur', onUp)
      root.classList.remove('has-hand-cursor')
      scene.traverse(o => (o as THREE.Mesh).geometry?.dispose())
      renderer.dispose()
      cv.remove()
    },
  }
}
