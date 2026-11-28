import { useEffect, useState } from 'react'
import { startGameLoops, useGame } from './game/store'
import { BoilFilters } from './components/Boil'
import { SceneView } from './components/SceneView'
import { HandCursor } from './components/HandCursor'
import { Counter, Gains, Hint, Logo, Mood, SoundToggle, Toast } from './components/Hud'
import { Achievements, Notebook, Shop, Stats, Story, Tabs, type TabId } from './components/Panels'
import { Quiz } from './components/Quiz'
import { Blackjack } from './components/Blackjack'
import { BlessingChooser, Ending, TidePanel } from './components/Tide'
import { DebugMenu } from './components/DebugMenu'
import { SaveMenu } from './components/SaveMenu'

export default function App() {
  const [tab, setTab] = useState<TabId>('boutique')
  useEffect(() => startGameLoops(), [])

  // confirmation intégrée (pas de confirm() natif : bloqué dans certains cadres)
  const [confirming, setConfirming] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="game">
      <BoilFilters />
      <SceneView />
      <Hint />
      <Logo />
      <Counter />
      <Mood />
      <Tabs active={tab} onChange={setTab} />
      {tab === 'succes' ? <Achievements /> : tab === 'histoire' ? <Story /> : tab === 'maree' ? <TidePanel /> : tab === 'stats' ? <Stats /> : tab === 'carnet' ? <Notebook /> : <Shop />}
      {/* sur mobile, ces liens se rangent dans un menu « ⋯ » en haut à droite */}
      <button className="menu-btn" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-label="Menu">
        {menuOpen ? '×' : '⋯'}
      </button>
      <div className={'extras' + (menuOpen ? ' extras--open' : '')}>
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
      </div>
      <Quiz />
      <Blackjack />
      <Toast />
      <Gains />
      <BlessingChooser />
      <Ending />
      <DebugMenu />
      <HandCursor />
    </div>
  )
}
