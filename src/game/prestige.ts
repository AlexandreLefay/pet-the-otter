// La grande marée : le prestige du jeu.
// On recommence de zéro en échange de perles. À chaque marée, on choisit une bénédiction
// parmi trois (elles se cumulent) ; les perles se dépensent dans un petit arbre de compétences.

/** Galets à gagner pendant une partie pour obtenir la première perle. */
export const TIDE_THRESHOLD = 100_000

export interface Blessing {
  id: string
  name: string
  desc: string
  /** une seule fois (ex. : le bébé revient) */
  unique?: boolean
}

export const BLESSINGS: Blessing[] = [
  { id: 'doigts', name: 'Doigts de fée', desc: 'caresses ×1,5' },
  { id: 'sieste', name: 'Longue sieste', desc: 'revenu passif ×1,5' },
  { id: 'soldes', name: 'Marée basse', desc: 'améliorations 10 % moins chères' },
  { id: 'humeur', name: 'Bon caractère', desc: 'l’humeur retombe deux fois moins vite' },
  { id: 'joie', name: 'Pleine joie', desc: 'bonus d’humeur ×2,5 au lieu de ×2' },
  { id: 'tresor', name: 'Trésor enfoui', desc: 'chaque marée commence avec 1 000 galets' },
  { id: 'echo', name: 'Écho', desc: 'chaque caresse rapporte aussi 2 % du revenu par seconde' },
  { id: 'nacre', name: 'Nacre', desc: '+1 perle à chaque marée' },
  { id: 'retour', name: 'Le bébé revient', desc: 'chaque marée commence avec le bébé', unique: true },
]

export interface Skill {
  id: string
  branch: 'caresses' | 'sieste' | 'famille'
  name: string
  desc: string
  cost: number
  requires?: string
}

export const SKILL_BRANCHES: { id: Skill['branch']; name: string }[] = [
  { id: 'caresses', name: 'Caresses' },
  { id: 'sieste', name: 'Sieste' },
  { id: 'famille', name: 'Famille' },
]

export const SKILLS: Skill[] = [
  { id: 'paume', branch: 'caresses', name: 'Paume tendre', desc: 'caresses +25 %', cost: 1 },
  { id: 'rythme', branch: 'caresses', name: 'Le rythme', desc: 'caresses +50 %', cost: 3, requires: 'paume' },
  { id: 'or', branch: 'caresses', name: 'Main d’or', desc: 'caresses ×2', cost: 8, requires: 'rythme' },
  { id: 'reverie', branch: 'sieste', name: 'Rêverie', desc: 'revenu passif +25 %', cost: 1 },
  { id: 'ronron', branch: 'sieste', name: 'Ronron', desc: 'revenu passif +50 %', cost: 3, requires: 'reverie' },
  { id: 'sommeil', branch: 'sieste', name: 'Grand sommeil', desc: 'revenu passif ×2', cost: 8, requires: 'ronron' },
  { id: 'troc', branch: 'famille', name: 'Le troc', desc: 'améliorations 5 % moins chères', cost: 2 },
  { id: 'heritage', branch: 'famille', name: 'Héritage', desc: 'chaque marée commence avec un rocher et deux plumes', cost: 4, requires: 'troc' },
  { id: 'clan', branch: 'famille', name: 'Le clan', desc: '+10 % de production par autre loutre', cost: 10, requires: 'heritage' },
]

export interface PrestigeState {
  perles: number
  marees: number
  blessings: string[]
  skills: string[]
  owned: Record<string, number>
}

const n = (list: string[], id: string) => list.filter(x => x === id).length
const has = (list: string[], id: string) => list.includes(id)

/** Tous les bonus de prestige, prêts à multiplier. */
export function bonuses(s: PrestigeState) {
  const b = s.blessings, k = s.skills
  const others = (s.owned.amie || 0) + (s.owned.cousin || 0) + (s.owned.grandmere || 0)
  return {
    click: Math.pow(1.5, n(b, 'doigts')) * (has(k, 'paume') ? 1.25 : 1) * (has(k, 'rythme') ? 1.5 : 1) * (has(k, 'or') ? 2 : 1),
    auto: Math.pow(1.5, n(b, 'sieste')) * (has(k, 'reverie') ? 1.25 : 1) * (has(k, 'ronron') ? 1.5 : 1) * (has(k, 'sommeil') ? 2 : 1),
    /** +1 % par perle gardée, +10 % par autre loutre avec « Le clan » */
    global: (1 + 0.01 * s.perles) * (has(k, 'clan') ? 1 + 0.1 * others : 1),
    cost: Math.pow(0.9, n(b, 'soldes')) * (has(k, 'troc') ? 0.95 : 1),
    decay: Math.pow(0.5, n(b, 'humeur')),
    mood: 2 + 0.5 * n(b, 'joie'),
    echo: 0.02 * n(b, 'echo'),
  }
}
export type Bonuses = ReturnType<typeof bonuses>

/** Perles gagnées si la marée arrive maintenant. */
export function pearlGain(totalGalets: number, blessings: string[]) {
  const base = Math.floor(Math.sqrt(totalGalets / TIDE_THRESHOLD))
  return base > 0 ? base + n(blessings, 'nacre') : 0
}

/** Ce qu'on possède au début d'une nouvelle marée. */
export function startingState(blessings: string[], skills: string[]) {
  const owned: Record<string, number> = {}
  if (has(blessings, 'retour')) owned.bebe = 1
  if (has(skills, 'heritage')) { owned.rocher = 1; owned.plume = 2 }
  return { galets: 1000 * n(blessings, 'tresor'), owned }
}

/** Trois bénédictions au hasard (sans reproposer une bénédiction unique déjà obtenue). */
export function drawBlessings(owned: string[]) {
  const pool = BLESSINGS.filter(x => !(x.unique && owned.includes(x.id))).map(x => x.id)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}
