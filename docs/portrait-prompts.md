# Vẽ chân dung người dân bằng chat AI miễn phí

Avatar của 13 người dân Thị trấn là ảnh vẽ (nửa người, kiểu anime visual novel), tạo bằng Gemini (gemini.google.com)
hoặc ChatGPT bản miễn phí. Ai chưa có ảnh thì app vẫn dùng avatar 3D. Nhân vật người chơi tự tạo luôn dùng avatar 3D
(quá nhiều kiểu tóc / màu da để vẽ trước).

**Người Westbay (nhân vật mới, 37 người):** prompt riêng ở `docs/portraits/westbay/`, ảnh tải về bỏ vào
`portraits-src/westbay/`, cùng `npm run portraits` (xem `README.md` trong đó).

**Mỗi người MỘT ảnh: 9 vẻ mặt xếp lưới 3 × 3.** Mỗi người có một file riêng, dán là xong: `docs/portraits/<tên>.md`
(`emma.md`, `leo.md`…). Phần dưới là bản gộp (khung chung + mô tả từng người) để sửa cho tất cả một lần; sửa ở đây
thì tạo lại các file riêng cho khớp.

## Cách làm

1. Mở **một cuộc chat mới cho mỗi người**, dán nguyên khung trong file của người đó, gửi.
2. Xem kỹ: đủ 9 ô có đường kẻ trắng giữa các ô, **cả 9 ô thấy trọn đỉnh đầu** (búi tóc, đuôi ngựa, mũ, kính trên đầu
   không bị mép ô cắt), cùng một người / áo / màu nền / cỡ, đúng thứ tự. Sai chỗ nào thì bảo vẽ lại đúng chỗ đó.
3. Tải về, đặt tên `<tên>.png` (ví dụ `zoe.png`), bỏ vào thư mục `portraits-src/` ở gốc repo (thư mục này không lên git),
   rồi chạy:

   ```
   npm run portraits
   ```

   Script tìm đường kẻ trắng, cắt 9 ô, ghép lại thành một ảnh `public/portraits/<nơi>.webp` (không còn đường kẻ, mỗi ô
   384 px) và ghi danh sách vào `src/features/town/portraitFiles.ts`. Nó in ra mỗi người được mấy vẻ mặt, ô nào trống.
   Ảnh để chỗ khác thì: `npm run portraits -- --from "D:\Downloads\avatar"`. Script dùng Microsoft Edge (có sẵn trên
   Windows) để cắt ảnh, không tải gì thêm.

Khi script báo "một mặt" cho một ảnh lưới (không thấy đường kẻ, ví dụ AI vẽ các ô dính nhau), đổi tên thành
`<tên>-luoi.png`: script chia đều 3 phần mỗi chiều. Muốn sửa riêng một mặt mà không vẽ lại cả lưới: vẽ một ảnh lẻ, đặt
tên `<tên>-cuoi.png`, `-buon`, `-ngai`, `-ngac`, `-camdong`, `-doi`, `-suynghi` hoặc `-lolang`, chạy lại; mặt đó thay vào
đúng ô của nó, các ô khác giữ nguyên.

Mẹo: bản miễn phí giới hạn số ảnh mỗi ngày, làm dần, dùng cả Gemini lẫn ChatGPT cũng được. Đây là nhân vật riêng
của app: đừng bảo AI vẽ "giống Stardew" hay giống nhân vật của game nào, chỉ tả như dưới đây.

## Thứ tự 9 ô

| Ô | Vẻ mặt | Khi nào hiện |
|---|---|---|
| 1 | Bình thường | lúc nghe, mặc định |
| 2 | Cười | trả lời đúng, quà thích |
| 3 | Buồn | trả lời sai |
| 4 | Ngại ngùng | tăng thiện cảm sau một cuộc trò chuyện / một tập, quà rất thích, câu ngọt khi hẹn hò, tỏ tình |
| 5 | Bất ngờ | lúc được cầu hôn |
| 6 | Cảm động | nhận lời tỏ tình / cầu hôn, đám cưới |
| 7 | Dỗi | quà không thích, câu vụng khi hẹn hò, đưa sai món ở quầy cà phê |
| 8 | Suy nghĩ | nhân chứng trong Vụ án lúc đang kể lại |
| 9 | Lo lắng | khách ở quầy cà phê sắp hết kiên nhẫn; nhân chứng có lời bạn vừa nghe sót (đến khi nghe lại) |

