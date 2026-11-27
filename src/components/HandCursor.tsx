import { useEffect } from 'react'
import { createHandCursor } from '../scene/handCursor'

/** Remplace le curseur de la souris par la main 3D, sur tout le site. */
export function HandCursor() {
  useEffect(() => createHandCursor().dispose, [])
  return null
}
