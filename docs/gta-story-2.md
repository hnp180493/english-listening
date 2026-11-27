# Kinh truyện Hồi II: "Băng bến cảng"

Viết 2026-11-27, cho chủ dự án đọc và cho các phiên viết phi vụ dùng. Đây là ĐỀ XUẤT: chưa có dòng code nào, chưa có
gì thành canon cho tới khi phi vụ được xây (phần canon cần thêm ở mục 9, đánh dấu "Act II"). Nối tiếp Hồi I như nó đã
được XÂY (`src/data/city/jobs/*.ts`, `docs/gta-story.md` §8, `docs/gta-plan.md` §13–16), không phải như dàn ý cũ.

**Đọc gì trước:** mục 6 (phi vụ "Hộp há cảo" viết đủ từng câu, mọi nhánh: nó cho thấy chọn người đi cùng đổi kiểu nghe
thế nào). Rồi mục 3 (cả hồi trong một trang) và mục 2 (băng nhóm).

Quy ước như Hồi I: lời thoại tiếng Anh trong ngoặc kép, nghĩa tiếng Việt dưới (→); ★ là câu mang chi tiết bị kiểm;
**[TT]** là câu của người thị trấn (một clip Gemini một câu, chỉ bản nối âm, chủ dự án tạo); mọi câu khác là giọng
trình duyệt. Người chơi không bao giờ được gọi bằng từ chỉ giới tính.

---

## 1. Hồi I để mọi người ở đâu

**Những gì đã xảy ra, theo các phi vụ đã xây:**

- **Hãng của Rico** có trạm gác cũ ở cổng cảng: Ban quản lý cảng cho "Rico and partner" thuê, tên người chơi trên hợp đồng
  (`hearing.ts`). Ba xe: Rico, Tess, Theo (`docs/city.md` §15). Bộ đàm của hãng ở **kênh mười ba**, có mật mã của Max:
  "Chip" là ga, "Grace's" là bệnh viện (`chip.ts`); Bayline chưa bao giờ giải được.
- **Tess** đã bỏ tiền mở quán (tám trăm) vào tiền đặt cọc; Rico hứa từ nay sáng nào cũng mang cà phê cho cô (`tess.ts`).
- **Kemp** bị loại khỏi vụ trạm gác vì thư dự thầu của hắn nhắc tới "mười bốn viên ngói", con số Gus bịa và chỉ nói trên
  kênh của Ban quản lý cảng. Hắn không bị bắt, không bị phạt: chỉ mất một hồ sơ. Sáng hôm đó hắn đã thắng thầu **kho số
  mười lăm**, "thầu lặng lẽ, chẳng ai tới" (Rico lại nghe thành "fifty", Tess sửa "One, five").
- **Bay FM** mất tiền tài trợ của Bayline: chương trình đêm của Marcus bị cắt. Gus ngồi trong chòi với cái đài im
  (`hearing.ts`, cuối). Bản tin giao thông trước đó do **Shona**, trợ lý của Kemp, đánh máy sẵn đưa Kit đọc (`three.ts`).
- **Bà Delaney** của Ban quản lý cảng đứng về phía người làm đúng giấy tờ; bà biết Kemp nghe lén kênh của Ban (`channels.ts`).
- **Chỗ ẩn** sau chòi Gus (800 xu, `docs/town.md` §29), **đường phố có đèn, cảnh sát và bộ đàm cảnh sát** (§28), **Bay FM
  nói đúng giờ, đúng trời của game** (§25), **văn phòng điều xe** (§27).
- **Một sợi chỉ chưa ai nhặt:** kho mười lăm là nơi Crane nói "That's where the papers are" (`cs-bigdeal-2`). Rico tới nhầm
  "kho năm mươi", và từ đó chưa ai vào kho mười lăm.

**Những gì phi vụ sau đọc được** (khóa đồng bộ `town-jobs`, `src/core/town/jobProgress.ts`; điều kiện `past`):

| Đọc | Nghĩa | Hồi II dùng ở đâu |
|---|---|---|
| `job-m2:kemp-asks-again` | người chơi bảo Kemp "để tôi nghĩ đã" | Kemp mời lần ba ở phi vụ 1 Hồi II |
| `job-m2:kemp-knows-unpaid` | người chơi nói thật là chưa được trả công | Kemp nhắc lại ở phi vụ 1 |
| `job-m2:hit:late` / `hit:gone` | khách đầu tiên chờ / bỏ đi | không dùng nữa (đã đọc ở phiên xét) |
| `job-channels:witness` | người chơi nhận làm chứng | bà Delaney tự chọn người chơi làm "trợ lý" ở Kho 15 |
| `job-tess:promised-tess` | người chơi hứa trả Tess | Tess nhắc ở phi vụ 5b |
| `job-three:warned` | đã kịp báo Gus | Gus tin người chơi ở chuỗi của anh |
| `job-hearing:hit:missedIt` | bà Delaney tự bắt được, không phải người chơi | câu của bà ở Kho 15 đổi ("lần này bạn bắt nhé") |

---

## 2. Băng nhóm

Hồi I, băng tự tụ lại quanh Rico. Hồi II, **người chơi chọn ai đi cùng** (gta-m0 đang xây phần chọn người). Mỗi người
mang một KIỂU NGHE riêng: chọn ai thì nhịp tại chỗ của phi vụ đổi theo kiểu nghe đó, và người đó lấy một phần tiền.

**Mở khi nào.** Người thị trấn dùng tim Thân thiết đã có. Người Westbay không có hệ thống tim; đề xuất cái đơn giản nhất:
**đã nghe hết các cảnh của người đó** (ba tập của người chính, hai cuộc nói chuyện của người quen), cộng với việc họ đã có
mặt ở Hồi I (ai chưa từng góp mặt thì không lý do gì đi cùng). Không lưu gì mới: đọc từ `town-city` và `town-jobs`.

| Ai | Kiểu nghe mang tới | Mở khi | Phần chia (đoán) | Khi đi cùng thì phi vụ đổi gì |
|---|---|---|---|---|
| **Rico** | lời chỉ đường nhanh, nói dồn, tự sửa giữa câu | luôn (cộng sự) | 0 | có một đoạn lái theo lời anh (ngã rẽ), anh nói nhanh và sửa lời |
| **Tess** | người canh: tả người, tả xe, ngắn gọn, giọng đều | `ct-tess-2` + Hồi I | 0 (đang được nợ) | có người canh gọi về: "xe xanh, đi về phía ga" |
| **Jun** | băng ghi âm, cuộc gọi qua sóng, tiếng rè: nghe câu bị đứt đoạn | `ct-jun-3` + Hồi I | 5 xu | có một đoạn nghe qua máy quét, câu đứt quãng, phải đoán chữ mất từ ngữ cảnh |
| **Mei** | lời nói vòng vo, nói dối; câu hỏi chỉ người thật mới trả lời được | `ct-mei-2` + Hồi I | không lấy tiền ("trả bằng khách") | có một đoạn đối đáp, trong đó một người nói dối; người chơi bắt được lời dối hay không |
| **Max** [TT] | máy ghi âm cỡ đồng xu: đặt máy, NGHE LẠI sau (tua lại được, đếm số lần) | 4 tim | 4 xu ("bốn mươi cho một cục pin") | có một đoạn nghe lại ở chỗ ẩn (hoặc sạp Jun nếu chưa có chỗ ẩn), giọng Úc nhẹ |
| **Gus** | bộ đàm đêm, các con số của cảng (thuyền, kho, giờ tuần tra) | `ct-gus-2` + Hồi I | 5 xu | có một đoạn nghe kênh đêm, và phải né xe tuần tra theo bộ đàm cảnh sát |
| **Marcus** | trên sóng: khán giả gọi vào, đủ tốc độ, đủ kiểu nói | `ct-marcus-3` + Hồi I | 0 (vì đài của anh) | có một đoạn khán giả gọi vào đài: nhiều người nói liền nhau, mỗi người một chi tiết |
| **bà Okafor** | giờ tàu xe, loa nhà ga, con số nói theo kiểu giờ tàu | `ct-okafor-2` + chuỗi A Hồi I | 3 xu | có một đoạn loa và giờ tàu: ai tới bằng chuyến nào |

Người thị trấn khác (Sam, Tom…) có thể ghé một cảnh nhưng không làm thành viên băng: mỗi câu của họ tốn một clip.

**Tiền.** Một phi vụ trả 30 / 15 / 5 xu (như Hồi I, một lần một ngày); phần của người đi cùng trừ vào đó. Đây là điểm trò
chơi, không phải thước đo nghe.

**Người mới (chỉ những ai truyện không thiếu được):**

| Ai | Là gì | Giọng |
|---|---|---|
| **Mr Ashby** | người của công ty chủ Bay FM ("head office", đã có trong canon: `ct-kit-2`), lo vụ bán đài | trình duyệt, nam |
| **Coastline Radio** | tên công ty chủ Bay FM (canon chỉ nói "head office") | (tên, không nói) |

Không có người mới nào khác: người canh kho đêm là **tay tài xế Bayline** đã có (`SCENE_VOICES.driver`, `jobCast.ts`).

---

## 3. Cả hồi trong một trang

**Kemp muốn gì bây giờ.** Mất trạm gác, Kemp nhắm một thứ lớn hơn: **Bay FM**. Công ty chủ đài (Coastline Radio) đang bán
nó, vì không có tiền Bayline thì đài lỗ, mà tiền Bayline là do chính Kemp rút. Hắn đã nộp giá mua.

- **Hợp pháp trên giấy:** ai cũng được mua một đài phát thanh. Hắn sẽ nói trên sóng là "mua để cứu Bay FM".
- **Sai trong thực tế:** (1) hắn làm đài sụp để mua rẻ; (2) giá hắn trả đúng bằng con số thấp nhất công ty chịu bán, con số
  chỉ từng được nói ngoài sóng, qua **đường truyền nói chuyện riêng** (talkback) giữa sân khấu Bay FM ở bến cảng và phòng
  thu, đường truyền không mã hóa mà máy quét của Bayline thu được; (3) mua đài là mua luôn **hai mươi năm băng lưu trữ**:
  giọng Marcus, giọng mọi người gọi vào, giọng cả thành phố.
