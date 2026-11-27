# Kinh truyện Hồi III: "Thành phố nghe thấy"

Viết 2026-11-27, cho chủ dự án đọc và cho các phiên dựng phi vụ dùng. Nối tiếp Hồi II như nó đã được XÂY
(`src/data/city/jobs/act2*.ts`, `docs/gta-story-2.md`, `docs/city.md` §19–20), không phải như dàn ý cũ. Đây là ĐỀ XUẤT:
chưa có gì thành canon cho tới khi chủ dự án giữ (phần canon ở `docs/city.md` §21, đánh dấu "nếu chủ dự án giữ").

**Đọc gì trước:** mục 2 (bảng "dấu vân tay lời nói": mọi trò thật / giả của hồi này dựa trên nó), rồi mục 3 (cả hồi trong
một trang), mục 6 (ba kết cục) và mục 7 (NEEDS ENGINE).

Quy ước như hai sổ trước: lời thoại tiếng Anh trong ngoặc kép, nghĩa tiếng Việt dưới (→) khi cần; ★ là câu mang chi tiết bị
kiểm; **[TT]** là câu của người thị trấn (một clip Gemini một câu, chỉ bản nối âm, chủ dự án tạo); mọi câu khác là giọng
trình duyệt. Người chơi không bao giờ được gọi bằng từ chỉ giới tính.

---

## 1. Hồi II để mọi người ở đâu

- **Bay FM là đài của người nghe** (Claire đứng tên, tiền góp từ Frank, Gianna, Hal, Nora và Theo). Nhưng Coastline Radio
  mới chỉ **tạm dừng** giá của Kemp "để điều tra", chưa ký bán: còn một kỳ xét lại. Chương trình đêm của Marcus trở lại.
- **Bà Delaney bị đình chỉ** vì Kemp khiếu nại. Băng mất người bạn ở Ban quản lý cảng.
- **Kemp còn giữ băng:** "Keep the tape. I have the rest." Hai mươi năm thành phố nói chuyện, những gì máy quét Bayline thu
  được, nằm ở chỗ hắn (một nửa số thùng ra tới cửa nước ở Kho 15 nếu người chơi tin cuộc gọi giả; dù sao phần lớn đã ở chỗ
  khác từ trước).
- **Gus** hết những đêm im lặng. **Tess** đã bỏ tiền mở quán vào tiền đặt cọc trạm gác. **Mã của hãng** vẫn là kênh mười ba,
  "Chip" là ga, "Grace's" là bệnh viện (`chip.ts`).
- Người chơi là **cộng sự của Rico** ("Rico and partner" trên hợp đồng thuê trạm gác), có chỗ ẩn sau chòi Gus, có điện thoại.

**Những gì Hồi III đọc được** (khóa đồng bộ `town-jobs`, điều kiện `past`):

| Đọc | Nghĩa | Hồi III dùng ở đâu |
|---|---|---|
| `job-warehouse:hit:trap` | người chơi tin cuộc gọi giả "kho năm mươi" | phi vụ 1: Tess nhắc ("lần trước giọng giả đã lừa được bà Delaney") |
| `job-farewell` (xong) / `job-farewell:hit:*` | Tom đã gọi lên đài cảm ơn Marcus | phi vụ 5: cuộc gọi THẬT của Tom là thứ để so |
| `job-three` (xong) | Sam đã chỉ đường ba chữ một lần qua điện thoại | phi vụ 3: "Sam ghét điện thoại" là điều người chơi đã nghe tận tai |
| `job-chip` (xong), `job-chip:crew:jun` / `crew:phone` | mật mã kênh mười ba, "Chip", "Grace's" | phi vụ 3: kẻ giả hỏi đúng cái mã đó |
| `job-dumplings:crew:phone` | máy ghi âm của Max đã từng nằm trong hộp há cảo | phi vụ 4: Max có băng giọng Shona để so |
| `job-link` (xong) | đã nghe câu thử "the kettle's on" của Kit | phi vụ 2: Kit nhận ra đoạn ghép từ băng talkback cũ |

---

## 2. Dấu vân tay lời nói (từ những câu ĐÃ CÓ trong game)

Ràng buộc cứng (`docs/gta-plan.md` §11 mục 6): người Westbay đều nói bằng **giọng trình duyệt**, giọng máy không có "thói
quen nói". Nên thật / giả phải nằm ở **CHỮ**, hoặc ở **một người thị trấn** bị nhại (clip Gemini của họ là thật, bản nhại là
giọng khác). Bảng dưới rút từ câu đã viết; mỗi thói quen có ít nhất hai câu làm chứng (file:dòng). Câu giả của Hồi III phạm
ĐÚNG MỘT thói quen trong bảng (để người chơi có một chỗ để bắt, không phải đoán mò), trừ những câu ghép (mục 2.3) phạm một
sự thật đã cũ.

Số đếm dưới đây là trên các câu đã có **trước** Hồi III (`src/data/city/**`, `src/data/scenes/**`), không tính câu của
hồi này.

### 2.1 Rico (giọng trình duyệt)

