import { create } from 'zustand'
import { ACHIEVEMENTS, COST_GROWTH, IDLE_LINES, MOODS, STORY, UPGRADES, type Upgrade } from './data'
import { fmt } from './format'
import { sound } from './sound'
import { GOAL, SKILLS, bonuses, capacity, drawBlessings, pearlGain, startingState, type PrestigeState } from './prestige'

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
  /** chapitres de l'histoire déjà débloqués */
  chapters: string[]
  // ——— grande marée (prestige) : tout ceci survit aux marées
  perles: number
  marees: number
  blessings: string[]
  skills: string[]
  /** les trois bénédictions proposées, tant que le joueur n'a pas choisi */
  pending: string[] | null
  /** le milliard a été atteint (l'écran de fin a été montré) */
  finished: boolean
  /** statistiques de toute la partie (survivent aux marées, effacées par « recommencer ») */
  stats: Stats
}

export interface Stats {
  /** galets gagnés depuis le tout début, toutes marées confondues */
  allGalets: number
  /** temps de jeu, onglet ouvert (s) */
  playSec: number
  /** achats effectués */
  buys: number
  /** perles gagnées au total */
  pearlsEarned: number
  /** caresses à ×10 (L'éclat) */
  crits: number
  /** record de galets par seconde */
  bestRate: number
  /** date de la première caresse (ms), 0 avant */
  startedAt: number
  /** date du milliard (ms), 0 avant */
  finishedAt: number
}
export const EMPTY_STATS: Stats = { allGalets: 0, playSec: 0, buys: 0, pearlsEarned: 0, crits: 0, bestRate: 0, startedAt: 0, finishedAt: 0 }

interface GameState extends SavedState {
  humeur: number
  toast: Toast | null
  gains: Gain[]
  /** compteur incrémenté à chaque caresse — la scène s'en sert pour réagir */
  petTick: number

  pet: (x: number, y: number) => void
  buy: (id: string) => void
  tick: (dt: number) => void
  notify: (text: string, ms?: number) => void
  reset: () => void
  /** déclenche la grande marée : on recommence, on gagne des perles, on choisira une bénédiction */
  tide: () => void
  chooseBlessing: (id: string) => void
  buySkill: (id: string) => void
  /** ferme l'écran de fin */
  closeEnding: () => void
  /** l'écran de fin est affiché */
  ending: boolean
}

// ——— dérivés (fonctions pures, utilisables partout)
export const count = (owned: Record<string, number>, id: string) => owned[id] || 0
export { bonuses }
/** Galets par caresse (améliorations × bonus de prestige), sans l'humeur. */
export const perClick = (s: PrestigeState) => {
  const b = bonuses(s)
  return (1 + UPGRADES.reduce((t, u) => t + (u.click || 0) * count(s.owned, u.id), 0)) * b.click * b.global
}
/** Galets par seconde (améliorations × bonus de prestige). */
export const perSecond = (s: PrestigeState) => {
  const b = bonuses(s)
  return UPGRADES.reduce((t, u) => t + (u.auto || 0) * count(s.owned, u.id), 0) * b.auto * b.global
}
export const multiplier = (humeur: number, moodBonus = 2) => (humeur >= 80 ? moodBonus : 1)
export const moodLabel = (humeur: number) => MOODS.find(m => humeur >= m.min)!.label
export const cost = (u: Upgrade, owned: Record<string, number>, mult = 1) =>
  Math.ceil(u.base * Math.pow(COST_GROWTH, count(owned, u.id)) * mult)
export const maxed = (u: Upgrade, owned: Record<string, number>) => u.max !== undefined && count(owned, u.id) >= u.max
/** Il manque l'amélioration requise (ex. : le deuxième bébé demande le premier). */
export const blocked = (u: Upgrade, owned: Record<string, number>) => !!u.requires && count(owned, u.requires) === 0
/** Réservée aux joueurs qui ont déjà vu assez de grandes marées. */
export const tooEarly = (u: Upgrade, marees: number) => (u.minMarees ?? 0) > marees
export { capacity }

/** Visible si : déjà possédée, ≥ 40 % du prix, ou la précédente de sa catégorie est possédée. */
export function isSeen(u: Upgrade, s: Pick<SavedState, 'galets' | 'owned'>) {
  const list = UPGRADES.filter(x => x.category === u.category)
  const i = list.indexOf(u)
  return i === 0 || count(s.owned, u.id) > 0 || s.galets >= cost(u, s.owned) * 0.4 || count(s.owned, list[i - 1].id) > 0
}

