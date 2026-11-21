// Catalogs of the game loops of "Thị trấn" (docs/town.md §10 "Vòng chơi"): fish, egg loot, achievements, town
// projects. Content only: the rules are in core/town/{fishing,farm,eggs,wardrobe,unlocks}.ts.
//
// The one rule (docs/town.md §8): every reward comes from LISTENING. A fish is caught by hearing what it said; eggs
// come from listening milestones or from xu (which come from listening); achievements and projects count listening.
// Nothing here is worth real money, nothing can be bought with anything but xu, and xu are a game score.
//
// Ids are stable (stored in the synced town progress): never rename one. Item, species, achievement and project ids
// share one namespace with each other (data/townGame.test checks they never collide).

import type { Level, Phenomenon } from '../core/types';

// ───────────────────────── rarity ─────────────────────────

export type Rarity = 'thuong' | 'hiem' | 'quy' | 'huyen-thoai';
export const RARITIES: readonly Rarity[] = ['thuong', 'hiem', 'quy', 'huyen-thoai'];

export interface RarityInfo {
  id: Rarity;
  /** Vietnamese, shown as it is. */
  name: string;
  /** Weight of a cast landing on this tier (before the streak bonus, core/town/fishing tierWeights). */
  fishWeight: number;
  /** Weight of an egg giving this tier (core/town/eggs). */
  eggWeight: number;
  /** Xu for catching a fish of this tier on the first listen (with replays: half, rounded up). */
  catchXu: number;
  /** Xu an egg gives instead when it hatches an item already owned. */
  dupXu: number;
  /** Time to answer a cast of this tier, as a share of the item's base time (core/town/fishing). */
  timeFactor: number;
  /** Plays a cast of this tier allows (the first included). */
  maxPlays: number;
}

export const RARITY: Readonly<Record<Rarity, RarityInfo>> = {
  thuong: { id: 'thuong', name: 'Thường', fishWeight: 62, eggWeight: 60, catchXu: 1, dupXu: 4, timeFactor: 1, maxPlays: 3 },
  hiem: { id: 'hiem', name: 'Hiếm', fishWeight: 26, eggWeight: 28, catchXu: 2, dupXu: 8, timeFactor: 0.9, maxPlays: 3 },
  quy: { id: 'quy', name: 'Quý', fishWeight: 10, eggWeight: 9, catchXu: 3, dupXu: 15, timeFactor: 0.8, maxPlays: 2 },
  'huyen-thoai': { id: 'huyen-thoai', name: 'Huyền thoại', fishWeight: 2, eggWeight: 3, catchXu: 5, dupXu: 30, timeFactor: 0.75, maxPlays: 2 },
};

/** 0 = thường … 3 = huyền thoại. */
export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}

// ───────────────────────── fish ─────────────────────────

/**
 * Where a species' listening items come from. Every item is built-in content with a shipped clip (core/audioInventory):
 * - 'chunks': a spoken chunk of Cụm từ (data/chunks) whose FIRST phenomenon is `phenomenon`, rank ≤ `maxRank`; it
 *   plays the chunk's connected clip (`ttsText`, mode 'connected') and asks which written words were said (4 options);
 * - 'pairs': one sentence of a minimal-pair item of Phân biệt âm (data/pairs) of that phenomenon; it plays that
 *   option (mode-less clip) and asks which of the item's 2–3 sentences was said;
 * - 'sentences': a dictation sentence (data/sentences) of one of `levels` with `phenomenon` in its focus (and at least
 *   `minFocus` phenomena); it plays the dictation clip (connected) and asks its meaning among 3 (core/town/visit).
 */
export type FishPool =
  | { from: 'chunks'; phenomenon: Phenomenon; maxRank: number }
  | { from: 'pairs'; phenomenon: Phenomenon }
  | { from: 'sentences'; phenomenon: Phenomenon; levels: readonly Level[]; minFocus?: number };

