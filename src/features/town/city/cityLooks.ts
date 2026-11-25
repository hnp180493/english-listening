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
  // ── Khu văn phòng ──
  // Priya: a long dark plait worn as a ponytail, a saffron blazer, always in a hurry
  priya: { skin: '#b9825c', hair: hair('ponytail', '#231c1c'), top: '#e9a23b', bottom: '#33384a', shoes: '#26232a', extras: ['collar', 'lashes'] },
  // Vivian: a sharp white bob, black glasses, a red coat-dress
  vivian: { skin: '#f3d9c8', hair: hair('bob', '#f1eee9'), top: '#b8323a', bottom: '#b8323a', shoes: '#26232a', extras: ['glasses', 'skirt', 'lashes'], scale: 1.02 },
  // Mr Whitlock: grey hair, a grey suit, a burgundy tie
  whitlock: { skin: '#f0cdb4', hair: hair('short', '#c9c6c1'), top: '#6c7280', bottom: '#565c68', shoes: '#26232a', extras: ['tie:#8f3f4f', 'collar', 'glasses'] },
  // Hana: a black bun, a sky-blue uniform blouse
  hana: { skin: '#f6dcc4', hair: hair('bun', '#1f1b22'), top: '#8fbfe6', bottom: '#3b4258', shoes: '#2f2a33', extras: ['collar', 'skirt', 'lashes'] },
  // Colin: a neat side parting, a FreshWay-green jacket and a tie, a little too keen
  colin: { skin: '#f4d2b8', hair: hair('short', '#b88a52'), top: '#4f9a66', bottom: '#3f475c', shoes: '#4f3d33', extras: ['tie:#f2c45a', 'collar'] },
  // Dev: curly black hair, glasses, an orange hoodie with a logo, a backpack
  dev: { skin: '#a8714f', hair: hair('curly', '#1c1818'), top: '#e9864a', bottom: '#4a4f66', shoes: '#f3efe6', extras: ['glasses', 'logo', 'backpack'] },
  // ── Đại học & bệnh viện ──
  // Dr Osei: short grey hair, a grey beard, a white coat and a stethoscope
  osei: { skin: '#70482f', hair: hair('short', '#bdb9b3'), top: '#8fb8d6', bottom: '#3f475c', shoes: '#26232a', extras: ['coat', 'stethoscope', 'beard'] },
  // Bridget: a red ponytail, navy scrubs
  bridget: { skin: '#f8dccb', hair: hair('ponytail', '#b8492e'), top: '#3f5f96', bottom: '#3f5f96', shoes: '#f3efe6', extras: ['lashes', 'freckles'] },
  // Prof Adeyemi: bald, a white beard, round glasses, a tweedy mustard jacket and a bow of a tie
  adeyemi: { skin: '#5f3d28', hair: hair('bald', '#e6e2dc'), top: '#b08a3c', bottom: '#5e5148', shoes: '#3a2c26', extras: ['beard', 'glasses', 'tie:#7a5a9c', 'collar'], scale: 0.98 },
  // Mr Finch: thin, grey, a green cardigan, glasses on a cord
  finch: { skin: '#f2d6c6', hair: hair('short', '#d9d4ce'), top: '#5f8f6f', bottom: '#6b6258', shoes: '#4f3d33', extras: ['glasses', 'collar'], scale: 0.97 },
  // Yuki: a short black bob with a yellow headband, a cream jumper, a backpack
  yuki: { skin: '#f6dcc4', hair: hair('bob', '#1f1b22'), top: '#f3e3b8', bottom: '#8fa6d6', shoes: '#f3efe6', extras: ['headband:#f2c45a', 'backpack', 'skirt', 'lashes'], scale: 0.96 },
  // Nell: brown curls, a white pharmacist's coat over mint
  nell: { skin: '#e3b089', hair: hair('curly', '#6b4630'), top: '#9ad8b6', bottom: '#6b6f80', shoes: '#f3efe6', extras: ['coat', 'lashes'] },
  // ── Bến cảng ──
  // Jun: spiky black hair going grey, a navy work apron, glasses pushed up
  jun: { skin: '#f1cba9', hair: hair('spiky', '#3a3638'), top: '#d8dde6', bottom: '#4a4f5c', shoes: '#3a2c26', extras: ['apron:#33466e', 'glasses'] },
  // Marcus: a neat beard, a mustard scarf, a teal jacket: the voice of the radio has a face
  marcus: { skin: '#8e5c3e', hair: hair('short', '#231c1c'), top: '#3f8f8a', bottom: '#3b4258', shoes: '#e9e4da', extras: ['beard', 'scarf:#f2c45a'] },
  // Captain Odile: a captain's cap, a navy coat with a white collar, grey ponytail
  odile: { skin: '#f0cdaa', hair: hair('ponytail', '#b9b3ad'), top: '#2f3f66', bottom: '#2c3550', shoes: '#26232a', extras: ['cap', 'collar', 'lashes'] },
  // Gus: stocky, a high-visibility yellow jacket, a cap, a moustache of a beard
  gus: { skin: '#dba67f', hair: hair('short', '#5a4636'), top: '#e8d44a', bottom: '#3f475c', shoes: '#26232a', extras: ['cap', 'beard', 'stocky'] },
  // Mei: grey bun, a red apron, small and quick
  mei: { skin: '#f4d7bd', hair: hair('bun', '#cfc9c2'), top: '#f5efe2', bottom: '#5c6074', shoes: '#4f3d33', extras: ['apron:#c9473f', 'lashes'], scale: 0.94 },
  // Sol: long dark hair, a purple headband, a shirt in lantern orange
  sol: { skin: '#c98f66', hair: hair('long', '#2a2222'), top: '#f08a3c', bottom: '#4a4038', shoes: '#8a5a44', extras: ['headband:#9b7cc6'] },
  // Fay: pink pigtails, a striped fairground top (rose), sunglasses pushed down
  fay: { skin: '#f8dccb', hair: hair('pigtails', '#f29bb0'), top: '#ee8aa6', bottom: '#5f8fd6', shoes: '#f3efe6', extras: ['skirt', 'lashes', 'freckles'] },
};

registerLooks(CITY_LOOKS);
