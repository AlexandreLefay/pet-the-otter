import { useEffect } from 'react'

/** Filtres SVG du « trait vivant » + rotation de la variable CSS --boil toutes les 140 ms. */
export function BoilFilters() {
  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      i = (i + 1) % 3
      document.documentElement.style.setProperty('--boil', `url(#boil${i})`)
    }, 140)
    return () => clearInterval(id)
  }, [])
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {[1, 7, 13].map((seed, i) => (
          <filter key={seed} id={`boil${i}`} x="-10%" y="-20%" width="120%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={seed} />
            <feDisplacementMap in="SourceGraphic" scale={3.5} />
          </filter>
        ))}
      </defs>
    </svg>
  )
}

/** Icône de monnaie : le galet orange. */
export function GaletIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 26" width={size} height={(size * 26) / 40} style={{ overflow: 'visible' }} aria-hidden>
      <g style={{ filter: 'var(--boil)' }} stroke="#1b1a18" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 18 C2 10 12 4 22 5 C33 6 39 12 37 18 C35 23 25 24 16 23 C9 23 5 22 4 18 Z" fill="oklch(0.66 0.16 45)" />
        <path d="M24 20 l5 -4 M28 21 l5 -4" fill="none" strokeWidth={1.4} />
      </g>
    </svg>
  )
}
