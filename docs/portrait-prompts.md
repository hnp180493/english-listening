# Vẽ chân dung người dân bằng chat AI miễn phí

Avatar của 13 người dân Thị trấn là ảnh vẽ (nửa người, kiểu anime visual novel), tạo bằng Gemini (gemini.google.com)
hoặc ChatGPT bản miễn phí, rồi `npm run portraits` đưa vào app. Ai chưa có ảnh thì app vẫn dùng avatar 3D. Nhân vật
người chơi tự tạo luôn dùng avatar 3D (quá nhiều kiểu tóc / màu da để vẽ trước).

**Mỗi người có một file riêng, dán là xong: `docs/portraits/<tên>.md`** (`emma.md`, `leo.md`…). Mở file của người
cần vẽ, làm theo 3 bước trong đó. Phần dưới là bản gộp (cùng nội dung) để sửa phong cách cho tất cả một lần; sửa ở
đây thì tạo lại các file riêng cho khớp.

## Cách làm

1. Mở **một cuộc chat mới cho mỗi người** (để AI không lẫn người này với người kia).
2. Dán **Phong cách chung** rồi ngay dưới nó dán đoạn của người đó, gửi.
3. Ưng ảnh thì tải về, đặt tên theo cột "Tên file" (ví dụ `emma.png`). Chưa ưng thì bảo "vẽ lại" hoặc sửa một ý
   ("tóc dài hơn", "mắt xanh lá hơn").
4. Trong **cùng cuộc chat đó**, dán câu **Ảnh cười** (tải về thành `emma-cuoi.png`), rồi câu **Ảnh buồn** (`emma-buon.png`). Cùng một chat thì mặt giữ giống
   nhau hơn.
5. Bỏ tất cả ảnh vào thư mục `portraits-src/` ở gốc repo (thư mục này không lên git), rồi chạy:

   ```
   npm run portraits
   ```

   Script cắt ảnh thành hình vuông, thu về 512 px, lưu WebP vào `public/portraits/` và ghi danh sách vào
   `src/features/town/portraitFiles.ts`. Ảnh để chỗ khác thì: `npm run portraits -- --from "D:\Downloads\avatar"`.
   Script dùng Microsoft Edge (có sẵn trên Windows) để đổi ảnh, không tải gì thêm.

Mẹo: ảnh nên là hình vuông, mặt ở nửa trên, nền một màu trơn. Nếu chat cho ảnh chữ nhật thì script cắt giữa (ưu
tiên phần trên). Bản miễn phí giới hạn số ảnh mỗi ngày: làm dần, dùng cả Gemini lẫn ChatGPT cũng được. Đây là nhân vật
riêng của app: đừng bảo AI vẽ "giống Stardew" hay giống nhân vật của game nào, chỉ tả như dưới đây.

## Phong cách chung (dán trước mỗi người)

```
Draw an original character portrait in the style of a modern anime visual novel.
Square image (1:1). Bust shot from the chest up, the head in the upper half of the frame, the face centered,
body turned slightly to the left (three-quarter view), looking at the viewer.
Soft cel shading with gentle painted gradients, clean thin line art, detailed glossy anime eyes with highlights,
soft warm lighting with a subtle rim light, cozy pastel colors, attractive and friendly.
Plain solid background in one soft color (given below), no scenery, no text, no watermark, no border, no logo.
Adult character, wholesome, everyday clothes as described.
```

## Ảnh cười (dán sau, trong cùng cuộc chat)

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but with a big happy smile, eyes closed in a cheerful curve (^ ^), a light blush.
```

## Ảnh buồn (dán sau ảnh cười, vẫn trong cùng cuộc chat)

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but looking a little sad and disappointed: eyebrows raised in the middle, a small downturned mouth,
eyes glancing slightly down. Still gentle and cute, no tears.
```

App dùng ảnh bình thường lúc nghe, ảnh cười khi trả lời đúng, ảnh buồn khi trả lời sai. Thiếu ảnh cười hay ảnh buồn
thì app dùng ảnh bình thường.

## Bốn vẻ mặt thêm (cho cả 13 người)

Vẫn trong cùng cuộc chat, mỗi khung một ảnh (với nam, các file riêng đã đổi "her" thành "his"). App dùng chúng như sau:

| Ảnh | Tên file | Khi nào hiện |
|---|---|---|
| Ngại ngùng | `<tên>-ngai.png` | tăng thiện cảm sau một cuộc trò chuyện / một tập, nhận món quà rất thích, câu trả lời ngọt khi hẹn hò, lúc tỏ tình |
| Bất ngờ | `<tên>-ngac.png` | lúc được cầu hôn (người hẹn hò được) |
| Cảm động | `<tên>-camdong.png` | nhận lời tỏ tình / cầu hôn, đám cưới (người hẹn hò được) |
| Dỗi | `<tên>-doi.png` | nhận món quà không thích, câu trả lời vụng khi hẹn hò |

Thiếu ảnh nào thì app dùng ảnh gần nhất: cảm động → ngại → cười; ngại → cười; dỗi → buồn; bất ngờ → bình thường.

### Ngại ngùng

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but shy and smitten: a deep blush across the cheeks and nose, a soft embarrassed smile, eyes glancing slightly away,
one hand lightly touching her cheek. Sweet and charming.
```

### Bất ngờ

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but surprised and delighted: eyes wide and sparkling, eyebrows raised, a small open "oh" mouth,
both hands raised close to her mouth, a light blush.
```

### Cảm động

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but deeply moved and happy: glistening happy tears at the corners of the eyes, a warm trembling smile,
a soft blush, hands held together at her chest.
```

### Dỗi

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but playfully sulking: cheeks puffed, a small pout, eyebrows slightly knitted, looking to the side,
arms folded. Still cute, not angry.
```

## Từng người

| Tên file | Người | Nơi |
|---|---|---|
| `leo.png` / `leo-cuoi.png` | Leo | Quảng trường |
| `emma.png` / `emma-cuoi.png` | Emma | Quán cà phê |
| `mia.png` / `mia-cuoi.png` | Mia | Nhà bạn |
| `grace.png` / `grace-cuoi.png` | Grace | Nhà |
| `ben.png` / `ben-cuoi.png` | Ben | Cửa hàng |
| `sarah.png` / `sarah-cuoi.png` | Sarah | Văn phòng |
| `daniel.png` / `daniel-cuoi.png` | Daniel | Trường học |
| `sam.png` / `sam-cuoi.png` | Sam | Bến xe |
| `kim.png` / `kim-cuoi.png` | Kim | Phòng khám |
| `zoe.png` / `zoe-cuoi.png` | Zoe | Rạp phim |
| `max.png` / `max-cuoi.png` | Max | Tiệm điện thoại |
| `lily.png` / `lily-cuoi.png` | Lily | Công viên |
| `tom.png` / `tom-cuoi.png` | Tom | Bảng tin |

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