Thiếu ô nào (AI vẽ hỏng, ô trống) thì app dùng vẻ mặt gần nhất: cảm động → ngại → cười; ngại → cười; dỗi → buồn;
lo lắng → buồn; suy nghĩ → bình thường; bất ngờ → bình thường.

Chỉ 9 ô, không 12: ảnh vuông 3 × 3 là kiểu chat AI vẽ ổn nhất. 12 ô thì mỗi mặt nhỏ lại (khoảng 250 px trên ảnh
1024 px) và AI hay vẽ lệch người hoặc lẫn thứ tự hơn.

## Khung chung

Trong file từng người, `<WHAT IS ON TOP OF THE HEAD>` là thứ dễ bị cắt nhất của người đó (búi tóc, đuôi ngựa, mũ,
kính trên đầu), `her/his` theo giới tính, và dòng `Character:` ở cuối là mô tả bên dưới.

```
Draw an original character expression sheet in the style of a modern anime visual novel.
One square image (1:1) divided into a 3 x 3 grid: nine equal square panels separated by clear white gutters,
with a thin white margin around the outside. No text, no numbers, no labels, no watermark, no logo.

Every panel shows the same character with an identical face, hairstyle, outfit and plain solid background color,
drawn at the same size and from the same distance: a bust shot from the mid-chest up, the face centered,
body turned slightly to the left (three-quarter view). The whole head always fits inside the panel with clear
empty space above it: <WHAT IS ON TOP OF THE HEAD> fully visible in all nine panels, never cut off or touching
the panel's top edge. Hands, when shown, stay inside the panel too.
Soft cel shading with gentle painted gradients, clean thin line art, detailed glossy anime eyes with highlights,
soft warm lighting with a subtle rim light, cozy pastel colors, attractive and friendly.
Adult character, wholesome, everyday clothes as described.

Panels, left to right, top to bottom:
1. Neutral: a gentle friendly smile, looking at the viewer.
2. Happy: a big happy smile, eyes closed in a cheerful curve (^ ^), a light blush.
3. Sad: a little sad and disappointed, eyebrows raised in the middle, a small downturned mouth,
   eyes glancing down. No tears.
4. Shy: a deep blush across the cheeks and nose, a soft embarrassed smile, eyes glancing away,
   one hand lightly touching her/his cheek.
5. Surprised: eyes wide and sparkling, eyebrows raised, a small open "oh" mouth,
   both hands raised close to her/his mouth.
6. Moved: glistening happy tears at the corners of the eyes, a warm trembling smile, a soft blush,
   hands held together at her/his chest.
7. Sulking: cheeks puffed, a small pout, eyebrows slightly knitted, looking to the side, arms folded.
   Still cute, not angry.
8. Thinking: curious, one hand on her/his chin, eyes glancing up, a small thoughtful smile.
9. Worried: nervous and unsure, eyebrows tilted up, a small awkward smile, a drop of sweat on the temple,
   one hand scratching the back of her/his head.

Character: <mô tả của người đó, ở dưới>
```

## Từng người

| Tên file | Người | Nơi |
|---|---|---|
| `leo.png` | Leo | Quảng trường |
| `emma.png` | Emma | Quán cà phê |
| `mia.png` | Mia | Nhà bạn |
| `grace.png` | Grace | Nhà |
| `ben.png` | Ben | Cửa hàng |
| `sarah.png` | Sarah | Văn phòng |
| `daniel.png` | Daniel | Trường học |
| `sam.png` | Sam | Bến xe |
| `kim.png` | Kim | Phòng khám |
| `zoe.png` | Zoe | Rạp phim |
| `max.png` | Max | Tiệm điện thoại |
| `lily.png` | Lily | Công viên |
| `tom.png` | Tom | Bảng tin |