// ——— sauvegarde
// Chaque joueur a sa partie dans SON navigateur (localStorage) : rien n'est envoyé ailleurs.
// Elle est écrite toutes les 2 s, après chaque achat ou marée, et quand l'onglet est caché ou fermé.
const SAVE_VERSION = 3
const EMPTY: SavedState = { galets: 0, totalGalets: 0, caresses: 0, owned: {}, unlocked: [], chapters: [], perles: 0, marees: 0, blessings: [], skills: [], pending: null, finished: false, stats: { ...EMPTY_STATS } }
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d)
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Relit une sauvegarde (de n'importe quelle version) en ignorant ce qui est abîmé. */
function sanitize(raw: unknown): SavedState {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const owned: Record<string, number> = {}
  if (o.owned && typeof o.owned === 'object') {
    for (const [k, v] of Object.entries(o.owned as Record<string, unknown>)) if (num(v) > 0) owned[k] = Math.floor(num(v))
  }
  return {
    galets: num(o.galets),
    totalGalets: num(o.totalGalets),
    caresses: Math.floor(num(o.caresses)),
    owned,
    unlocked: strs(o.unlocked),
    chapters: strs(o.chapters),
    perles: Math.floor(num(o.perles)),
    marees: Math.floor(num(o.marees)),
    blessings: strs(o.blessings),
    skills: strs(o.skills),
    pending: Array.isArray(o.pending) ? strs(o.pending) : null,
    finished: o.finished === true,
    stats: (() => {
      const st = (o.stats && typeof o.stats === 'object' ? o.stats : {}) as Record<string, unknown>
      const out = { ...EMPTY_STATS }
      ;(Object.keys(out) as (keyof Stats)[]).forEach(k => { out[k] = num(st[k]) })
      // anciennes parties : au moins les galets de la marée en cours
      out.allGalets = Math.max(out.allGalets, num(o.totalGalets))
      return out
    })(),
  }
}
function snapshot(s: SavedState) {
  const { galets, totalGalets, caresses, owned, unlocked, chapters, perles, marees, blessings, skills, pending, finished, stats } = s
  return { v: SAVE_VERSION, at: Date.now(), galets, totalGalets, caresses, owned, unlocked, chapters, perles, marees, blessings, skills, pending, finished, stats }
}
function load(): SavedState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? sanitize(JSON.parse(raw)) : { ...EMPTY }
  } catch {
    return { ...EMPTY }
  }
}
function save(s: SavedState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot(s)))
    lastSaved = Date.now()
  } catch {
    /* stockage indisponible (navigation privée stricte…) : la partie reste en mémoire */
  }
}
let lastSaved = 0
/** Heure de la dernière sauvegarde réussie (ms), 0 si aucune. */
export const lastSaveTime = () => lastSaved

/** Code de sauvegarde à copier, pour transférer sa partie sur un autre appareil. */
export function exportSave() {
  const json = JSON.stringify(snapshot(useGame.getState()))
  return 'LOUTRE-' + btoa(String.fromCharCode(...new TextEncoder().encode(json)))
}
/** Charge un code de sauvegarde ; renvoie false s'il est illisible. */
export function importSave(code: string) {
  try {
    const b64 = code.trim().replace(/^LOUTRE-/, '')
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))
    const data = sanitize(JSON.parse(json))
    useGame.setState({ ...data, humeur: 0, gains: [], toast: null, ending: false })
    save(useGame.getState())
    return true
  } catch {
    return false
  }
}