- **Vì sao không thắng bằng cách lên đài:** đài đang không có chương trình đêm, và sắp là của hắn. Luật bán của công ty:
  người mua dùng thông tin mật của đài thì bị loại, nhưng phải chỉ ra được ĐÚNG đoạn băng, đúng câu. Hắn không nói dối, chỉ
  giữ mọi thứ.
- **Kho mười lăm:** kho của Bayline ở cảng, thuê của Ban quản lý cảng. Trong đó là chỗ lưu những gì máy quét của Bayline
  thu được nhiều năm ("Burn twenty years of this city talking? They're worth more than the station."). Và mấy thùng giấy
  cũ của Vane mà chưa ai lấy.

**Đường đi của hồi** (khoảng ba tuần trong truyện, tới ngày hội đồng công ty họp bán đài):

| # | Phi vụ | Ai mời | Cược | Thu được cho Kho 15 |
|---|---|---|---|---|
| 1 | **Bán đài** (mở hồi, cố định) | Marcus (tin nhắn thoại, gọi lại trước giờ hẹn) | biết Bay FM sắp về tay Kemp | băng tụ lại; bốn chuỗi việc mở |
| 2a | Đường truyền ngoài trời | Jun | đường talkback có bị nghe được không | chứng minh được đường truyền "gào" ra không khí |
| 2b | Đường dây chéo | Jun | Kemp nói gì với Mr Ashby | con số sàn "forty thousand", ngày họp hội đồng |
| 3a | Câu hỏi thứ hai | Mei | Shona tới mua sạp, nói dối | biết có kho lưu trữ ("he keeps every word") |
| 3b | **Hộp há cảo** (viết đủ ở mục 6) | Mei | Kemp giữ băng ở đâu, khi nào dọn kho | giờ xe dọn kho, cửa nào, (tùy người đi cùng) thùng nào / ngày họp / ca gác |
| 4a | Ca đêm | Gus | đêm ở dãy kho, né tuần tra | giờ tuần tra, ca của người gác |
| 4b | Cửa nước | Gus | thuyền nào chở đồ của Kemp | Kemp định chuyển băng ra bằng đường nước |
| 5a | Gọi vào đài | Marcus | góp tiền mua đài cho người nghe | đủ tiền để có một giá mua thứ hai |
| 5b | Tuần cuối | Marcus | chương trình đêm được phát lại một tuần | Marcus trên sóng đúng đêm Kho 15 |
| 10 | **Kho 15** (phi vụ lớn) | bà Delaney | bằng chứng trong kho | Kemp bị loại; đài về tay người nghe |

**Thứ tự người chơi chọn.** Phi vụ 1 cố định. Sau đó bốn chuỗi (Jun 2a→2b, Mei 3a→3b, Gus 4a→4b, Marcus 5a→5b) làm theo thứ
tự nào cũng được; trong một chuỗi thì phi vụ a trước b. Kho 15 mở khi xong cả bốn phi vụ b (cần engine: "sau tất cả").
Thứ tự đổi ba điều (đọc bằng `past`):
- **Mei trước Jun:** ở 2b Jun biết phải nghe gì (có kho lưu trữ), nên trước cuộc gọi có thêm một câu của Jun báo cái cần
  bắt; nếu Jun trước, cuộc gọi đến bất ngờ.
