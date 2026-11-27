// Sons du jeu, synthétisés avec la Web Audio API (aucun fichier à charger).
// Le contexte audio n'est créé qu'au premier geste de l'utilisateur (règle des navigateurs).

const MUTE_KEY = 'loutre-muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
})()
const listeners = new Set<(m: boolean) => void>()

function audio() {
  if (muted) return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Une note : oscillateur + enveloppe percussive, avec glissement de hauteur optionnel. */
function note(type: OscillatorType, from: number, to: number, start: number, dur: number, vol: number) {
  const c = audio()
  if (!c || !master) return
  const t = c.currentTime + start
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(from, t)
  if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.02)
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

export const sound = {
  /** Caresse : un « ploc » d'eau, plus aigu quand la loutre est de bonne humeur. */
  plop(humeur = 0) {
    const f = rand(330, 430) * (1 + humeur / 400)
    note('sine', f, f * 2.4, 0, 0.13, 0.32)
    if (Math.random() < 0.3) note('sine', f * 1.5, f * 3, 0.05, 0.08, 0.1)
  },

  /** Achat : un galet qui tinte sur un autre, de plus en plus aigu avec la quantité. */
  buy(n = 1) {
    const k = Math.pow(2, Math.min(n - 1, 12) / 24)
    note('sine', 160 * k, 90 * k, 0, 0.09, 0.3) // le « toc » sourd
    note('triangle', 1320 * k, 1320 * k, 0.012, 0.16, 0.13)
    note('triangle', 1980 * k, 1980 * k, 0.07, 0.22, 0.1)
  },

  /** Refus (pas assez de galets). */
  nope() {
    note('triangle', 180, 140, 0, 0.12, 0.12)
  },

  /** Succès débloqué : petit arpège montant. */
  success() {
    ;[523, 659, 784, 1047].forEach((f, i) => note('triangle', f, f, i * 0.085, 0.3, 0.12))
  },

  /** Nouveau chapitre de l'histoire : accord doux, comme une page qu'on tourne. */
  chapter() {
    ;[392, 494, 587, 784].forEach((f, i) => note('sine', f, f, i * 0.03, 1.1, 0.07))
  },

  get muted() {
    return muted
  },
  setMuted(m: boolean) {
    muted = m
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0')
    } catch {
      /* stockage indisponible */
    }
    if (m && ctx) void ctx.suspend()
    listeners.forEach(f => f(m))
  },
  subscribe(f: (m: boolean) => void) {
    listeners.add(f)
    return () => { listeners.delete(f) }
  },
}