| Thói quen | Chứng cứ | Hồi III dùng |
|---|---|---|
| Nói nửa giờ là **"half nine"**, không bao giờ "nine thirty" | 2 câu "half …" (`channels.ts:35`, `:38`), 0 câu "… thirty" | ★ phi vụ 1 (tin nhắn giả nói "nine thirty"), ★ phi vụ 6 (Lyle nói lại đúng chữ đó) |
| Gọi người chơi là **"partner"** | 9 câu | Shona dạy Lyle nói "partner" (phi vụ 4), nên ở phi vụ 6 chữ này KHÔNG còn là chỗ lộ |
| **Nói nhiều**, không bao giờ nói gì một lần | Gus: "He never says anything just once" (`tess.ts:37`); Tess: "Rico talks enough for all three of us" (`tess.ts:83`); ông của Rico: "you talk too much, son" (`episodesA.ts:104`) | tin nhắn giả ở phi vụ 1 ngắn và cụt ("Thanks, Tess. Bye."): chỗ lộ thứ hai, dùng ở lựa chọn "Gọi cho Rico hỏi đã" |
| Bộ đàm: "Rico on thirteen", "Over", "Copy" | `chip.ts`, `channels.ts` | ★ phi vụ 6: đoạn ghép "Rico on thirteen" là băng cũ (hãng đã sang kênh mười bốn ở phi vụ 3) |
| "Not pretty, but we got there" | kết của Hồi I | lời kết messy của phi vụ 3, 6 |
| Không bao giờ "dear", "Goodnight" | 0 câu | (giữ, chưa dùng làm chỗ lộ) |

### 2.2 Marcus (giọng trình duyệt)

| Thói quen | Chứng cứ | Hồi III dùng |
|---|---|---|
| Gọi người nghe là **"Westbay"** | 37 câu | ★ phi vụ 2: đoạn nhại chào "Evening, everybody" |
| Không bao giờ "partner", "mate"; "dear" chỉ ở đầu thư ("Dear Marcus", `episodesD.ts:277`) | 0 câu | ★ phi vụ 2: đoạn nhại có "mate" |
| Chào theo giờ trong ngày, "This is Bay FM" | `radio.ts` | câu mở của mọi lần lên sóng |
| Tự biết mình nói khác khi không có micro: "Sorry, I sound different without the microphone" | `episodesD.ts:239` | (để dành: nếu sau này giọng Marcus là clip, đây là lý do bản ghi ngoài sóng nghe khác) |
| "Kit says I talk too much on these messages" | `act2Sale.ts:32` | (giữ) |

### 2.3 Câu ghép: sự thật đã cũ

Băng ghép dùng chữ thật của chính người đó, nên không phạm thói quen nào. Chỗ lộ là **một sự thật đã đổi**:

| Sự thật bây giờ | Chứng cứ | Băng cũ nói | Phi vụ |
|---|---|---|---|
| Chuyến số 9 cuối về thị trấn chạy lúc **mười giờ mười lăm** | `radio.ts:329` ("still goes at ten fifteen"), `radioCalls.ts:68`, `chats.ts:24`, `chats.ts:589`, `events.ts:201` | "leaves at ten" (lịch cũ, nhiều năm trước: canon mới, `docs/city.md` §21) | ★ 2 |
| Hãng của Rico ở **kênh mười bốn** | phi vụ 3 của hồi này | "Rico on thirteen" | ★ 6 |

### 2.4 Sam (người thị trấn: clip Gemini thật [TT]; bản nhại `sam-fake` là giọng trình duyệt)

| Thói quen | Chứng cứ | Hồi III dùng |
|---|---|---|
| **Ghét điện thoại, nói ba chữ một lần** | "I hate the phone. Fine. Three words." (`three.ts:40`), "Don't. Tell. Mom." (`three.ts:93`); bà Okafor: "He says three words, I say three numbers" (`chats.ts:29`) | ★ phi vụ 3: "Sam" giả nói câu dài, trơn |
| Người Mỹ: "Mom", "favorite", "buddy" | `three.ts` | bản giả cũng nói "mom", "buddy" (kịch bản của Shona học đúng chữ, sai nhịp): chữ Mỹ KHÔNG phải chỗ lộ |
| Con chó tên **Chip** | `docs/city.md` ("Sam has a dog, Chip"); "Chip" là ga vì chó của Sam ngồi đó (`chip.ts:39`) | ★ phi vụ 3: bản giả trả lời "Buddy"; Bayline nghe "Chip" mấy tháng mà không biết đó là con chó (`chip.ts:82–83`) |

### 2.5 Tom (người thị trấn: clip Gemini thật [TT]; bản nhại `tom-fake` là giọng trình duyệt)

| Thói quen | Chứng cứ | Hồi III dùng |
|---|---|---|
| **Ghét nói trước đám đông, dở điện thoại** | "I'm no good on the phone. You know that." (`act2Farewell.ts:26`); `docs/city.md`: hates speaking in public | ★ phi vụ 5: "Honestly, I love talking on the radio" |
| "Um", "Sorry", "Honestly?" | lời Tom trong thị trấn | bản thật ở cả ba đoạn có "um"; bản giả không có |
| Viết thư; bức đầu tiên năm chín tuổi: bốn dòng và một hình vẽ xe buýt | `docs/city.md` §17 | phi vụ 5: Tom thật nhắc "lá có cái xe buýt" |

### 2.6 Những người khác (không bị nhại trong hồi này, nhưng lời của họ phải giữ đúng)

