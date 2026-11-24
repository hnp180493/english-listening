# Daniel (Trường học)

Mở một cuộc chat MỚI với Gemini hoặc ChatGPT. Cần 3 ảnh: bình thường (lúc nghe), cười (trả lời đúng), buồn (trả lời
sai). Lười thì chỉ làm Bước 1 cũng được: thiếu ảnh cười / buồn thì app dùng ảnh bình thường.

**Bước 1.** Dán nguyên khung dưới đây, gửi. Ưng thì tải ảnh về, đặt tên `daniel.png`.
Chưa ưng thì bảo "vẽ lại" hoặc sửa một ý.

```
Draw an original character portrait in the style of a modern anime visual novel.
Square image (1:1). Bust shot from the chest up, the head in the upper half of the frame, the face centered,
body turned slightly to the left (three-quarter view), looking at the viewer.
Soft cel shading with gentle painted gradients, clean thin line art, detailed glossy anime eyes with highlights,
soft warm lighting with a subtle rim light, cozy pastel colors, attractive and friendly.
Plain solid background in one soft color (given below), no scenery, no text, no watermark, no border, no logo.
Adult character, wholesome, everyday clothes as described.

Character: Daniel, a gentle British teacher in his early thirties who teaches an evening English class and has
been writing a novel for years. Deep brown skin, short neat black hair, round dark-framed glasses, warm dark-brown
eyes, a calm kind smile. Mustard-yellow sweater over a white shirt collar with a burgundy tie.
Background: soft butter yellow.
```

**Bước 2.** Trong CÙNG cuộc chat đó, dán khung này, gửi. Tải ảnh về, đặt tên `daniel-cuoi.png`.

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but with a big happy smile, eyes closed in a cheerful curve (^ ^), a light blush.
```

**Bước 3.** Vẫn trong CÙNG cuộc chat đó, dán khung này, gửi. Tải ảnh về, đặt tên `daniel-buon.png`.

```
Now draw exactly the same character again: same face, hair, outfit, pose, framing and background color,
but looking a little sad and disappointed: eyebrows raised in the middle, a small downturned mouth,
eyes glancing slightly down. Still gentle and cute, no tears.
```

**Bước 4.** Bỏ 3 ảnh vào thư mục `portraits-src` ở gốc repo rồi chạy `npm run portraits`.