export interface FishSpecies {
  id: string;
  /** Vietnamese name. */
  name: string;
  tier: Rarity;
  phenomenon: Phenomenon;
  /**
   * One short Vietnamese line about the sound it "says": the album card only. After a cast the panel shows the tip of
   * the item itself (core/town/fishing fishTip), since the species' examples are not the words that were said.
   */
  fact: string;
  pool: FishPool;
}

export const FISH_SPECIES: readonly FishSpecies[] = [
  // thường: high-frequency chunks, one per phenomenon
  {
    id: 'ca-noi',
    name: 'Cá Nối',
    tier: 'thuong',
    phenomenon: 'linking',
    fact: 'Phụ âm cuối dính sang nguyên âm đầu của từ sau: “turn it off” nghe như “tơ-ni-đóp”.',
    pool: { from: 'chunks', phenomenon: 'linking', maxRank: 160 },
  },
  {
    id: 'ca-luot',
    name: 'Cá Lướt',
    tier: 'thuong',
    phenomenon: 'weak-form',
    fact: 'Từ nhỏ như to, for, and, can bị nói lướt thành một âm /ə/ rất ngắn.',
    pool: { from: 'chunks', phenomenon: 'weak-form', maxRank: 160 },
  },
  {
    id: 'ca-bat-luoi',
    name: 'Cá Bật Lưỡi',
    tier: 'thuong',
    phenomenon: 'flap-t',
    fact: 'Giọng Mỹ: T giữa hai nguyên âm thành một cú bật lưỡi nhẹ, “water” nghe như “wa-đơ”.',
    pool: { from: 'chunks', phenomenon: 'flap-t', maxRank: 160 },
  },
  {
    id: 'ca-gonna',
    name: 'Cá Gơ-nơ',
    tier: 'thuong',
    phenomenon: 'reduction',
    fact: '“going to” nói nhanh thành “gonna”, “want to” thành “wanna”: cả cụm gọn lại như một từ.',
    pool: { from: 'chunks', phenomenon: 'reduction', maxRank: 160 },
  },
  {
    id: 'ca-nuot',
    name: 'Cá Nuốt',
    tier: 'thuong',
    phenomenon: 'elision',
    fact: 'T, D kẹp giữa hai phụ âm hay bị nuốt mất: “next day” nghe như “nex day”.',
    pool: { from: 'chunks', phenomenon: 'elision', maxRank: 192 },
  },
  {
    id: 'ca-hoa',
    name: 'Cá Hòa',
    tier: 'thuong',
    phenomenon: 'assimilation',
    fact: 'Hai âm cạnh nhau hòa thành âm khác: “did you” nghe như “đi-jə”.',
    pool: { from: 'chunks', phenomenon: 'assimilation', maxRank: 192 },
  },
  {
    id: 'ca-mat-h',
    name: 'Cá Mất H',
    tier: 'thuong',
    phenomenon: 'h-dropping',
    fact: 'him, her, he không được nhấn thì rơi mất h: “tell him” nghe như “te-lim”.',
    pool: { from: 'chunks', phenomenon: 'h-dropping', maxRank: 192 },
  },
  {
    id: 'ca-gon',
    name: 'Cá Gọn',
    tier: 'thuong',
    phenomenon: 'contraction',
    fact: 'I am thành I’m, I will thành I’ll: khi nói còn ngắn hơn cả khi viết.',
    pool: { from: 'chunks', phenomenon: 'contraction', maxRank: 192 },
  },
  // hiếm: short sentences (levels 1–2) or a minimal pair
  {
    id: 'ro-noi-am',
    name: 'Cá Rô Nối Âm',
    tier: 'hiem',
    phenomenon: 'linking',
    fact: 'Người bản xứ không ngắt giữa các từ: cả câu ngắn trôi như một chuỗi âm liền.',
    pool: { from: 'sentences', phenomenon: 'linking', levels: [1] },
  },
  {
    id: 'me-can',
    name: 'Cá Mè Can',
    tier: 'hiem',
    phenomenon: 'weak-form',
    fact: '“can” khẳng định nói lướt thành “kən”; “can’t” được nhấn, nguyên âm mở và dài hơn.',
    pool: { from: 'pairs', phenomenon: 'weak-form' },
  },
  {
    id: 'chep-do',
    name: 'Cá Chép Đờ',
    tier: 'hiem',
    phenomenon: 'flap-t',
    fact: '“get it”, “a lot of”: chữ T giữa hai nguyên âm nghe như “đ” rất nhẹ.',
    pool: { from: 'sentences', phenomenon: 'flap-t', levels: [1, 2] },
  },
  {
    id: 'tre-wanna',
    name: 'Cá Trê Wanna',
    tier: 'hiem',
    phenomenon: 'reduction',
    fact: 'kind of → kinda, out of → outta: “of” chỉ còn lại một âm /ə/.',
    pool: { from: 'sentences', phenomenon: 'reduction', levels: [1, 2] },
  },
  {
    id: 'loc-nuot-chu',
    name: 'Cá Lóc Nuốt Chữ',
    tier: 'hiem',
    phenomenon: 'elision',
    fact: '“I don’t know” nói nhanh có thể chỉ còn “ai-đơ-nô”: chữ bị nuốt nhưng nghĩa vẫn còn.',
    pool: { from: 'sentences', phenomenon: 'elision', levels: [1, 2] },
  },
  {
    id: 'troi-hoa-am',
    name: 'Cá Trôi Hòa Âm',
    tier: 'hiem',
    phenomenon: 'assimilation',
    fact: '“would you” thành “wu-jə”, “meet you” thành “mee-chə”: D, T gặp Y thì hóa thành J, CH.',
    pool: { from: 'sentences', phenomenon: 'assimilation', levels: [1, 2] },
  },
  {
    id: 'bong-him',
    name: 'Cá Bống Him-Them',
    tier: 'hiem',
    phenomenon: 'h-dropping',
    fact: '“him” mất h nghe như “im”, dễ lẫn với “them” nói lướt thành “əm”.',
    pool: { from: 'pairs', phenomenon: 'h-dropping' },
  },
  {
    id: 'thu-rut-gon',
    name: 'Cá Thu Rút Gọn',
    tier: 'hiem',
    phenomenon: 'contraction',
    fact: 'I’ll hay I, he’s hay he was: nhiều khi chỉ khác nhau một âm rất nhỏ.',
    pool: { from: 'pairs', phenomenon: 'contraction' },
  },
  // quý: long, fast sentences (level 3)
  {
    id: 'hoi-am-yeu',
    name: 'Cá Hồi Âm Yếu',
    tier: 'quy',
    phenomenon: 'weak-form',
    fact: 'Câu dài thì từ nhỏ càng yếu: chỉ những từ mang nghĩa chính mới được nhấn rõ.',
    pool: { from: 'sentences', phenomenon: 'weak-form', levels: [3] },
  },
  {
    id: 'ngu-chu-t',
    name: 'Cá Ngừ Chữ T',
    tier: 'quy',
    phenomenon: 'flap-t',
    fact: 'Chữ T bật nhẹ cả qua ranh giới từ: “what about” nghe như “wa-đə-bao”.',
    pool: { from: 'sentences', phenomenon: 'flap-t', levels: [3] },
  },
  {
    id: 'kiem-gonna',
    name: 'Cá Kiếm Gonna',
    tier: 'quy',
    phenomenon: 'reduction',
    fact: 'Nói nhanh, cả cụm “what are you going to” có thể chỉ còn “wa-chə-gơ-nə”.',
    pool: { from: 'sentences', phenomenon: 'reduction', levels: [3] },
  },
  {
    id: 'mu-mat-h',
    name: 'Cá Mú Mất H',
    tier: 'quy',
    phenomenon: 'h-dropping',
    fact: 'has, have, had không nhấn cũng rơi mất h: “should have” nghe như “shoul-də”.',
    pool: { from: 'sentences', phenomenon: 'h-dropping', levels: [2, 3] },
  },
  {
    id: 'chinh-nuot-am',
    name: 'Cá Chình Nuốt Âm',
    tier: 'quy',
    phenomenon: 'elision',
    fact: 'Trong câu dài, âm cuối của nhiều từ liền nhau cùng bị nuốt: nghe theo nhịp, đừng đợi từng chữ.',
    pool: { from: 'sentences', phenomenon: 'elision', levels: [3] },
  },
  {
    id: 'duoi-hoa-am',
    name: 'Cá Đuối Hòa Âm',
    tier: 'quy',
    phenomenon: 'assimilation',
    fact: '“in Boston” nghe như “im Boston”: N gặp B, P thì môi khép sớm thành M.',
    pool: { from: 'sentences', phenomenon: 'assimilation', levels: [3] },
  },
  // huyền thoại: the densest long sentences
  {
    id: 'rong-noi-am',
    name: 'Cá Rồng Nối Âm',
    tier: 'huyen-thoai',
    phenomenon: 'linking',
    fact: 'Câu dài, nói nhanh, nhiều hiện tượng chồng lên nhau: nghe ra nghĩa ở đây là tai đã quen nhịp nói thật.',
    pool: { from: 'sentences', phenomenon: 'linking', levels: [3], minFocus: 3 },
  },
  {
    id: 'koi-vang',
    name: 'Cá Koi Vàng',
    tier: 'huyen-thoai',
    phenomenon: 'contraction',
    fact: 'Dạng rút gọn chen giữa câu dài, nói nhanh: chữ viết một đằng, tai nghe một nẻo.',
    pool: { from: 'sentences', phenomenon: 'contraction', levels: [3], minFocus: 3 },
  },
];

