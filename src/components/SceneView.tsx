import { useEffect, useRef } from 'react'
import { createOtterScene } from '../scene/otterScene'
import { useGame } from '../game/store'
import { hideBoot } from '../boot'

export function SceneView() {
  const ref = useRef<HTMLDivElement>(null)
  const scene = useRef<ReturnType<typeof createOtterScene> | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const s = createOtterScene(el, { onPet: (x, y) => useGame.getState().pet(x, y), onReady: hideBoot })
    scene.current = s
    // la scène affiche ce qui a été acheté
    s.sync(useGame.getState().owned)
    const unsub = useGame.subscribe((st, prev) => { if (st.owned !== prev.owned) s.sync(st.owned) })
    // Q / E (ou A / E sur clavier AZERTY) : tourner la vue
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') || e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'q' || k === 'a') s.rotate(-1)
      else if (k === 'e') s.rotate(1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unsub()
      s.dispose()
      scene.current = null
    }
  }, [])
  return (
    <>
      <div ref={ref} className="scene" />
      <div className="rotate" aria-label="Tourner le plateau">
        <button className="rotate__btn" onClick={() => scene.current?.rotate(-1)} title="tourner à gauche (Q)">⟲</button>
        <button className="rotate__btn" onClick={() => scene.current?.rotate(1)} title="tourner à droite (E)">⟳</button>
      </div>
    </>
  )
}
