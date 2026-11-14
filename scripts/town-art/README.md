# Town art: rendering Kenney's 3D packs into sprites

"Thị trấn" (`src/features/town/`) draws pictures rendered from Kenney's free 3D packs (CC0 1.0, kenney.nl). The
3D models are **not** in the repository. Only the rendered WebP atlases and their manifest are committed
(`src/features/town/art/`). The app gains no runtime dependency: `three` is a dev dependency, used only here.

## 1. Get the packs (by hand, once per machine)

Download them from kenney.nl and unzip each one into `art-src/kenney/<folder>/`. `art-src/` is git-ignored.

| Folder | Pack | Used for |
|---|---|---|
| `art-src/kenney/mini-characters/` | Mini Characters 2.0 | the player and the 13 residents |
| `art-src/kenney/city-kit-suburban/` | City Kit (Suburban) | the houses of home, Mia, the café and the shop; poplars |
| `art-src/kenney/city-kit-roads/` | City Kit (Roads) | street lamps, cones and the lamp of the construction site |

Each pack has its own `License.txt` (CC0). `src/features/town/art/LICENSE-kenney.txt` carries the licence text.

## 2. Render

```
npm run art:town                          # everything: the people, then the world -> src/features/town/art/
npm run art:town -- --part characters     # only the people and portraits
npm run art:town -- --part world          # only the world (places, lots, trees, decorations, the cat, the ground)
npm run art:town -- --explore places      # a quick sheet to look at (also: houses, kit, or key prefixes such as decor/lamp)
npm run art:town -- --only player,cafe    # a trial: only these, into art-src/out/trial/, manifest untouched
npm run art:town -- --preview             # every human model, idle, six directions: for choosing the cast
npm run art:town -- --sheet <file.png>    # where to put the contact sheets (default art-src/out/characters-sheet.png)
npm run art:town -- --no-sheet            # skip the contact sheets
```

It needs Edge or Chrome. Set `TOWN_ART_BROWSER` to the executable if it is not in a standard place. A full run
takes about 20 s.

How it works:

- `render.mjs` serves `page/`, `node_modules/three` and `art-src/kenney/` on 127.0.0.1. It opens the page in a
  headless browser with a throwaway profile (`cdp.mjs`, DevTools protocol).
- `page/render.js` loads each GLB with three.js and poses it with the pack's own animation clips. It renders through
  the town's camera: orthographic, true 2:1 dimetric. That means 30° elevation, so a ground tile is 64 × 32 world
  px as in `engine/iso.ts`, and 45° yaw. One three.js unit is one tile edge, tile x maps to +X and tile y to +Z.
  The lighting is a soft warm key, a fill from the viewer (faces stay readable under hats), a cool rim, and a
  hemisphere light. Each frame is rendered 2× bigger and scaled down, gets a thin dark outline, and is trimmed. The
  page keeps the frames in memory.
- `pack.mjs` (shelf packing, `node --test scripts/town-art/pack.test.mjs`) lays the frames out. The page encodes
  each atlas as WebP. `render.mjs` writes the files and the typed manifest `characters.data.ts`.

## 3. What comes out (characters)

- `characters/<id>.webp`: one atlas per person, at 2.5 atlas px per world px (`RES`: the phone's resting zoom on a
  2× screen, so faces are drawn 1:1 there) and WebP quality 0.74. Each person has 106 frames:
  - idle: 6 frames, looping;
  - walk: 8 frames, looping;
  - both in 5 directions (S, SE, E, NE, N). SW, W and NW are SE, E and NE mirrored. The `-mirror` contact sheet
    shows that this matches real renders;
  - the emotes `yes` (a nod), `no` (a head shake) and `wave` (Kenney's `interact-right`, a reach): 6 frames each,
    facing SE and NE, so the four diagonals with mirroring.
- `characters/shadow.webp`: the contact shadow. It is the same for everyone, so it is drawn once under each person
  instead of being baked into every frame. That saves about 0.9 MB.
- `characters/portraits.webp`: a 192 px bust per person (three-quarter front), for 96 px and 56 px use, in two
  moods: `neutral` and `happy` (the middle of the nod; the faces are textures, so the mouth does not change).
- `characters.data.ts`: the generated manifest. The loader is `characters.ts`: `loadCharacterArt`, `getFrame`,
  `drawCharacterSprite`, `dirFromTileVector`, `portraitStyle`… The cast (who is which model, with glasses or a
  palette swap) is `cast.ts`.

Size budget for `src/features/town/art/`: about 6 MB in total, characters about 4.4 MB, the world about 0.9 MB.
The script prints the sizes.

**Trial runs:** `--only` still renders the world after the trial characters unless `--part characters` is given
(`npm run art:town -- --part characters --only player,cafe`). One trial run on 2026-11-14 without it rewrote
`world/` with untrimmed frames; always check `git status` / the world sizes after a run.
`RES`, the frame counts and the WebP quality at the top of `render.mjs` are the knobs. The contact sheets
(`art-src/out/characters-sheet*.png`) show every person, direction and animation at atlas size, at the game's size
(`-game`, `-game1x`), at the conversation zoom on a phone (`-focus`), and the portraits.

## 4. What comes out (the world)

The world uses the same camera, lights, outline and colour filter as the people, so it reads as one picture with
them. `page/world.js` renders items; the recipes say how each one is built:

- `page/places.js`: the thirteen places. A Kenney suburban house where a house fits (home, Mia, café, shop),
  recoloured by material name and dressed with awnings, signs and flower boxes; the rest are composed from plain
  low-poly shapes in the kits' flat colours (office, school with its clock tower, bus stop, clinic, cinema, phone
  shop, park gate, notice board, the bandstand on the square). Signs carry symbols, never words. A place is built
  with its door on +Z and turned a quarter for a door on the +X face (`face` in townWorld.ts).
