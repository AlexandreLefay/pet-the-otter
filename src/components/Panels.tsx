import { useGame, cost, count, isSeen, maxed } from '../game/store'
import { ACHIEVEMENTS, STORY, UPGRADES, type Category } from '../game/data'
import { fmt } from '../game/format'

export type TabId = Category | 'succes' | 'histoire'

export const TABS: { id: TabId; name: string }[] = [
  { id: 'caresses', name: 'Caresses' },
  { id: 'accessoires', name: 'Accessoires' },
  { id: 'decors', name: 'Décors' },
  { id: 'famille', name: 'Famille' },
  { id: 'succes', name: 'Succès' },
  { id: 'histoire', name: 'Histoire' },
]

export function Tabs({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const unlocked = useGame(s => s.unlocked.length)
  return (
    <nav className="tabs">
      {TABS.map(t => (
        <button key={t.id} className={'tab' + (t.id === active ? ' tab--active' : '')} onClick={() => onChange(t.id)}>
          <span className="tab__dot" />
          <span>{t.id === 'succes' ? `Succès ${unlocked}/${ACHIEVEMENTS.length}` : t.name}</span>
        </button>
      ))}
    </nav>
  )
}

export function Shop({ category }: { category: Category }) {
  const galets = useGame(s => s.galets)
  const owned = useGame(s => s.owned)
  const buy = useGame(s => s.buy)
  const items = UPGRADES.filter(u => u.category === category)
  return (
    <div className="panel">
      {items.map(u => {
        const c = cost(u, owned)
        const seen = isSeen(u, { galets, owned })
        const full = maxed(u, owned)
        const can = seen && !full && galets >= c
        const n = count(owned, u.id)
        return (
          <button key={u.id} className={'card' + (seen ? '' : ' card--hidden')} disabled={!can} onClick={() => buy(u.id)}>
            <div className="card__name">{seen ? u.name : '? ? ?'}</div>
            <div className="card__count">{n || ''}</div>
            <div className="card__desc">{seen ? u.desc : '…'}</div>
            <div className="card__cost">{full ? 'adopté' : `${fmt(c)} galets`}</div>
          </button>
        )
      })}
    </div>
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
