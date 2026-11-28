// La grande marée : le prestige du jeu.
// On recommence de zéro en échange de perles. À chaque marée, on choisit une bénédiction
// parmi trois (elles se cumulent) ; les perles se dépensent dans l'arbre des perles.
//
// Objectif final : réunir 1 milliard de galets. Mais la flaque a une contenance limitée
// (FLAQUE_BASE × 4^marées) : sans grande marée, le milliard est hors de portée ; en jouant
// normalement il faut trois marées (environ trois heures), deux avec un arbre bien choisi.

/** Galets à gagner pendant une partie pour obtenir la première perle. */
export const TIDE_THRESHOLD = 100_000
/** L'objectif du jeu. */
export const GOAL = 1_000_000_000
/** Contenance de la flaque avant toute marée. */
export const FLAQUE_BASE = 10_000_000

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
  { id: 'digue', name: 'La digue', desc: 'la flaque contient 50 % de galets en plus' },
  { id: 'retour', name: 'Le bébé revient', desc: 'chaque marée commence avec le bébé', unique: true },
]

export type Branch = 'caresses' | 'sieste' | 'famille' | 'maree'

export interface Skill {
  id: string
  branch: Branch
  name: string
  desc: string
  cost: number
  requires?: string
}

export const SKILL_BRANCHES: { id: Branch; name: string }[] = [
  { id: 'caresses', name: 'Caresses' },
  { id: 'sieste', name: 'Sieste' },
  { id: 'famille', name: 'Famille' },
  { id: 'maree', name: 'Marée' },
]

export const SKILLS: Skill[] = [
  { id: 'paume', branch: 'caresses', name: 'Paume tendre', desc: 'caresses +25 %', cost: 1 },
  { id: 'rythme', branch: 'caresses', name: 'Le rythme', desc: 'caresses +50 %', cost: 3, requires: 'paume' },
  { id: 'or', branch: 'caresses', name: 'Main d’or', desc: 'caresses ×2', cost: 8, requires: 'rythme' },
  { id: 'tempete', branch: 'caresses', name: 'Tempête de câlins', desc: 'caresses ×3', cost: 20, requires: 'or' },
  { id: 'eclat', branch: 'caresses', name: 'L’éclat', desc: '1 caresse sur 10 rapporte ×10', cost: 40, requires: 'tempete' },

  { id: 'reverie', branch: 'sieste', name: 'Rêverie', desc: 'revenu passif +25 %', cost: 1 },
  { id: 'ronron', branch: 'sieste', name: 'Ronron', desc: 'revenu passif +50 %', cost: 3, requires: 'reverie' },
  { id: 'sommeil', branch: 'sieste', name: 'Grand sommeil', desc: 'revenu passif ×2', cost: 8, requires: 'ronron' },
  { id: 'hiberner', branch: 'sieste', name: 'Hiberner', desc: 'revenu passif ×3', cost: 20, requires: 'sommeil' },
  { id: 'reves', branch: 'sieste', name: 'Beaux rêves', desc: 'passif +3 % par succès obtenu', cost: 40, requires: 'hiberner' },

  { id: 'troc', branch: 'famille', name: 'Le troc', desc: 'améliorations 5 % moins chères', cost: 2 },
  { id: 'heritage', branch: 'famille', name: 'Héritage', desc: 'chaque marée commence avec un rocher et deux plumes', cost: 4, requires: 'troc' },
  { id: 'clan', branch: 'famille', name: 'Le clan', desc: '+10 % de production par autre loutre', cost: 10, requires: 'heritage' },
  { id: 'dynastie', branch: 'famille', name: 'Dynastie', desc: 'chaque marée commence avec le bébé, le cousin et deux amies', cost: 20, requires: 'clan' },
  { id: 'banquet', branch: 'famille', name: 'Le banquet', desc: 'améliorations 20 % moins chères', cost: 40, requires: 'dynastie' },

  { id: 'bassin', branch: 'maree', name: 'Bassin creusé', desc: 'flaque ×2', cost: 2 },
  { id: 'courant', branch: 'maree', name: 'Le courant', desc: '+25 % de perles à chaque marée', cost: 5, requires: 'bassin' },
  { id: 'hautes', branch: 'maree', name: 'Hautes eaux', desc: 'chaque perle gardée donne +2 % au lieu de +1 %', cost: 12, requires: 'courant' },
  { id: 'ocean', branch: 'maree', name: 'L’océan', desc: 'flaque ×5', cost: 30, requires: 'hautes' },
  { id: 'lune', branch: 'maree', name: 'La lune', desc: 'perles ×2 à chaque marée', cost: 60, requires: 'ocean' },
]