export function fishSpecies(id: string): FishSpecies | undefined {
  return FISH_SPECIES.find((f) => f.id === id);
}

// ───────────────────────── eggs and what they hatch ─────────────────────────

/** Xu for one egg at the egg shop. */
export const EGG_COST = 40;
/** At least one item of tier quý or above every EGG_PITY eggs opened on a browser. */
export const EGG_PITY = 10;

export type LootKind = 'pet' | 'hat' | 'outfit' | 'title';
export const LOOT_KINDS: readonly LootKind[] = ['pet', 'hat', 'outfit', 'title'];

export interface LootItem {
  id: string;
  kind: LootKind;
  /** Vietnamese name (a title: the words shown over the player's head). */
  name: string;
  tier: Rarity;
  /** Outfits only: the colour the engine tints the player's clothes with (canvas palette, not CSS). */
  color?: string;
}

const pet = (id: string, name: string, tier: Rarity): LootItem => ({ id, kind: 'pet', name, tier });
const hat = (id: string, name: string, tier: Rarity): LootItem => ({ id, kind: 'hat', name, tier });
const outfit = (id: string, name: string, tier: Rarity, color: string): LootItem => ({ id, kind: 'outfit', name, tier, color });
const title = (id: string, name: string, tier: Rarity): LootItem => ({ id, kind: 'title', name, tier });

