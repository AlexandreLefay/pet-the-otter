import { useEffect, useState } from 'react'
import { exportSave, importSave, lastSaveTime } from '../game/store'

/** « sauvegarde » : rappelle que la partie est enregistrée dans ce navigateur, et permet de l'emporter ailleurs. */
export function SaveMenu() {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [, tick] = useState(0)

  // rafraîchit « enregistrée il y a … »
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => tick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [open])

  const ago = lastSaveTime() ? Math.max(0, Math.round((Date.now() - lastSaveTime()) / 1000)) : null

  const copy = async () => {
    const c = exportSave()
    setCode(c)
    try {
      await navigator.clipboard.writeText(c)
      setMsg('Code copié. Colle-le sur l’autre appareil.')
    } catch {
      setMsg('Copie impossible : sélectionne le code ci-dessous.')
    }
  }
  const load = () => {
    if (!code.trim()) return setMsg('Colle d’abord un code.')
    setMsg(importSave(code) ? 'Partie chargée.' : 'Ce code ne ressemble pas à une sauvegarde.')
  }

  if (!open) return <button className="save-link" onClick={() => setOpen(true)}>sauvegarde</button>

  return (
    <div className="save-menu" role="dialog" aria-label="Sauvegarde">
      <div className="debug__head">
        <b>Sauvegarde</b>
        <button className="link-inline" onClick={() => { setOpen(false); setMsg('') }}>fermer</button>
      </div>
      <p className="save-menu__text">
        Ta partie est enregistrée automatiquement dans ce navigateur, sur cet appareil
        {ago !== null ? ` (il y a ${ago} s)` : ''}. Chaque personne a la sienne.
      </p>
      <p className="save-menu__text">Pour continuer ailleurs : copie ton code ici, et colle-le sur l’autre appareil.</p>
      <textarea
        className="save-menu__code"
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="LOUTRE-…"
        rows={3}
        spellCheck={false}
      />
      <div className="debug__row">
        <button className="debug__btn" onClick={copy}>copier mon code</button>
        <button className="debug__btn" onClick={load}>charger ce code</button>
      </div>
      {msg && <div className="save-menu__msg">{msg}</div>}
    </div>
  )
}
