// What the people of Westbay look like (docs/city.md): registered with the town's cast (three/chars/looks.ts) when the
// city's page loads, so the 3D people, their portraits and the panels all draw them. One or two things make each
// recognisable at a glance, as in the town; family shows (Nora has Leo's curls and skin, Frank is Ben thirty years on,
// Claire has Daniel's glasses).
import type { CharacterLook, HairSpec } from '../three/contracts';
import { registerLooks } from '../three/chars/looks';

const hair = (style: HairSpec['style'], color: string): HairSpec => ({ style, color });

export const CITY_LOOKS: Readonly<Record<string, CharacterLook>> = {
  // ── Ga & bến xe ──
  // Rico: Sam's cousin, taxi-yellow jacket, a flat cap, a bit stocky
  rico: { skin: '#dba67f', hair: hair('short', '#2a2222'), top: '#f2c45a', bottom: '#3b4258', shoes: '#2f2a33', extras: ['cap', 'beard', 'stocky'] },
  // Mrs Okafor: grey bun, glasses, the station's navy uniform with a tie
  okafor: { skin: '#6f4630', hair: hair('bun', '#cfc9c2'), top: '#33466e', bottom: '#2c3550', shoes: '#26232a', extras: ['glasses', 'tie:#c94f4f', 'collar', 'skirt', 'lashes'], scale: 0.96 },
  // Pete: ginger, a brown cardigan and a tie, always a little rumpled
  pete: { skin: '#f6d9c6', hair: hair('short', '#c9743a'), top: '#8a6a4f', bottom: '#5c6074', shoes: '#4f3d33', extras: ['tie:#5f8fd6', 'freckles'] },
  // Tess: fair ponytail, a coffee-brown apron
  tess: { skin: '#f4d2b8', hair: hair('ponytail', '#e2bd6b'), top: '#f19a74', bottom: '#56658a', shoes: '#f3efe6', extras: ['apron:#7a5642', 'lashes'] },
  // ── Chợ cũ ──
  // Nora: Leo's sister, the same curls and skin, a sunflower top under a green florist's apron
  nora: { skin: '#c98f66', hair: hair('curly', '#3b2a22'), top: '#f6cf5a', bottom: '#6b5a52', shoes: '#7c5545', extras: ['apron:#5f9472', 'lashes'] },
  // Theo: ferry mechanic, navy dungarees, a short beard
  theo: { skin: '#f0cdaa', hair: hair('short', '#6b4a33'), top: '#d8dde6', bottom: '#40527a', shoes: '#4f3d33', extras: ['dungarees', 'beard'] },
  // Frank: Ben thirty years on: bald, a grey beard, glasses, a brown cardigan
  frank: { skin: '#e8b892', hair: hair('bald', '#bdb6ae'), top: '#9a6f52', bottom: '#5c6074', shoes: '#4f3d33', extras: ['beard', 'glasses', 'stocky'], scale: 0.98 },
  // Poppy: ginger pigtails, freckles, a flour-white top and a pink apron
  poppy: { skin: '#f8dccb', hair: hair('pigtails', '#d9773f'), top: '#f5efe2', bottom: '#8f82a8', shoes: '#f3efe6', extras: ['apron:#f2a7bf', 'freckles', 'lashes'] },
  // Gianna: dark bun, a red blouse, a white cook's apron
  gianna: { skin: '#e3b089', hair: hair('bun', '#2e2220'), top: '#d9534f', bottom: '#3f3a44', shoes: '#2f2a33', extras: ['apron:#f5efe2', 'lashes'] },
  // Hal: grey hair, a big beard, a blue-striped fishmonger's apron, stocky
  hal: { skin: '#f0c4a0', hair: hair('short', '#c9c4bd'), top: '#f5efe2', bottom: '#4a5568', shoes: '#3a2c26', extras: ['beard', 'apron:#4f7fb5', 'stocky'] },
  // Amira: long black hair, an orange scarf, a teal dress
  amira: { skin: '#b9825c', hair: hair('long', '#1f1b22'), top: '#3f9c96', bottom: '#3f9c96', shoes: '#c97f6a', extras: ['scarf:#e9924a', 'skirt', 'lashes'] },
  // Jonah: long brown hair, a beard, a denim jacket, a red headband
  jonah: { skin: '#eac4a0', hair: hair('long', '#7a5236'), top: '#5f86b8', bottom: '#4a4038', shoes: '#8a5a44', extras: ['beard', 'headband:#d9534f'] },
  // ── Phố nghệ thuật ──
  // Iris: a silver bob, glasses, all in black with a plum skirt; tall
  iris: { skin: '#f6dccd', hair: hair('bob', '#d6d3da'), top: '#34303c', bottom: '#7a5a9c', shoes: '#26232a', extras: ['glasses', 'skirt', 'lashes'], scale: 1.03 },
  // Wren: spiky teal hair, a yellow tee, shorts
  wren: { skin: '#f1cba9', hair: hair('spiky', '#3fb0a6'), top: '#f4d36e', bottom: '#6f6a8f', shoes: '#f3efe6', extras: ['shorts', 'freckles', 'lashes'] },
  // Claire: Daniel's sister: his skin and glasses, a dark bun, a burgundy jumper with a collar
  claire: { skin: '#8e5c3e', hair: hair('bun', '#231c1c'), top: '#8f3f4f', bottom: '#4a4038', shoes: '#3a2c26', extras: ['glasses', 'collar', 'lashes'] },
  // Kit: a cap worn low, a grey studio hoodie with the station's logo
  kit: { skin: '#efc29c', hair: hair('short', '#4a3528'), top: '#6b7280', bottom: '#33384a', shoes: '#e9e4da', extras: ['cap', 'logo'] },
  // Bo: sunglasses indoors and out, a magenta shirt, stocky
  bo: { skin: '#a8714f', hair: hair('short', '#1c1818'), top: '#c9478f', bottom: '#2f2a33', shoes: '#f3efe6', extras: ['sunglasses', 'stocky', 'collar'] },
  // Dana: a black bob, a mint office blazer with a collar
  dana: { skin: '#f1d0ad', hair: hair('bob', '#1f1b22'), top: '#8fcfb4', bottom: '#3b4258', shoes: '#2f2a33', extras: ['collar', 'skirt', 'lashes'] },
};

registerLooks(CITY_LOOKS);