export const LOOT: readonly LootItem[] = [
  pet('cho-con', 'Chó con', 'thuong'),
  pet('vit', 'Vịt', 'thuong'),
  pet('meo-muop', 'Mèo mướp', 'thuong'),
  pet('ga-con', 'Gà con', 'thuong'),
  pet('tho', 'Thỏ', 'hiem'),
  pet('rua', 'Rùa', 'hiem'),
  pet('cao', 'Cáo', 'quy'),
  pet('gau-truc', 'Gấu trúc', 'huyen-thoai'),
  hat('mu-len', 'Mũ len', 'thuong'),
  hat('mu-rom', 'Mũ rơm', 'thuong'),
  hat('non-la', 'Nón lá', 'thuong'),
  hat('mu-luoi-trai', 'Mũ lưỡi trai', 'thuong'),
  hat('vong-hoa', 'Vòng hoa', 'hiem'),
  hat('mu-dau-bep', 'Mũ đầu bếp', 'hiem'),
  hat('mu-cao-boi', 'Mũ cao bồi', 'hiem'),
  hat('mu-phu-thuy', 'Mũ phù thủy', 'quy'),
  hat('vuong-mien', 'Vương miện', 'huyen-thoai'),
  outfit('ao-xanh-la', 'Áo xanh lá', 'thuong', '#5c9e4f'),
  outfit('ao-do', 'Áo đỏ', 'thuong', '#c8473d'),
  outfit('ao-vang', 'Áo vàng', 'thuong', '#e0b43a'),
  outfit('ao-cam', 'Áo cam', 'thuong', '#e07b34'),
  outfit('ao-hong', 'Áo hồng', 'hiem', '#e48aa8'),
  outfit('ao-tim', 'Áo tím', 'hiem', '#8a5fc0'),
  outfit('ao-trang', 'Áo trắng', 'hiem', '#eeeae2'),
  outfit('ao-den', 'Áo đen', 'quy', '#2f3136'),
  outfit('ao-bac', 'Áo bạc', 'quy', '#b9c0c8'),
  outfit('ao-kim-tuyen', 'Áo kim tuyến', 'huyen-thoai', '#d9b44a'),
  title('t-me-nghe', 'Người mê nghe', 'thuong'),
  title('t-cu-dem', 'Cú đêm', 'thuong'),
  title('t-ban-cua-ca', 'Bạn của cá', 'hiem'),
  title('t-tai-nhay', 'Tai nhạy', 'hiem'),
  title('t-moi-podcast', 'Mọt podcast', 'hiem'),
  title('t-tho-san-am', 'Thợ săn âm', 'quy'),
  title('t-nhac-truong', 'Nhạc trưởng nối âm', 'quy'),
  title('t-ngoi-sao', 'Ngôi sao thị trấn', 'huyen-thoai'),
];

