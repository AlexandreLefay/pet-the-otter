// Contenu du jeu : améliorations, succès, textes. Tout ce qui est « réglable » vit ici.

export type Category = 'caresses' | 'accessoires' | 'decors' | 'famille'

export interface Upgrade {
  id: string
  category: Category
  name: string
  desc: string
  base: number
  /** + galets par caresse */
  click?: number
  /** + galets par seconde */
  auto?: number
  /** texte affiché au premier achat */
  firstBuy?: string
  /** quantité maximale (ex. : un seul bébé) */
  max?: number
  /** amélioration à posséder avant de pouvoir acheter celle-ci */
  requires?: string
}

export const COST_GROWTH = 1.15

export const UPGRADES: Upgrade[] = [
  // — Caresses (clic + auto, la boucle de base)
  { id: 'patte', category: 'caresses', name: 'Patte douce', desc: '+1 galet par caresse', base: 15, click: 1 },
  { id: 'plume', category: 'caresses', name: "Plume d'oie", desc: 'la chatouille toute seule · +0,5 /s', base: 40, auto: 0.5 },
  { id: 'galet', category: 'caresses', name: 'Galet plat', desc: 'elle jongle avec · +3 /s', base: 220, auto: 3, firstBuy: 'Un galet a été promu chef de service.' },
  { id: 'gant', category: 'caresses', name: 'Gant en laine', desc: '+8 galets par caresse', base: 900, click: 8 },
  { id: 'bain', category: 'caresses', name: 'Bain tiède', desc: 'elle se détend · +15 /s', base: 2600, auto: 15 },
  { id: 'brosse', category: 'caresses', name: 'Brosse douce', desc: 'à poils de blaireau, il est d’accord · +25 /caresse', base: 6000, click: 25 },
  { id: 'riviere', category: 'caresses', name: 'La rivière', desc: 'tout le monde vient · +400 /s', base: 90000, auto: 400 },
  { id: 'massage', category: 'caresses', name: 'Massage du dos', desc: 'elle grogne de plaisir · +200 /caresse', base: 150000, click: 200 },
  { id: 'berceuse', category: 'caresses', name: 'La berceuse', desc: 'des notes flottent au-dessus du bébé · +1 200 /s', base: 400000, auto: 1200, firstBuy: 'Tout le monde chante la berceuse. Faux, mais avec conviction.' },

  // — Accessoires (portés par la loutre, visibles dans la scène)
  { id: 'noeud', category: 'accessoires', name: 'Nœud papillon', desc: 'elle se sent importante · +2 /caresse', base: 500, click: 2, firstBuy: 'La loutre porte un nœud papillon. Elle exige qu’on la vouvoie.' },
  { id: 'lunettes', category: 'accessoires', name: 'Lunettes de soleil', desc: 'il n’y a pas de soleil · +20 /s', base: 5000, auto: 20 },
  { id: 'echarpe', category: 'accessoires', name: 'Écharpe tricotée', desc: 'elle n’a pas froid, mais quand même · +60 /s', base: 18000, auto: 60 },
  { id: 'couronne', category: 'accessoires', name: 'Couronne d’algues', desc: 'elle se sent reine · +40 /caresse', base: 45000, click: 40, firstBuy: 'La loutre porte une couronne. Elle a nommé le rocher ministre.' },
  { id: 'collier', category: 'accessoires', name: 'Collier de coquillages', desc: 'ça fait clic-clic quand elle bouge · +300 /s', base: 250000, auto: 300 },

  // — Décors (posés dans la scène)
  { id: 'rocher', category: 'decors', name: 'Un rocher', desc: 'il ne fait rien · +1 /s', base: 120, auto: 1, firstBuy: 'Le rocher a été embauché. Il ne fait rien, mais il le fait bien.' },
  { id: 'nenuphar', category: 'decors', name: 'Nénuphar', desc: 'pour la déco · +10 /s', base: 3200, auto: 10 },
  { id: 'bateau', category: 'decors', name: 'Bateau en papier', desc: 'il ne va nulle part · +35 /s', base: 9000, auto: 35 },
  { id: 'parasol', category: 'decors', name: 'Un parasol', desc: 'pour l’ombre qu’il n’y a pas · +120 /s', base: 30000, auto: 120 },
  { id: 'phare', category: 'decors', name: 'Un phare', desc: 'il éclaire la flaque toute la nuit · +2 000 /s', base: 1200000, auto: 2000, max: 1, firstBuy: 'On a construit un phare. Les bateaux en papier sont soulagés.' },

  // — Famille (le bébé, puis d'autres loutres)
  { id: 'bebe', category: 'famille', name: 'Le bébé', desc: 'il dort sur son ventre · +4 /s', base: 300, auto: 4, max: 1, firstBuy: 'Un bébé est apparu sur son ventre. Elle fait comme si c’était prévu.' },
  { id: 'amie', category: 'famille', name: 'Une autre loutre', desc: 'elles se caressent entre elles · +80 /s', base: 14000, auto: 80, firstBuy: 'Une deuxième loutre est arrivée. Elle a apporté son propre galet.' },
  { id: 'cousin', category: 'famille', name: 'Le cousin', desc: 'personne ne l’a invité · +250 /s', base: 60000, auto: 250, max: 1 },
  { id: 'jumeau', category: 'famille', name: 'Un deuxième bébé', desc: 'il dort à côté du premier · +150 /s', base: 80000, auto: 150, max: 1, requires: 'bebe', firstBuy: 'Un deuxième bébé ! La mère a deux pattes, c’est pile ce qu’il faut.' },
  { id: 'grandmere', category: 'famille', name: 'La grand-mère', desc: 'elle raconte des histoires · +900 /s', base: 300000, auto: 900, max: 1 },
]

