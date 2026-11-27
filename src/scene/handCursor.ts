// Curseur « main 3D » : une main qui pointe de l'index, même rendu que la scène
// (toon + contour encre), dessinée dans un mini canvas qui suit le pointeur.
// createHandCursor() → { dispose() } · inactif sur écran tactile (pointer: coarse).
//
// Précision : le bout de l'index est l'origine du modèle ET le pivot de toutes les
// animations. Il ne bouge donc jamais, et sa position projetée dans le canvas donne
// le point chaud exact. Le canvas est déplacé dès l'événement pointermove (pas
// d'attente de la frame suivante), donc la main ne traîne pas derrière la souris.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const INK = 0x1b1a18
const SIZE = 72 // taille CSS du canvas, en px

/** Posé par la scène quand le pointeur survole la loutre (la main se fait caressante). */
export const OTTER_HOVER_ATTR = 'data-otter-hover'

export function createHandCursor() {
  if (!window.matchMedia('(pointer: fine)').matches) return { dispose() {} }

  const root = document.documentElement
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.max(2, Math.min(3, window.devicePixelRatio || 1)))
  renderer.setSize(SIZE, SIZE)
  const cv = renderer.domElement
  cv.className = 'hand-cursor'
  cv.setAttribute('aria-hidden', 'true')
  document.body.appendChild(cv)
  root.classList.add('has-hand-cursor')

  const scene = new THREE.Scene()
  // cadrage asymétrique : l'origine (le bout du doigt) tombe en haut à gauche du canvas
  const cam = new THREE.OrthographicCamera(-0.55, 1.95, 0.35, -2.15, 0.1, 50)
  cam.position.set(1.6, 1.4, 6)
  cam.lookAt(0, 0, 0)
  scene.add(new THREE.AmbientLight(0xffffff, 1.25))
  const sun = new THREE.DirectionalLight(0xffffff, 1.7)
  sun.position.set(-3, 5, 4)
  scene.add(sun)

  // ——— matériaux (même langage visuel que la scène)
  const grad = new THREE.DataTexture(new Uint8Array([190, 190, 190, 255, 232, 232, 232, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat)
  grad.minFilter = grad.magFilter = THREE.NearestFilter
  grad.needsUpdate = true
  const skin = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad })
  const cuffMat = new THREE.MeshToonMaterial({ color: 0xe9e6df, gradientMap: grad })
  const black = new THREE.MeshBasicMaterial({ color: INK })
  const inkU = { value: 0.04 }
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
  inkMat.onBeforeCompile = sh => {
    sh.uniforms.th = inkU
    sh.vertexShader = 'uniform float th;\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * th;')
  }
  // pas d'échelle non uniforme sur les maillages : le contour garde une épaisseur constante
  const part = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, p: [number, number, number], rz = 0, rx = 0) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(...p)
    m.rotation.set(rx, 0, rz)
    m.add(new THREE.Mesh(geo, inkMat))
    parent.add(m)
    return m
  }

  // ——— la main : dos vers l'écran, index tendu vers le haut, origine = bout de l'index
  const pivot = new THREE.Group() // toutes les animations tournent autour du bout du doigt
  scene.add(pivot)
  const hand = new THREE.Group()
  pivot.add(hand)
  const R = 0.13 // rayon des doigts
  const INDEX = 0.56 // longueur droite de l'index
  // index : de la base (y = −INDEX − R) au bout (y = 0)
  part(new THREE.CapsuleGeometry(R, INDEX, 8, 20), skin, hand, [0, -INDEX / 2 - R, 0])
  // paume : un bloc arrondi sous l'index, décalé vers la droite (main droite vue de dos)
  const palmY = -INDEX - R - 0.34
  part(new RoundedBoxGeometry(0.78, 0.7, 0.4, 5, 0.16), skin, hand, [0.25, palmY, -0.02])
  // trois doigts repliés : des phalanges rondes qui dépassent du haut de la paume
  ;[0.22, 0.42, 0.6].forEach((x, i) => {
    part(new THREE.CapsuleGeometry(0.115, 0.14, 6, 16), skin, hand, [x - 0.02, palmY + 0.3 - i * 0.012, 0.04], 0, Math.PI / 2)
  })
  // pouce, couché le long du flanc gauche
  part(new THREE.CapsuleGeometry(0.12, 0.3, 6, 16), skin, hand, [-0.17, palmY + 0.02, 0.12], -0.55)
  // manchette avec un liseré
  const cuffY = palmY - 0.52
  part(new RoundedBoxGeometry(0.86, 0.34, 0.46, 4, 0.1), cuffMat, hand, [0.26, cuffY, -0.02])
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.025, 0.48), black)
  band.position.set(0.26, cuffY + 0.09, -0.02)
  hand.add(band)
  // ongle de l'index : un petit trait, pour lire tout de suite « bout du doigt »
  const nail = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.011, 4, 12, Math.PI), black)
  nail.position.set(0, -0.1, R - 0.005)
  nail.rotation.z = Math.PI
  hand.add(nail)

  const BASE_TILT = 0.38 // inclinée vers la gauche, comme une flèche de curseur
  pivot.rotation.z = BASE_TILT

  // point chaud = projection de l'origine (le bout de l'index)
  cam.updateMatrixWorld()
  const o = new THREE.Vector3(0, 0, 0).project(cam)
  const hx = ((o.x + 1) / 2) * SIZE
  const hy = ((1 - o.y) / 2) * SIZE

  // ——— pointeur
  let px = 0, py = 0, lastX = 0, visible = false, down = false
  let vx = 0, press = 0, over = 0, rub = 0
  const place = () => { cv.style.transform = `translate3d(${px - hx}px, ${py - hy}px, 0)` }
  const show = (on: boolean) => {
    if (on === visible) return
    visible = on
    cv.style.opacity = on ? '1' : '0'
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    px = e.clientX
    py = e.clientY
    place()
    show(true)
  }
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    down = true
    px = e.clientX
    py = e.clientY
    place()
  }
  const onUp = () => { down = false }
  const onOut = (e: MouseEvent) => { if (!e.relatedTarget) show(false) }
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  window.addEventListener('blur', onUp)
  document.addEventListener('mouseout', onOut)

  // ——— boucle (animations uniquement : la position est gérée dans pointermove)
  let raf = 0, last = performance.now()
  const ease = (cur: number, to: number, k: number, dt: number) => cur + (to - cur) * (1 - Math.exp(-k * dt))
  const loop = (t: number) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.05, (t - last) / 1000)
    last = t
    if (!visible) return
    vx = ease(vx, dt > 0 ? (px - lastX) / dt : 0, 12, dt)
    lastX = px
    const hovering = root.hasAttribute(OTTER_HOVER_ATTR)
    press = ease(press, down ? 1 : 0, 30, dt)
    over = ease(over, hovering ? 1 : 0, 10, dt)
    rub = ease(rub, hovering && down ? 1 : 0, 10, dt)

    // penche avec le mouvement, appuie au clic, frétille au-dessus de la loutre
    const lean = THREE.MathUtils.clamp(-vx / 3000, -0.25, 0.25)
    pivot.rotation.z = BASE_TILT + lean + Math.sin(t / 160) * 0.05 * over + Math.sin(t / 70) * 0.12 * rub
    pivot.rotation.x = press * 0.5
    const s = 1 - press * 0.08
    pivot.scale.set(s, s, s)
    renderer.render(scene, cam)
  }
  raf = requestAnimationFrame(loop)
  // trait vivant, plus discret que dans la scène pour garder un curseur net
  const boil = setInterval(() => { inkU.value = 0.038 + Math.random() * 0.008 }, 140)

  return {
    dispose() {
      cancelAnimationFrame(raf)
      clearInterval(boil)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onUp)
      document.removeEventListener('mouseout', onOut)
      root.classList.remove('has-hand-cursor')
      scene.traverse(obj => (obj as THREE.Mesh).geometry?.dispose())
      renderer.dispose()
      cv.remove()
    },
  }
}
