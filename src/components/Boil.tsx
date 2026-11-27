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

/** Icône de monnaie : le galet bleu. */
export function GaletIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 26" width={size} height={(size * 26) / 40} style={{ overflow: 'visible' }} aria-hidden>
      <g style={{ filter: 'var(--boil)' }} stroke="#1b1a18" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 18 C2 10 12 4 22 5 C33 6 39 12 37 18 C35 23 25 24 16 23 C9 23 5 22 4 18 Z" fill="var(--galet)" />
        <path d="M24 20 l5 -4 M28 21 l5 -4" fill="none" strokeWidth={1.4} />
      </g>
    </svg>
  )
}

/**
 * Emblème du jeu : la loutre qui flotte sur le dos dans sa flaque, un galet sur le ventre.
 * Même dessin que public/logo.svg (couleurs en dur là-bas, tokens ici).
 */
export function LogoMark({ size = 52 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={{ overflow: 'visible' }} aria-hidden className="logo__mark">
      <g style={{ filter: 'var(--boil)' }} stroke="#1b1a18" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <LogoMarkPaths />
      </g>
    </svg>
  )
}

function LogoMarkPaths() {
  return (
    <>
      {/* flaque */}
      <path d="M5 44 C3 36 14 31 30 31 C46 31 61 34 60 43 C59 51 46 55 31 54 C16 54 7 51 5 44 Z" fill="#dfdbd4" />
      <path d="M12 47 l7 0 M44 49 l6 0" fill="none" stroke="#fff" strokeWidth={1.6} />
      {/* queue + corps sur le dos */}
      <path d="M13 38 C8 37 5 39 4 41" fill="none" />
      <path d="M12 39 C12 31 20 27 31 27 C40 27 45 31 45 37 C45 42 38 44 29 44 C19 44 12 43 12 39 Z" fill="#fff" />
      {/* pattes qui tiennent le galet */}
      <path d="M26 28 C25 24 27 22 29 23 M35 28 C36 24 34 22 32 23" fill="none" strokeWidth={2} />
      <path d="M24 23 C23 19 28 16 32 17 C37 18 39 21 37 24 C35 26 27 26 24 23 Z" fill="var(--galet, #4a8fd4)" />
      {/* tête */}
      <circle cx={48} cy={30} r={10} fill="#fff" />
      <circle cx={41.5} cy={22.5} r={2.6} fill="#fff" />
      <circle cx={55} cy={23} r={2.6} fill="#fff" />
      <path d="M43.5 29 q2 -2 4 0 M50 29 q2 -2 4 0" fill="none" strokeWidth={1.8} />
      <ellipse cx={49} cy={33} rx={2} ry={1.3} fill="#1b1a18" strokeWidth={1} />
      <path d="M47 35.5 q2 2 4 0" fill="none" strokeWidth={1.6} />
      <path d="M41 33 l-6 -1 M41 35 l-6 1 M57 33 l5 -1 M57 35 l5 1" fill="none" strokeWidth={1.1} />
    </>
  )
}
