import { useEffect, useRef } from 'react'
import { OTTER_HOVER_ATTR } from '../scene/otterScene'
import { useGame } from '../game/store'

// Centre du coussin de la paume dans le viewBox du dessin : c'est le point de clic (1 unité = 1 px).
const TIP_X = 22
const TIP_Y = 30

/**
 * Curseur « patte de loutre » dessinée à l'encre, dans le style des icônes du jeu (trait 2,2 px,
 * aplat blanc, filtre « boil »). Souris uniquement : sur écran tactile rien ne change.
 * La main est déplacée directement dans pointermove (pas de retard) et toutes ses
 * animations tournent autour du coussin de la paume, qui reste donc sous le point de clic.
 */
export function HandCursor() {
  const ref = useRef<HTMLDivElement>(null)
  // avec le « Gant en laine », la main porte une moufle tricotée
  const mitten = useGame(s => (s.owned.gant || 0) > 0)

  useEffect(() => {
    const el = ref.current
    if (!el || !window.matchMedia('(pointer: fine)').matches) return
    const root = document.documentElement
    root.classList.add('has-hand-cursor')

    const place = (e: PointerEvent) => {
      el.style.transform = `translate3d(${e.clientX - TIP_X}px, ${e.clientY - TIP_Y}px, 0)`
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      place(e)
      el.classList.add('is-visible')
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      place(e)
      el.classList.add('is-down')
    }
    const onUp = () => el.classList.remove('is-down')
    const onOut = (e: MouseEvent) => { if (!e.relatedTarget) el.classList.remove('is-visible') }
    // la scène signale le survol de la loutre par un attribut sur <html>
    const mo = new MutationObserver(() => el.classList.toggle('is-petting', root.hasAttribute(OTTER_HOVER_ATTR)))
    mo.observe(root, { attributes: true, attributeFilter: [OTTER_HOVER_ATTR] })

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onUp)
    document.addEventListener('mouseout', onOut)
    return () => {
      mo.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onUp)
      document.removeEventListener('mouseout', onOut)
      root.classList.remove('has-hand-cursor')
    }
  }, [])

  return (
    <div ref={ref} className="hand-cursor" aria-hidden>
      <svg viewBox="0 0 44 52" width={44} height={52}>
        <g className="hand-cursor__hand">
          {/* ombre dure décalée, comme les cartes de l'interface */}
          <path d={PAW} transform="translate(2.5 2.5)" fill="#1b1a18" opacity={0.14} />
          <g style={{ filter: 'var(--boil)' }} stroke="#1b1a18" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            {/* la patte : une moufle duveteuse */}
            <path d={PAW} fill={mitten ? '#dcd7cd' : '#f6f2ea'} />
            {mitten && <path d={KNIT} fill="none" strokeWidth={1.1} />}
            {/* touffes de fourrure sur le pourtour */}
            <path d="M7.2 22 l-2.6 -1.6 M6.8 27.5 l-2.8 0.4 M36.8 22 l2.6 -1.6 M37.2 27.5 l2.8 0.4 M15 9.6 l-1.2 -2.4 M29 9.6 l1.2 -2.4" fill="none" strokeWidth={1.3} />
            {/* coussinets : quatre doigts et la paume, à l'encre */}
            <g fill="#1b1a18" strokeWidth={1}>
              <ellipse cx={13.6} cy={18.8} rx={2.2} ry={2.7} transform="rotate(-24 13.6 18.8)" />
              <ellipse cx={19.1} cy={15.2} rx={2.3} ry={2.8} transform="rotate(-8 19.1 15.2)" />
              <ellipse cx={24.9} cy={15.2} rx={2.3} ry={2.8} transform="rotate(8 24.9 15.2)" />
              <ellipse cx={30.4} cy={18.8} rx={2.2} ry={2.7} transform="rotate(24 30.4 18.8)" />
              {/* coussin de la paume, en trois lobes */}
              <path d="M14.6 31.4 C14.2 27.8 17.8 25.6 22 25.6 C26.2 25.6 29.8 27.8 29.4 31.4 C29.1 33.8 27.4 34.6 25.6 34 C24 33.4 23 34.4 22 34.4 C21 34.4 20 33.4 18.4 34 C16.6 34.6 14.9 33.8 14.6 31.4 Z" />
            </g>
            {/* petits reflets sur les coussinets */}
            <g fill="#fff" stroke="none">
              <circle cx={18.4} cy={14} r={0.6} />
              <circle cx={24.2} cy={14} r={0.6} />
              <circle cx={19.4} cy={28} r={0.8} />
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}

// Patte de loutre vue de dessous (coussinets visibles), doigts vers le haut.
// Le point de clic est le centre du coussin de la paume, pivot de toutes les animations.
const PAW =
  'M8 25 C6.6 16 12.6 7.4 22 7.4 C31.4 7.4 37.4 16 36 25 ' +
  'C35.2 31.6 32.6 37.6 28.4 40.4 C25 42.6 19 42.6 15.6 40.4 C11.4 37.6 8.8 31.6 8 25 Z'
// mailles du tricot (petits « v ») sur la moufle
const KNIT = 'M11 30 l1.2 1.4 l1.2 -1.4 M31 30 l1.2 1.4 l1.2 -1.4 M15.5 37 l1.2 1.4 l1.2 -1.4 M26 37 l1.2 1.4 l1.2 -1.4 M20.8 39.5 l1.2 1.4 l1.2 -1.4'