const initial = load()
let uid = 0
let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useGame = create<GameState>((set, get) => ({
  ...initial,
  humeur: 0,
  toast: null,
  gains: [],
  petTick: 0,
  ending: false,

  pet: (x, y) => {
    const s = get()
    const b = bonuses(s)
    const crit = Math.random() < b.crit
    const gain = (perClick(s) * multiplier(s.humeur, b.mood) + perSecond(s) * b.echo) * (crit ? 10 : 1)
    // la flaque a une contenance : ce qui dépasse déborde et se perd
    const kept = Math.max(0, Math.min(gain, capacity(s) - s.galets))
    const g: Gain = { id: ++uid, x, y, text: kept > 0 ? '+' + fmt(gain) + (crit ? ' !' : '') : 'plein', rot: Math.random() * 16 - 8 }
    set({
      galets: s.galets + kept,
      totalGalets: s.totalGalets + kept,
      caresses: s.caresses + 1,
      stats: { ...s.stats, allGalets: s.stats.allGalets + kept, crits: s.stats.crits + (crit ? 1 : 0), startedAt: s.stats.startedAt || Date.now() },
      humeur: Math.min(100, s.humeur + 5),
      gains: [...s.gains.slice(-20), g],
      petTick: s.petTick + 1,
    })
    setTimeout(() => set(st => ({ gains: st.gains.filter(q => q.id !== g.id) })), 900)
    sound.plop(s.humeur)
    if (crit) sound.buy(8)
    checkAchievements()
  },

  buy: id => {
    const s = get()
    const u = UPGRADES.find(x => x.id === id)
    if (!u) return
    const c = cost(u, s.owned, bonuses(s).cost)
    if (s.galets < c || maxed(u, s.owned) || blocked(u, s.owned) || tooEarly(u, s.marees)) return
    const first = count(s.owned, id) === 0
    set({ galets: s.galets - c, owned: { ...s.owned, [id]: count(s.owned, id) + 1 }, stats: { ...s.stats, buys: s.stats.buys + 1 } })
    sound.buy(count(s.owned, id) + 1)
    if (first && u.firstBuy) get().notify(u.firstBuy)
    checkAchievements()
    save(get())
  },

  tick: dt => {
    const s = get()
    const rate = perSecond(s)
    const inc = Math.max(0, Math.min(rate * dt, capacity(s) - s.galets))
    const st = s.stats
    set({
      stats: { ...st, allGalets: st.allGalets + inc, playSec: st.playSec + dt, bestRate: Math.max(st.bestRate, rate) },
      galets: s.galets + inc, totalGalets: s.totalGalets + inc, humeur: Math.max(0, s.humeur - 7 * bonuses(s).decay * dt) })
  },

  notify: (text, ms = 4200) => {
    clearTimeout(toastTimer)
    set({ toast: { id: ++uid, text } })
    toastTimer = setTimeout(() => set({ toast: null }), ms)
  },

  reset: () => {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* rien */
    }
    set({ galets: 0, totalGalets: 0, caresses: 0, owned: {}, unlocked: [], chapters: [], perles: 0, marees: 0, blessings: [], skills: [], pending: null, finished: false, stats: { ...EMPTY_STATS }, ending: false, humeur: 0, gains: [], toast: null })
  },

  tide: () => {
    const s = get()
    const gain = pearlGain(s.totalGalets, s.blessings, s.skills)
    if (gain < 1 || s.pending) return
    // on garde : perles, succès, histoire, bénédictions, compétences ; tout le reste repart de zéro
    const start = startingState(s.blessings, s.skills)
    set({
      perles: s.perles + gain,
      stats: { ...s.stats, pearlsEarned: s.stats.pearlsEarned + gain },
      marees: s.marees + 1,
      galets: start.galets,
      totalGalets: 0,
      owned: start.owned,
      humeur: 0,
      gains: [],
      pending: drawBlessings(s.blessings),
    })
    sound.chapter()
    save(get())
    checkAchievements()
  },

  chooseBlessing: id => {
    const s = get()
    if (!s.pending?.includes(id)) return
    const blessings = [...s.blessings, id]
    // les bénédictions de départ s'appliquent tout de suite à la marée qui commence
    const start = startingState([id], [])
    set({ blessings, pending: null, galets: s.galets + start.galets, owned: { ...start.owned, ...s.owned } })
    sound.success()
    save(get())
  },

  buySkill: id => {
    const s = get()
    const k = SKILLS.find(x => x.id === id)
    if (!k || s.skills.includes(id) || s.perles < k.cost || (k.requires && !s.skills.includes(k.requires))) return
    set({ perles: s.perles - k.cost, skills: [...s.skills, id] })
    sound.buy(s.skills.length + 1)
    save(get())
  },

  closeEnding: () => set({ ending: false }),
}))

function checkAchievements() {
  checkSuccesses()
  checkStory()
  checkGoal()
}

/** Le milliard : la fin du jeu (on peut continuer à flotter ensuite). */
function checkGoal() {
  const s = useGame.getState()
  if (s.finished || s.galets < GOAL) return
  useGame.setState({ finished: true, ending: true, stats: { ...s.stats, finishedAt: Date.now() } })
  sound.chapter()
  save(useGame.getState())
}

/** Un nouveau chapitre reste affiché plus longtemps qu'un succès, avec son propre son. */
function checkStory() {
  const s = useGame.getState()
  // le premier chapitre (dans l'ordre du livre) non lu dont la condition est remplie
  const i = STORY.findIndex(c => !s.chapters.includes(c.id) && c.test(s))
  if (i < 0) return
  const c = STORY[i]
  useGame.setState({ chapters: [...s.chapters, c.id] })
  sound.chapter()
  s.notify(`Chapitre ${i + 1} · ${c.title}. ${c.text}`, 7500)
}

function checkSuccesses() {
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
  // onglet fermé, rechargé, ou mis en arrière-plan (sur mobile, c'est souvent le dernier signal)
  const onHide = () => save(useGame.getState())
  const onVisibility = () => { if (document.visibilityState === 'hidden') onHide() }
  window.addEventListener('beforeunload', onHide)
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    started = false
    clearInterval(tick)
    clearInterval(slow)
    clearInterval(idle)
    window.removeEventListener('beforeunload', onHide)
    window.removeEventListener('pagehide', onHide)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

// Outil de test en développement uniquement : window.__loutre.setState({ galets: 1e6 })
if (import.meta.env.DEV) (window as unknown as { __loutre: typeof useGame }).__loutre = useGame
