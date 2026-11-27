# Pet the otter (« Loutre. ») — contexte du projet

Jeu web incrémental (clicker) : on caresse une loutre qui flotte sur le dos dans une flaque ;
chaque caresse rapporte des **galets** (monnaie) qu'on dépense en améliorations. Ton absurde.
Desktop d'abord, mobile ensuite. Textes du jeu en français.

## Stack
Vite + React + TypeScript · three.js (scène 3D) · Zustand (état) · sauvegarde localStorage (`loutre-save-v2`).
`npm run dev` · `npm run build` · `npm run build:single` (un seul HTML autonome dans dist/).

## Où est quoi
- `src/game/data.ts` — contenu : améliorations (4 catégories), succès, phrases absurdes, paliers d'humeur
- `src/game/store.ts` — état + boucle : caresse, achat, revenu passif (tick 100 ms), humeur (−7/s, ≥80 → ×2), succès, notifications, sauvegarde 2 s
- `src/scene/otterScene.ts` — scène three.js : caméra ortho isométrique, toon shading, contour encre qui « tremble », flaque masquée au stencil, loutre qui dérive, ondes ; clic ou glisser (1 caresse / 140 ms) → `onPet(x, y)`
- `src/components/HandCursor.tsx` — curseur main dessinée à l'encre (SVG + boil, souris seulement) ; point de clic = bout de l'index (13, 2) ; caresse au survol de la loutre (attribut `data-otter-hover` posé par la scène)
- `src/components/` — Hud (logo, compteur, humeur, toast, gains flottants), Panels (onglets, boutique, succès), Boil (filtres SVG du trait vivant, icône galet)
- `src/index.css` — design tokens + styles, layout mobile sous 820 px

## Direction artistique (à respecter)
Encre sur papier, noir et blanc. Papier `#FAF9F6`, fond scène `#FBFAF8`, encre `#1B1A18`, graphite `#6B6863`.
Accent unique : bleu galet `oklch(0.64 0.15 250)` (texte : `oklch(0.50 0.15 250)`, variables `--galet` / `--galet-text`) — réservé à la monnaie,
aux gains et à l'ombre du bouton principal, **jamais dans la scène 3D**.
Typo : Space Mono (titres, chiffres) + IBM Plex Mono (texte). Bordures 2 px, angles droits, ombres dures `3px 3px 0`.
Le filtre « boil » ne s'applique pas au texte. Maquette de référence : artifact Claude « Loutre Design System ».

## État actuel
Fait : scène 3D complète, boucle de jeu, 5 onglets (Caresses, Accessoires, Décors, Famille, Succès),
12 améliorations, 10 succès, notifications absurdes, confirmation « recommencer » intégrée, mobile de base,
curseur main dessinée, logo (`public/logo.svg`, composant `LogoMark` dans Boil.tsx, aussi utilisé en favicon).

## Prochaines étapes envisagées
1. Afficher les accessoires sur la loutre, les décors dans la scène, les nouvelles loutres (famille) dans la flaque
2. Équilibrage des coûts / gains
3. Peaufiner le mobile

## Workflow
Commits au format Conventional Commits (`feat:`, `fix:`, `style:`…), titre court à l'impératif, corps qui explique quoi et pourquoi.
Les sessions Cowork ne peuvent pas `git push` : Claude modifie et commit, Alexandre pousse depuis son terminal.
