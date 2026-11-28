# Pet the otter — contexte du projet

Jeu web incrémental (clicker) : on caresse une loutre qui flotte sur le dos dans une flaque ;
chaque caresse rapporte des **galets** (monnaie) qu'on dépense en améliorations. Ton absurde.
Desktop d'abord, mobile ensuite. Textes du jeu en français.

## Stack
Vite + React + TypeScript · three.js (scène 3D) · Zustand (état) · sauvegarde localStorage par navigateur
(clé `loutre-save-v2`, format versionné `v: 3`, relue par `sanitize()` ; toutes les 2 s, après chaque achat, et quand
l'onglet est caché ou fermé ; export / import par code `LOUTRE-…` dans le menu « sauvegarde »).
`npm run dev` · `npm run build` · `npm run build:single` (un seul HTML autonome dans dist/).

## Où est quoi
- `src/game/data.ts` — contenu : améliorations (4 catégories, `max` pour les achats uniques), succès, histoire (`STORY`, chapitres débloqués dans l'ordre), phrases absurdes, paliers d'humeur
- `src/game/prestige.ts` — grande marée (prestige) : perles (`pearlGain`, racine cubique des galets ÷ 100 k), bénédictions au choix parmi trois (cumulables), arbre des perles (4 branches × 5 étages), `bonuses()`, contenance de la flaque (`capacity` = 10 M × 4^marées) et objectif `GOAL` = 1 milliard (écran de fin). Équilibrage simulé : ~3 marées / ~3 h pour finir, impossible sans marée
- `src/game/facts.ts` — le carnet : 33 vrais faits sur les loutres (texte + affirmation vrai/faux) ; débloqués au premier achat lié (`item`), au fil du jeu (« Le saviez-vous ? ») et par le quiz vrai/faux (bonne réponse ≈ 45 s de revenu). Vérifier l'exactitude avant d'en ajouter
- `src/game/sound.ts` — sons synthétisés (Web Audio) : caresse, achat, succès, chapitre ; bouton muet (`loutre-muted`)
- `src/game/store.ts` — état + boucle : caresse, achat, revenu passif (tick 100 ms), humeur (−7/s, ≥80 → ×2), succès, notifications, sauvegarde 2 s
- `src/scene/otterScene.ts` — loutre de mer (`makeOtter`, réutilisé pour les amies et le cousin), bébé sur le ventre, achats visibles (`makeProp` / `syncProps`, appelés via `sync(owned)` depuis SceneView) ; scène three.js : caméra ortho isométrique, toon shading, contour encre qui « tremble », flaque masquée au stencil, loutre qui dérive, ondes ; clic ou glisser (1 caresse / 140 ms) → `onPet(x, y)`
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
Fait : scène 3D complète, boucle de jeu, 4 onglets (Boutique, Succès, Histoire, Marée — visible dès la première perle possible),
32 améliorations (`max` pour les uniques, `requires` pour le deuxième bébé, `minMarees` pour celles réservées aux marées), 14 succès, 25 chapitres d'histoire, prestige, écran de chargement (index.html + src/boot.ts), notifications absurdes, sons,
confirmation « recommencer » intégrée, mobile de base, curseur main dessinée (moufle avec le gant),
logo (`public/logo.svg`, composant `LogoMark` dans Boil.tsx, aussi utilisé en favicon).
Chaque achat est visible dans la scène : nœud papillon et lunettes sur la loutre, plume qui la chatouille,
galets qu'elle jongle, rochers, nénuphars, vapeur du bain, rivière, amies en petits groupes libres (24 affichées au plus) dont la première se
tiennent la patte, cousin à chapeau. Toutes les loutres se caressent. La mare grandit et la caméra recule avec
la famille (`growthFor` / `applyGrowth`, variable G). Boutique sur un seul écran, dans la colonne de droite (`--side`).
Déployé sur GitHub Pages à chaque push sur `main` : https://alexandrelefay.github.io/pet-the-otter/

## Prochaines étapes envisagées
1. Équilibrage des coûts / gains
2. Peaufiner le mobile
3. Pour tester : menu debug (touche ², Ctrl+Maj+D, ou `?debug` dans l'adresse, aussi en ligne) — galets, perles, marées, un de chaque achat, écran de fin… ; en dev, `window.__loutre` donne aussi accès au store

## Workflow
Commits au format Conventional Commits (`feat:`, `fix:`, `style:`…), titre court à l'impératif, corps qui explique quoi et pourquoi.
Claude peut pousser `main` directement après chaque changement (accord d'Alexandre du 28/11) ; un push redéploie GitHub Pages.
