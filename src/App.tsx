import { useEffect, useState } from 'react'
import { startGameLoops, useGame } from './game/store'
import { BoilFilters } from './components/Boil'
import { SceneView } from './components/SceneView'
import { HandCursor } from './components/HandCursor'
import { Counter, Gains, Hint, Logo, Mood, Toast } from './components/Hud'
import { Achievements, Shop, Tabs, type TabId } from './components/Panels'

export default function App() {
  const [tab, setTab] = useState<TabId>('caresses')
  useEffect(() => startGameLoops(), [])

  // confirmation intégrée (pas de confirm() natif : bloqué dans certains cadres)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="game">
      <BoilFilters />
      <SceneView />
      <Hint />
      <Logo />
      <Counter />
      <Mood />
      <Tabs active={tab} onChange={setTab} />
      {tab === 'succes' ? <Achievements /> : <Shop category={tab} />}
      {confirming ? (
        <div className="link-row">
          <span>tout recommencer ?</span>
          <button className="link-inline" onClick={() => { useGame.getState().reset(); setConfirming(false) }}>oui</button>
          <button className="link-inline" onClick={() => setConfirming(false)}>non</button>
        </div>
      ) : (
        <button className="link" onClick={() => setConfirming(true)}>recommencer</button>
      )}
      <Toast />
      <Gains />
      <HandCursor />
    </div>
  )
}
