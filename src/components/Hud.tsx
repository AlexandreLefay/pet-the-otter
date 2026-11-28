import { useSyncExternalStore } from 'react'
import { sound } from '../game/sound'
import { useGame, perSecond, multiplier, moodLabel, bonuses, capacity } from '../game/store'
import { GOAL } from '../game/prestige'
import { fmt, fmtRate } from '../game/format'
import { GaletIcon, LogoMark } from './Boil'

export function Logo() {
  return (
    <div className="logo">
      <LogoMark />
      <div className="logo__text">
        <div className="logo__title">PET THE OTTER.</div>
        <div className="logo__sub">plateau n°1 · la flaque</div>
      </div>
    </div>
  )
}

export function Counter() {
  const galets = useGame(s => s.galets)
  const rate = useGame(s => perSecond(s))
  return (
    <div className="counter">
      <div className="counter__row">
        <GaletIcon />
        <div className="counter__value">{fmt(galets)}</div>
      </div>
      <div className="counter__rate">+ {fmtRate(rate)} galets / s</div>
      <Reservoir />
    </div>
  )
}

/** Jauge de la flaque : combien elle contient encore, et l'objectif du milliard. */
function Reservoir() {
  const galets = useGame(s => s.galets)
  const cap = useGame(s => capacity(s))
  const full = galets >= cap * 0.999
  return (
    <div className="reservoir" title="au-delà, les galets débordent ; les grandes marées agrandissent la flaque">
      <div className="reservoir__bar">
        <div className="reservoir__fill" style={{ width: `${Math.min(100, (galets / cap) * 100)}%` }} />
      </div>
      <div className="reservoir__label">
        {full ? 'la flaque est pleine' : `flaque ${fmt(galets)} / ${fmt(cap)}`} · objectif {fmt(GOAL)}
      </div>
    </div>
  )
}

export function Mood() {
  const humeur = useGame(s => s.humeur)
  const moodBonus = useGame(s => bonuses(s).mood)
  return (
    <div className="mood">
      <div className="mood__row">
        <div>humeur</div>
        <div>{moodLabel(humeur)} · ×{multiplier(humeur, moodBonus)}</div>
      </div>
      <div className="gauge">
        <div className="gauge__fill" style={{ width: `${humeur}%` }} />
      </div>
    </div>
  )
}

export function Toast() {
  const toast = useGame(s => s.toast)
  const dismiss = useGame(s => s.dismissToast)
  if (!toast) return null
  return (
    <div className="toast" key={toast.id} onClick={dismiss} role="status" title="toucher pour fermer">
      <div className="toast__dot" />
      <div>{toast.text}</div>
    </div>
  )
}

export function Gains() {
  const gains = useGame(s => s.gains)
  return (
    <>
      {gains.map(g => (
        // affiché bien au-dessus du point de clic, pour ne pas se perdre dans les loutres
        <div key={g.id} className={'gain' + (g.text.endsWith('!') ? ' gain--crit' : '')} style={{ left: g.x, top: g.y - 64, ['--r' as string]: `${g.rot}deg` }}>
          {g.text !== 'plein' && <GaletIcon size={22} />}
          <span>{g.text}</span>
        </div>
      ))}
    </>
  )
}

export function Hint() {
  const caresses = useGame(s => s.caresses)
  return (
    <div className="hint" style={{ opacity: caresses < 3 ? 1 : 0 }}>
      caressez-la — cliquez, ou glissez dessus
    </div>
  )
}

export function SoundToggle() {
  const muted = useSyncExternalStore(sound.subscribe, () => sound.muted)
  return (
    <button className="sound-toggle" onClick={() => sound.setMuted(!muted)} aria-pressed={!muted}>
      son : {muted ? 'coupé' : 'oui'}
    </button>
  )
}
