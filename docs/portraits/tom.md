# Tom (Bảng tin)

Mở một cuộc chat MỚI với Gemini hoặc ChatGPT. Cần 7 ảnh, tất cả trong CÙNG cuộc chat này (để mặt giữ giống
nhau). Lười thì chỉ làm Bước 1 cũng được: thiếu ảnh nào thì app dùng ảnh gần nhất.

**Bước 1.** Dán nguyên khung dưới đây, gửi. Ưng thì tải ảnh về, đặt tên `tom.png`.
Chưa ưng thì bảo "vẽ lại" hoặc sửa một ý.

```
Draw an original character portrait in the style of a modern anime visual novel.
Square image (1:1). Bust shot from the chest up, the head in the upper half of the frame, the face centered,
body turned slightly to the left (three-quarter view), looking at the viewer.
Soft cel shading with gentle painted gradients, clean thin line art, detailed glossy anime eyes with highlights,
soft warm lighting with a subtle rim light, cozy pastel colors, attractive and friendly.
Plain solid background in one soft color (given below), no scenery, no text, no watermark, no border, no logo.
Adult character, wholesome, everyday clothes as described.

Character: Tom, a cool, confident young man in his late twenties who organises the town fair and every event.
Deep brown skin, short spiky black hair with sunglasses pushed up on his head, amber eyes, a self-assured smirk.
Red hoodie. Background: soft coral red.
```

**Bước 2.** Ảnh cười (trả lời đúng): dán khung này, gửi. Tải ảnh về, đặt tên `tom-cuoi.png`.

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but with a big happy smile, eyes closed in a cheerful curve (^ ^), a light blush.
```

**Bước 3.** Ảnh buồn (trả lời sai): dán khung này, gửi. Tải ảnh về, đặt tên `tom-buon.png`.

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but looking a little sad and disappointed: eyebrows raised in the middle, a small downturned mouth,
eyes glancing slightly down. Still gentle and cute, no tears.
```

**Bước 4.** Ảnh ngại ngùng (tăng thiện cảm, quà rất thích, câu ngọt khi hẹn hò, tỏ tình): dán khung này, gửi. Tải ảnh về, đặt tên `tom-ngai.png`.

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but shy and smitten: a deep blush across the cheeks and nose, a soft embarrassed smile, eyes glancing slightly away,
one hand lightly touching his cheek. Endearing and charming.
```

**Bước 5.** Ảnh bất ngờ (lúc được cầu hôn): dán khung này, gửi. Tải ảnh về, đặt tên `tom-ngac.png`.

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but surprised and delighted: eyes wide and sparkling, eyebrows raised, a small open "oh" mouth,
both hands raised close to his mouth, a light blush.
```

**Bước 6.** Ảnh cảm động (nhận lời, đám cưới): dán khung này, gửi. Tải ảnh về, đặt tên `tom-camdong.png`.

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but deeply moved and happy: glistening happy tears at the corners of the eyes, a warm trembling smile,
a soft blush, hands held together at his chest.
```

**Bước 7.** Ảnh dỗi (quà không thích, câu vụng khi hẹn hò): dán khung này, gửi. Tải ảnh về, đặt tên `tom-doi.png`.

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but playfully sulking: cheeks puffed, a small pout, eyebrows slightly knitted, looking to the side,
arms folded. Still cute, not angry.
```

**Bước 8.** Bỏ hết ảnh vào thư mục `portraits-src` ở gốc repo rồi chạy `npm run portraits`.