- **Kemp:** "Goodnight" (7 câu), "Lovely", "by the way" (`act2Sale.ts:55`, `act2Dumplings.ts:57`), "Mr / Mrs" + họ, không bao
  giờ chấm than. *Chi tiết cài:* "Sam" giả ở phi vụ 3 nói "by the way": chữ của Kemp lọt vào kịch bản Shona viết. Không
  chấm điểm, chỉ để người nghe kỹ thấy.
- **Tess:** khô, ngắn, hay hỏi lại, cà phê. **Gus:** "mate", "Gus here". **Bà Delaney:** nói đủ chữ, "Noted.", không
  chấm than. **Jun:** gọi máy móc là "she". **Mei:** "dear", "If it's urgent, it's lying" (`events.ts:153`).
- **Lyle Penn** (mới): diễn viên lồng tiếng thuê từ nơi khác, áo xám. Giọng thật của hắn trơn và lịch sự, hơi chán việc
  ("This is the worst job I've ever had").


---

## 3. Cả hồi trong một trang

**Kemp muốn gì bây giờ.** Hắn không còn đài, nhưng giá của hắn chỉ bị tạm dừng. Kỳ xét lại của Coastline hỏi một câu:
"bên người nghe có trung thực không?" Kemp sẽ cho Coastline, và cả thành phố, nghe **những cuộn băng cho thấy họ nói dối**:
Rico bảo Tess đem sổ sách và chìa khóa trạm gác cho người lạ; Marcus thừa nhận giữ tiền góp; Sam đòi mã bộ đàm của hãng; Tom
nói những lá thư là Marcus tự viết. Không cuộn nào thật.

- **Hợp pháp trên giấy:** một cuộn băng gửi tới hội đồng xét lại không phạm luật nào; nếu nó giả thì người gửi có thể bảo là
  "nhận được từ người lạ". Hắn không đứng tên cuộn nào: tất cả đi qua một tần số không người nhận (đài lậu) và qua những
  cuộc gọi mạo danh.
- **Làm bằng hai cách** (đây là chỗ kỹ năng nghe thành trò thám tử):
  1. **Ghép** từ hai mươi năm băng thật: mỗi chữ là chữ thật của người đó, nhưng ghép lại thì lộ một **sự thật đã cũ** (giờ
     chuyến xe cuối hồi trước, lời giới thiệu đài khi Bayline còn tài trợ, tên chương trình đã đổi).
  2. **Nhại** do một người đọc lời Shona viết: một diễn viên lồng tiếng thuê từ thành phố khác, **Lyle Penn** (mới, giọng trình
     duyệt). Anh ta bắt chước giọng được, nhưng kịch bản là của Shona: nó phạm **thói quen nói** của người bị nhại (bảng mục 2).
- **Vì sao không thắng bằng cách bắt quả tang:** không có quả tang. Thắng là **cho thành phố nghe ra**: phát cạnh nhau cái thật
  và cái giả, chỉ đúng chữ lộ, để người nghe tự nghe thấy. Tên hồi là vậy.
- **Không bạo lực, không súng.** Kemp không bị bắt. Cái hắn mất là lòng tin của Coastline và của thành phố.

**Đường đi của hồi** (sáu phi vụ, khoảng hai tuần trong truyện, tới buổi phát sóng trực tiếp của kỳ xét lại):

| # | Phi vụ | Ai mời | Băng giả | Người chơi bắt bằng | Giữ lại được |
|---|---|---|---|---|---|
| 1 | **Tin nhắn không phải của Rico** (`job-forged`) | Tess | tin nhắn thoại "Rico" bảo Tess đem sổ và chìa khóa cho người của Ban quản lý cảng | một thói quen của Rico (mục 2.1), nút "Đó!" | Tess (cờ `kept-tess`) |
| 2 | **Hai Marcus** (`job-twomarcus`) | Marcus | "Marcus" trên đài lậu nhận giữ tiền góp | ba đoạn không chữ: chọn đúng Marcus của tối nay; "Đó!" ở sự thật đã cũ | Marcus (`kept-marcus`) |
| 3 | **Sam không gọi điện** (`job-samcall`) | Rico | "Sam" gọi máy số hai xin mã bộ đàm | câu hỏi chỉ Sam thật trả lời được (cách của Mei); giọng: clip của Sam thật [TT] | mã của hãng (`code-safe`) |
| 4 | **Phòng ghép băng** (`job-splice`) | Jun | tìm chỗ làm băng | nghe lén Shona và Lyle tập; ghi giờ, đoạn, tần số sẽ phát trong buổi trực tiếp | kế hoạch (`knows-plan`) |
| 5 | **Tom gọi lên đài** (`job-tomcall`) | Marcus | "Tom" gọi vào chương trình nói thư là giả | thói quen của Tom; giọng: clip của Tom thật [TT] | Tom (`kept-tom`) |
| 6 | **Phát sóng trực tiếp** (`job-live`) | Marcus | Lyle gọi vào "là Rico"; đài lậu phát chèn | ba mạch cùng lúc; "Đó!"; chọn đúng đoạn; người chơi nói một câu trên sóng | (kết cục, mục 6) |

