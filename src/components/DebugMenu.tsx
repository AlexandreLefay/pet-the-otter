import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { ACHIEVEMENTS, STORY, UPGRADES } from '../game/data'
import { capacity } from '../game/prestige'
import { fmt } from '../game/format'

/**
 * Menu de triche pour tester le jeu.
 * Ouverture : touche ² (ou `), Ctrl+Maj+D, ou l'adresse avec ?debug (ex. …/pet-the-otter/?debug).
 */
export function DebugMenu() {
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).has('debug'))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const combo = e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd'
      if (combo || e.key === '²' || e.key === '`' || e.code === 'Backquote') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const galets = useGame(s => s.galets)
  const cap = useGame(s => capacity(s))
  const perles = useGame(s => s.perles)
  const marees = useGame(s => s.marees)
  if (!open) return null

  const set = useGame.setState
  const get = useGame.getState
  // les galets donnés comptent aussi comme « gagnés » (pour les perles et l'histoire)
  const give = (n: number) => set(s => ({ galets: s.galets + n, totalGalets: s.totalGalets + n }))
  const buyAll = () => {
    const owned = { ...get().owned }
    UPGRADES.forEach(u => { owned[u.id] = Math.max(owned[u.id] || 0, u.max ?? 1) })
    set({ owned })
  }
  const addFamily = () => set(s => ({ owned: { ...s.owned, bebe: 1, amie: (s.owned.amie || 0) + 1 } }))

  return (
    <div className="debug" role="dialog" aria-label="Menu debug">
      <div className="debug__head">
        <b>DEBUG</b>
        <button className="link-inline" onClick={() => setOpen(false)}>fermer</button>
      </div>
      <div className="debug__info">
        {fmt(galets)} / {fmt(cap)} galets · {perles} perles · {marees} marées
      </div>

      <div className="debug__label">galets</div>
      <div className="debug__row">
        {[1e3, 1e5, 1e6, 1e8, 1e9].map(n => (
          <button key={n} className="debug__btn" onClick={() => give(n)}>+{fmt(n)}</button>
        ))}
        <button className="debug__btn" onClick={() => give(Math.max(0, cap - get().galets))}>remplir</button>
        <button className="debug__btn" onClick={() => set({ galets: 0 })}>vider</button>
      </div>

      <div className="debug__label">prestige</div>
      <div className="debug__row">
        <button className="debug__btn" onClick={() => set(s => ({ perles: s.perles + 10 }))}>+10 perles</button>
        <button className="debug__btn" onClick={() => set(s => ({ perles: s.perles + 100 }))}>+100 perles</button>
        <button className="debug__btn" onClick={() => set(s => ({ marees: s.marees + 1 }))}>+1 marée</button>
        <button className="debug__btn" onClick={() => { give(Math.max(0, 1e6 - get().totalGalets)); get().tide() }}>déclencher la marée</button>
      </div>

      <div className="debug__label">contenu</div>
      <div className="debug__row">
        <button className="debug__btn" onClick={buyAll}>un de chaque achat</button>
        <button className="debug__btn" onClick={addFamily}>+1 loutre</button>
        <button className="debug__btn" onClick={() => set({ humeur: 100 })}>humeur max</button>
        <button className="debug__btn" onClick={() => set({ chapters: STORY.map(c => c.id) })}>toute l’histoire</button>
        <button className="debug__btn" onClick={() => set({ unlocked: ACHIEVEMENTS.map(a => a.id) })}>tous les succès</button>
        <button className="debug__btn" onClick={() => set({ ending: true })}>écran de fin</button>
      </div>

      <div className="debug__label">partie</div>
      <div className="debug__row">
        <button className="debug__btn" onClick={() => set({ owned: {} })}>retirer les achats</button>
        <button className="debug__btn debug__btn--danger" onClick={() => get().reset()}>tout effacer</button>
      </div>
      <div className="debug__hint">² ou Ctrl+Maj+D pour fermer</div>
    </div>
  )
}
