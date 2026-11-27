# Loutre.

Jeu incrémental : on caresse une loutre qui flotte dans une flaque.

Stack : Vite + React + TypeScript · three.js (scène) · Zustand (état) · sauvegarde localStorage.

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # build classique dans dist/
npm run build:single   # un seul fichier HTML autonome dans dist/
```

## En ligne

https://alexandrelefay.github.io/pet-the-otter/ — redéployé automatiquement à chaque push sur `main`
(workflow `.github/workflows/deploy.yml`).

## Où est quoi

- `src/game/data.ts` — contenu : améliorations, succès, phrases absurdes (c'est ici qu'on équilibre)
- `src/game/store.ts` — état + boucle de jeu (caresse, achat, revenu passif, humeur, succès, sauvegarde)
- `src/scene/otterScene.ts` — scène three.js (loutre, flaque, ondes, clic / glisser)
- `src/components/` — interface (compteur, humeur, onglets, boutique, succès, notification, gains)
- `src/index.css` — design tokens + styles