**Thứ tự.** Phi vụ 1 mở sau `job-warehouse`. Phi vụ 2–5 làm theo thứ tự nào cũng được sau phi vụ 1. Phi vụ 6 mở khi xong cả
năm (`afterAll`).

**Cái bẫy cũ trả lần cuối.** Hồi II: giọng giả gọi "kho năm mươi". Hồi III: cả hồi là giọng giả, và lần này người chơi không
chỉ bắt được một cuộc gọi mà dạy cả thành phố cách bắt.

---

## 4. Sáu phi vụ: dàn ý

Cả sáu đã viết thành dữ liệu (`src/data/city/jobs/act3*.ts`, thứ tự 20, 24–28; 21–23 và 31–33 là việc phụ của bà Okafor
và giáo sư). Từng câu thoại ở trong file; dưới đây là cái nghe, cái trả lời bằng hành động, hệ quả và chỗ nối lại. Cả sáu
**chỉ dùng mảnh bộ máy đã có**; những gì còn thiếu để chơi trọn ý nằm ở mục 7.

### 4.1 Tin nhắn không phải của Rico (`job-forged`, sau `job-warehouse`, Tess mời) — `act3Forged.ts`, 40 câu

1. Xe cà phê của Tess. Nếu `job-warehouse:hit:trap`: "A fake Gus nearly sent Mrs Delaney to warehouse fifty. Remember?"
2. **Tin nhắn thoại** (notebook `via: 'voicemail'`): "Rico" bảo Tess đem sổ sách và chìa khóa trạm gác cho ông **Clarke** của
   Ban quản lý cảng, ở **quầy bán vé** nhà ga Trung tâm, ★ "Be there at **nine thirty**". Ghi hai mục: chỗ (quầy bán vé /
   phòng đồ thất lạc / bến taxi), tên (Clarke / Clark / Black).
3. **"Đó!"** khi nghe lại: đúng ở "nine thirty".
4. **Ý định** với Tess: "Không phải Rico, anh ấy nói half nine" hoặc "Gọi Rico hỏi đã" (đúng, cờ `kept-tess`); "Là Rico, mang
   sổ đi" (sai).
5. Rico thật gọi: "I didn't ring Tess. I've been on the ferry run since five."
6. Tới chỗ đã ghi, gặp **người áo xám** (Lyle Penn): "Clarke, Harbour Trust. Mrs Delaney's office." Bà Okafor: "Mrs
   Delaney's suspended, love." Hắn bỏ đi. Có Mei: "Walked off very fast for a man who made a mistake, dear."

| Mục nghe sai | Hệ quả | Nối lại |
|---|---|---|
| chỗ | tới nhầm cửa ở nhà ga | Tess chỉ quầy bán vé, ngay bên cạnh |
| tên | hỏi nhầm người ở quầy | bà Okafor chỉ người áo xám |
| "Đó!" sai | chưa chỉ ra chữ lộ | Tess nghe lại, tự thấy "nine thirty" |
| tin là Rico | Tess mang sổ, người áo xám cầm được sổ | Rico gọi kịp; sổ chỉ có tiền cuốc tuần trước |

Người đi cùng: **Mei** (mở khi đã nghe `ct-mei-2`, phần chia "friend"), đứng ở quầy bán vé.

### 4.2 Hai Marcus (`job-twomarcus`, sau `job-forged`, Marcus mời) — `act3TwoMarcus.ts`, 42 câu

1. Marcus và Kit: "There is a Marcus on the radio at night, and it is not me." Nếu `past: 'job-link'`, Kit: "Remember my
   kettle test? Somebody's been through our old tapes with scissors."
2. **Jun qua bộ đàm** (notebook `via: 'radio'`): tần số **ninety-one point five** (91.5 / 91.9 / 99.5), nghe rõ nhất ở **sạp cá
   của Hal** (Hal / Sol / Bo).
3. Đỗ ở chỗ đã ghi. Hal: "Every word of it is his. But something in it is old." **"Đó!"** trên đài lậu: ★ "the last number
   nine tonight leaves at **ten**" (lịch cũ; bây giờ là mười giờ mười lăm).