export interface GameSnapshot {
  galets: number
  totalGalets: number
  caresses: number
  owned: Record<string, number>
  humeur: number
}

export interface Achievement {
  id: string
  name: string
  desc: string
  test: (s: GameSnapshot) => boolean
  toast?: string
}

const owns = (s: GameSnapshot, id: string) => (s.owned[id] || 0) > 0
const ownedTotal = (s: GameSnapshot) => Object.values(s.owned).reduce((a, b) => a + b, 0)

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'premier', name: 'Premier contact', desc: 'une caresse', test: s => s.caresses >= 1, toast: 'Premier contact. Elle n’a pas mordu.' },
  { id: 'moite', name: 'Main moite', desc: '100 caresses', test: s => s.caresses >= 100, toast: '100 caresses. Votre main est moite. La loutre aussi.' },
  { id: 'avocat', name: 'Conseil juridique', desc: '1 000 caresses', test: s => s.caresses >= 1000, toast: '1 000 caresses. La loutre a contacté un avocat.' },
  { id: 'rocher', name: 'Ami du rocher', desc: 'embaucher le rocher', test: s => owns(s, 'rocher') },
  { id: 'anges', name: 'Aux anges', desc: 'humeur au maximum', test: s => s.humeur >= 100 },
  { id: 'riche', name: 'Petit pécule', desc: '1 000 galets gagnés', test: s => s.totalGalets >= 1000 },
  { id: 'tres-riche', name: 'Banque centrale', desc: '100 000 galets gagnés', test: s => s.totalGalets >= 100000, toast: 'La Banque centrale des galets vous a envoyé une carte de vœux.' },
  { id: 'collection', name: 'Collectionneur', desc: '25 objets achetés', test: s => ownedTotal(s) >= 25 },
  { id: 'castors', name: 'Les castors sont au courant', desc: 'une autre loutre', test: s => owns(s, 'amie'), toast: 'Les castors sont au courant. Ils ne disent rien.' },
  { id: 'riviere', name: 'Tout le monde vient', desc: 'acheter la rivière', test: s => owns(s, 'riviere') },
]

/** Phrases qui tombent au hasard, de temps en temps. */
export const IDLE_LINES = [
  'La loutre a cligné des yeux. C’est sans doute un signe.',
  'Un galet a été promu chef de service.',
  'Une réunion a eu lieu dans la flaque. Rien n’a été décidé.',
  'La loutre pense à quelque chose. Elle ne dira pas quoi.',
  'Le galet sur son ventre est son préféré. Ne le dites pas aux autres.',
  'Il paraît que l’eau est mouillée. À vérifier.',
]

