import { useState } from 'react'
import { useGame } from '../game/store'
import { BLESSINGS, SKILLS, SKILL_BRANCHES, TIDE_THRESHOLD, pearlGain } from '../game/prestige'
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
  const gain = pearlGain(total, blessings)

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
          et tu choisis une bénédiction parmi trois.
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
