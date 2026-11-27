import { useEffect, useRef } from 'react'
import { createOtterScene } from '../scene/otterScene'
import { useGame } from '../game/store'

export function SceneView() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const s = createOtterScene(el, { onPet: (x, y) => useGame.getState().pet(x, y) })
    // la scène affiche ce qui a été acheté
    s.sync(useGame.getState().owned)
    const unsub = useGame.subscribe((st, prev) => { if (st.owned !== prev.owned) s.sync(st.owned) })
    return () => {
      unsub()
      s.dispose()
    }
  }, [])
  return <div ref={ref} className="scene" />
}