export function lootItem(id: string): LootItem | undefined {
  return LOOT.find((i) => i.id === id);
}

// ───────────────────────── achievements and town projects ─────────────────────────

/**
 * What a goal counts (core/town/unlocks townMetrics). All of it is listening:
 * lines / first: town and episode lines understood (on the first listen); gistFirst: episodes whose gist was right on
 * the very first listen; episodes: episodes finished; relistens: spaced re-listens with the gist right; fish: fish
 * caught; species: species caught; legendary: huyền thoại species caught; phenomenon: species of `phenomenon` caught;
 * farmDays: days the whole farm was harvested; streakBest: the longest run of days with a town line answered;
 * perfect: days with a perfect quick chat; mature: review cards with an interval of 21 days or more (Ôn tập).
 */
export type TownMetric =
  | 'lines'
  | 'first'
  | 'gistFirst'
  | 'episodes'
  | 'relistens'
  | 'fish'
  | 'species'
  | 'legendary'
  | 'phenomenon'
  | 'farmDays'
  | 'streakBest'
  | 'perfect'
  | 'mature';

export interface TownGoal {
  metric: TownMetric;
  /** 'all' = everything there is (every episode, every species, every species of `phenomenon`). */
  goal: number | 'all';
  /** metric 'phenomenon' only. */
  phenomenon?: Phenomenon;
}

export interface Achievement extends TownGoal {
  id: string;
  /** Vietnamese name of the achievement. */
  name: string;
  /** What it takes, one short Vietnamese line. */
  blurb: string;
  /** The title it unlocks (shown over the player's head when worn). */
  title: string;
}

const ach = (id: string, name: string, blurb: string, title: string, metric: TownMetric, goal: number | 'all', phenomenon?: Phenomenon): Achievement =>
  phenomenon ? { id, name, blurb, title, metric, goal, phenomenon } : { id, name, blurb, title, metric, goal };