- `page/props.js`: empty lots (a construction site for the next one to build, a grass patch for the others, one per
  footprint size), trees (round ×3, pine ×2, Kenney's poplars ×2), bushes, rocks, every decoration, the café's
  terrace, the bus, string lights between fixed points, and a low-poly cat with walk and sit poses.
- `page/ground.js`: the ground as ONE picture: the island (rounded slab, grassy lip, earth sides), its top painted
  in tile space (grass, round paths, the cobbled plaza, the pond, doorsteps), a plaza curb, rocks by the pond, grass
  tufts and the fixed trees' shadows. One picture rather than tiles: the round paths, plaza and pond would need many
  edge tiles, one picture has no seams and costs one drawImage per frame, and the layout changes rarely (re-render).
- `page/parts.js`: shared colours, roofs, windows, doors, awnings, and the sign symbols (cup, basket, phone, cross,
  film reel, star, bus, leaf, clock).

Each item gives up to three layers, trimmed with the ground point it stands on as anchor: `body`, `lit` (windows,
lamp bulbs and string bulbs only, with a soft halo, for the night) and `shadow` (sun shadow plus a soft contact
shadow, for the game to draw on the ground before anything stands on it). `world.mjs` packs them into atlases
(`world/places.webp`, `props`, `cat`, `lit`, `shadows`) plus `world/ground.webp` and writes `world.data.ts`;
the loader is `src/features/town/art/world.ts` (tested in `world.test.ts`). Tree variants are chosen by
`worldPick.ts`, shared by the renderer (it bakes their shadows into the ground) and the game.

Knobs at the top of `world.mjs`: `WORLD_RES` (3: sprites are big on a phone), `GROUND_RES` (2), `SHADOW_RES` (1),
`ISLAND`, `WORLD_LOOK` (shadow strength and blur, glow). It writes contact sheets next to the characters' ones:
`world-places` (and `-night`), `world-lots-nature`, `world-decor`, `world-cat`, and whole-town previews with
the people: `town-day`, `town-night`, `town-start` (two places built, three construction sites), `town-desk`
(desktop zoom) and `town-phone` (phone zoom).

## 5. Changing things

- **A place or a prop looks wrong:** change its recipe in `page/places.js` / `page/props.js`, look with
  `npm run art:town -- --explore places` (or a key prefix), then `npm run art:town -- --part world`.
- **The layout changed (townWorld.ts):** re-run `npm run art:town -- --part world`: the ground, the string lights and
  the lot sizes come from the layout.
- **A different person for a resident:** edit `src/features/town/art/cast.ts`, then re-run `npm run art:town`.
- **Palette swaps:** `swaps` copy one 32 × 128 px cell of Kenney's `colormap.png` (16 × 4 cells) over another. The
  copy is made for one mesh only (`body-mesh` = clothes, `head-mesh` = hair and face). To find which cells a model
  uses, read the TEXCOORD_0 values of its GLB.
- **female-a:** her crutches are part of her body mesh. `MODEL_FIXES` in `render.mjs` removes them (the blue pieces
  out along the arms).
- **male-e (the player):** his hands and shoes share one black colour cell, so a palette swap cannot give him bare
  hands. `MODEL_FIXES` repaints only the vertices out along the arms (|x| ≥ 0.2 in the bind pose) to the skin cell
  (`paint`), and `cast.ts` swaps his hair to fair and his braces to blue.
