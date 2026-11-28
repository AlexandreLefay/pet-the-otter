// Fin de l'écran de chargement (défini dans index.html) : quand la scène a dessiné sa
// première image et que les polices sont prêtes, avec une durée minimale pour ne pas clignoter.
const MIN_MS = 1100

let done = false
export function hideBoot() {
  if (done) return
  done = true
  const el = document.getElementById('boot')
  if (!el) return
  const wait = Math.max(0, MIN_MS - performance.now())
  Promise.all([document.fonts?.ready, new Promise(r => setTimeout(r, wait))]).then(() => {
    el.classList.add('boot--done')
    setTimeout(() => el.remove(), 500)
  })
}