export const MOODS = [
  { min: 80, label: 'aux anges' },
  { min: 50, label: 'contente' },
  { min: 20, label: 'curieuse' },
  { min: 0, label: 'méfiante' },
]

/** L'histoire, en chapitres débloqués par la progression. */
export interface Chapter {
  id: string
  title: string
  text: string
  test: (s: GameSnapshot) => boolean
}

export const STORY: Chapter[] = [
  { id: 'flaque', title: 'La flaque', test: s => s.caresses >= 1,
    text: 'Il était une fois une loutre qui flottait sur le dos, dans une flaque. Elle n’avait rien demandé à personne.' },
  { id: 'galets', title: 'Les galets', test: s => s.totalGalets >= 60,
    text: 'Chaque caresse fait apparaître un galet. Personne ne sait pourquoi. La loutre a décidé de ne pas poser de questions.' },
  { id: 'vide', title: 'Quelque chose manque', test: s => s.totalGalets >= 180,
    text: 'Elle regarde souvent son ventre, comme s’il y manquait quelque chose. Le galet fait de son mieux.' },
  { id: 'bebe', title: 'Le bébé', test: s => owns(s, 'bebe'),
    text: 'Un matin, il y avait un bébé sur son ventre. Il dort. Elle le tient fort, pour qu’il ne dérive pas.' },
  { id: 'mot', title: 'Le premier mot', test: s => owns(s, 'bebe') && s.caresses >= 300,
    text: 'Le bébé a dit son premier mot : « galet ». Sa mère est très fière, et un peu inquiète.' },
  { id: 'ministre', title: 'Le rocher', test: s => s.totalGalets >= 3000,
    text: 'Le rocher a eu une promotion. Il ne sait pas pourquoi, mais il a dit merci. Enfin, on suppose.' },
  { id: 'bande', title: 'La bande', test: s => owns(s, 'amie'),
    text: 'D’autres loutres sont arrivées. Elles se tiennent la patte pour ne pas partir à la dérive. Le rocher, lui, reste où il est.' },
  { id: 'bateau', title: 'Le bateau', test: s => s.totalGalets >= 25000,
    text: 'Un bateau en papier est passé. Le bébé a voulu monter dedans. Après un vote, il a été décidé que non.' },
  { id: 'cousin', title: 'Le cousin', test: s => owns(s, 'cousin'),
    text: 'Le cousin est arrivé sans prévenir, avec un chapeau. Personne ne sait d’où vient le chapeau.' },
  { id: 'jumeau', title: 'Le jumeau', test: s => owns(s, 'jumeau'),
    text: 'Un deuxième bébé est arrivé. Il ressemble au premier, en plus petit. Ou en plus grand. Personne n’arrive à se décider.' },
  { id: 'riviere', title: 'La rivière', test: s => owns(s, 'riviere'),
    text: 'La flaque est devenue une rivière. Le bébé ne s’en est pas rendu compte : il dormait.' },
  { id: 'grandmere', title: 'La grand-mère', test: s => owns(s, 'grandmere'),
    text: 'La grand-mère est venue. Elle raconte la Grande Marée d’autrefois, quand la flaque avait tout emporté. Personne ne la croit.' },
  { id: 'berceuse', title: 'La berceuse', test: s => s.totalGalets >= 2e6,
    text: 'Le soir, toutes les loutres chantent la berceuse. Elles chantent faux. Les bébés dorment quand même.' },
  { id: 'phare', title: 'Le phare', test: s => owns(s, 'phare'),
    text: 'Un phare éclaire maintenant la flaque toute la nuit. Les loutres dorment avec un masque.' },
  { id: 'rumeur', title: 'La rumeur', test: s => s.totalGalets >= 5e6,
    text: 'La grand-mère avait raison : l’eau monte. Une grande marée se prépare. Elle emportera tout, sauf ce qu’on a appris.' },
]