**Leo** (`leo.png`)
```
Character: Leo, a warm, outgoing young man in his late twenties who welcomes every newcomer to a small town and
runs its clean-ups and lantern festival. Warm medium-brown skin, short curly dark-brown hair, amber eyes,
an easy open smile. Coral-orange hoodie with the hood down. Background: soft peach.
```

**Emma** (`emma.png`)
```
Character: Emma, a cheerful barista in her mid-twenties who remembers every customer's usual order.
Fair skin, chestnut-brown hair in a high ponytail tied with a pink ribbon, side-swept bangs, green eyes,
a bright friendly expression. Pink blouse under a mint-green café apron. Background: soft mint green.
```

**Mia** (`mia.png`)
```
Character: Mia, a playful, chatty young woman in her early twenties, the learner's best friend.
Light skin with a few freckles, glossy black hair in twin tails with pink hair ties, straight bangs, violet eyes,
a mischievous grin. Lilac T-shirt. Background: soft lavender.
```

**Grace** (`grace.png`)
```
Character: Grace, a kind elderly British lady in her seventies, a retired nurse who grows roses and treats
the neighbours like family. Fair skin with soft wrinkles, silver-grey hair in a neat bun, round glasses,
gentle blue-grey eyes, a warm motherly smile. Rose-pink cardigan over a white blouse. Background: soft blush pink.
```

**Ben** (`ben.png`)
```
Character: Ben, a good-humoured shopkeeper in his early thirties who jokes about everything and runs the shop
his dad opened. Light tan skin, short dark-brown hair, a neatly trimmed short beard, warm brown eyes,
a broad build, a playful grin. Cream shirt with a forest-green shop apron. Background: soft sage green.
```

**Sarah** (`sarah.png`)
```
Character: Sarah, a busy, capable office worker in her late twenties, confident and a little teasing.
Fair skin with light freckles, a sleek red bob haircut, teal eyes, a composed smart look. Navy blazer over a white
collared blouse. Background: soft teal.
```

**Daniel** (`daniel.png`)
```
Character: Daniel, a gentle British teacher in his early thirties who teaches an evening English class and has
been writing a novel for years. Deep brown skin, short neat black hair, round dark-framed glasses, warm dark-brown
eyes, a calm kind smile. Mustard-yellow sweater over a white shirt collar with a burgundy tie.
Background: soft butter yellow.
```

**Sam** (`sam.png`)
```
Character: Sam, a calm, reliable bus station attendant in his late twenties who has a dog named Chip.
Tan skin, short black hair under a navy transit cap with a gold band and badge, blue eyes, a quiet friendly look.
Navy uniform shirt with a gold tie. Background: soft cornflower blue.
```

**Kim** (`kim.png`)
```
Character: Kim, a caring young doctor in her late twenties with a teasing sense of humour who goes running at six
every morning. Light skin, black hair in a sleek ponytail with long side bangs, dark indigo-blue eyes,
a confident gentle smile. White doctor's coat over light-blue scrubs, a stethoscope around her neck.
Background: soft periwinkle.
```

**Zoe** (`zoe.png`)
```
Character: Zoe, a lively film lover in her mid-twenties who makes her own short films on her phone.
Warm brown skin, bright pink hair in a high space bun with loose strands, golden-amber eyes, an excited sparkle.
Yellow top with a small denim jacket collar visible. Background: soft pastel pink.
```

**Max** (`max.png`)
```
Character: Max, an easy-going Australian tech guy in his late twenties who fixes phones and makes repair videos.
Light skin with freckles, messy spiky sandy-blond hair, green eyes, a relaxed lopsided grin.
Charcoal-grey T-shirt with a small round teal logo. Background: soft leaf green.
```

**Lily** (`lily.png`)
```
Character: Lily, a sweet, slightly shy young woman in her mid-twenties who loves sunflowers and her new puppy.
Fair skin, long wavy strawberry-blonde hair with a pink flower headband, sky-blue eyes, a soft hopeful smile.
Light-green blouse. Background: soft sky blue.
```

**Tom** (`tom.png`)
```
Character: Tom, a cool, confident young man in his late twenties who organises the town fair and every event.
Deep brown skin, short spiky black hair with sunglasses pushed up on his head, amber eyes, a self-assured smirk.
Red hoodie. Background: soft coral red.
```
