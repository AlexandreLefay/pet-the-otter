import { useGame, cost, count, isSeen, maxed, blocked, bonuses, tooEarly } from '../game/store'
import { ACHIEVEMENTS, STORY, UPGRADES, type Category } from '../game/data'
import { fmt } from '../game/format'
import { TIDE_THRESHOLD } from '../game/prestige'

export type TabId = 'boutique' | 'succes' | 'histoire' | 'maree'

const SECTIONS: { id: Category; name: string }[] = [
  { id: 'caresses', name: 'Caresses' },
  { id: 'accessoires', name: 'Accessoires' },
  { id: 'decors', name: 'Décors' },
  { id: 'famille', name: 'Famille' },
]

export const TABS: { id: TabId; name: string }[] = [
  { id: 'boutique', name: 'Boutique' },
  { id: 'succes', name: 'Succès' },
  { id: 'histoire', name: 'Histoire' },
  { id: 'maree', name: 'Marée' },
]

export function Tabs({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const unlocked = useGame(s => s.unlocked.length)
  // l'onglet Marée n'apparaît qu'une fois la première perle à portée
  const tideOpen = useGame(s => s.marees > 0 || s.perles > 0 || s.totalGalets >= TIDE_THRESHOLD)
  return (
    <nav className="tabs">
      {TABS.filter(t => t.id !== 'maree' || tideOpen).map(t => (
        <button key={t.id} className={'tab' + (t.id === active ? ' tab--active' : '')} onClick={() => onChange(t.id)}>
          <span className="tab__dot" />
          <span>{t.id === 'succes' ? `Succès ${unlocked}/${ACHIEVEMENTS.length}` : t.name}</span>
        </button>
      ))}
    </nav>
  )
}

/** Toute la boutique sur un seul écran, rangée par sections. */
export function Shop() {
  return (
    <div className="panel panel--shop">
      {SECTIONS.map(sec => (
        <section key={sec.id} className="shop__section">
          <h3 className="shop__title">{sec.name}</h3>
          <div className="shop__grid">
            <ShopItems category={sec.id} />
          </div>
        </section>
      ))}
    </div>
  )
}

function ShopItems({ category }: { category: Category }) {
  const galets = useGame(s => s.galets)
  const owned = useGame(s => s.owned)
  const buy = useGame(s => s.buy)
  const costMult = useGame(s => bonuses(s).cost)
  const marees = useGame(s => s.marees)
  // on montre ce qui est déjà découvert, plus une seule carte mystère par section
  const all = UPGRADES.filter(u => u.category === category)
  const firstHidden = all.find(u => !isSeen(u, { galets, owned }))
  // les achats réservés aux marées futures apparaissent, verrouillés, pour donner envie
  const items = all.filter(u => u === firstHidden || isSeen(u, { galets, owned }) || tooEarly(u, marees))
  return (
    <>
      {items.map(u => {
        const c = cost(u, owned, costMult)
        const seen = isSeen(u, { galets, owned })
        const full = maxed(u, owned)
        const locked = blocked(u, owned)
        const early = tooEarly(u, marees)
        const can = seen && !full && !locked && !early && galets >= c
        const n = count(owned, u.id)
        return (
          <button key={u.id} className={'card' + (seen && !early ? '' : ' card--hidden')} disabled={!can} onClick={() => buy(u.id)}>
            <div className="card__name">{seen || early ? u.name : '? ? ?'}</div>
            <div className="card__count">{n || ''}</div>
            <div className="card__desc">{seen && !early ? u.desc : '…'}</div>
            <div className="card__cost">
              {early
                ? `après ${u.minMarees} grande${(u.minMarees ?? 0) > 1 ? 's' : ''} marée${(u.minMarees ?? 0) > 1 ? 's' : ''}`
                : full ? 'adopté' : locked ? 'il faut d’abord le bébé' : `${fmt(c)} galets`}
            </div>
          </button>
        )
      })}
    </>
  )
}

export function Achievements() {
  const unlocked = useGame(s => s.unlocked)
  return (
    <div className="panel">
      {ACHIEVEMENTS.map(a => {
        const ok = unlocked.includes(a.id)
        return (
          <div key={a.id} className={'badge' + (ok ? '' : ' badge--locked')}>
            <div className="badge__ring">{a.name[0]}</div>
            <div>
              <div className="badge__name">{a.name}</div>
              <div className="badge__desc">{a.desc}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function Story() {
  const chapters = useGame(s => s.chapters)
  return (
    <div className="panel">
      {STORY.map((c, i) => {
        const ok = chapters.includes(c.id)
        return (
          <div key={c.id} className={'chapter' + (ok ? '' : ' chapter--locked')}>
            <div className="chapter__title">
              {i + 1}. {ok ? c.title : '? ? ?'}
            </div>
            <div className="chapter__text">{ok ? c.text : '…'}</div>
          </div>
        )
      })}
    </div>
  )
}
