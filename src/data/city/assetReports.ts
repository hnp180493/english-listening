// What the managers of the learner's assets say in their daily reports (core/town/assets.ts; docs/town.md §34), and the
// Vietnamese meanings shown after the answers. The English is made in core/town/assets.ts from these pieces (a car, a
// repair, goods, a programme); `vi` holds the meaning with `{…}` filled there. Westbay people: the browser's voice, no
// clips (docs/city.md §5). Amira is warm and talkative, Theo says as little as he can, Kit is brisk.

/** The workshop's cars and what was done to them (Theo). */
export const ASSET_CARS: readonly { en: string; vi: string }[] = [
  { en: 'a blue Fiesta', vi: 'Fiesta màu xanh dương' },
  { en: 'a red Polo', vi: 'Polo màu đỏ' },
  { en: 'a white van', vi: 'xe tải nhỏ màu trắng' },
  { en: 'a grey Corsa', vi: 'Corsa màu xám' },
  { en: 'a green Mini', vi: 'Mini màu xanh lá' },
];
export const ASSET_REPAIRS: readonly { en: string; vi: string }[] = [
  { en: 'New clutch.', vi: 'Thay côn.' },
  { en: 'New brakes.', vi: 'Thay phanh.' },
  { en: 'Two new tyres.', vi: 'Thay hai lốp.' },
  { en: 'New battery.', vi: 'Thay bình điện.' },
];

/** The stall's goods (Amira). */
export const ASSET_GOODS: readonly { en: string; vi: string }[] = [
  { en: 'saffron', vi: 'nghệ tây' },
  { en: 'smoked paprika', vi: 'ớt bột xông khói' },
  { en: 'cumin', vi: 'thì là Ai Cập' },
  { en: 'cinnamon', vi: 'quế' },
];

/** Programme names one sound apart on Bay FM (Kit): the first is said, the others are what a careless ear hears. */
export const ASSET_SHOWS: readonly (readonly [string, string, string])[] = [
  ['Night Owls', 'Night Calls', 'Light Owls'],
  ['Harbour Lights', 'Harbour Nights', 'Parlour Lights'],
  ['Bay Talk', 'Day Talk', 'Bay Walk'],
  ['The Late Shift', 'The Lake Shift', 'The Late Gift'],
  ['Sunday Best', 'Sunday Rest', 'Monday Best'],
];

/** The meaning of each report, its values put in where `{…}` stands. */
export const ASSET_REPORT_VI: Readonly<Record<'stall' | 'workshop' | 'sponsor', { vi: string }>> = {
  stall: { vi: 'Amira đây. Hôm nay sạp của cháu bán được {qty} hũ {goods}, {price} một hũ.' },
  workshop: { vi: 'Theo đây. Hôm nay một xe: {car}, biển số {plate}. {repair} {bill} bảng.' },
  sponsor: { vi: 'Kit ở phòng thu đây. Tối nay tên hãng lên sóng trong chương trình {show}, lúc {time}. Marcus tự đọc.' },
};

/** What Marcus reads on Bay FM once the sponsorship is bought (core/town/assetsStore.ts sponsorLine). */
export const SPONSOR_READ: { text: string; vi: string } = {
  text: "This hour of Bay FM comes to you with the help of Rico's cars, at the old gatehouse on Pier Road. Ring phone two, day or night.",
  vi: 'Giờ phát sóng này của Bay FM có sự giúp sức của hãng xe Rico, ở trạm gác cũ trên Pier Road. Gọi máy số hai, ngày cũng như đêm.',
};
