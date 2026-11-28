import { useEffect, useState } from 'react'
import { startGameLoops, useGame } from './game/store'
import { BoilFilters } from './components/Boil'
import { SceneView } from './components/SceneView'
import { HandCursor } from './components/HandCursor'
import { Counter, Gains, Hint, Logo, Mood, SoundToggle, Toast } from './components/Hud'
import { Achievements, Shop, Story, Tabs, type TabId } from './components/Panels'
import { BlessingChooser, Ending, TidePanel } from './components/Tide'
import { DebugMenu } from './components/DebugMenu'
import { SaveMenu } from './components/SaveMenu'

export default function App() {
  const [tab, setTab] = useState<TabId>('boutique')
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
      {tab === 'succes' ? <Achievements /> : tab === 'histoire' ? <Story /> : tab === 'maree' ? <TidePanel /> : <Shop />}
      {confirming ? (
        <div className="link-row">
          <span>tout recommencer ?</span>
          <button className="link-inline" onClick={() => { useGame.getState().reset(); setConfirming(false) }}>oui</button>
          <button className="link-inline" onClick={() => setConfirming(false)}>non</button>
        </div>
      ) : (
        <button className="link" onClick={() => setConfirming(true)}>recommencer</button>
      )}
      <SoundToggle />
      <SaveMenu />
      <Toast />
      <Gains />
      <BlessingChooser />
      <Ending />
      <DebugMenu />
      <HandCursor />
    </div>
  )
}