export interface PrestigeState {
  perles: number
  marees: number
  blessings: string[]
  skills: string[]
  owned: Record<string, number>
  /** succès obtenus (pour « Beaux rêves ») */
  unlocked?: string[]
}

const n = (list: string[], id: string) => list.filter(x => x === id).length
const has = (list: string[], id: string) => list.includes(id)

/** Tous les bonus de prestige, prêts à multiplier. */
export function bonuses(s: PrestigeState) {
  const b = s.blessings, k = s.skills
  const others = (s.owned.amie || 0) + (s.owned.cousin || 0) + (s.owned.grandmere || 0) + (s.owned.voisins || 0) + (s.owned.colonie || 0)
  return {
    click: Math.pow(1.5, n(b, 'doigts')) * (has(k, 'paume') ? 1.25 : 1) * (has(k, 'rythme') ? 1.5 : 1) * (has(k, 'or') ? 2 : 1) * (has(k, 'tempete') ? 3 : 1),
    auto: Math.pow(1.5, n(b, 'sieste')) * (has(k, 'reverie') ? 1.25 : 1) * (has(k, 'ronron') ? 1.5 : 1) * (has(k, 'sommeil') ? 2 : 1) * (has(k, 'hiberner') ? 3 : 1)
      * (has(k, 'reves') ? 1 + 0.03 * (s.unlocked?.length ?? 0) : 1),
    /** +1 % (ou +2 %) par perle gardée, +10 % par autre loutre avec « Le clan » */
    global: (1 + (has(k, 'hautes') ? 0.02 : 0.01) * s.perles) * (has(k, 'clan') ? 1 + 0.1 * others : 1),
    cost: Math.pow(0.9, n(b, 'soldes')) * (has(k, 'troc') ? 0.95 : 1) * (has(k, 'banquet') ? 0.8 : 1),
    decay: Math.pow(0.5, n(b, 'humeur')),
    mood: 2 + 0.5 * n(b, 'joie'),
    echo: 0.02 * n(b, 'echo'),
    /** probabilité qu'une caresse rapporte ×10 */
    crit: has(k, 'eclat') ? 0.1 : 0,
  }
}
export type Bonuses = ReturnType<typeof bonuses>

/** Contenance de la flaque : au-delà, les galets débordent et sont perdus. */
export function capacity(s: Pick<PrestigeState, 'marees' | 'blessings' | 'skills'>) {
  return FLAQUE_BASE * Math.pow(4, s.marees) * Math.pow(1.5, n(s.blessings, 'digue'))
    * (has(s.skills, 'bassin') ? 2 : 1) * (has(s.skills, 'ocean') ? 5 : 1)
}

/** Perles gagnées si la marée arrive maintenant : racine cubique des galets gagnés (÷ 100 000). */
export function pearlGain(totalGalets: number, blessings: string[], skills: string[] = []) {
  const base = Math.floor(Math.cbrt(totalGalets / TIDE_THRESHOLD))
  if (base < 1) return 0
  const mult = (has(skills, 'courant') ? 1.25 : 1) * (has(skills, 'lune') ? 2 : 1)
  return Math.floor(base * mult) + n(blessings, 'nacre')
}

/** Ce qu'on possède au début d'une nouvelle marée. */
export function startingState(blessings: string[], skills: string[]) {
  const owned: Record<string, number> = {}
  if (has(blessings, 'retour')) owned.bebe = 1
  if (has(skills, 'heritage')) { owned.rocher = 1; owned.plume = 2 }
  if (has(skills, 'dynastie')) { owned.bebe = 1; owned.cousin = 1; owned.amie = 2 }
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