export const ACHIEVEMENTS: readonly Achievement[] = [
  // lines understood
  ach('cau-dau-tien', 'Mười câu đầu', 'Hiểu 10 câu trong thị trấn.', 'Người mới đến', 'lines', 10),
  ach('nam-muoi-cau', 'Năm mươi câu', 'Hiểu 50 câu.', 'Người hay chuyện', 'lines', 50),
  ach('tram-ruoi-cau', 'Một trăm rưỡi câu', 'Hiểu 150 câu.', 'Người sành chuyện', 'lines', 150),
  ach('ba-tram-cau', 'Ba trăm câu', 'Hiểu 300 câu.', 'Kho chuyện thị trấn', 'lines', 300),
  ach('nghe-mot-lan', 'Nghe một lần', 'Hiểu 25 câu ngay lần nghe đầu.', 'Nghe một lần', 'first', 25),
  ach('tai-nhanh', 'Tai nhanh', 'Hiểu 100 câu ngay lần nghe đầu.', 'Tai nhanh', 'first', 100),
  ach('tai-vang', 'Tai vàng', 'Hiểu 250 câu ngay lần nghe đầu.', 'Tai vàng', 'first', 250),
  // episodes
  ach('nghe-y-chinh', 'Bắt được ý chính', 'Đoán đúng ý chính của một tập ngay lần nghe đầu.', 'Người nắm ý', 'gistFirst', 1),
  ach('tai-thinh', 'Tai thính', 'Đoán đúng ý chính của 10 tập ngay lần nghe đầu.', 'Tai thính', 'gistFirst', 10),
  ach('tap-dau-tien', 'Tập đầu tiên', 'Nghe trọn một tập “Chuyện ở thị trấn”.', 'Người nghe chuyện', 'episodes', 1),
  ach('muoi-tap', 'Mười tập', 'Nghe trọn 10 tập.', 'Khách quen của chuyện', 'episodes', 10),
  ach('nguoi-ke-chuyen', 'Người kể chuyện', 'Nghe trọn mọi tập của thị trấn.', 'Người kể chuyện', 'episodes', 'all'),
  ach('nghe-lai-khong-quen', 'Nghe lại không quên', 'Nghe lại đúng hẹn 10 lần và vẫn nắm ý chính.', 'Trí nhớ bền', 'relistens', 10),
  // fishing
  ach('me-ca-dau', 'Mẻ cá đầu', 'Câu được con cá đầu tiên.', 'Cần thủ tập sự', 'fish', 1),
  ach('nam-muoi-ca', 'Năm mươi con cá', 'Câu được 50 con cá.', 'Cần thủ', 'fish', 50),
  ach('hai-tram-ca', 'Hai trăm con cá', 'Câu được 200 con cá.', 'Lão ngư', 'fish', 200),
  ach('nha-suu-tam', 'Nhà sưu tầm', 'Câu được một nửa số loài cá.', 'Nhà sưu tầm', 'species', 12),
  ach('du-bo-ca', 'Đủ bộ cá', 'Câu được mọi loài cá trong hồ.', 'Chủ hồ', 'species', 'all'),
  ach('huyen-thoai-ben-ho', 'Huyền thoại bên hồ', 'Câu được một con cá huyền thoại.', 'Huyền thoại bên hồ', 'legendary', 1),
  ach('bac-thay-noi-am', 'Bậc thầy nối âm', 'Câu được mọi loài cá nối âm.', 'Bậc thầy nối âm', 'phenomenon', 'all', 'linking'),
  ach('bac-thay-am-yeu', 'Bậc thầy âm yếu', 'Câu được mọi loài cá âm yếu.', 'Bậc thầy âm yếu', 'phenomenon', 'all', 'weak-form'),
  ach('bac-thay-chu-t', 'Bậc thầy chữ T', 'Câu được mọi loài cá chữ T bật nhẹ.', 'Bậc thầy chữ T', 'phenomenon', 'all', 'flap-t'),
  ach('bac-thay-gonna', 'Bậc thầy gonna', 'Câu được mọi loài cá rút gọn (gonna, wanna…).', 'Bậc thầy gonna', 'phenomenon', 'all', 'reduction'),
  ach('bac-thay-nuot-am', 'Bậc thầy nuốt âm', 'Câu được mọi loài cá nuốt âm.', 'Bậc thầy nuốt âm', 'phenomenon', 'all', 'elision'),
  ach('bac-thay-hoa-am', 'Bậc thầy hòa âm', 'Câu được mọi loài cá hòa âm.', 'Bậc thầy hòa âm', 'phenomenon', 'all', 'assimilation'),
  ach('bac-thay-mat-h', 'Bậc thầy mất H', 'Câu được mọi loài cá mất âm h.', 'Bậc thầy mất H', 'phenomenon', 'all', 'h-dropping'),
  ach('bac-thay-rut-gon', 'Bậc thầy rút gọn', 'Câu được mọi loài cá dạng rút gọn (I’m, he’s…).', 'Bậc thầy rút gọn', 'phenomenon', 'all', 'contraction'),
  // the farm (Ôn tập)
  ach('mua-dau-tien', 'Mùa thu hoạch đầu', 'Thu hoạch sạch nông trại một ngày.', 'Nhà nông', 'farmDays', 1),
  ach('khong-bo-cay-nao', 'Không bỏ cây nào', 'Thu hoạch sạch nông trại 7 ngày.', 'Không bỏ cây nào', 'farmDays', 7),
  ach('vuon-ba-muoi-ngay', 'Ba mươi mùa gặt', 'Thu hoạch sạch nông trại 30 ngày.', 'Lão nông', 'farmDays', 30),
  ach('vuon-lau-nam', 'Vườn lâu năm', 'Có 25 thẻ ôn đã thuộc (khoảng cách ôn từ 21 ngày).', 'Người trồng cây lâu năm', 'mature', 25),
  // keeping at it
  ach('bay-ngay-lien', 'Bảy ngày liền', 'Nghe ở thị trấn 7 ngày liền.', 'Bảy ngày liền', 'streakBest', 7),
  ach('mot-thang-lien', 'Một tháng không nghỉ', 'Nghe ở thị trấn 30 ngày liền.', 'Không bỏ ngày nào', 'streakBest', 30),
  ach('tro-chuyen-troi-chay', 'Trò chuyện trôi chảy', 'Có 10 ngày trò chuyện đúng cả 5 câu.', 'Trò chuyện trôi chảy', 'perfect', 10),
];

