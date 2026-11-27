import { create } from 'zustand'
import { ACHIEVEMENTS, COST_GROWTH, IDLE_LINES, MOODS, UPGRADES, type Upgrade } from './data'
import { fmt } from './format'
import { sound } from './sound'

const SAVE_KEY = 'loutre-save-v2'

export interface Toast {
  id: number
  text: string
}

export interface Gain {
  id: number
  x: number
  y: number
  text: string
  rot: number
}

interface SavedState {
  galets: number
  totalGalets: number
  caresses: number
  owned: Record<string, number>
  unlocked: string[]
}

interface GameState extends SavedState {
  humeur: number
  toast: Toast | null
  gains: Gain[]
  /** compteur incrémenté à chaque caresse — la scène s'en sert pour réagir */
  petTick: number

  pet: (x: number, y: number) => void
  buy: (id: string) => void
  tick: (dt: number) => void
  notify: (text: string) => void
  reset: () => void
}

// ——— dérivés (fonctions pures, utilisables partout)
export const count = (owned: Record<string, number>, id: string) => owned[id] || 0
export const perClick = (owned: Record<string, number>) =>
  1 + UPGRADES.reduce((t, u) => t + (u.click || 0) * count(owned, u.id), 0)
export const perSecond = (owned: Record<string, number>) =>
  UPGRADES.reduce((t, u) => t + (u.auto || 0) * count(owned, u.id), 0)
export const multiplier = (humeur: number) => (humeur >= 80 ? 2 : 1)
export const moodLabel = (humeur: number) => MOODS.find(m => humeur >= m.min)!.label
export const cost = (u: Upgrade, owned: Record<string, number>) =>
  Math.ceil(u.base * Math.pow(COST_GROWTH, count(owned, u.id)))

/** Visible si : déjà possédée, ≥ 40 % du prix, ou la précédente de sa catégorie est possédée. */
export function isSeen(u: Upgrade, s: Pick<SavedState, 'galets' | 'owned'>) {
  const list = UPGRADES.filter(x => x.category === u.category)
  const i = list.indexOf(u)
  return i === 0 || count(s.owned, u.id) > 0 || s.galets >= cost(u, s.owned) * 0.4 || count(s.owned, list[i - 1].id) > 0
}

// ——— sauvegarde
function load(): SavedState {
  const empty: SavedState = { galets: 0, totalGalets: 0, caresses: 0, owned: {}, unlocked: [] }
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return empty
    return { ...empty, ...JSON.parse(raw) }
  } catch {
    return empty
  }
}
function save(s: SavedState) {
  try {
    const { galets, totalGalets, caresses, owned, unlocked } = s
    localStorage.setItem(SAVE_KEY, JSON.stringify({ galets, totalGalets, caresses, owned, unlocked }))
  } catch {
    /* stockage indisponible : tant pis */
  }
}

let uid = 0
let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useGame = create<GameState>((set, get) => ({
  ...load(),
  humeur: 0,
  toast: null,
  gains: [],
  petTick: 0,

  pet: (x, y) => {
    const s = get()
    const gain = perClick(s.owned) * multiplier(s.humeur)
    const g: Gain = { id: ++uid, x, y, text: '+' + fmt(gain), rot: Math.random() * 16 - 8 }
    set({
      galets: s.galets + gain,
      totalGalets: s.totalGalets + gain,
      caresses: s.caresses + 1,
      humeur: Math.min(100, s.humeur + 5),
      gains: [...s.gains.slice(-20), g],
      petTick: s.petTick + 1,
    })
    setTimeout(() => set(st => ({ gains: st.gains.filter(q => q.id !== g.id) })), 900)
    sound.plop(s.humeur)
    checkAchievements()
  },

  buy: id => {
    const s = get()
    const u = UPGRADES.find(x => x.id === id)
    if (!u) return
    const c = cost(u, s.owned)
    if (s.galets < c) return
    const first = count(s.owned, id) === 0
    set({ galets: s.galets - c, owned: { ...s.owned, [id]: count(s.owned, id) + 1 } })
    sound.buy(count(s.owned, id) + 1)
    if (first && u.firstBuy) get().notify(u.firstBuy)
    checkAchievements()
  },

  tick: dt => {
    const s = get()
    const inc = perSecond(s.owned) * dt
    set({ galets: s.galets + inc, totalGalets: s.totalGalets + inc, humeur: Math.max(0, s.humeur - 7 * dt) })
  },

  notify: text => {
    clearTimeout(toastTimer)
    set({ toast: { id: ++uid, text } })
    toastTimer = setTimeout(() => set({ toast: null }), 4200)
  },

  reset: () => {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* rien */
    }
    set({ galets: 0, totalGalets: 0, caresses: 0, owned: {}, unlocked: [], humeur: 0, gains: [], toast: null })
  },
}))

function checkAchievements() {
  const s = useGame.getState()
  const fresh = ACHIEVEMENTS.filter(a => !s.unlocked.includes(a.id) && a.test(s))
  if (!fresh.length) return
  useGame.setState({ unlocked: [...s.unlocked, ...fresh.map(a => a.id)] })
  const a = fresh[fresh.length - 1]
  sound.success()
  s.notify(a.toast ?? `Succès : ${a.name}.`)
}

// ——— boucles globales : revenu passif (100 ms), succès, sauvegarde (2 s), phrases absurdes
let started = false
export function startGameLoops() {
  if (started) return () => {}
  started = true
  let last = performance.now()
  const tick = setInterval(() => {
    const now = performance.now()
    useGame.getState().tick(Math.min(1, (now - last) / 1000))
    last = now
  }, 100)
  const slow = setInterval(() => {
    checkAchievements()
    save(useGame.getState())
  }, 2000)
  const idle = setInterval(() => {
    const s = useGame.getState()
    if (!s.toast && s.caresses > 0 && Math.random() < 0.35) s.notify(IDLE_LINES[(Math.random() * IDLE_LINES.length) | 0])
  }, 20000)
  const onHide = () => save(useGame.getState())
  window.addEventListener('beforeunload', onHide)
  return () => {
    started = false
    clearInterval(tick)
    clearInterval(slow)
    clearInterval(idle)
    window.removeEventListener('beforeunload', onHide)
  }
}
