import { useEffect, useRef } from 'react'
import { OTTER_HOVER_ATTR } from '../scene/otterScene'
import { useGame } from '../game/store'

// Bout de l'index dans le viewBox du dessin : c'est le point de clic (1 unité = 1 px).
const TIP_X = 13
const TIP_Y = 2

/**
 * Curseur « main » dessinée à l'encre, dans le style des icônes du jeu (trait 2,2 px,
 * aplat blanc, filtre « boil »). Souris uniquement : sur écran tactile rien ne change.
 * La main est déplacée directement dans pointermove (pas de retard) et toutes ses
 * animations tournent autour du bout de l'index, qui reste donc sous le point de clic.
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
      <svg viewBox="0 0 40 46" width={40} height={46}>
        <g className="hand-cursor__hand">
          {/* ombre dure décalée, comme les cartes de l'interface */}
          <path d={HAND} transform="translate(2.5 2.5)" fill="#1b1a18" opacity={0.14} />
          <g style={{ filter: 'var(--boil)' }} stroke="#1b1a18" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d={CUFF} fill="#f4f2ee" />
            <path d={HAND} fill={mitten ? '#e4e0d8' : '#fff'} />
            {mitten && <path d={KNIT} fill="none" strokeWidth={1.1} />}
            {/* plis des doigts repliés, ongle, liseré de manchette */}
            <path d="M17 15.5 C17.2 17.3 17.6 18.3 18.3 19 M23 16.5 C23.2 18 23.5 19 24 19.6 M28.4 18 C28.5 19.4 28.8 20.3 29.2 21 M11.3 6.2 q1.7 -1.6 3.4 0 M14 38.6 L27.5 38.6" fill="none" strokeWidth={1.4} />
          </g>
        </g>
      </svg>
    </div>
  )
}

// Main droite vue de dos, index levé ; le bout de l'index est en (13, 2).
const HAND =
  'M9 22 L9 6 C9 3.4 10.8 2 13 2 C15.2 2 17 3.4 17 6 L17 15.5 ' +
  'C17.4 13.6 19.2 12.8 21 13.2 C22.4 13.5 23 14.8 23 16.5 ' +
  'C23.4 14.9 25 14.4 26.5 14.9 C27.9 15.4 28.4 16.6 28.4 18 ' +
  'C28.9 16.9 30.4 16.7 31.5 17.4 C32.9 18.3 33.1 20.1 32.6 22.4 ' +
  'C32 27.2 30.9 31 28.2 34.2 L13.2 34.2 ' +
  'C10.4 31.4 6.6 27.6 4.8 24.4 C3.8 22.3 4.6 20.1 6.6 20 C7.8 19.9 8.6 20.7 9 22 Z'
const CUFF = 'M12.4 34 L28.9 34 L29.3 42.4 L12 42.4 Z'
// mailles du tricot (petits « v ») sur le dos de la moufle
const KNIT = 'M19 22 l1.2 1.4 l1.2 -1.4 M23.5 22.5 l1.2 1.4 l1.2 -1.4 M16 26.5 l1.2 1.4 l1.2 -1.4 M21 27 l1.2 1.4 l1.2 -1.4 M26 26.5 l1.2 1.4 l1.2 -1.4'
