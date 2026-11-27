import { useEffect, useRef } from 'react'
import { createOtterScene } from '../scene/otterScene'
import { useGame } from '../game/store'

export function SceneView() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const s = createOtterScene(el, { onPet: (x, y) => useGame.getState().pet(x, y) })
    return () => s.dispose()
  }, [])
  return <div ref={ref} className="scene" />
}