export function achievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** A long goal of the whole town, fed by listening totals. Done: a permanent decoration in the world and a title. */
export interface TownProject extends TownGoal {
  id: string;
  /** Vietnamese name. */
  name: string;
  /** What it takes, one short Vietnamese line. */
  blurb: string;
  /** The world decoration it adds for good (drawn by the engine, features/town). */
  decoration: string;
  /** The title it unlocks. */
  title: string;
}

export const TOWN_PROJECTS: readonly TownProject[] = [
  {
    id: 'du-an-den-ho',
    name: 'Thắp đèn quanh hồ',
    blurb: 'Cả thị trấn góp sức: hiểu 100 câu.',
    metric: 'lines',
    goal: 100,
    decoration: 'proj-lake-lights',
    title: 'Người thắp đèn',
  },
  {
    id: 'du-an-le-hoi',
    name: 'Lễ hội mùa thu',
    blurb: 'Nghe trọn 10 tập “Chuyện ở thị trấn”.',
    metric: 'episodes',
    goal: 10,
    decoration: 'proj-festival',
    title: 'Người mở hội',
  },
  {
    id: 'du-an-ben-ca',
    name: 'Bến cá mới',
    blurb: 'Câu được 60 con cá.',
    metric: 'fish',
    goal: 60,
    decoration: 'proj-pier',
    title: 'Ngư dân của hồ',
  },
  {
    id: 'du-an-vuon',
    name: 'Vườn cộng đồng',
    blurb: 'Thu hoạch sạch nông trại 10 ngày.',
    metric: 'farmDays',
    goal: 10,
    decoration: 'proj-garden',
    title: 'Người làm vườn',
  },
  {
    id: 'du-an-thap-dong-ho',
    name: 'Tháp đồng hồ',
    blurb: 'Hiểu 150 câu ngay lần nghe đầu.',
    metric: 'first',
    goal: 150,
    decoration: 'proj-clock-tower',
    title: 'Người giữ nhịp',
  },
];

export function townProject(id: string): TownProject | undefined {
  return TOWN_PROJECTS.find((p) => p.id === id);
}