4. Ở bàn của Kit: **ba đoạn không chữ** (pick): Marcus tối nay ("Evening, Westbay … ten fifteen"), băng cũ ("… ten
   o'clock"), bản nhại ("Evening, everybody … ten fifteen, mate").
5. **Ý định** với Marcus: "Phát cả hai cạnh nhau" hoặc "Tìm cuộn gốc rồi phát cả hai" (đúng, `kept-marcus`); "Im lặng"
   (sai: Claire gọi, Hal đã rút hai mươi đô).
6. Tối đó trên sóng: "Two tapes tonight. Listen to both, then decide."

| Mục | Hệ quả | Nối lại |
|---|---|---|
| tần số | dò trúng đài bệnh viện | Jun gọi chỉ lại |
| chỗ đỗ | chỉ nghe tiếng rè | Jun chỉ tới sạp Hal |
| "Đó!" | chưa chỉ ra câu đã cũ | Kit nghe lại, chỉ "ten" |
| đoạn | chọn nhầm | Kit chỉ đoạn giữa |
| im lặng | ba người rút tiền góp | Claire gọi; Marcus phát cả hai ngay tối đó |

Người đi cùng: **Kit** (`ct-kit-2`), nhắc nghe cách Marcus chào.

### 4.3 Sam không gọi điện (`job-samcall`, sau `job-forged`, Rico mời) — `act3SamCall.ts`, 42 câu, 6 câu [TT]

1. Văn phòng (chòi Gus đứng thay trạm gác cũ). Rico: "Says it's Sam. Sam never rings anybody." Nếu `past: 'job-three'`:
   "You've heard him on a phone. Three words at a time, remember?"
2. **Cuộc gọi** của "Sam" (`sam-fake`): bốn câu dài, trơn; xin kênh bộ đàm và chữ mã của nhà ga; cuối câu lọt "by the way"
   của Kemp.
3. Có Mei: "If it's urgent, it's lying, dear. Ask him something only he knows."
4. **Ý định** với Rico: "Không phải Sam: ba chữ một lần" (đúng, `code-safe`); "Hỏi tên con chó" (đúng, `asked-dog`: Rico
   hỏi, bản giả đáp "Buddy"); "Là Sam, cho kênh" (sai: Bayline nghe trên bộ đàm "Chip is the station").
5. **Ba cuộc gọi không chữ** (pick): hai cuộc của `sam-fake`, một của Sam thật [TT] "Bus. Late. Sorry."
6. Sam thật gọi [TT]: "Sam. Didn't call. Promise." **Mã mới** (notebook qua điện thoại): kênh **fourteen** (14 / 40 / 4), chữ
   cho nhà ga **Biscuit** [TT] (Biscuit / Basket / Brisket), "Chip's favorite".
7. Thử mã trên bộ đàm: "Car two, pick up at Biscuit". Tới nhà ga; bà Okafor: "Sam rang me at noon. Three numbers, three
   words."

| Mục | Hệ quả | Nối lại |
|---|---|---|
| tin là Sam | Bayline biết "Chip" là nhà ga | Rico đổi mã ngay hôm đó |
| cuộc gọi | chọn nhầm | Rico chỉ ra cuộc ba chữ |
| kênh | lên kênh không ai nghe | Rico gọi chỉ kênh mười bốn |
| chữ | không biết "Biscuit" là đâu | Rico nhắc: là nhà ga |

Người đi cùng: **Mei** (`ct-mei-2`).

### 4.4 Phòng ghép băng (`job-splice`, sau `job-forged`, Jun mời) — `act3Splice.ts`, 48 câu, 2 câu [TT]

1. Jun lần theo 91.5 tới phòng sau trên tiệm **Twin Ovens**. Poppy: phòng cho "a lady in a navy blazer" thuê, trả tiền mặt.
2. **Nghe lén dưới cửa sổ** (overhear, hai lượt, Shona đứng ở cửa sổ): Shona dạy Lyle làm Rico ("Twice. Rico says
   everything twice. And say partner") và Tom ("Tom says um. Tom says sorry"); ★ "When Marcus says **lines are open**,
   you ring in."
3. **Gõ lại hiệu lệnh** cho Jun (password: "lines are open").
4. **Máy không dây của Shona** trên máy quét của Jun (notebook `via: 'radio'`): Lyle gọi vào **đường dây mười ba** (13 / 30 /
   3), buổi xét lại vào **thứ Sáu** (thứ Sáu / Chủ nhật / thứ Hai), "Lovely … Goodnight, Shona" (Kemp).
5. Kit, theo mục đã ghi. **Ý định**: "Để mở, cho Westbay nghe hắn" hoặc "Để mở và ghi âm" (đúng, `knows-plan`); "Cắt
   đường dây" (sai: hắn sẽ gọi đường khác).

| Mục | Hệ quả | Nối lại |
|---|---|---|
| hiệu lệnh | không nói lại được | Jun tự nói với Kit |
| đường dây | ghi sai số | Kit chỉ đường dự phòng, số mười ba |
| ngày | ghi sai | Kit chỉ bảng: thứ Sáu |
| cắt dây | sẽ không biết cuộc nào là hắn | Jun bảo nối lại; đèn đỏ cho đường mười ba |

Người đi cùng: **Max** (4 tim, đi xe): máy ghi âm dưới bậu cửa sổ [TT].

Manh mối: ai đã nghe quảng cáo Twin Ovens trên Bay FM (`ad-twin-ovens`: "knock at the back door from five") thì vào
bằng cửa sau, Poppy cho đứng cạnh bao bột, nghe buổi tập ba lượt thay vì hai.

### 4.5 Tom gọi lên đài (`job-tomcall`, sau `job-forged`, Marcus mời) — `act3TomCall.ts`, 45 câu, 12 câu [TT]

1. Phòng thu. Kit: "He'll ring again at three." Nếu `past: 'job-farewell'`: "You heard the real Tom ring us once. Same ears
   now."
2. **"Đó!"** trên sóng: "Tom" (`tom-fake`) ★ "Honestly, I love talking on the radio. I could do this all day."
3. **Ba cuộc gọi không chữ**: Tom thật [TT] "Um. Hi. It's Tom. Sorry, I'm no good at this." và hai cuộc trơn tru của bản giả.
4. **Lá thư** Marcus đọc (notebook `via: 'scene'`): Tom lên chuyến **twelve forty** (12:40 / 12:14 / 2:40), gặp ở **tiệm hoa**
   ("flower": tiệm hoa của Nora / "flour": Twin Ovens / sạp cá của Hal, cá được nhắc ngay trong câu).
5. Tiệm hoa của Nora: Tom [TT]. **Ý định**: "Gọi lên, nói như anh vẫn nói" hoặc "Tới phòng thu tự nói" (đúng, `kept-tom`);
   "Viết thư" (sai: "He'd only say Marcus wrote it. That's the whole trick.", rồi Tom tự đổi ý).
6. Trên sóng [TT]: "Um. Hi, Marcus. It's Tom. The real one. Sorry." Marcus: "Four lines and a drawing of a bus."

| Mục | Hệ quả | Nối lại |
|---|---|---|
| "Đó!" | chưa chỉ ra câu không giống Tom | Kit: "Tom, loving the radio?" (luôn nói) |
| cuộc gọi | chọn nhầm | Kit chỉ cuộc có "um" |
| chuyến xe | tới ga sai giờ | bà Okafor chỉ chuyến 12:40 |
| chỗ hẹn | đứng nhầm sạp | người ở sạp chỉ sang tiệm Nora |
| viết thư | kẻ giả sẽ lại bảo Marcus viết | Tom tự đổi ý, gọi lên |

Người đi cùng: **Kit** (`ct-kit-2`), nhắc nghe tiếng "um".

### 4.6 Phát sóng trực tiếp (`job-live`, sau `job-forged` và cả bốn phi vụ kia, Marcus mời) — `act3Live.ts`, 50 câu, 2 câu [TT]

1. Phòng thu, thứ Sáu. Nếu `job-splice:knows-plan`: "Line thirteen has a red light on it." Không: "Every line is open
   tonight. We will have to listen to all of them."
2. **Thứ tự chương trình** (notebook `via: 'scene'`): Tom gọi **quarter past** (past / to / half), Rico thật ngồi **trong
   phòng thu** (phòng thu / sân khấu / ngoài đường).
3. **Ba mạch cùng lúc** (threads): *Trên sóng* (Claire đọc sổ, Tom [TT], Marcus "lines are open"), *Bàn đường dây* (Kit; có
   Tess thì Tess nói to; khóa: "Line thirteen is ringing"), *Ngoài đường* (Jun trong xe; có Max thì Max [TT]; khóa:
   "Ninety-one point five just came on").
4. **"Đó!"**: Lyle làm Rico, đã học "partner" và "nói hai lần", nhưng ★ "I'll hand the keys in at **nine thirty**" (Shona
   không biết chữ này; người chơi đã bắt nó ở phi vụ 1).
5. **Ba Rico không chữ**: Lyle ("nine thirty"), Rico thật ("Half nine … Ask Tess"), băng cũ ("Rico on thirteen": hãng đã
   sang kênh mười bốn ở phi vụ 3).
6. **Micro** (ý định, người chơi nói một câu trên sóng): "Đừng nghe giọng, nghe chữ" hoặc "Phát cạnh nhau, để thành phố tự
   nghe" (đúng, `words`); "Kemp làm hết, bắt hắn đi" (sai: Ashby "Can you prove that, on air? Then please do not say it.").
7. **Phán quyết** của Ashby qua điện thoại: mục 6.

| Mục | Hệ quả | Nối lại |
|---|---|---|
| giờ Tom | lỡ mấy chữ đầu của Tom | Kit giữ lại cuộc gọi |
| chỗ Rico | tìm anh ở ngoài | Rico gọi: ở trong phòng thu |
| đường mười ba (mạch) | Rico giả lên sóng trước khi Kit kịp ghi | Marcus vẫn giữ hắn trên sóng |
| đài lậu (mạch) | nửa bến cảng nghe nó trước | Max và Jun vẫn thu được |
| "Đó!" | chưa chỉ ra "nine thirty" | Marcus tự nhắc lại cho thành phố |
| Rico | chọn nhầm | Rico thật: "kênh mười ba là băng cũ" |
| micro | buộc tội không bằng chứng | Marcus làm cách chậm: hai cuộn cạnh nhau |

Người đi cùng: **Tess** (`ct-tess-2`, đứng ở cửa phòng thu) hoặc **Max** (4 tim, trong xe với Jun).

---

## 5. Thứ tự, cờ và những gì phi vụ để lại cho nhau

```
job-warehouse ─▶ job-forged ─┬─▶ job-twomarcus ─┐
                             ├─▶ job-samcall   ─┤
                             ├─▶ job-splice    ─┼─▶ job-live (afterAll)
                             └─▶ job-tomcall   ─┘
```

| Cờ (đọc bằng `past`) | Đặt khi | Đọc ở |
|---|---|---|
| `job-forged:kept-tess` | không để Tess đi (hai lựa chọn đúng) | `job-live`: đếm |
| `job-twomarcus:kept-marcus` | khuyên Marcus phát cả hai | `job-live`: đếm |
| `job-samcall:code-safe` hoặc `job-samcall:asked-dog` | mã của hãng không lọt | `job-live`: đếm |
| `job-splice:knows-plan` | để đường mười ba mở | `job-live`: đếm, và câu mở "red light" |
| `job-tomcall:kept-tom` | Tom tự nói | `job-live`: đếm |
| `job-live:words` | câu trên sóng đúng | (để dành cho hồi sau) |
| từ Hồi I–II: `job-warehouse:hit:trap`, `job-link`, `job-three`, `job-farewell` | | câu riêng ở phi vụ 1, 2, 3, 5 |

Cờ trong `town-jobs` là **hợp của mọi lượt chơi** (`core/town/jobProgress.ts`: chơi lại chỉ thêm cờ, không bao giờ bỏ; một
hệ quả đã dính thì dính mãi). Nên mỗi điều kiện "giữ được" là một CỜ, không bao giờ là "không dính hệ quả": người chơi lại
phi vụ 1–5 trước buổi phát sóng (nút "Chơi lại") và chọn đúng là **cứu được người đã mất**. Chủ ý, không phải lỗi.

---

## 6. Kết: buổi phát sóng trực tiếp và ba kết cục

Ba kết cục là **câu có điều kiện**, không phải mã mới: `Cond count` trên năm điều kiện `ACT3_KEPT` (`act3Live.ts`).

| Đếm được | Kết cục | Ashby nói | Thêm |
|---|---|---|---|
| **4–5** | Thành phố nghe ra | "Coastline has heard enough. The listeners' bid stands. Mr Kemp's is withdrawn." | Bà Delaney: "The Trust has asked me back. Noted, with thanks." Kemp: "Lovely show, Marcus. Truly. Goodnight." |
| **2–3** | Tạm giữ | "The listeners' bid stands, for now. We will listen again next year." | |
| **0–1** | Không ai biết ai nói dối | "Coastline cannot tell who is lying tonight. The sale is paused another month." | Rico: "Half the city heard nine thirty and believed it. Next time, partner." |

Lời kết của Rico và Marcus theo **hạng của chính buổi phát sóng** (sạch / lộn xộn / hỏng), chồng lên kết cục ở trên. Không
có kết cục nào có bạo lực, bắt bớ hay súng; Kemp không bị bắt, cái hắn mất là giá thầu và lòng tin. Không câu nào nói
người chơi đã "nghe như người bản xứ": câu cuối của Marcus là "Listen to the words. That's all we ask."

**Dữ liệu kết cục đọc:**

- Có sẵn: `town-jobs` → cờ của từng phi vụ (`past: '<job>:<flag>'`), hệ quả đã dính (`past: '<job>:hit:<id>'`), người đi
  cùng (`past: '<job>:crew:<who>'`), phi vụ đã xong (`past: '<job>'`).
- **Chưa đọc được** (mục 7): **heat** (chỉ ở trong bộ nhớ), **hạng** của một phi vụ trước (lưu `best` trong `town-jobs`
  nhưng `Cond` không có cách hỏi), **niềm tin của băng** (số lần một người đã đi cùng qua cả ba hồi).

Đề xuất khi có ba thứ đó: heat ≥ 6 lúc bắt đầu buổi phát sóng → xe tuần tra đậu ngoài phòng thu, Ashby thêm "And I am told the
police are outside your studio, Marcus." (kết cục tụt một bậc, không bao giờ dưới "Tạm giữ" nếu đếm được 4–5); băng đã đi cùng
≥ 3 lần trong Hồi III → một câu của người đó trong lời kết.

---

## 7. NEEDS ENGINE

Cả sáu phi vụ chạy được bằng bộ máy hiện có. Những thứ dưới đây làm chúng đúng ý hơn; mỗi mục nói `jobDoc` / `useCityJob` cần
gì. Không mục nào bắt buộc trước khi chủ dự án chơi thử.

1. **Heat trong điều kiện.** `Cond { heat: { min?, max? } }`, đọc heat lúc bước bắt đầu (`jobs/heatStore.ts`, hiện chỉ ở
   trong bộ nhớ). Cho buổi phát sóng (mục 6) và cho bất kỳ phi vụ nào muốn "đang bị truy thì cảnh khác". Nếu heat phải sống qua
   lần tải lại, nó cần một chỗ trong `town-jobs` (ví dụ `heatAt: { value, at }` gộp theo thời điểm muộn hơn).
2. **Một thân cho Lyle Penn.** Hắn có giọng (`SCENE_VOICES.lyle`) mà không có hình: thêm `lyle` vào `JOB_CAST_LOOKS`
   (`features/town/jobs/jobCast.ts`: áo khoác xám dài, tóc nâu chải gọn, không phù hiệu) và một chỗ đứng mặc định. Khi có,
   phi vụ 1 nên để hắn đứng cạnh bảng giờ tàu (`scene.who: ['lyle']`) và phi vụ 4 cho hắn đứng sau cửa sổ (`overhear.who:
   ['shona', 'lyle']`).
3. **Câu giả lộ mặt ở phần tổng kết.** Câu giả hiện dùng id của người bị nhại (`who: 'rico'` cho tin nhắn của phi vụ 1, `'marcus'`
   cho băng ghép) hoặc `sam-fake` / `tom-fake` (tên hiện "Sam", "Tom"). Cần `JobLine.as?: string` (người nói thật) để: (a)
   thẻ ôn tập và phần tổng kết ghi "Lyle Penn (nhại Rico)" / "băng ghép" sau khi chơi xong, (b) dải phụ đề trong lúc chơi vẫn
   hiện tên người bị nhại. Không đổi gì khi thiếu `as`.
4. **Hạng của phi vụ trước trong điều kiện.** `Cond { grade: '<job>', min: 'messy' }` đọc `best` của `town-jobs`. Cho "niềm tin
   của băng" (mục 6) mà không phải đếm từng cờ.
5. **Kết cục được ghi lại.** Buổi phát sóng nên để lại cờ kết cục (`job-live:end-best` / `end-middle` / `end-worst`) để hồi sau
   đọc. Hiện một lựa chọn ý định chỉ đặt được MỘT cờ, và cờ không đặt được từ một `Cond`. Đề xuất: bước `flag { set, if }`
   (đặt cờ khi điều kiện đúng, không nói gì).
6. **Tần số trên radio xe.** Đài lậu 91.5 hiện chỉ có trong phi vụ (bước `radio`). Nếu chủ dự án muốn: nút "Radio" trong xe
   (`scenes/CarRadio.tsx`) có thêm một kênh chỉ mở trong Hồi III, phát lại cuộn băng ghép, có câu hỏi như Bay FM.
7. **Người chơi nói trên sóng.** Bước micro ở phi vụ 6 là một ý định; câu của người chơi được nói bằng giọng trình duyệt khi
   `PLAYER_VOICE` bật (đang chờ chủ dự án). Nếu tắt: câu hiện ra, không ai nói. Không cần gì mới, nhưng là chỗ quyết định đó
   nặng nhất.
8. **Đoạn chọn có hai loại sai.** Ở bước `pick` của phi vụ 2 và 6, một đoạn sai là băng ghép, một là bản nhại. Phần tổng kết
   hiện chỉ nói "chọn nhầm". Nếu `pick` nhận `why?: Record<clipId, lineId>` (một câu giải thích cho từng đoạn sai), người chơi
   học được hai cách lộ khác nhau. Hiện dùng một câu chung của Kit / Rico (`k04`, `p02`).

---

## 8. Đếm câu và clip

| Phi vụ | Câu | Câu của người thị trấn [TT] | Giọng mới |
|---|---|---|---|
| 1 `job-forged` | 40 | 0 | Lyle (`lyle`) |
| 2 `job-twomarcus` | 42 | 0 | Lyle |
| 3 `job-samcall` | 42 | 6 (Sam) | `sam-fake` |
| 4 `job-splice` | 48 | 2 (Max) | Lyle |
| 5 `job-tomcall` | 45 | 12 (Tom) | `tom-fake` |
| 6 `job-live` | 50 | 2 (Tom 1, Max 1) | Lyle |
| **Cộng** | **267** | **22 clip, khoảng 900 ký tự** | |

Hai mươi hai clip nằm trong kho `cityJobs` tự động (chỉ bản nối âm, giọng của từng người); chưa tạo. Tới khi chủ dự án chạy
`npm run audio:generate`, Sam, Tom và Max nói bằng giọng trình duyệt: chữ vẫn phân biệt được thật / giả (mục 2.4–2.5), giọng
thì chưa.

---

## 9. Canon thêm vào `docs/city.md`

Đã viết ở `docs/city.md` §21 (đánh dấu "nếu chủ dự án giữ").

---

## 10. Câu hỏi cho chủ dự án (mỗi câu có một bản nháp đã chọn, việc không phải chờ)

1. **Kemp đánh trả bằng băng giả** có hợp không, hay quá "thám tử"? *Nháp đã chọn:* giữ. Nó biến đúng kỹ năng của app (nghe
   ra một chữ) thành cốt truyện, và cấm hẳn đường thắng bằng bạo lực.
2. **Người chơi nói một câu trên sóng** ở phi vụ 6: giữ dù `PLAYER_VOICE` chưa quyết? *Nháp:* giữ; khi tắt giọng, câu chỉ hiện
   ra (như mọi ý định khác).
3. **Bà Delaney được mời lại** trong kết cục tốt nhất? *Nháp:* có. Hồi II để bà bị đình chỉ vì người chơi; trả lại cho bà là
   phần thưởng đúng của việc nghe kỹ.
4. **Hai mươi hai clip** của Sam, Tom, Max cần tạo; cộng với 93 clip của Hồi I–II còn chờ. *Nháp:* chạy chung một lần khi tiện.
5. **Lịch cũ "chuyến cuối lúc mười giờ"** là canon mới (vài năm trước). Có muốn một người khác (bà Okafor) nói câu đó ở đâu
   đó trong thành phố trước Hồi III, cho công bằng với người chơi? *Nháp:* chưa thêm; Kit nói ra ngay sau "Đó!", và câu "still
   goes at ten fifteen" trên Bay FM (`radio.ts:329`) đã gợi.
6. **Nhân vật mới chỉ có một**: Lyle Penn. Kemp, Shona, Ashby, bà Delaney dùng lại. *Nháp:* đủ.

**Chưa ai đọc, nghe hay chơi** 267 câu này. Câu và nghĩa tiếng Việt do mô hình (Opus) viết; 164 chuỗi giao diện tiếng Anh do
cùng phiên viết. Mọi phi vụ chỉ qua kiểm tra nội dung (`wellFormed`, câu 3–16 từ, an toàn cho SAPI, không chép câu cũ, mỗi
lựa chọn người đi cùng tự chơi trọn); chưa chạy bằng script trong trình duyệt như Hồi II.