- **Marcus 5a trước Gus 4a:** trong cuộc khán giả gọi vào có một người là chị của tay gác kho ("my brother watches
  warehouse fifteen, nights"), nên ở 4a người chơi biết tên và ca của người gác từ trước (một mục sổ tay thành có sẵn).
- **Chuỗi làm sau cùng:** Shona đã đánh hơi thấy. Phi vụ b của chuỗi cuối có Shona có mặt (một câu dối thêm, hoặc một lần
  đổi giờ) và tiền thưởng nhích lên vì khó hơn.

**Kết hồi: thắng, có giá.**
- **Thắng:** ở Kho 15, trong một giờ kiểm tra an toàn hợp pháp của bà Delaney (kho thuê của Ban quản lý cảng), băng tìm ra
  đúng cuộn talkback có câu "anything over forty thousand", và đúng câu Kemp nhắc con số đó. Công ty dừng giá của Kemp
  chờ điều tra; giá của người nghe (do Claire đứng tên, tiền góp từ phi vụ 5a) đủ sàn. **Bay FM thành đài của người nghe.**
  Chương trình đêm trở lại; Gus hết những đêm im lặng. Thùng giấy của Vane được bà Delaney niêm phong ("That's where the
  papers are" khép lại).
- **Giá:** (1) Kemp khiếu nại bà Delaney dùng quyền của Ban cho việc riêng: bà bị đình chỉ, băng mất người bạn ở Ban quản lý
  cảng. (2) Kemp không cần cuộn băng đó: "Keep the tape. I have the rest." Hai mươi năm giọng nói của thành phố vẫn ở chỗ
  hắn. Đó là cửa vào Hồi III (băng ghi âm giả nhại giọng Rico, Marcus: `docs/gta-plan.md` §5).
- **Mười lăm hay năm mươi:** ở Kho 15, một cuộc gọi giả giọng ai đó bảo bà Delaney ra "warehouse fifty" gấp. Bến cảng chỉ
  có tới kho hai mươi hai (`cs-bigdeal-4`): ai nghe ra "fifty" thì biết là bẫy. Cái bẫy fifteen / fifty gài từ phần 2 trả
  ở đây, lần này người chơi là người bắt được.

---

## 4. Mười phi vụ: dàn ý

Như Hồi I: mỗi phi vụ bốn nhịp; mỗi chi tiết ghi sai có MỘT hệ quả rồi nhập lại mạch chính; mức kết theo số hệ quả (0 Sạch,
1–2 Lộn xộn, 3+ Hỏng). Kiểu nói giờ dùng `clock` có sẵn: 'quarter' (quarter past / to), 'half' ("half five"), 'ten' (ten past
/ to). Tên đường lấy từ mười hai đường của `docs/city.md` §17.

### Phi vụ 1. Bán đài (`job-sale`, sau `job-hearing`, Marcus mời)

**Vì sao có:** đặt cược của hồi, gom băng, và cho người chơi thử điện thoại có tin nhắn thoại với hạn gọi lại.

- **(a) Nghe lệnh.** Cuộc gọi nhỡ của Marcus, tin nhắn thoại (giọng anh khác hẳn khi không có mic: `ct-marcus-1`): "call me
  back before {time}" (clock 'quarter'). Gọi lại kịp thì Marcus kể; trễ thì Kit gọi, kể ngắn hơn và bực.

| Mục | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Gọi lại trước mấy giờ ★ | {time} (quarter past / to) | quarter to / past; giờ kế | như Hồi I: "past" teo thành /pəs/, "to" thành /tə/ |
| Ai mua đài ★ | Kemp, Bayline | "Bay FM's own lot" (chính người của đài); "Ben, maybe" | "Bayline" và "Bay FM" cùng âm đầu "Bay", nói nhanh thì chữ sau mờ; Marcus nói vòng ("someone who knows us very well") |
| Họp ở đâu ★ | sạp há cảo của Mei, chín giờ | sân khấu Bay FM; "Mei's... no, the stage's closed" | Marcus tự sửa: "at the stage. No, it's locked, at Mei's" |

- **(b) Trên đường.** Bản tin Bay FM ban ngày (Kit đọc, không có tài trợ): "Bay FM's owners confirm the station is for sale."
- **(c) Tại chỗ.** Cuộc họp ở sạp Mei: Marcus, Kit, Jun, Mei, Gus, Rico. Nghe theo người nói: mỗi người nhận một việc (bốn
  chuỗi). Kemp đi ngang (đáp theo ý): mời người chơi lần thứ ba nếu `job-m2:kemp-asks-again` ("Third time. I did say I'd ask
  again."), nhắc chuyện "chưa được trả công" nếu `kemp-knows-unpaid`.
- **(d) Hệ quả:** gọi lại trễ → Kit kể thay, người chơi lỡ câu Marcus nói về hai mươi năm băng (một dòng mất trong xem lại);
  nhầm người mua → Rico sửa ở buổi họp, Marcus buồn vì phải nói lại tên Kemp; nhầm chỗ họp → tới sân khấu khóa cửa, Gus gọi.
  Nhập lại: buổi họp vẫn diễn ra.
- **Mở:** bốn chuỗi.
- Người nói: Marcus, Kit, Jun, Mei, Gus, Rico, Kemp, người chơi. Khoảng 55 câu. **Người thị trấn: 0.**

### Phi vụ 2a. Đường truyền ngoài trời (`job-link`, chuỗi Jun, Jun mời)

**Vì sao có:** chứng minh đường talkback từ sân khấu về phòng thu "gào" ra không khí, như kênh của Ban quản lý cảng ở Hồi I.

- **Người đi cùng:** Jun (bắt buộc). Tùy chọn: Kit (biết đường truyền), hoặc Tess (canh).
- **(a)** Jun ở sạp, giảng nhanh: đường talkback chạy trên tần số nào, máy quét cầm tay để đâu.

| Mục | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Đứng ở đâu để thu ★ | góc Quay Street và East Road | góc Quay Street và Pier Road; "the quay" | ba tên đường cảng; "East Road" nói nhanh "Eas' Road" mất /t/ |
| Tần số ★ | "eighteen point two" | "eighty point two"; "eight point two" | "-teen / -ty" trước một chữ có nhấn: trọng âm dời lên đầu |
| Kit thử nói câu gì ★ | "testing, one, two, the kettle's on" | "the kettle's off"; "the cattle's on" | on / off cuối câu, nói nhỏ; kettle / cattle khác một nguyên âm |

- **(b)** Lái tới góc phố; đèn đỏ ở ngã tư (vượt đèn = độ nóng).
- **(c) Nghe qua máy quét**: Kit nói vào đường truyền từ sân khấu, câu đứt quãng (tiếng rè), người chơi gõ lại câu thử
  (bước gõ lại có sẵn). Đứng sai góc thì chỉ có tiếng rè, Jun gọi chỉ lại.
- **(d) Hệ quả:** sai góc → Jun chỉ, trễ; sai tần số → nghe nhầm một kênh taxi của Bayline (một câu của tổng đài Bayline:
  "car six, the harbour") rồi chuyển đúng; sai câu thử → Kit nói lại, chậm hơn, mất một nhịp. Nhập lại: biết đường truyền bị
  nghe được.
- Người nói: Jun, Kit, Tess (nếu đi), tổng đài Bayline, người chơi. Khoảng 50 câu. **Người thị trấn: 0.**

### Phi vụ 2b. Đường dây chéo (`job-crossed`, sau `job-link`, Jun mời)

**Vì sao có:** bắt được Kemp nói con số sàn với Mr Ashby. (Nếu đã làm chuỗi Mei: Jun biết trước phải bắt gì.)

- **Người đi cùng:** Jun (bắt buộc). Tùy chọn: Max [TT] (ghi lại để nghe lại), hoặc Gus (canh xe tuần tra).
- **(a)** Tin nhắn thoại của Jun: điện thoại không dây trong văn phòng Kemp ở kho mười lăm là loại cũ, sóng hở; tối nay
  Kemp gọi Mr Ashby.

| Mục | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Kemp gọi lúc mấy giờ ★ | {time} (clock 'ten') | ten to / past; giờ kế | như Hồi I |
| Ngồi đâu ★ | xe đậu trên Quay Street | Pier Road; "the quay" (bến) | "Quay" đọc là "key" |

- **(b)** Ngồi trong xe; bộ đàm cảnh sát: một xe tuần tra đi ngang; đậu đúng làn, tắt máy, không bị để ý (nếu đậu trên vỉa
  hè hoặc ngược làn thì độ nóng +1: luật đường phố có sẵn).
- **(c) Nghe qua tiếng rè** cuộc gọi Kemp – Ashby (sổ tay thứ hai):

| Mục | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Giá sàn ★ | forty thousand | fourteen thousand; four thousand | "forty" và "fourteen": trước "thousand" có nhấn, "fourteen" dời trọng âm lên đầu, nghe như "forty" |
| Ngày họp hội đồng ★ | the thirteenth | the thirtieth; the third | như trên, "-teen / -ty"; "third" là chỉ nghe được âm đầu |

  Đi cùng Max: cuộc gọi được ghi, nghe lại ở chỗ ẩn, tua được (mỗi lần tua đều đếm). Đi cùng Gus: có thêm đoạn né tuần tra.
- **(d) Hệ quả:** sai giá sàn → Claire tính sai số tiền cần góp, phải gọi Mr Ashby hỏi lại (lộ ý); sai ngày → bà Delaney lên
  lịch kiểm tra muộn, phải dời sớm hơn (Kho 15 bớt một nhịp chuẩn bị). Nhập lại: biết con số và ngày.
- Người nói: Jun, Kemp, Mr Ashby (mới), Max [TT] (nếu đi), Gus (nếu đi), cảnh sát (bộ đàm), người chơi. Khoảng 60 câu.
  **Người thị trấn: Max 5 câu nếu đi cùng (0 nếu không).**

### Phi vụ 3a. Câu hỏi thứ hai (`job-second`, chuỗi Mei, Mei mời)

**Vì sao có:** Shona tới sạp Mei hỏi mua chỗ "cho Bayline". Mei dùng cách của bà: hỏi một câu chỉ người nói thật trả lời
được. Người chơi phải bắt được câu dối.

- **Người đi cùng:** Mei (bắt buộc). Tùy chọn: Sol (sạp bên cạnh), hoặc bà Okafor (biết Shona đi chuyến tàu nào).
- **(a)** Mei dặn: "she'll say three things. One of them's a lie. Remember all three."

| Mục | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Shona nói đã làm cho Kemp bao lâu ★ | eight years | eighteen years; a few years | "eight years" /eɪt jɪəz/ dính thành "eigh-tyears", gần "eighteen years" |
| Nói Kemp "giữ" cái gì ★ | "every word" (mọi lời) | "every one" (mọi người); "every world" | "word" /wɜːd/ và "one" /wʌn/ cùng âm đầu, cuối mờ |
| Nói sẽ quay lại khi nào ★ | Saturday, half eight | half seven; Saturday at eight | "half eight" = 8:30 kiểu Anh |

- **(b)** Không lái: nhịp này là Mei bày quầy, và một cuộc gọi của bà Okafor nếu bà đi cùng (Shona tới bằng chuyến nào).
- **(c) Đối đáp:** Shona nói chuyện vòng vo; Mei hỏi câu thứ hai ("what does he like with his dumplings?"); Shona trả lời
  sai điều Mei đã biết (Kemp ăn nhân thịt: `machine2.ts`). Người chơi trả lời theo ý: "câu nào là dối?" (ba ý).
- **(d) Hệ quả:** sai năm làm việc → Mei hỏi lại, Shona cảnh giác hơn ở 3b (một câu); sai "every word" → người chơi không biết
  có kho lưu trữ cho tới 3b (Mei nói ra); sai ngày quay lại → không có ai ở sạp lúc Shona quay lại, cô để lại danh thiếp.
  Nhập lại: biết Kemp "keeps every word".
- Người nói: Mei, Shona, Sol hoặc bà Okafor, người chơi. Khoảng 55 câu. **Người thị trấn: 0.**

### Phi vụ 3b. Hộp há cảo (`job-dumplings`, sau `job-second`, Mei mời) — viết đủ ở mục 6

Tóm tắt: tối nào Kemp cũng gọi sáu cái nhân thịt tới kho mười lăm. Mei tự mang tới, giữ hắn nói chuyện ở cửa. Người chơi
chọn người thứ hai: **Max** (đặt máy ghi âm dưới nắp hộp, hôm sau nghe lại), **Jun** (nghe cuộc gọi qua tiếng rè trong xe
trên Quay Street), hoặc **Gus** (nghe kênh đêm của Bayline từ chòi, né xe tuần tra). Mỗi người cho một mẩu khác nhau.

### Phi vụ 4a. Ca đêm (`job-night`, chuỗi Gus, Gus mời)

**Vì sao có:** đêm ở dãy kho có những luật riêng; người chơi học nghe chúng, và lần đầu phải tự né xe tuần tra bằng tai.

- **Người đi cùng:** Gus (bắt buộc). Tùy chọn: Tess (canh từ xe cà phê trên đường về), hoặc Rico (lái).
- **(a)** Gus, trong chòi, kể đêm của dãy kho; bộ đàm cảnh sát bật nhỏ. (Nếu đã làm 5a: tên người gác đã có trong sổ.)

| Mục | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Xe tuần tra qua dãy kho lúc ★ | {time} (clock 'quarter') | quarter to / past | như trên |
| Người gác đổi ca lúc ★ | "from ten till two" | "ten to two" (1:50); "ten till twelve" | "till" và "to" đều yếu, "from" bị nuốt: "ten till two" ≈ "ten to two" |
| Đèn nào sáng nghĩa là có người ★ | the lamp over the side door | the lamp over the slide door; "the light by the stairs" | side / slide khác một /l/ |

- **(b)** Đi bộ dọc Quay Street lúc tối, mưa át bớt tiếng (thời tiết game).
- **(c) Né tuần tra:** bộ đàm cảnh sát nói "Unit twelve, passing Quay Street, heading west" (sinh từ dữ kiện); người chơi phải
  vào chòi hoặc đổi hướng. Bị thấy thì độ nóng tăng, có thể bị dừng xe hỏi (luật có sẵn, không "thua").
- **(d) Hệ quả:** sai giờ tuần tra → đứng giữa đường lúc xe tới, độ nóng +2 (hoặc bị dừng, nộp phạt); sai ca gác → tới cửa
  kho đúng lúc người gác mới tới, phải quay lui; sai đèn → nhìn nhầm cửa, Gus sửa qua bộ đàm. Nhập lại: biết nhịp đêm của
  dãy kho.
- Người nói: Gus, cảnh sát (bộ đàm), tay tài xế Bayline (người gác), Tess hoặc Rico, người chơi. Khoảng 55 câu.
  **Người thị trấn: 0.**

### Phi vụ 4b. Cửa nước (`job-water`, sau `job-night`, Gus mời)

**Vì sao có:** Kemp không định chở băng ra bằng đường phố mà bằng thuyền, qua cửa nước của kho.

- **Người đi cùng:** Gus (bắt buộc). Tùy chọn: thuyền trưởng Odile (bộ đàm bến phà), hoặc Theo (thợ máy, nghe máy thuyền).
- **(a)** Gus đếm thuyền (canon: "I count every boat in this harbour"). Bộ đàm bến phà của Odile gọi.

| Mục | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Thuyền nào ★ | the Kittiwake, berth nine | berth five; "the kitty, berth nine" | nine / five: cùng /aɪ/, âm cuối yếu (như "car nine / five" ở Hồi I) |
| Đến lúc ★ | {time} (clock 'half') | half H−1; giờ chẵn | "half eleven" = 11:30 |
| Ai lái ★ | "Shona's cousin" | "Shona, of course"; "Shona's husband" | "cousin" /ˈkʌzən/ và "of course" đều có /kɔː/-/kʌ/ đầu, nói nhanh |

- **(b)** Ra Pier Road lúc đêm; xe tuần tra; thời tiết.
- **(c) Nghe lén** hai người ở cầu tàu (tay tài xế Bayline và người lái thuyền): theo khoảng cách, mưa át. Họ nói khi nào
  chuyển "the M boxes".
- **(d) Hệ quả:** sai thuyền → canh nhầm bến, Odile gọi chỉ; sai giờ → tới muộn, chỉ nghe được nửa sau; sai người lái → Gus
  hiểu nhầm, mất một câu giải thích. Nhập lại: biết băng sẽ ra bằng đường nước đêm trước khi hội đồng họp.
- Người nói: Gus, Odile hoặc Theo, tay tài xế Bayline, người lái thuyền (mới? xem mục 8), người chơi. Khoảng 55 câu.
  **Người thị trấn: 0.**

### Phi vụ 5a. Gọi vào đài (`job-callin`, chuỗi Marcus, Marcus mời)

**Vì sao có:** để người nghe góp tiền mua đài. Đây là thang độ khó của plan §4.5: khán giả gọi lên, đủ giọng, đủ tốc độ.

- **Người đi cùng:** Marcus (bắt buộc, trên sóng ban ngày một giờ). Tùy chọn: Kit (bàn âm thanh), hoặc Claire (sổ sách góp tiền).
- **(a)** Kit giảng: người chơi nghe máy, ghi tên và số tiền từng người góp (nhiều sổ tay ngắn, có sẵn trong engine).

| Mục (mỗi người gọi một mục) | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Frank góp ★ | thirty | thirteen; three | "-teen / -ty" |
| Gianna góp ★ | "a hundred, and a dinner" | "a hundred and twenty"; "a hundred, and a winner" | dinner / winner; "and a" dính thành "ənə" |
| Hal góp ★ | eighty | eighteen; "a tee" | như trên |
| Một người tự xưng "Mr Pryce" ★ | không góp gì: là người của Bayline phá ngang | "price"; tưởng là người góp thật | Pryce / price đồng âm; câu hỏi giá là cái lộ ra |

- **(b)** Không lái; bản tin Bay FM thật (§25) phát giữa giờ.
- **(c) Khán giả gọi vào** liền nhau; một người là của Bayline (nói vòng vo, đòi biết đài sẽ bán bao nhiêu): người chơi chọn
  có cắt máy không (đáp theo ý). Nếu đã làm 4a: một người gọi kể em trai gác kho mười lăm (đặt cờ cho 4a nếu chưa làm).
- **(d) Hệ quả:** ghi sai một khoản → Claire cộng sai, phải gọi lại người đó (một câu xin lỗi trên sóng); để người của Bayline
  nói tiếp → hắn hỏi được con số đài đang cần, Kemp biết (Kho 15: Shona có mặt sẵn). Nhập lại: đủ tiền cho một giá thứ hai.
- Người nói: Marcus, Kit, Claire, Frank, Gianna, Hal, "Mr Pryce" (người của Bayline, mới), hai người gọi khác, người chơi.
  Khoảng 70 câu. **Người thị trấn: 0** (Ben góp qua bố là Frank).

### Phi vụ 5b. Tuần cuối (`job-farewell`, sau `job-callin`, Marcus mời)

**Vì sao có:** công ty cho Marcus một tuần đêm cuối để chia tay. Băng cần Marcus trên sóng đúng đêm Kho 15, và Mr Ashby tới
thành phố bằng tàu để gặp Kemp: biết ông tới chuyến nào là biết Kemp chuẩn bị gì.

- **Người đi cùng:** Marcus (bắt buộc). Tùy chọn: bà Okafor (giờ tàu, loa ga), hoặc Tess (canh ở bãi xe buýt).
- **(a)** Marcus và Kit. Tom [TT] gọi lên chương trình chia tay (anh ghét nói trước đám đông, nhưng gọi cho Marcus thì được):
  ba câu, cảm động, và một chi tiết: "I saw a man in a Coastline jacket on the no. 9."

| Mục | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Ashby tới chuyến ★ | {time} từ ga (clock 'ten') | ten to / past | như trên |
| Ở đâu ★ | Gianna's, the table by the window | "Gianna's, by the winter"; Gianna's, by the door | window / winter cùng "win-"; nói nhanh "by the window" mất /d/ |
| Mặc gì ★ | a Coastline jacket, green | grey; "a coat, line jacket" | green / grey cùng /gr/; "Coastline" nói nhanh "Coas'line" |

- **(b)** Ra ga đón (không gặp): bà Okafor đọc giờ; loa ga.
- **(c) Nghe lén** Ashby và Kemp ở bàn cạnh cửa sổ quán Gianna (Gianna cho ngồi gần, "eat your pasta"): ngày họp, và Kemp dặn
  "Thursday night, the water door". Gianna để điện thoại khách vào rổ (canon §10), nên họ nói to.
- **(d) Hệ quả:** sai chuyến → lỡ Ashby ở ga, phải tìm ở quán; sai chỗ ngồi → ngồi quá xa, nghe loáng thoáng; sai áo → bám
  nhầm người. Nhập lại: biết Kemp sẽ chuyển băng đêm thứ Năm, và Marcus lên sóng đêm đó.
- Người nói: Marcus, Kit, Tom [TT], bà Okafor hoặc Tess, Mr Ashby, Kemp, Gianna, loa ga, người chơi. Khoảng 65 câu.
  **Người thị trấn: Tom, 3 câu.**

### Phi vụ 10. Kho 15 (`job-warehouse`, sau cả bốn phi vụ b, bà Delaney mời)

**Vì sao có:** phi vụ lớn đầu tiên. Nhiều người cùng lúc, nhiều kiểu nghe trong một phi vụ, và cái bẫy fifteen / fifty.

- **Người đi cùng:** bà Delaney được mang hai "trợ lý" vào trong (người chơi luôn là một nếu có cờ `job-channels:witness`;
  nếu không, bà hỏi lại). Người chơi chọn **một người vào trong** (Jun: tìm cuộn băng theo tiếng; hoặc Mei: giữ Shona nói
  chuyện ở cửa) và **hai người ở ngoài** trên bộ đàm (Gus: cửa nước và tuần tra; Marcus: trên sóng; Max [TT]: nghe lại cái
  máy đã đặt từ 3b nếu 3b đi với Max; Rico: xe chờ).
- **(a) Nghe lệnh.** Bà Delaney ở trạm gác, giọng giấy tờ: một giờ kiểm tra an toàn, theo luật cho thuê, không được mang gì ra
  ngoài trừ những gì bà ghi biên bản.

| Mục | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Kho số ★ | fifteen | fifty; fourteen | cái bẫy của cả truyện: "fifteen" trước một chữ có nhấn dời trọng âm thành "FIF-teen" ≈ "fifty"; bến chỉ tới hai mươi hai |
| Bắt đầu lúc ★ | {time} (clock 'quarter') | quarter to / past | như trên |
| Được ở trong bao lâu ★ | "an hour, not a minute more" | "half an hour"; "a nower" | "an hour" dính /ən aʊə/; "half an hour" chỉ khác chữ đầu |
| Thùng cần tìm ★ | M (nếu 3b biết), hoặc "the one under the stairs" | N; "the stores" | M / N; stairs / stores (như 3b) |

- **(b) Trên đường.** Bay FM: Marcus lên sóng đêm cuối (5b); tin bản tin thật nói trời mưa từ mười giờ (thời tiết game).
- **(c) Tại chỗ**, ba mạch cùng lúc (cần engine: nhiều nguồn tiếng đan xen):
  1. **Trong kho:** những cuộn băng không nhãn (Shona đã gỡ nhãn); người chơi nghe từng đoạn ngắn, tìm đúng cuộn: tiếng Kit
     "testing, one, two, the kettle's on" (câu thử ở 2a) là dấu cuộn talkback. Rồi tìm đúng câu Kemp (hoặc Ashby) nói
     "anything over forty thousand". Đi với Jun: anh nghe cùng, chỉ chỗ rè; đi với Mei: không có Jun, nghe một mình, nhưng
     Shona không lẻn vào được.
  2. **Ở cửa:** Shona cố cản (lời vòng vo, nói dối thời hạn). Đi với Mei: Mei giữ cô ở cửa, người chơi nghe được Mei bắt lời dối.
  3. **Bộ đàm:** Gus báo thuyền ở cửa nước; bộ đàm cảnh sát: Shona gọi báo "đột nhập ở kho mười lăm", người chơi nghe đơn vị
     nào tới và báo bà Delaney chìa thư của Ban ra trước. Rồi **cuộc gọi giả** (giọng trình duyệt, tự xưng là Gus): "Mrs
     Delaney, you're needed at warehouse fifty, right now." Người chơi phải nói với bà là không có kho năm mươi (đáp theo ý).
- **(d) Hệ quả:** ghi kho fifty → đi nhầm về phía cuối bến, Gus gọi: "There is no fifty. There never was." (mất mười phút của
  một giờ); sai giờ → tới muộn, bà Delaney đã vào trong một mình, người chơi lỡ đoạn đầu; sai thời hạn → không canh đồng hồ,
  bà Delaney phải tự gọi hết giờ (mất cuộn thứ hai); sai thùng → mở thùng N trước (băng tin tức, mất thời gian); tin cuộc gọi
  giả → bà Delaney ra cửa, Shona chuyển một thùng ra cửa nước, Gus giữ được nửa (Lộn xộn). Nhập lại: cuộn talkback và câu
  "forty thousand" luôn được tìm thấy (nếu người chơi không tìm được, bà Delaney tìm được ở lần nghe thứ hai, như phiên xét).
- **Kết:** công ty dừng giá của Kemp; giá của người nghe thắng; bà Delaney bị đình chỉ; Kemp: "Keep the tape. I have the rest."
  Marcus kết đêm cuối bằng tin đài thuộc về người nghe. Gus không còn ngồi trong im lặng.
- Người nói: bà Delaney, Jun hoặc Mei, Gus, Marcus, Max [TT] (nếu 3b đi với Max), Rico, Shona, Kemp, tay tài xế Bayline, cảnh
  sát (bộ đàm), người gọi giả, Kit (trên băng), Mr Ashby (trên băng), người chơi. Khoảng 90 câu kể cả nhánh.
  **Người thị trấn: Max 4 câu nếu có (0 nếu không).**

---

## 5. Thứ tự, cờ và những gì phi vụ để lại cho nhau

| Phi vụ để lại cờ | Đọc ở |
|---|---|
| `job-link`: cờ "kettle" (đã nghe câu thử của Kit) | Kho 15: dấu nhận cuộn talkback (không có thì bà Delaney nhận ra muộn) |
| `job-crossed`: `hit:floor` / `hit:date` | Kho 15: Claire và bà Delaney nói lại đúng con số / ngày |
| `job-second`: cờ "every-word" | 2b: Jun biết phải bắt gì (nếu Mei trước Jun) |
| `job-dumplings`: cờ `crew-max` / `crew-jun` / `crew-gus`, `knows-box`, `knows-door`, `knows-shift` | Kho 15: Max nghe lại máy, thùng M, cửa sau, ca gác |
| `job-night`: cờ "patrol-time" | Kho 15: bộ đàm cảnh sát tới đúng lúc dự đoán |
| `job-callin`: cờ "watchman-name", `hit:pryce` | 4a (nếu chưa làm), Kho 15 (Shona có mặt sẵn) |
| `job-farewell`: cờ "on-air" | Kho 15: Marcus trên sóng |

---

## 6. Phi vụ 3b viết đủ: "Hộp há cảo"

Chọn phi vụ này để viết đủ vì nó là nơi chọn người đi cùng đổi hẳn KIỂU NGHE của nhịp 3: cùng một tối, cùng một cái cửa,
nhưng đi với Max thì nghe lại băng ở chỗ ẩn, đi với Jun thì nghe qua tiếng rè, đi với Gus thì nghe kênh đêm và né tuần tra.

**Bối cảnh.** Tối, sạp há cảo của bà Mei ở chợ đêm. Rico ghé. Kemp gọi sáu cái nhân thịt tới kho mười lăm lúc chín giờ, tối
nào cũng vậy (từ phi vụ 1 Hồi I hắn thích nhân thịt). **Mở khi:** xong 3a "Câu hỏi thứ hai". **Ai mời:** Mei. **Clock:** 'half'
(giờ xe dọn kho nói kiểu "half six").

**Chọn người đi cùng:** Max (4 tim) / Jun / Gus. Người chưa mở thì nút mờ, có dòng "cần …".

### Nhịp 1. Nghe lệnh

**01 · Mei**
"Every night at nine, six pork to warehouse fifteen. He's a creature of habit."
→ Tối nào chín giờ cũng sáu cái nhân thịt tới kho mười lăm. Hắn sống theo nếp lắm.

**02 · Rico**
"So tonight you take them yourself, and keep him talking at the door."
→ Vậy tối nay bà tự mang tới, rồi giữ hắn nói chuyện ở cửa.

**03 · Mei**
"I've kept worse men talking, dear. I sell dumplings to you."
→ Bà từng giữ những gã tệ hơn nói chuyện rồi, cháu ạ. Bà bán há cảo cho cháu mà.

**04 · Rico**
"Fair. But somebody has to listen to what goes on behind him."
→ Cũng phải. Nhưng phải có người nghe chuyện diễn ra sau lưng hắn.

**05 · Mei**
"So. Who's coming with me tonight? Choose quickly. The steam won't wait."
→ Sao. Tối nay ai đi với bà? Chọn nhanh lên. Hơi nước không chờ đâu.

*(Chọn người: Max / Jun / Gus.)*

**06m · Max** [TT] *(nếu chọn Max)*
"Easy. My coin recorder goes under the lid. Twelve hours of whatever he says."
→ Dễ. Cái máy ghi âm bằng đồng xu của tôi nằm dưới nắp hộp. Mười hai tiếng, hắn nói gì cũng vào hết.

**07m · Max** [TT]
"Mei fetches the empty box tomorrow, and we listen back at your place."
→ Mai bà Mei đi lấy cái hộp rỗng về, rồi mình nghe lại ở chỗ bạn.

**06j · Jun** *(nếu chọn Jun)*
"His office phone's a cordless. An old one. It shouts to anybody with the right set."
→ Điện thoại văn phòng hắn là loại không dây. Đời cũ. Ai có máy đúng là nghe được.

**07j · Jun**
"I'll sit in the van on Quay Street. Sit with me, and listen through the hiss."
→ Tôi ngồi trong xe trên Quay Street. Ngồi với tôi, nghe xuyên qua tiếng rè.

**08j · Mei**
"Listening to his phone? Jun, that's exactly what he does to us."
→ Nghe điện thoại của hắn? Jun, đó đúng là việc hắn làm với mình.

**09j · Jun**
"It's on open air, Mei. Like his scanners. Just this once, for the station."
→ Nó phát ra không khí mà, bà Mei. Như máy quét của hắn. Chỉ lần này thôi, vì cái đài.

**06g · Gus** *(nếu chọn Gus)*
"His night man talks to Shona on Bayline's open channel. Every night, like clockwork."
→ Tay gác đêm của hắn nói chuyện với Shona trên kênh mở của Bayline. Đêm nào cũng vậy, đều như đồng hồ.

**07g · Gus**
"Sit in my hut with me and listen. And mind the patrol. They pass at ten."
→ Ngồi trong chòi với tôi mà nghe. Và coi chừng xe tuần tra. Mười giờ họ đi ngang.

### Nhịp 2. Trên đường

*(Đi bộ cùng Mei, bà bê chồng hộp, từ chợ đêm sang dãy kho trên Quay Street. Bản tin Bay FM ban ngày đã hết; đài đang
phát nhạc không lời, không ai dẫn. Chỉ một câu của Mei trên đường.)*

**10 · Mei**
"Walk behind me, dear. Old ladies with dumplings are invisible. Nobody looks twice."
→ Đi sau bà, cháu. Bà già bưng há cảo thì vô hình. Chẳng ai nhìn tới lần hai.

### Nhịp 3a. Ở cửa kho (mọi lựa chọn đều nghe đoạn này)

*(Người chơi đứng bên kia đường, như người đi ngang. Đây là sổ tay thứ nhất: lời ở cửa được nói một lần, nghe lại được, đếm.)*

**11 · Mei**
"Six pork, Mr Kemp. Pork's better. You said so yourself, if you remember."
→ Sáu cái nhân thịt, ông Kemp. Thịt ngon hơn. Chính ông nói thế, nếu ông còn nhớ.

**12 · Kemp**
"I remember everything, Mrs Mei. It's a terrible habit."
→ Tôi nhớ mọi thứ, bà Mei. Một thói quen kinh khủng.

**13 · Mei**
"So I hear. All those shelves in there, full of remembering."
→ Bà cũng nghe nói vậy. Bao nhiêu cái kệ trong đó, đầy những thứ được nhớ.

**14 · Kemp**
"Empty shelves, Mrs Mei. A warehouse full of nothing much."
→ Kệ trống thôi, bà Mei. Một cái kho chẳng có gì mấy.

**15 · Shona** *(từ bên trong)* ★ *[Giờ xe dọn kho]*
"Duncan, the movers want to know. Is it still Friday, half six in the morning?"
→ Duncan, bên chuyển đồ hỏi. Vẫn là thứ Sáu, sáu rưỡi sáng chứ?

**16 · Kemp**
"Shona. Not now, please."
→ Shona. Không phải lúc này.

**17 · Mei**
"Half seven, did she say? I'm up at five. I could bring breakfast."
→ Cô ấy nói bảy rưỡi à? Bà dậy từ năm giờ. Bà mang bữa sáng tới được đấy.

**18 · Kemp**
"Half six. And no breakfast, thank you. Goodnight, Mrs Mei."
→ Sáu rưỡi. Và không cần bữa sáng, cảm ơn bà. Chúc bà ngủ ngon.

**19 · Shona** *(từ bên trong)* ★ *[Xe vào cửa nào]*
"And tell them the back door, not the front. The front's the black one."
→ Và bảo họ vào cửa sau, không phải cửa trước. Cửa trước là cái cửa đen.

**20 · Kemp**
"It's warehouse fifteen, by the way, Mrs Mei. Not fifty. People do get that wrong."
→ Mà là kho mười lăm nhé, bà Mei. Không phải năm mươi. Người ta hay nhầm lắm.

**21 · Mei**
"Rude. He took the box and forgot to pay."
→ Vô duyên. Hắn cầm hộp rồi quên trả tiền.

*Lặp lại khi bấm "Xin nhắc lại":*
- **15r · Shona** "Friday. Half six. In the morning." → Thứ Sáu. Sáu rưỡi. Buổi sáng.
- **19r · Shona** "The back door. The back." → Cửa sau. Cửa sau.
- **22 · Mei** *(từ lần nhắc thứ ba)* "They won't say it twice for us, dear. Not this lot." → Bọn này không nói hai lần cho mình đâu, cháu.

**Sổ tay 1:**

| Mục | Lựa chọn | Vì sao lựa chọn sai là thứ tai nghe ra |
|---|---|---|
| Giờ xe dọn kho | **Thứ Sáu 6:30 sáng** / Thứ Sáu 7:30 sáng / Thứ Sáu 5:30 sáng | Mei cố tình nói sai "half seven" ở giữa (lời vòng vo: ai nói gì); "half six" kiểu Anh là 6:30, người học nhiều nước hiểu là 5:30 |
| Xe vào cửa nào | **Cửa sau** / Cửa đen (cửa trước) / Cửa bên hông | "back" /bæk/ và "black" /blæk/ chỉ khác một /l/ bị nuốt sau /b/; cửa trước lại đúng là màu đen, nên ghi "black" dẫn thẳng ra cửa trước |

*(Câu 20 không bị kiểm: Kemp nói thẳng "không phải năm mươi". Nó gài cho Kho 15: hắn biết Rico từng nghe nhầm.)*

### Nhịp 3b. Phía sau lưng Kemp: theo người đi cùng

#### Nếu đi với Max: nghe lại ở chỗ ẩn, tối hôm sau

*(Cảnh ngắn: tối hôm sau ở sạp Mei.)*

**m01 · Mei**
"Empty box. I think he licked the lid. Your coin's still in there."
→ Hộp rỗng. Chắc hắn liếm cả nắp. Đồng xu của cậu vẫn còn trong đó.

**m02 · Max** [TT]
"Twelve hours on it. Let's hear what Mr Empty Shelves had to say."
→ Mười hai tiếng trong đó. Nghe xem ông Kệ Trống nói gì nào.

*(Đi về chỗ ẩn. Nếu người chơi chưa mua chỗ ẩn: về sạp Jun, Max nói câu m03b thay.)*

**m03 · Max** [TT]
"Rewind as much as you like. That's the beauty of a tape."
→ Tua lại bao nhiêu tùy bạn. Băng hay ở chỗ đó.

**m03b · Max** [TT] *(không có chỗ ẩn)*
"Jun won't mind us using his bench. Rewind as much as you like."
→ Jun không phiền mình mượn bàn đâu. Tua lại bao nhiêu tùy bạn.

*(Sổ tay 2: đoạn băng, tiếng nhỏ, có tiếng giấy, nhưng không có tiếng ồn trộn vào; tua lại được, mỗi lần đều đếm.)*

**t01 · Kemp** ★ *[Giá sàn]*
"Ashby rang. Head office will take anything over forty thousand."
→ Ashby gọi. Công ty sẽ bán với bất cứ giá nào trên bốn mươi nghìn.

**t02 · Shona**
"And the talkback tapes? The ones where he actually says it?"
→ Còn mấy cuộn băng talkback? Mấy cuộn mà ông ta nói ra con số ấy?

**t03 · Kemp** ★ *[Thùng nào]*
"Box M, under the stairs. M for Marcus. He'd appreciate that."
→ Thùng M, dưới cầu thang. M là Marcus. Anh ta sẽ thích lắm.

**t04 · Shona**
"Shouldn't we just burn them, then?"
→ Thế sao không đốt luôn đi?

**t05 · Kemp**
"Burn twenty years of this city talking? They're worth more than the station."
→ Đốt hai mươi năm thành phố này nói chuyện? Chúng đáng giá hơn cả cái đài.

**t06 · Shona**
"And the dumpling lady? She was looking at the shelves."
→ Còn bà bán há cảo? Bà ta cứ nhìn mấy cái kệ.

**t07 · Kemp**
"Mrs Mei looks at everything. That's why she gets a smile and her money."
→ Bà Mei nhìn mọi thứ. Thế nên bà ta được một nụ cười và tiền của mình.

**m04 · Max** [TT] *(sau ba lần tua)*
"Same twelve seconds, mate. I'll put the kettle on."
→ Vẫn mười hai giây đó thôi bạn. Để tôi đun ấm nước.

**Sổ tay 2 (Max):**

| Mục | Lựa chọn | Vì sao gần |
|---|---|---|
| Giá sàn | **40.000** / 14.000 / 4.000 | "forty" và "fourteen": trước "thousand" có nhấn, "fourteen" dời trọng âm lên đầu nên gần như "forty"; "four" là người chỉ giữ được âm đầu |
| Thùng nào | **Thùng M, dưới cầu thang** / Thùng N, dưới cầu thang / Thùng M, trong kho chứa ("stores") | M /ɛm/ và N /ɛn/ chỉ khác âm mũi cuối; "stairs" /steəz/ và "stores" /stɔːz/ cùng khung phụ âm |

#### Nếu đi với Jun: qua tiếng rè, ngay tối đó

*(Trong xe đậu trên Quay Street. Nếu đậu ngược làn hoặc trên vỉa hè: độ nóng +1, luật đường phố có sẵn. Câu có chữ bị mất
được viết với "..." và đọc ngắt quãng: cần engine.)*

**j01 · Jun**
"Got him. It's crackly. Headphones on, and please don't touch the dial."
→ Bắt được rồi. Rè lắm. Đeo tai nghe vào, và làm ơn đừng chạm vào núm.

**j02 · Kemp** ★ *[Giá sàn]*
"Mr Ashby. Yes, I know the time. Your floor's still... forty thousand?"
→ Ông Ashby. Vâng, tôi biết mấy giờ rồi. Giá sàn của ông vẫn là... bốn mươi nghìn chứ?

**j03 · Ashby**
"Forty, Duncan. And you didn't hear that from me."
→ Bốn mươi, Duncan. Và anh không nghe điều đó từ tôi.

**j04 · Kemp**
"I never hear anything from anyone. Ask the Harbour Trust."
→ Tôi có bao giờ nghe gì từ ai đâu. Cứ hỏi Ban quản lý cảng.

**j05 · Ashby** ★ *[Ngày họp]*
"Very funny. The board meets on the... thirteenth. Bring a pen."
→ Buồn cười lắm. Hội đồng họp vào ngày... mười ba. Mang theo bút.

**j06 · Kemp**
"I'll bring two. Goodnight."
→ Tôi mang hai cây. Chào ông.

**j07 · Jun**
"Did you get the date? I lost half of it in the hiss."
→ Bạn bắt được ngày không? Tôi mất nửa câu trong tiếng rè.

**j08 · Jun** *(từ lần nhắc thứ ba)*
"It's a recording now. Play it again, but we're leaving soon."
→ Giờ nó là bản ghi rồi. Mở lại đi, nhưng mình sắp phải đi.

**Sổ tay 2 (Jun):**

| Mục | Lựa chọn | Vì sao gần |
|---|---|---|
| Giá sàn | **40.000** / 14.000 / 4.000 | như trên, cộng tiếng rè ngắt ngay trước số |
| Ngày họp hội đồng | **ngày 13** / ngày 30 / ngày 3 | "thirteenth" và "thirtieth": cùng "thir-", khác "-teen" và "-tieth"; rè cắt mất nửa sau |

#### Nếu đi với Gus: kênh đêm từ chòi, và xe tuần tra

*(Chòi gác của Gus. Bộ đàm của Gus vặn sang kênh mở của Bayline. Bộ đàm cảnh sát bật nhỏ.)*

**g01 · Driver** *(người gác kho, trên kênh mở)* ★ *[Ca gác]*
"Night desk, it's the warehouse. Fifteen's locked. I'm on from ten till two."
→ Tổng đài đêm, kho đây. Mười lăm khóa rồi. Tôi trực từ mười giờ tới hai giờ.

**g02 · Shona** *(trên kênh mở)*
"Fine. And Thursday night, leave the back door open for the movers."
→ Được. Và đêm thứ Năm, để cửa sau mở cho bên chuyển đồ.

**g03 · Driver**
"The back door. Got it. Anything else?"
→ Cửa sau. Rõ. Còn gì nữa không?

**g04 · Shona** ★ *[Canh chỗ nào]*
"Keep everybody away from the stairs. Not Gus, not the dumpling woman. Nobody."
→ Không cho ai lại gần cầu thang. Gus cũng không, bà bán há cảo cũng không. Không ai hết.

**g05 · Gus**
"The stairs. Twenty years I've watched that place. Never seen anyone guard stairs."
→ Cầu thang. Hai mươi năm tôi canh chỗ đó. Chưa thấy ai canh cầu thang bao giờ.

*(Mười giờ: bộ đàm cảnh sát, sinh từ dữ kiện như §28.)*

**g06 · Dispatch** *(bộ đàm cảnh sát)*
"Unit twelve, routine patrol, Quay Street, heading west."
→ Đơn vị mười hai, tuần tra thường lệ, Quay Street, đi về hướng tây.

**g07 · Gus**
"That's them. Inside, quick, or you're the one they're describing."
→ Họ đấy. Vào trong, nhanh, kẻo bạn thành người bị tả trên bộ đàm.

*(Người chơi vào chòi trong 20 giây. Đứng ngoài thì xe tuần tra thấy một người lảng vảng trước dãy kho lúc mười giờ đêm:
độ nóng +1, và:)*

**g08 · Unit** *(bộ đàm cảnh sát)*
"Dispatch, someone loitering by the warehouses. Probably nothing. Moving on."
→ Tổng đài, có người lảng vảng gần dãy kho. Chắc không có gì. Đi tiếp.

**g09 · Gus** *(từ lần nhắc thứ ba)*
"They don't repeat themselves on that channel. Not for anyone."
→ Trên kênh đó họ không nhắc lại đâu. Không vì ai cả.

**Sổ tay 2 (Gus):**

| Mục | Lựa chọn | Vì sao gần |
|---|---|---|
| Người gác trực tới mấy giờ | **từ 10 giờ tới 2 giờ** / 1:50 ("ten to two") / từ 10 giờ tới 12 giờ | "from ten till two": "from" bị nuốt, "till" yếu thành /tɪl/ gần "to" /tə/, thành "ten to two"; "twelve" là người chỉ giữ "t…" |
| Canh chỗ nào | **Cầu thang** / Kho chứa ("stores") / Sân khấu ("stage") | stairs / stores như trên; "stage" là người chỉ bắt được "st…" và nghĩ tới sân khấu Bay FM gần đó |

*(Hệ quả riêng của đường Gus: không vào chòi khi xe tuần tra tới = hệ quả "seen", độ nóng +1, nhập lại: xe đi tiếp.)*

### Nhịp 4. Kết, ở sạp Mei

**k01 · Mei**
"Well? What did my dumplings buy us tonight?"
→ Sao? Tối nay mấy cái há cảo của bà mua được gì?

*(Người chơi trả lời theo ý: chọn điều quan trọng nhất họ nghe được. Ý nào cũng đúng nếu khớp với điều đã ghi đúng; ghi sai
thì câu của người chơi mang con số sai và Mei sửa.)*

- **k02a · Người chơi** "The movers come Friday, half six, at the back door." → Bên chuyển đồ tới thứ Sáu, sáu rưỡi, cửa sau.
- **k02b · Người chơi** *(ghi 7:30)* "The movers come Friday, half seven." → Bên chuyển đồ tới thứ Sáu, bảy rưỡi.
  **k03b · Mei** "Half seven was me, dear. I said it to see if he'd correct me. He did." → Bảy rưỡi là bà nói đấy cháu. Bà nói để xem hắn có sửa không. Hắn sửa.
- **k02c · Người chơi** *(ghi 5:30)* "The movers come Friday, at half past five." → Bên chuyển đồ tới thứ Sáu, năm rưỡi.
  **k03c · Mei** "Half six is half past six, dear. Not half to." → Half six là sáu giờ rưỡi, cháu ạ. Không phải năm rưỡi.
- **k04 · Người chơi** *(ghi cửa đen)* "And they'll use the black door at the front." → Và họ sẽ vào cửa đen phía trước.
  **k05 · Mei** "The back, dear. Back. The black one's where he stood." → Cửa sau, cháu. Cửa sau. Cái cửa đen là chỗ hắn đứng.

Câu chốt của người đi cùng (theo đường):
- **k06m · Max** [TT] "Box M, under the stairs. I reckon that's worth a battery." → Thùng M, dưới cầu thang. Tôi nghĩ đáng giá một cục pin đấy.
- **k06j · Jun** "Forty thousand, and the thirteenth. We've got a number and a clock." → Bốn mươi nghìn, và ngày mười ba. Mình có một con số và một cái đồng hồ.
- **k06g · Gus** "Ten till two, and the stairs. I'll count the steps for you." → Mười giờ tới hai giờ, và cầu thang. Tôi sẽ đếm từng bậc cho bạn.

**Câu chốt của Mei theo mức kết:**
- **Sạch:** "Six dumplings, and he never knew. That's the best sale I've made all year." → Sáu cái há cảo, mà hắn chẳng hay biết gì. Vụ bán hời nhất năm nay của bà.
- **Lộn xộn:** "We got most of it. Next time, write down who said what." → Được gần hết. Lần sau ghi lại ai nói cái gì nhé.
- **Hỏng:** "He knows something's up. Tomorrow I'll give him seven, to confuse him." → Hắn biết có chuyện rồi. Mai bà cho hắn bảy cái, cho hắn rối.

**Bản tin (Kit đọc, đài không có tài trợ):**
- **Sạch:** "A quiet night on the harbour. Only the dumpling stall was busy." → Một đêm yên ả ở cảng. Chỉ có sạp há cảo là đông.
- **Lộn xộn:** "Reports of somebody hanging about the warehouses tonight. Probably nothing." → Có tin ai đó lảng vảng quanh dãy kho tối nay. Chắc không có gì.
- **Hỏng:** "A van has been booked for the harbour on Friday morning. Somebody's moving out." → Có một chiếc xe được đặt tới cảng sáng thứ Sáu. Có người sắp dọn đi.

### Hệ quả từng mục

| Mục ghi sai | Hệ quả | Nhập lại |
|---|---|---|
| Giờ xe (7:30 hoặc 5:30) | Mei sửa lại; ở Kho 15, nếu không có cờ đúng, bà Delaney phải dời kiểm tra sớm hơn nữa | giờ đúng vẫn nằm trong xem lại; Kho 15 vẫn diễn ra trước xe dọn kho |
| Cửa nào (cửa đen) | Mei sửa; ở Kho 15, Gus canh nhầm cửa lúc đầu | Gus đổi sang cửa sau khi nghe thấy tiếng xe |
| (Max) Giá sàn | Claire tính sai tiền cần góp, phải hỏi lại | Claire có con số đúng trước 5a / Kho 15 |
| (Max) Thùng nào | ở Kho 15 mở thùng sai trước | thùng M vẫn được tìm thấy, chậm hơn |
| (Jun) Giá sàn | như trên | như trên |
| (Jun) Ngày họp | bà Delaney lên lịch muộn, phải dời sớm hơn | Kho 15 vẫn trước ngày họp |
| (Gus) Ca gác | ở Kho 15, tới cửa đúng lúc đổi ca, phải quay lui một lần | người gác đi khỏi sau mười phút |
| (Gus) Canh chỗ nào | ở Kho 15, người chơi tìm ở kho chứa trước | cầu thang vẫn được tìm |
| (Gus) Không vào chòi khi xe tuần tra tới | độ nóng +1, một câu của đơn vị mười hai | xe đi tiếp |

Mức kết: 0 hệ quả là Sạch, 1–2 là Lộn xộn, 3+ là Hỏng. Cờ để lại: `crew-max` / `crew-jun` / `crew-gus`, `knows-box` (Max đúng
thùng), `knows-door` (đúng cửa sau), `knows-shift` (Gus đúng ca), và `hit:<id>` cho từng hệ quả.

### Đếm

- Câu: 23 câu chung (nhịp 1–3a, kể cả lặp lại) + 4 câu chọn người mỗi đường (Max 2, Jun 4, Gus 2) + đường Max 12, Jun 8, Gus
  9 + kết 15 + mức kết 3 + bản tin 3. Cả kịch bản khoảng 80 câu; một lượt chơi nghe khoảng 45–50.
- **Người thị trấn: Max, 7 câu (06m, 07m, m02, m03, m03b, m04, k06m)**, chỉ khi đi với Max. 0 câu nếu đi với Jun hoặc Gus.
- Người nói: Mei, Rico, Kemp, Shona, Max [TT] / Jun / Gus, Mr Ashby (mới, chỉ đường Jun), tay tài xế Bayline (đường Gus),
  bộ đàm cảnh sát (Dispatch, Unit), Kit (bản tin), người chơi.
- Canon dựa vào: Kemp thích nhân thịt, câu "Pork's better" của Mei (`machine2.ts`, `ct-mei-1`); quy tắc "if it's urgent,
  it's lying" (`docs/city.md` §11); máy ghi âm cỡ đồng xu của Max (`cs-bigdeal-3`); Max "bốn mươi cho một cục pin"
  (`ct-jun-1`); điện thoại và sóng là nghề của Jun (§7); Gus "I count every boat", trực đêm, kênh lạ (`cs-bigdeal-1`); kho
  mười lăm (`hearing.ts`); Shona là trợ lý của Kemp, người gác là tay tài xế Bayline (`jobCast.ts`); xe tuần tra và bộ đàm
  cảnh sát (`docs/town.md` §28); chỗ ẩn (§29).

---

## 7. NEEDS ENGINE (ngoài ba thứ gta-m0 đang làm: chọn người đi cùng, điện thoại có tin nhắn thoại và cuộc gọi nhỡ có hạn,
manh mối trong sổ tay)

1. **"Sau tất cả":** Kho 15 mở khi xong cả bốn phi vụ b. `after` hiện chỉ nhận một id (cần `afterAll: [...]` hoặc tương đương).
2. **Câu đứt quãng (tiếng rè):** đọc một câu thành từng mảnh có khoảng lặng ở chỗ "..." (đường Jun ở 3b, phi vụ 2a, 2b, Kho 15).
   Không trộn tiếng ồn (plan §11.5 đã bác trộn ồn).
3. **Nghe lại một cuộn băng như một bước của phi vụ ở chỗ ẩn:** một sổ tay "via: tape" (tua lại thoải mái, đếm), mở ở chỗ ẩn
   nếu đã mua, ở sạp Jun nếu chưa.
4. **Phi vụ gọi xe tuần tra:** một bước khiến một xe tuần tra đi qua một con phố đúng lúc, bộ đàm cảnh sát nói câu viết sẵn
   (không chỉ câu sinh từ lỗi), và một điều kiện "bị thấy / không bị thấy" thành một hệ quả (4a, 3b đường Gus, Kho 15).
5. **Kho mười lăm trên bản đồ** (dãy kho trên Quay Street / Pier Road, số tới hai mươi hai) và **một phòng bên trong** (kệ,
   cầu thang, thùng M / N, cửa sau, cửa đen phía trước, cửa nước).
6. **Ba mạch tiếng đan xen** trong Kho 15: trong kho (nghe từng đoạn băng), ở cửa (Mei và Shona), bộ đàm (Gus, cảnh sát, cuộc
   gọi giả). Bây giờ engine đi từng bước một.
7. **Nghe từng đoạn băng không nhãn rồi chọn đúng cuộn** (Kho 15): một bước "chọn đoạn" (năm đoạn ngắn, mỗi đoạn nghe được,
   chọn một), khác sổ tay ở chỗ không có chữ để chọn, chỉ có tiếng.
8. **Nút "Đó!"** (từ Hồi I, vẫn chưa có): bấm đúng lúc câu dối được nói (3a, Kho 15) hoặc đúng câu có con số.
9. **Thuyền chạy và cửa nước** (4b, Kho 15): bây giờ thuyền chỉ là cảnh vật đứng yên.
10. **Phần chia tiền theo người đi cùng** (nếu phần chọn người của gta-m0 chưa có).
11. **Đếm số chuỗi đã xong** để đổi lời thoại của chuỗi làm sau cùng (Shona đã đánh hơi thấy): hoặc một điều kiện `count`, hoặc
    phi vụ b nào cũng đọc ba cờ của ba chuỗi kia bằng `past`.

---

## 8. Đếm câu

| Phi vụ | Câu (kể cả nhánh, ước) | Câu người thị trấn (clip) |
|---|---|---|
| 1 Bán đài | 55 | 0 |
| 2a Đường truyền ngoài trời | 50 | 0 |
| 2b Đường dây chéo | 60 | Max 5 (chỉ khi đi cùng) |
| 3a Câu hỏi thứ hai | 55 | 0 |
| 3b Hộp há cảo | 80 | Max 7 (chỉ khi đi cùng) |
| 4a Ca đêm | 55 | 0 |
| 4b Cửa nước | 55 | 0 |
| 5a Gọi vào đài | 70 | 0 |
| 5b Tuần cuối | 65 | Tom 3 |
| 10 Kho 15 | 90 | Max 4 (chỉ khi 3b đi với Max) |
| **Cả hồi** | **khoảng 635** | **19** (Max 16, Tom 3), khoảng 900 ký tự |

Giữ thấp có chủ ý: chỉ Max (thành viên băng, mang một kiểu nghe riêng: giọng Úc, nghe lại) và Tom (một cú gọi cảm động cho
đêm chia tay của Marcus). Số clip là trần: người chơi không đi cùng Max thì không bao giờ nghe các câu đó, nhưng clip vẫn phải
tạo để ai chọn Max cũng có.

---

## 9. Canon cần thêm vào `docs/city.md` khi phi vụ được xây (Act II)

- **Coastline Radio** là công ty chủ Bay FM ("head office"); **Mr Ashby** lo vụ bán đài; giá sàn bốn mươi nghìn; hội đồng
  họp ngày mười ba.
- **Đường talkback** từ sân khấu Bay FM ở bến cảng về phòng thu chạy trên sóng hở; máy quét của Bayline thu được.
- **Kho mười lăm** là kho của Bayline, thuê của Ban quản lý cảng; trong đó có kho băng của Bayline (nhiều năm, chia thùng theo
  chữ cái; thùng M dưới cầu thang là talkback của Bay FM) và mấy thùng giấy cũ của Vane. Người gác đêm là một tài xế Bayline,
  trực từ mười giờ tới hai giờ. Cửa trước sơn đen; xe chuyển đồ vào cửa sau; có cửa nước ra cầu tàu.
- **Kemp ăn sáu cái nhân thịt của Mei mỗi tối lúc chín giờ.**
- **Bay FM thành đài của người nghe** (Claire đứng tên; Frank, Gianna, Hal… góp tiền); chương trình đêm của Marcus trở lại.
- **Bà Delaney bị đình chỉ** sau Kho 15 (Kemp khiếu nại).

---

## 10. Chỗ tao chưa chắc

### Canon mỏng, tao đã tự chọn

1. **Bay FM có công ty chủ ở đâu đó khác.** Canon chỉ có "head office is sending a new desk" (`ct-kit-2`). Tao đặt tên
   Coastline Radio và cho nó bán đài. Nếu chủ dự án muốn Bay FM là của Marcus hay của thành phố thì cả trục Hồi II phải đổi.
2. **Đường talkback trên sóng hở** là tao thêm. Nó lặp lại mô-típ "Kemp nghe kênh hở" của Hồi I; tao giữ vì nó là thứ ăn
   khớp nhất với Kemp, nhưng cách thắng khác: Hồi I bắt hắn DÙNG điều nghe được, Hồi II phải TÌM ra đúng cuộn băng trong kho
   của chính hắn, và người nghe mua lại đài.
3. **Giấy tờ của Vane trong kho mười lăm** chỉ là một mẩu khép lại câu "That's where the papers are". Tao cố tình không làm
   chúng thành mối đe dọa: ở Hồi I mọi sạp đã ký lại hợp đồng với Ban quản lý cảng, nên đơn của Vane không còn giá trị.
4. **Đạo đức của việc nghe điện thoại Kemp** (đường Jun ở 3b, phi vụ 2b): tao để Mei phản đối và Jun nói "chỉ lần này". Nếu
   chủ dự án muốn băng không bao giờ nghe lén điện thoại thì 2b đổi thành chỉ nghe đường talkback (cái Kemp đã làm với họ).
5. **Thứ tự "giữa hồi" của plan:** `docs/gta-plan.md` §5 đặt Kho 15 giữa Hồi II; tao đặt nó cuối (phi vụ thứ mười), theo yêu
   cầu của phiên điều phối.
6. **Người lái thuyền ở 4b** có thể cần một người mới (tao để "người lái thuyền", "Shona's cousin"); nếu không muốn thêm người
   thì cho tay tài xế Bayline lái.
7. **"Mr Pryce" ở 5a** là một người của Bayline gọi vào đài: một tên mới chỉ để làm cặp đồng âm Pryce / price.

### Khó dựng trong thị trấn 3D nhìn từ trên xuống

- Kho 15 là phi vụ khó nhất: ba mạch tiếng cùng lúc và một căn phòng mới; nếu engine chưa kịp, có thể chia nó thành ba bước liền
  nhau (cửa, trong kho, bộ đàm) và mất cảm giác "cùng lúc".
- 4a và 4b là phi vụ đêm: người chơi phải chờ đồng hồ game tới giờ (48 phút thật một ngày game), nên cần cho bắt đầu chỉ khi
  game đang tối, hoặc cho "Nằm nghỉ" ở chỗ ẩn tới giờ.
- Nghe lén ở quán Gianna (5b) cần Kemp và Ashby đứng trong thế giới: Kemp có, Ashby chưa có hình.

### Câu hỏi thật sự của chủ dự án

1. **Trục Hồi II: Kemp mua Bay FM** (và hai mươi năm băng giọng nói của thành phố) có ổn không, hay mày muốn Hồi II xoay quanh
   chuyện khác?
2. **Cái giá cuối hồi:** bà Delaney bị đình chỉ, và Kemp vẫn giữ hai mươi năm băng ("I have the rest"). Có nặng quá không?
3. **Nghe lén điện thoại của Kemp** (đường Jun): được phép trong truyện, hay băng chỉ nghe những gì hắn để hở như hắn từng làm?
4. **Chọn người đi cùng có tốn tiền** (phần chia) hay chỉ đổi kiểu nghe?

---

## 11. As written (2026-11-27): năm phi vụ đầu tiên thành dữ liệu chơi được

Phiên này viết phi vụ 1, 3a, 3b, 5a, 5b; phiên kia viết phần còn lại (2a, 2b, 4a, 4b, Kho 15). Mỗi file có danh sách thay
đổi ngay đầu file.

| Phi vụ | File | Câu (kể cả nhánh) | Người thị trấn (clip) | Mở sau | Thứ tự |
|---|---|---|---|---|---|
| 1 Bán đài | `src/data/city/jobs/act2Sale.ts` | 50 | 0 | `job-hearing` | 10 |
| 3a Câu hỏi thứ hai | `act2Second.ts` | 37 | 0 | `job-sale` | 13 |
| 3b Hộp há cảo | `act2Dumplings.ts` | 84 | Max 8 (chỉ đường Max) | `job-second` | 14 |
| 5a Gọi vào đài | `act2Callin.ts` | 49 | 0 | `job-sale` | 17 |
| 5b Tuần cuối | `act2Farewell.ts` | 43 | Tom 3 | `job-callin` | 18 |

**Đổi so với kinh truyện:**

1. **Phi vụ 1:** hạn gọi lại là của chính chiếc điện thoại (cuộc gọi nhỡ có hạn của engine). Sổ tay là tin nhắn thoại của
   Marcus (`via: 'voicemail'`), giờ hẹn là buổi họp ở sạp bà Mei, đi tới đó có hạn theo giờ hẹn. "Ai mua" có lựa chọn nhầm là
   Coastline (bên bán), không phải "người của đài": hai hãng cùng đuôi "-line". Buổi họp kết bằng câu Rico hỏi ai lo đường
   talkback (đáp theo ý). Lời mời của Kemp đổi theo cờ của phi vụ 1 Hồi I.
2. **3a:** người đi cùng là Sol (sạp bên cạnh) hoặc bà Okafor (giờ tàu). Nhờ bà Okafor để mắt tới ông Ashby thì đặt cờ
   `okafor-watch`, đọc ở 5b. Câu dối của Shona được bắt bằng nút "Đó!" (bước `spot`). "Every word" có lựa chọn nhầm thứ ba
   là "every record".
3. **3b:** viết đúng như mục 6, trừ mấy chỗ sau. Cửa kho mười lăm là chỗ `w15-front`. Băng của Max là sổ tay
   `via: 'tape'` (tự đưa tới chỗ ẩn, hoặc sạp Jun nếu chưa có chỗ ẩn), nên câu m03b bỏ. Hai câu có "..." của đường Jun là
   `broken`. Đường Gus dùng bước `patrol` trên Quay Street. Đi một mình thì chỉ nghe được ở cửa. Cuối phi vụ, người chơi
   nói lại điều mình đã ghi (theo sổ), không chọn.
4. **5a:** bốn người góp tiền trong hai sổ tay: Frank 30 (13, 3), Gianna 180 (118, 108), Hal "twelve, no, twenty", Nora 60
   (16, 6). Không có "bữa tối" của Gianna. "Ông Pryce" và chị của người gác dùng giọng người gọi vào đài đã có. Ca của người
   gác thành cờ `watchman` cho 4a (`past: 'job-callin:watchman'`). Đi với Kit thì Kit đọc tên từng người trước; đi với Claire
   thì Claire bắt lỗi ghi sổ ở cuối, còn không thì Marcus.
5. **5b:** ông Ashby chưa có hình trong thế giới, nên ông được tả, được Shona đón và được nhắc tới. Hai người bị nghe lén ở
   quán Gianna là Kemp và Shona, lúc Ashby đi rửa tay. Chỗ ngồi là "bàn số chín" (năm, mười chín), không phải "cạnh cửa sổ".
   Ghi áo màu xám thì hỏi nhầm ông Whitlock.
6. **Người nói mới** (`core/town/sceneTypes.ts`): `ashby` (ông Ashby · Coastline), `scanner-desk`, `scanner-unit` (bộ đàm
   cảnh sát).
7. **Không còn chỗ `// ENGINE` nào.** Lúc tao bắt đầu viết, engine đã có đủ các món trong danh sách NEEDS ENGINE mà năm
   phi vụ này cần (spots của kho mười lăm, `broken`, `via: 'tape'`, `patrol`, `spot`), nên tao dùng thẳng.

**Clip cho chủ dự án:** 11 câu (Max 8 ở 3b đường Max, Tom 3 ở 5b), chỉ bản nối âm, `npm run audio:generate`.

**Đã chạy bằng script** (Edge headless trên dev server riêng, chế độ admin, tiếng tắt):
- Phi vụ 1: tới màn xem lại. Script chọn bừa giờ đầu tiên nên ra Lộn xộn (ghi sai giờ → tới muộn, đúng như thiết kế).
- 3b đi với Jun: Sạch.
- 3b đi với Max: Sạch. Không có chỗ ẩn nên engine dẫn tới sạp Jun nghe băng.
- 3b đi với Gus: Lộn xộn. Script đứng yên ở cửa kho lúc xe tuần tra chạy qua Quay Street nên bị thấy: bước `patrol`
  hoạt động.

**Chưa chạy:** 3a (nút "Đó!"), 5a, 5b, và 3b đi một mình.

**Chưa ai kiểm:** chưa ai đọc hay nghe lời thoại (model viết); chưa chơi bằng tay hay trên điện thoại.
