import { useEffect, useRef, useState } from 'react'
import { sound } from '../game/sound'
import { useGame } from '../game/store'
import { BLESSINGS, GOAL, SKILLS, SKILL_BRANCHES, TIDE_THRESHOLD, capacity, pearlGain } from '../game/prestige'
import { fmt } from '../game/format'

/** Une perle : rond blanc cerné d'encre, avec un reflet. */
export function PearlIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden style={{ overflow: 'visible', flex: 'none' }}>
      <g style={{ filter: 'var(--boil)' }} stroke="#1b1a18" strokeWidth={1.8}>
        <circle cx={10} cy={10} r={7.5} fill="#fff" />
        <path d="M6.5 8 q1.2 -2.4 3.6 -2.6" fill="none" strokeWidth={1.3} strokeLinecap="round" />
      </g>
    </svg>
  )
}

const blessingName = (id: string) => BLESSINGS.find(b => b.id === id)?.name ?? id

/** Onglet « Marée » : déclencher la marée, voir ses bénédictions, dépenser ses perles. */
export function TidePanel() {
  const perles = useGame(s => s.perles)
  const marees = useGame(s => s.marees)
  const total = useGame(s => s.totalGalets)
  const blessings = useGame(s => s.blessings)
  const skills = useGame(s => s.skills)
  const tide = useGame(s => s.tide)
  const buySkill = useGame(s => s.buySkill)
  const [confirm, setConfirm] = useState(false)
  const gain = pearlGain(total, blessings, skills)
  const cap = useGame(s => capacity(s))
  // contenance de la flaque après la prochaine marée
  const nextCap = capacity({ marees: marees + 1, blessings, skills })

  // bénédictions regroupées : « Doigts de fée ×2 »
  const counts = blessings.reduce<Record<string, number>>((m, id) => ({ ...m, [id]: (m[id] || 0) + 1 }), {})

  return (
    <div className="panel panel--tide">
      <section className="tide__head">
        <div className="tide__pearls">
          <PearlIcon size={26} />
          <span className="tide__count">{perles}</span>
          <span className="tide__unit">perle{perles > 1 ? 's' : ''}</span>
        </div>
        <div className="tide__sub">
          {marees ? `${marees} marée${marees > 1 ? 's' : ''} passée${marees > 1 ? 's' : ''}` : 'aucune marée pour l’instant'} · chaque perle gardée : +1 % de production
        </div>
      </section>

      <section className="tide__box">
        <h3 className="shop__title">La grande marée</h3>
        <p className="tide__text">
          Tout recommence à zéro : galets, achats, loutres. Tu gardes tes perles, tes succès, l’histoire,
          et tu choisis une bénédiction parmi trois. La flaque, elle, s’agrandit :
          {' '}<b>{fmt(cap)}</b> → <b>{fmt(nextCap)}</b> galets. Il en faudra {fmt(GOAL)} pour finir le jeu.
        </p>
        {gain >= 1 ? (
          confirm ? (
            <div className="tide__confirm">
              <span>vraiment ?</span>
              <button className="tide__btn" onClick={() => { tide(); setConfirm(false) }}>oui, la marée</button>
              <button className="link-inline" onClick={() => setConfirm(false)}>non</button>
            </div>
          ) : (
            <button className="tide__btn" onClick={() => setConfirm(true)}>
              déclencher la marée · +{gain} <PearlIcon size={14} />
            </button>
          )
        ) : (
          <p className="tide__hint">
            Il faut gagner {fmt(TIDE_THRESHOLD)} galets pendant une partie pour obtenir une perle
            ({fmt(total)} / {fmt(TIDE_THRESHOLD)}).
          </p>
        )}
      </section>

      {blessings.length > 0 && (
        <section className="shop__section">
          <h3 className="shop__title">Bénédictions</h3>
          <ul className="tide__list">
            {Object.entries(counts).map(([id, k]) => (
              <li key={id}>
                <b>{blessingName(id)}</b>
                {k > 1 ? ` ×${k}` : ''} — {BLESSINGS.find(b => b.id === id)?.desc}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="shop__section">
        <h3 className="shop__title">Arbre des perles</h3>
        <div className="tree">
          {SKILL_BRANCHES.map(br => (
            <div key={br.id} className="tree__branch">
              <div className="tree__name">{br.name}</div>
              {SKILLS.filter(k => k.branch === br.id).map(k => {
                const ownedSkill = skills.includes(k.id)
                const open = !k.requires || skills.includes(k.requires)
                const can = !ownedSkill && open && perles >= k.cost
                return (
                  <button
                    key={k.id}
                    className={'node' + (ownedSkill ? ' node--owned' : open ? '' : ' node--locked')}
                    disabled={!can}
                    onClick={() => buySkill(k.id)}
                  >
                    <span className="node__name">{k.name}</span>
                    <span className="node__desc">{k.desc}</span>
                    <span className="node__cost">
                      {ownedSkill ? 'acquis' : (
                        <>
                          {k.cost} <PearlIcon size={11} />
                        </>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/** Après la marée : on choisit une bénédiction parmi trois (le jeu attend ce choix). */
export function BlessingChooser() {
  const pending = useGame(s => s.pending)
  const choose = useGame(s => s.chooseBlessing)
  if (!pending) return null
  return (
    <div className="chooser" role="dialog" aria-label="Choisir une bénédiction">
      <div className="chooser__title">La marée est passée.</div>
      <div className="chooser__sub">Choisis une bénédiction. Elle te suivra pour toutes les marées à venir.</div>
      <div className="chooser__cards">
        {pending.map(id => {
          const b = BLESSINGS.find(x => x.id === id)!
          return (
            <button key={id} className="card chooser__card" onClick={() => choose(id)}>
              <PearlIcon size={22} />
              <div className="card__name">{b.name}</div>
              <div className="card__desc">{b.desc}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Le milliard est atteint : l'écran de fin (on peut continuer à jouer). */
export function Ending() {
  const ending = useGame(s => s.ending)
  const marees = useGame(s => s.marees)
  const caresses = useGame(s => s.caresses)
  const unlocked = useGame(s => s.unlocked.length)
  const close = useGame(s => s.closeEnding)
  if (!ending) return null
  return (
    <div className="chooser" role="dialog" aria-label="Fin">
      <Fireworks />
      <div className="chooser__title">Fin.</div>
      <div className="chooser__sub">
        Un milliard de galets. La loutre les a tous comptés, deux fois, puis elle s’est endormie au milieu.
      </div>
      <div className="ending__stats">
        <div><b>{marees}</b>marée{marees > 1 ? 's' : ''}</div>
        <div><b>{fmt(caresses)}</b>caresses</div>
        <div><b>{unlocked}</b>succès</div>
      </div>
      <button className="tide__btn" style={{ marginTop: 18 }} onClick={close}>continuer à flotter</button>
    </div>
  )
}

/**
 * Feu d'artifice à l'encre : des gerbes de traits noirs et de petits galets bleus qui
 * éclatent, retombent et s'effacent, tant que l'écran de fin est ouvert.
 */
function Fireworks() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    type P = { x: number; y: number; px: number; py: number; vx: number; vy: number; life: number; max: number; blue: boolean }
    const parts: P[] = []
    let raf = 0, last = performance.now(), nextBurst = 0, bursts = 0
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = cv.clientWidth * dpr
      cv.height = cv.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)
    const burst = () => {
      const w = cv.clientWidth, h = cv.clientHeight
      const x = w * (0.1 + Math.random() * 0.8), y = h * (0.07 + Math.random() * 0.2)
      const n = reduce ? 14 : 34
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2
        const sp = 110 + Math.random() * 120
        parts.push({ x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.9 + Math.random() * 0.5, blue: Math.random() < 0.3 })
      }
      if (bursts++ < 12) sound.buy(4 + (bursts % 6))
    }
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      if (t > nextBurst) { burst(); nextBurst = t + (reduce ? 1600 : 520 + Math.random() * 500) }
      ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight)
      ctx.lineCap = 'round'
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.life += dt
        if (p.life >= p.max) { parts.splice(i, 1); continue }
        p.px = p.x; p.py = p.y
        p.vy += 90 * dt // ça retombe
        p.vx *= 1 - dt * 0.9; p.vy *= 1 - dt * 0.4
        p.x += p.vx * dt; p.y += p.vy * dt
        const k = 1 - p.life / p.max
        ctx.globalAlpha = Math.min(1, k * 1.6)
        if (p.blue) {
          // un petit galet bleu
          ctx.fillStyle = '#4a8fd4'
          ctx.strokeStyle = '#1b1a18'
          ctx.lineWidth = 1.4
          ctx.beginPath()
          ctx.ellipse(p.x, p.y, 4.2, 2.8, Math.atan2(p.vy, p.vx), 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        } else {
          // un trait d'encre, qui s'allonge avec la vitesse
          ctx.strokeStyle = '#1b1a18'
          ctx.lineWidth = 2.2 * k + 0.6
          ctx.beginPath()
          ctx.moveTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05)
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fit)
    }
  }, [])
  return <canvas ref={ref} className="fireworks" aria-hidden />
}
