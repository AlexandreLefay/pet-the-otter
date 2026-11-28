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
export function GaletIcon({ size = 40, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <svg viewBox="0 0 40 26" width={size} height={(size * 26) / 40} style={{ overflow: 'visible' }} aria-hidden>
      <g style={{ filter: 'var(--boil)' }} stroke="#1b1a18" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 18 C2 10 12 4 22 5 C33 6 39 12 37 18 C35 23 25 24 16 23 C9 23 5 22 4 18 Z" fill={mono ? '#fff' : 'var(--galet)'} />
        <path d="M24 20 l5 -4 M28 21 l5 -4" fill="none" strokeWidth={1.4} />
      </g>
    </svg>
  )
}

/**
 * Emblème du jeu : la loutre mignonne (tête ronde, grands yeux, truffe) qui sort de l'eau
 * en tenant son galet bleu. Même dessin que public/logo.svg (couleurs en dur là-bas).
 */
export function LogoMark({ size = 52 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 62" width={size} height={(size * 62) / 64} style={{ overflow: 'visible' }} aria-hidden className="logo__mark">
      <g style={{ filter: 'var(--boil)' }} stroke="#1b1a18" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">

    {/* oreilles */}
    <circle cx="17.5" cy="15.5" r="4.6" fill="#8f8a83"/>
    <circle cx="46.5" cy="15.5" r="4.6" fill="#8f8a83"/>
    {/* épaules, dans l'eau */}
    <path d="M12 56 C11 46 19 40 32 40 C45 40 53 46 52 56 Z" fill="#99948c"/>
    {/* tête ronde */}
    <circle cx="32" cy="27" r="17" fill="#fdfaf3"/>
    {/* duvet du front */}
    <path d="M27 11.5 q1.5 2 3 0 M32.5 10.8 q1.5 2 3 0" fill="none" strokeWidth="1.3"/>
    {/* yeux */}
    <circle cx="24.5" cy="25" r="3.3" fill="#1b1a18" stroke="none"/>
    <circle cx="39.5" cy="25" r="3.3" fill="#1b1a18" stroke="none"/>
    <circle cx="25.6" cy="23.8" r="1.1" fill="#fff" stroke="none"/>
    <circle cx="40.6" cy="23.8" r="1.1" fill="#fff" stroke="none"/>
    {/* coussinets de moustaches */}
    <circle cx="28.3" cy="35" r="4.6" fill="#fff" strokeWidth="1.6"/>
    <circle cx="35.7" cy="35" r="4.6" fill="#fff" strokeWidth="1.6"/>
    <g fill="#1b1a18" stroke="none">
      <circle cx="26" cy="34.2" r="0.6"/><circle cx="27.6" cy="36.6" r="0.6"/><circle cx="25.3" cy="36.9" r="0.6"/>
      <circle cx="38" cy="34.2" r="0.6"/><circle cx="36.4" cy="36.6" r="0.6"/><circle cx="38.7" cy="36.9" r="0.6"/>
    </g>
    {/* truffe */}
    <path d="M27.6 30.2 C27.6 28 36.4 28 36.4 30.2 C36.4 32.6 33.6 33.8 32 33.8 C30.4 33.8 27.6 32.6 27.6 30.2 Z" fill="#1b1a18" strokeWidth="1.2"/>
    <ellipse cx="30.4" cy="29.8" rx="1.3" ry="0.7" fill="#fff" stroke="none"/>
    {/* bouche */}
    <path d="M29.6 40 q1.2 1.3 2.4 0 q1.2 1.3 2.4 0" fill="none" strokeWidth="1.3"/>
    {/* moustaches */}
    <path d="M22 34 l-8 -1.5 M22 36.5 l-8 1 M42 34 l8 -1.5 M42 36.5 l8 1" fill="none" strokeWidth="1"/>
    {/* pattes qui tiennent le galet bleu */}
    <ellipse cx="32" cy="48.5" rx="6.6" ry="3.9" fill="var(--galet, #4a8fd4)"/>
    <ellipse cx="24.5" cy="48" rx="3.4" ry="2.8" fill="#75716a"/>
    <ellipse cx="39.5" cy="48" rx="3.4" ry="2.8" fill="#75716a"/>
    {/* l'eau, devant */}
    <path d="M3 55 C9 51.5 14 53.5 19 52 C24 50.5 28 53.5 32 52.5 C37 51.2 41 53.6 46 52 C51 50.5 56 53 61 55 L61 64 L3 64 Z" fill="#dfdbd4" stroke="none"/>
    <path d="M3 55 C9 51.5 14 53.5 19 52 C24 50.5 28 53.5 32 52.5 C37 51.2 41 53.6 46 52 C51 50.5 56 53 61 55" fill="none"/>
    <path d="M10 57 l6 0 M42 57.5 l7 0" fill="none" stroke="#fff" strokeWidth="1.6"/>
      </g>
    </svg>
  )
}
