# Kinh truyện Hồi I: "Chân chạy việc"

Viết 2026-11-26, cho chủ dự án đọc và quyết. Đây là ĐỀ XUẤT, chưa có dòng code nào, chưa có gì thành canon. Nó nối
tiếp hai phần truyện chính đã có ("Kèo lớn ở Westbay", `src/data/city/seasonsMain.ts`; "Người đứng sau Crane",
`src/data/city/seasonsMain2.ts`) và theo khung phi vụ bốn nhịp của `docs/gta-plan.md` §3, cùng các điểm soát lại ở
§11 (truyện Hồi I mỏng, "kẻ đứng sau" lần thứ ba, không có phản diện có tên, người chơi không có lai lịch).

**Đọc gì trước:** mục 6 (phi vụ 1 viết đủ từng câu). Rồi mục 2 (phản diện) và mục 3 (cả hồi trong một trang). Các
mục còn lại là dàn ý để soát.

Quy ước trong file:

- Lời thoại tiếng Anh trong ngoặc kép, nghĩa tiếng Việt ngay dưới (→).
- ★ đánh dấu câu mang một chi tiết người chơi bị kiểm (ghi sổ tay hoặc làm theo).
- **[TT]** đánh dấu câu của một người thị trấn: cần clip Gemini (chủ dự án tự chạy tạo), một clip một câu (bản nối
  âm; "Rõ từng từ" của người thị trấn trong cảnh thành phố là giọng trình duyệt, như `core/town/cityAudio.ts` đang
  làm). Mọi câu khác là người Westbay hoặc nhân vật mới: giọng trình duyệt, không tốn gì.
- "Người chơi" / "bạn" là nhân vật người học tự tạo (tên, nam hay nữ). Không câu nào gọi họ bằng từ chỉ giới tính.

---

## 1. Người chơi: "mày" là ai từ phần 3

### Những gì đã có, không được đụng

- Ở thị trấn, người chơi "mới chuyển đến tuần trước" (`src/data/townStories.ts` square-1), được Leo chào, quen dần
  13 người. Tiếng Anh nói được (các câu 'you' của tập truyện), nhưng là người từ xa tới: app là app luyện nghe.
- Có thể đã tạo nhân vật (nam / nữ, tên), có thể đã cưới một người thị trấn và có tới ba đứa con
  (`docs/town.md` §15). Vợ / chồng vẫn sống ở chỗ của họ trong thị trấn; chưa có "nhà riêng".
- Ở Westbay: xuống xe số 9 là gặp Rico ngay (`ct-rico-1`, "You're Sam's friend, right?"). Nếu đã chơi `station-4`
  và nhờ anh họ của Sam, Rico từng chở họ ra sân bay (sự kiện `you:sams-cousin-taxi`, `src/data/stories/station.ts`).
- Chuyến xe cuối về thị trấn là 10:15 tối (`docs/city.md` §1).

### Lai lịch đề xuất (chỉ thêm, không đổi gì ở trên)

- **Vì sao ở Westbay:** người chơi vẫn sống ở thị trấn (với gia đình, nếu có), lên thành phố bằng xe số 9 như mọi
  người thị trấn khác. Thành phố nói nhanh hơn thị trấn: ở thị trấn người ta nói chậm với người mới, ở Westbay không
  ai chậm cho ai. Đó là lai lịch "tai chưa quen" mà §11.7 của plan đề xuất, và nó đúng với người học thật.
- **Vì sao Rico nhận họ:**
  1. Rico cần người nghe máy số hai. Giấc mơ của anh là "hai cái điện thoại và một tấm bản đồ trên tường", và Tess đã
     nói thẳng là cô không nghe máy thứ hai ("I'll bring the coffee, Rico. You answer your own phones.",
     `ct-rico-3`, `src/data/city/episodesA.ts`).
  2. Người chơi **hỏi lại**. Rico nói nhiều vì mười hai tiếng một mình trong xe mà khách chỉ nhìn điện thoại
     (`ct-rico-3`). Người chơi là người đầu tiên bảo anh nói lại câu vừa nói, thay vì gật đầu rồi làm sai. Với Rico
     đó là lắng nghe. Đây là lý do trong truyện để nút "Xin nhắc lại" tồn tại (plan §11.3), và nó không bao giờ bị
     chê trong lời thoại; nó chỉ tốn thời gian và được đếm trung thực.
  3. Người chơi là **cầu nối với thị trấn**. Băng của Rico ở Westbay, nhưng mật mã ở phi vụ 3 dựa trên những thứ chỉ
     người thị trấn biết (con chó Chip của Sam, ngày thứ Tư của Grace ở bệnh viện). Bayline không biết thị trấn.
- **Người chơi muốn gì:**
  - Trước mắt: có việc, có tiền (Rico chia tiền cuốc, chưa trả lương: anh chưa có tiền).
  - Sâu hơn: thôi gật đầu khi chưa hiểu. Ở phi vụ 1, Kemp sửa lại chính lời đặt xe của hắn cho người chơi nghe. Ở
    phi vụ 8, người chơi là người bắt được một chữ sai trong cả một lá thư đọc to. Cung truyện của người chơi trong
    hồi này là cái tai, nói trung thực: từ "nghe sót" thành "biết mình sót chỗ nào và hỏi lại". Không câu nào hứa
    nghe như người bản xứ.
  - Cuối hồi: tên người chơi được ghi cạnh tên Rico trên hợp đồng thuê trạm gác ("Rico and partner"). Đó là "được tin".
- **Gia đình (nếu có):** không phi vụ nào cần nhắc tới. Đề xuất tùy chọn ở phi vụ 8: một cuộc gọi từ nhà ("có kịp
  chuyến 10:15 không?"), hai câu, nói bằng giọng Gemini của người bạn đời. Giá: 2 câu × 11 giọng có thể cưới = 22 clip
  (cách các cuộc đi chơi ở Westbay đã làm, `docs/town.md` §21). Người chơi chưa cưới thì bỏ qua cảnh đó.
- **Giọng của người chơi:** khi người chơi nói (đáp theo ý), câu tiếng Anh do game ghép từ ý họ chọn, đọc bằng giọng
  trình duyệt đúng giới tính, hiện cả chữ. Điều này PHÁ một luật của canon: `docs/city.md` §5 "The learner is there
  and is talked to, but never speaks". Cần chủ dự án đồng ý (câu hỏi ở mục 7).

---

## 2. Phản diện của Hồi I: Duncan Kemp, chủ hãng Bayline

### Hắn là ai

- **Duncan Kemp**, chủ **Bayline**, hãng taxi lớn nhất Westbay (mười năm nay). Bayline đã là canon từ phi vụ mẫu M0:
  một hãng taxi nghe trộm bộ đàm của người khác, cướp khách của Rico, xe đậu chờ trên Station Avenue mỗi tối
  (`docs/city.md` §13, `src/data/city/jobs/ferry.ts`). Kemp là cái mặt của Bayline. Hồi I không giấu hắn: người chơi
  chở hắn ngay ở phi vụ 1.
- Lịch sự, ấm áp, không bao giờ vội, trả tiền boa hậu. **Không bao giờ nói dối.** Đây là chỗ hắn khác hai kẻ trước:
  Crane lừa bằng một cái quỹ giả, Vane lừa bằng một lá đơn giả. Kemp nói thẳng mình muốn gì.
- Câu định nghĩa hắn (phi vụ 1): "Mrs Vane tried to take this harbour with a pen and a lie. I'm just going to buy
  it." (Bà Vane định chiếm cảng bằng một cây bút và một lời nói dối. Tôi thì chỉ định mua nó.)

### Hắn muốn gì

Cảng. Không phải bằng lừa, bằng mua: các sạp ở chợ đêm, vòng đu quay, và **cái trạm gác cũ** mà Gus mời Rico về
làm văn phòng ở cuối phần 2 ("Rico, the old gatehouse is empty. Two phones would fit.", `cs-bigdeal-6`). Kemp muốn trạm
gác làm bãi xe của Bayline ở cảng, và một ngày nào đó biến khu chợ đêm thành bãi đỗ xe cho phà.

### Vì sao hợp pháp trên giấy, sai trong thực tế

Nối thẳng từ phần 2, không lật lại gì:

1. Sau vụ Vane, **Ban quản lý cảng** (Harbour Trust, chủ thật của mọi sạp và cái trạm gác) làm một việc đúng: mọi chủ
   sạp ở cảng phải tới ký lại hợp đồng thuê, tận nơi, trước một hạn chót, để không ai còn ký nhượng sạp qua điện thoại
   được nữa. Sạp nào không ký lại kịp thì đem ra đấu thầu công khai. Trạm gác bỏ trống cũng đem ra đấu thầu.
2. Gus mời Rico là thật lòng, nhưng **trạm gác không phải của Gus mà cho**. Rico phải nộp hồ sơ và thắng phiên xét
   hồ sơ của Ban quản lý cảng. Kemp cũng nộp. Tất cả đều đàng hoàng.
3. Cái sai: Kemp thắng bằng **cái tai**. Xe Bayline gắn máy quét sóng, nghe mọi bộ đàm không mã hóa ở cảng: bộ đàm
   của Rico, của chợ đêm, và cả kênh an ninh ở cổng cảng mà Gus và Ban quản lý cảng dùng. Hắn biết ai sắp bỏ cuộc, ai
   ốm, ai trễ hạn, ai đang hỏi giá, và có mặt trước. Khẩu hiệu của Bayline trên đài: "Wherever you're going, we're
   already there." (Bạn đi đâu, chúng tôi đã ở đó rồi.) Câu đó đúng theo nghĩa đen.

### Vì sao không thắng được bằng cách lên đài thêm lần nữa

- **Hắn không nói gì để mà bắt.** Băng của bà Mei bắt được Vane vì Vane nói dối thành tiếng. Kemp biết có máy ghi âm
  (cả thành phố đã nghe băng của Mei), nên hắn chỉ nói điều thật. Ở phi vụ 1 hắn còn quay lại bảo người đang nghe lén
  hắn: "You can come closer. I never say anything I wouldn't say on the radio."
- **Hắn trả tiền cho đài.** Bayline tài trợ bản tin giao thông của Bay FM, và theo hợp đồng thì nuôi luôn chương
  trình đêm của Marcus (phi vụ 4). Marcus đánh Kemp trên sóng là tự cắt chương trình của mình.
- **Thành phố quý hắn.** Bayline rẻ, đúng giờ, chở người già miễn phí đi ký lại hợp đồng (phi vụ 2). Lên đài nói "hắn
  nghe trộm" mà không có bằng chứng thì người nghe sẽ hỏi: thế thì sao, xe vẫn tới đúng giờ.
- **Nghe sóng không mã hóa khó chứng minh ở tòa.** Thứ duy nhất làm hắn thua là luật của chính Ban quản lý cảng: người
  dự thầu dùng thông tin nội bộ của Ban thì bị loại. Phải chứng minh hắn **biết điều mà hắn không thể biết** nếu không
  nghe kênh của Ban. Đó là cái bẫy ở phi vụ 6 và 8, và nó là một trò nghe.

### Liên quan tới văn phòng của Rico

Trạm gác là thứ hai bên giành nhau từ đầu tới cuối hồi. Rico mở hãng trong đó ngay ngày đầu (Gus cho dọn vào ở tạm),
và mỗi phi vụ là một dòng trong hồ sơ mà Ban quản lý cảng sẽ đọc ở phiên xét (mục 3).

### Vì sao không phải "kẻ đứng sau" lần thứ ba

Kemp không đứng sau Crane hay Vane. Hắn là kẻ cơ hội đã đứng xem Vane thua và rút ra bài học: đừng nói dối, hãy nghe.
Hồi I là đấu trí với một người ai cũng biết mặt, không phải truy tìm một cái tên. Cuối hồi hắn vẫn còn đó, thua một
ván và thắng một ván khác.

### Nhân vật mới (đề xuất, chưa canon)

| Ai | Là gì | Giọng |
|---|---|---|
| **Duncan Kemp** | chủ Bayline; áo khoác xanh than; tự đọc quảng cáo của hãng mình trên Bay FM | trình duyệt, nam |
| **Mrs Delaney** | cán bộ cho thuê của Ban quản lý cảng; kính đỏ, kẹp hồ sơ, chỉ tin giấy tờ, công bằng tới mức khó chịu | trình duyệt, nữ |
| **Shona** | trợ lý của Kemp; mang bản tin giao thông đánh máy sẵn tới Bay FM | trình duyệt, nữ |

Chỗ mới trên bản đồ (chưa có trong `src/data/cityWorld.ts`): **trạm gác cũ** (văn phòng của Rico) cạnh chòi gác của Gus
trên Pier Road; **văn phòng Ban quản lý cảng**, tầng trên chợ đồ điện tử trên Quay Street.

---

## 3. Cả hồi trong một trang

**Hồi I, "Chân chạy việc": tám phi vụ, khoảng hai tuần trong truyện.** Mở khi đã nghe hết phần 2 (`cs-bigdeal-6`).

Tiền cược leo dần: một cuốc xe → các sạp ở cảng → khách của hãng → tiền nuôi đài → uy tín của hãng → bằng chứng →
tiền đặt cọc của một người bạn → cái trạm gác. Người chơi leo từ "người nghe máy số hai" tới "người có tên trên hợp
đồng".

| # | Phi vụ | Người chơi làm | Cược | Kemp làm |
|---|---|---|---|---|
| 1 | **Máy số hai** | nghe cuộc đặt xe đầu tiên, đón khách, chở ra chợ đêm | khách đầu tiên của hãng | là chính người khách đó; báo rằng hắn cũng xin trạm gác |
| 2 | **Nửa sáu** | đưa Sol và Fay đi ký lại hợp đồng trước giờ đóng cửa | sạp lồng đèn và vòng đu quay | ngồi chờ ở hành lang, cây bút trong tay, hồ sơ thầu sẵn cho từng sạp |
| 3 | **Chip là ga** | Max và Jun đổi bộ đàm, đặt mật mã theo chuyện thị trấn; người chơi chạy ba cuốc bằng mật mã | khách của hãng quay lại | thua một ván: Bayline không giải được mật mã |
| 4 | **Ba chữ một lần** | Sam (ghét gọi điện) chỉ đường qua điện thoại để bám một xe Bayline | sự thật về bản tin giao thông | trả tiền cho bản tin, rồi tự gây tắc đường mà bản tin báo |
| 5 | **Ghế của bà Delaney** | điều phối cuốc xe trong khi cán bộ Ban quản lý cảng ngồi xem | hồ sơ của hãng | gọi vào máy số hai, ngay trước mặt bà Delaney, mời người chơi về Bayline |
| 6 | **Ba kênh** | bẫy: ba điểm đón giả trên ba kênh bộ đàm, xem Bayline tới chỗ nào | bằng chứng hắn nghe kênh của Ban quản lý cảng | cắn câu |
| 7 | **Tiền của Tess** | chạy khắp thành phố xin ba thư giới thiệu trước hạn; thiếu tiền đặt cọc | hồ sơ đủ hay không | người của hắn đi xin thư giới thiệu trước một bước |
| 8 | **Một chữ sai** | phiên xét hồ sơ; nghe lá thư dự thầu của Kemp đọc to và bắt đúng câu lộ ra | trạm gác | thua trạm gác; nhưng đã mua kho số mười lăm sáng hôm đó |

**Hồ sơ.** Mỗi phi vụ "Lộn xộn" hoặc "Hỏng" ghi thêm một dòng vào hồ sơ của hãng mà bà Delaney giữ (khách đầu tiên
chờ nửa tiếng; một sạp ký trên bậc thang lúc 5 giờ 31; một xe tới nhầm cửa…). Ở phi vụ 8, Kemp đọc từng dòng đó ra,
và mỗi dòng là thêm một câu hỏi mà Rico phải trả lời. Hồ sơ không làm thua hồi (phi vụ 8 luôn thắng trạm gác nếu bắt
được câu lộ), nhưng làm phiên xét dài hơn, khó hơn, và đổi câu chốt của Rico. Đó là "lòng tin của băng" ở dạng nhìn
thấy được.

**Kết hồi: thắng, có giá.**

- **Thắng:** lá thư dự thầu của Kemp nhắc tới một chi tiết chỉ từng được nói trên kênh của Ban quản lý cảng (cái bẫy
  ở phi vụ 6–7). Hắn bị loại theo luật của Ban. Trạm gác thuộc về "Rico and partner".
- **Cái giá:**
  1. Tess bỏ tiền dành dụm mở quán (canon: cô để dành cho "a real café … with a lemon cake like Emma's", `docs/city.md`
     §6) vào tiền đặt cọc. Quán của cô lùi lại, không biết bao lâu.
  2. Bayline rút tài trợ khỏi Bay FM. Từ thứ Hai, chương trình đêm của Marcus bị cắt. Gus, người trực mười hai tiếng
     mỗi đêm với Marcus làm bạn (`ct-gus-1`), ngồi trong chòi với cái đài im lặng.
- **Mở Hồi II:** Kemp ra về, không giận: sáng hôm đó hắn đã thắng thầu **kho số mười lăm**, thầu lặng lẽ, không ai tới.
  Đó là cái kho mà Crane nói "That's where the papers are" và Vane dặn Rico "you never heard of warehouse fifteen"
  (`cs-bigdeal-2`, `cs-bigdeal-4`), và chưa ai từng tới đó. Hồi II ("Băng bến cảng") mở với hai việc cần làm: đưa
  chương trình của Marcus trở lại sóng (chuỗi của Marcus và Gus), và biết trong kho mười lăm có gì (phi vụ "Kho 15",
  để nguyên cho Hồi II, chưa dùng ở đây).

---

## 4. Tám phi vụ: dàn ý

Mỗi phi vụ theo bốn nhịp của plan §3: (a) nghe lệnh + sổ tay, (b) trên đường, (c) tại chỗ, (d) kết. Mỗi chi tiết ghi
sai có MỘT hệ quả rồi nhập lại mạch chính (plan §11.4); mức kết đếm số hệ quả: 0 là Sạch, 1–2 là Lộn xộn, 3 trở lên
(hoặc mất khách / mất mục tiêu) là Hỏng.

Cách đọc phần "dễ nghe nhầm": mỗi lựa chọn sai trong sổ tay phải là thứ một cái tai nghe nửa vời thật sự ghi ra, kèm
lý do vì sao hai thứ đó nghe gần nhau trong lời nói nối âm.

### Phi vụ 1. Máy số hai

Viết đủ ở mục 6. Tóm tắt: ngày đầu ở trạm gác, máy số hai đổ chuông, khách tên Kemp đặt xe; người chơi đón hắn ở
Meridian, chở ra sạp há cảo của bà Mei, nghe hắn ngỏ ý mua sạp của bà và trả lời đúng câu hỏi "có gấp không" của
bà. Rico nghe tên khách thì mới biết: Duncan Kemp, chủ Bayline.

- Nơi: trạm gác cũ (Pier Road) → bên hông trụ sở Meridian, sạp báo (khu văn phòng) → sạp há cảo, chợ đêm.
- Người nói: Rico, Tess, Kemp, Kit (trên đài), Mr Whitlock, Hana, Dev, Fay, Mei, người chơi. Khoảng 75 câu kể cả
  nhánh, một lượt chơi nghe khoảng 45. **Người thị trấn: 0 câu, 0 clip.**

### Phi vụ 2. Nửa sáu ("Half five")

**Vì sao có:** đưa cái luật ký lại hợp đồng vào truyện, cho thấy Kemp thắng bằng giấy tờ hợp pháp, và cho người chơi
một chiến thắng nhỏ đầu tiên cho người khác.

**(a) Nghe lệnh.** Jun gọi từ sạp sửa đồ, chiều thứ Sáu. Ban quản lý cảng dán thông báo: chủ sạp ký lại tận nơi trước
giờ đóng cửa hôm nay; hai người chưa ký. Jun nói nhanh, đang hàn dở một cái gì đó.

| Mục sổ tay | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Ai chưa ký ★ | Sol và Fay | Sol và Mei; chỉ Sol | "Sol and Fay": "and" teo thành /n/, dính vào chữ sau; Fay và Mei cùng vần /eɪ/, chỉ khác phụ âm đầu, và tên Mei thì cả cảng nhắc suốt từ vụ cuộn băng |
| Hạn chót ★ | 5:30 ("half five") | 4:30; 5:00 | "half five" là kiểu Anh của 5:30, rút từ "half past five". Người học nhiều nước hiểu "nửa năm giờ" là 4:30 (như "halb fünf" của tiếng Đức); người khác chỉ giữ được chữ "five" |
| Ký ở đâu ★ | văn phòng Ban quản lý cảng, tầng trên chợ đồ điện tử, Quay Street | bến phà (Pier Road); Bay Road | "Quay" viết như "kway" nhưng đọc là /kiː/, y như "key". Tai nghe "Key Street" không khớp với chữ nào trên bản đồ, nên đoán chỗ nghe có vẻ "của cảng" nhất là bến phà |
| Mang theo gì ★ | bản hợp đồng cũ, tờ màu xanh lá ("the green copy") | tờ in mới ("the clean copy") | /griːn/ và /kliːn/: cùng nguyên âm dài, cùng đuôi /n/, khác cụm phụ âm đầu gr / kl mà nói nhanh thì nghe sát nhau; cả hai đều là tính từ hợp lý cho một tờ giấy |

**(b) Trên đường.** Rico qua bộ đàm (trước khi đổi mật mã, nên Kemp nghe được, và đó là lý do hắn có mặt sẵn ở văn
phòng): "Don't drive on the quay, Gus will kill us." Bản tin giao thông Bay FM, do Bayline tài trợ, báo Bayline chở
miễn phí chủ sạp đi ký lại hôm nay. Kemp tốt bụng, và hợp pháp.

**(c) Tại chỗ.** Ba miếng:
- **Đáp lời theo ý, với bà Mei.** Sol không bỏ sạp được: tối thứ Sáu là tối đông khách nhất của anh (`ct-sol-2`).
  Người chơi nhờ bà Mei trông hộ (bà từng trông sạp cho Sol ở lễ hội lồng đèn, `docs/city.md` §12). Ý "Gấp lắm bà ơi"
  thì bà đáp bằng quy tắc của bà: "If it's urgent, it's lying." và bắt đợi bà gói xong mẻ bánh. Ý "Không gấp, bà
  trông giúp nửa tiếng thôi" thì bà gật ngay. Đây là khoảnh khắc vui của phi vụ. (Sol: anh, không phải ông; canon
  không nói tuổi.)
- **Tìm người theo lời tả.** Fay sợ độ cao, đứng lên ghế còn chóng mặt (`ct-fay-1`), và văn phòng ở tầng trên. Cô
  không leo cầu thang. Người chơi phải tìm bà Delaney trong đám người ở chân cầu thang ("red glasses, a clipboard,
  never sits down") và nhờ bà xuống.
- **Nghe lén.** Kemp ngồi băng ghế ở hành lang, cây bút trên đùi, gọi cho Shona: "Two left. The wheel and the
  lantern stall. If they're not in by half five, they go to tender on Monday." Người chơi nghe được câu này thì biết
  phải đưa ai lên trước (vòng đu quay: hồ sơ thầu của Kemp cho chỗ đó dày hơn).

**(d) Kết và hệ quả từng mục:**
- Ghi Mei: tới sạp bà Mei, bà đã ký từ chín giờ sáng ("In ink. Twice."), chỉ tay sang Fay. Mất thời gian.
- Ghi giờ sớm hơn: đồng hồ trên thẻ nhiệm vụ chạy gấp, người chơi phóng xe qua thanh chắn của Gus. Độ nóng +1, Gus
  càu nhàu ở phi vụ sau.
- Ghi nhầm chỗ: tới bến phà, thuyền trưởng Odile chỉ: "Quay Street. Key, like a door key." Mất thời gian.
- Mang nhầm tờ: bà Delaney không nhận, người chơi chạy lại vòng đu quay lấy tờ màu xanh. Mất thời gian.
- Nhập lại mạch chính: nếu tới 5:30 vẫn còn người chưa ký, bà Delaney ký cho Fay ngay trên bậc thang cuối lúc 5:31
  ("I didn't hear the clock."). Hồ sơ của hãng ghi thêm một dòng, và Kemp sẽ đọc dòng đó ở phi vụ 8.
- Sạch: Kemp gập cây bút lại, đứng dậy: "Next time, then." Hỏng: Fay ký trên bậc thang, Kemp nộp đơn khiếu nại.

- Nơi: sạp của Jun (Quay Street), sạp lồng đèn và sạp há cảo (chợ đêm, Pier Road), vòng đu quay (Quay Street), văn
  phòng Ban quản lý cảng (mới).
- Người nói: Jun, Rico, Kit, Mei, Sol, Fay, bà Delaney, Kemp, Odile. Khoảng 55 câu. **Người thị trấn: 0.**
- Canon dựa vào: Sol bận tối thứ Sáu (`ct-sol-2`, chats2.ts); Mei trông sạp cho Sol (`docs/city.md` §12); Fay sợ độ
  cao, vòng đu quay của ông nội (`ct-fay-1`, `ct-fay-2`); quy tắc của Mei (`docs/city.md` §11); Odile ở bến phà.

### Phi vụ 3. Chip là ga

**Vì sao có:** chống lại cái tai của Kemp bằng chính thứ hắn không có (chuyện thị trấn), và cho băng thắng một ván để
người chơi thấy mình có ích. Đưa Max vào, giọng Úc, có clip.

**(a) Nghe lệnh.** Tại trạm gác. Max lên thăm Jun như mọi tháng (`ct-jun-2`: "Every month you come up here") và hai
người thay bộ đàm của hãng. Max đặt mật mã bằng chuyện dưới thị trấn: "Nobody up here knows our town. That's the
whole trick." Max nói nhanh, giọng Úc nhẹ, vừa nói vừa vặn ốc.

| Mục sổ tay | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Kênh mới ★ | kênh 13 | kênh 30; kênh 3 | "thirteen" nhấn ở "-teen", nhưng đứng trước một từ có nhấn ("channel thirteen, mate") thì trọng âm dời lên đầu (stress shift) và /n/ cuối nuốt vào chữ sau, nghe thành "THIR-tee" |
| "Chip" là ★ | Ga trung tâm (chó của Sam ngồi chờ ở bến xe) | bến phà ("ship"); sạp đồ điện tử của Jun ("chip" điện tử) | /tʃ/ và /ʃ/ chỉ khác ở cái tắc đầu; qua bộ đàm rè thì cái tắc mất. Lựa chọn thứ ba là nhầm nghĩa chứ không nhầm âm: nghe đúng "chip" mà nghĩ tới con chip |
| "Grace's" là ★ | bệnh viện (thứ Tư Grace làm tình nguyện ở đó) | chòi của Gus ("Gus's") | /ˈgreɪsɪz/ và /ˈgʌsɪz/: cùng G đầu, cùng đuôi /sɪz/, chỉ khác nguyên âm giữa, mà qua bộ đàm nguyên âm là thứ rè nhất |

Rồi Rico gọi ba cuốc bằng mật mã, mỗi cuốc một lần, có tiếng rè (miếng "tiếng rè" của Jun trong plan §4.3). Một cuốc
có cái bẫy đồng âm: "Pick up at Chip, two to Grace's." Ghi "two" (hai người) hay "to" (tới): ghi "to" là chỉ đón
một người và bỏ lại người thứ hai.

**(b) Trên đường.** Hành khách của cuốc thứ hai là Bridget, điều dưỡng trưởng, học trò cũ của Grace
(`docs/city.md` §7). Nghe Rico gọi bệnh viện là "Grace's" qua bộ đàm, bà cười: "Grace's? That's what you call the
hospital? Oh, she'd love that." Một câu nhỏ ấm áp, và là cách người chơi biết mật mã chạy đúng.

**(c) Tại chỗ.** **Nghe lén**: một xe Bayline đậu cạnh trạm gác, cửa kính hé, bộ đàm của tổng đài Bayline bật to.
Người chơi lại gần (rõ dần theo khoảng cách) để nghe: "Anyone know what Chip is? … Chip. Like a chip. No? Boss says
leave it." Lại quá sát thì tài xế kéo kính lên.

**(d) Kết.** Mật mã giữ được. Khách quay lại với Rico trong hai ngày. Hệ quả từng mục:
- Ghi kênh 30: ba cuốc đầu bạn không nghe thấy Rico; Rico gọi điện thoại, mất một cuốc vào tay Bayline.
- Ghi "Chip" là bến phà: thuyền trưởng Odile: "I've got nobody called Chip on my ship." Khách ở ga chờ lâu, ít boa.
- Ghi "Grace's" là chòi Gus: Gus nhìn hành khách đang ôm bụng: "This is a gate, not a hospital." Trễ.
- Bỏ lại người thứ hai: người đó gọi thẳng cho Rico, Rico phải tự quay xe. Lộn xộn.
- Câu chốt của Max [TT]: "Told ya. Nobody up here's ever heard of Chip." Câu cuối của phi vụ là bản tin giao thông
  buổi sáng, Bayline tài trợ: "Expect delays around the harbour gate tonight." Mở phi vụ 4.

- Nơi: trạm gác cũ; Ga trung tâm; bệnh viện Westbay.
- Người nói: Max **[TT]**, Jun, Rico (bộ đàm), Bridget, hai khách khác, tổng đài Bayline, tài xế Bayline, Kit.
  Khoảng 55 câu. **Người thị trấn: Max, 9 câu = 9 clip.**
- Canon dựa vào: Max tháo đài của bà lúc chín tuổi, sáu năm ở đây (`docs/city.md` §10); Max lên thăm Jun hằng tháng
  (`ct-jun-2`, episodesD.ts); Chip ngồi chờ ở trạm xe với Sam (`ct-rico-2`); Grace thứ Tư ở bệnh viện (`docs/city.md`
  §4); Bridget học Grace ở London (§7, §10).

### Phi vụ 4. Ba chữ một lần

**Vì sao có:** cho thấy cách Kemp dùng tiền một cách hợp pháp (tài trợ bản tin giao thông), gieo cái giá cuối hồi
(chương trình đêm của Marcus sống nhờ tiền Bayline), và cho người chơi một trò bám đuôi buồn cười nhất có thể: người
chỉ điểm là Sam, người ghét điện thoại.

**(a) Nghe lệnh.** Rico, tại bến taxi. Đêm qua bản tin báo "tắc ở cổng cảng" mà chẳng có gì tắc; tối nay sẽ có.
Rico muốn biết ai viết bản tin. Sam đang ngồi ở ghế lái xe số 9 trong bãi xe buýt, nhìn ra cả bến taxi; Rico bắt Sam
gọi điện chỉ đường ("Today, you press the button." gợi lại `ct-rico-2`).

| Mục sổ tay | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Bám xe nào ★ | xe Bayline số 9 ("car nine, not the bus") | xe số 5 | "nine" và "five" cùng nguyên âm đôi /aɪ/; khác ở âm cuối /n/ và /v/, mà qua điện thoại âm cuối là thứ yếu nhất. Rico còn phải chen "not the bus" vì xe buýt của Sam cũng là số 9, nên câu càng rối |
| Nó rời bến lúc ★ | 6:10 ("ten past six") | 5:50 ("ten to six") | như "quarter past / to" ở phi vụ 1: hai giới từ đều không nhấn, "past" teo thành /pəs/ mất t, "to" thành /tə/ |
| Giữ khoảng cách ★ | "a bus length behind" | "a bus stop behind" | "length" /leŋθ/ và "stop" khác hẳn trên giấy, nhưng người nghe đã nghe "bus" thì đầu tự điền cụm quen nhất là "bus stop" |

**(b) Trên đường. Bám đuôi theo lời người chỉ điểm** (plan §3). Sam nói qua điện thoại, ba chữ một lần, giọng
Gemini [TT]: "Left. Market Street. Now." / "Right after the bakery." / "No. Other right." / "Slow. He's stopping."
Mỗi lệnh là một vùng đúng và vài vùng sai, như phi vụ M0. Cái bẫy nghe: "right after the bakery" và "right at the
bakery" (giới từ yếu, "after" teo thành /ˈæftə/ mà âm t gần như không bật). Lại gần hơn một xe buýt thì Sam: "Too.
Close. Mate."

**(c) Tại chỗ. Nghe lén** ở cửa sau phòng thu Bay FM (Arts Street). Shona đưa Kit bản tin đánh máy sẵn.
- Kit: "Avoid the harbour gate, heavy delays from eight? There's nothing there."
- Shona: "There will be. We've got six cars parking on Pier Road at eight."
- Kit: "That's not traffic news. That's an advert."
- Shona: "Read the contract, Kit. Bayline pays for the whole night show."
- Kit, sau một lúc: "… Fine."

Chi tiết được kiểm bằng hành động: Shona nói "at eight", nên người chơi phải tới chòi Gus trước tám giờ (đồng hồ game)
để Gus mở cổng phụ cho xe của Rico. Không có sổ tay ở đây: nghe được thì làm, không nghe được thì tám giờ biết.

**(d) Kết và hệ quả:**
- Bám nhầm xe 5: nó chở một bà khách tới quán Gianna; Sam [TT]: "Wrong. Car. Sorry." rồi chỉ xe đúng đang rẽ vào Arts
  Street. Trễ, nghe lén mất mấy câu đầu.
- Ghi 5:50: tới bến sớm hai mươi phút, đứng chờ ngay trong tầm nhìn của tài xế Bayline; hắn nhận ra xe của Rico và đi
  vòng. Phải bám từ xa hơn, Sam chỉ thêm hai lệnh.
- Ghi "bus stop behind": quá xa, mất dấu một lần; Sam: "Lost him. Wait. There."
- Không báo Gus kịp: tám giờ cổng cảng tắc thật, ba khách của Rico đi Bayline. Lộn xộn.
- Câu chốt của Sam [TT] (cả ba mức): "That was. Actually fun." rồi "Don't. Tell. Mom."
- Bản tin tối: Kit đọc bản đánh máy. Giọng anh nghe như người đọc giấy báo tử.

- Nơi: bến taxi và bãi xe buýt (khu ga), Market Street, Arts Street, cửa sau Bay FM, chòi Gus.
- Người nói: Rico, Sam **[TT]**, Kit, Shona, Gus. Khoảng 50 câu. **Người thị trấn: Sam, 9 câu = 9 clip.**
- Canon dựa vào: Sam ghét gọi điện, nhắn ba chữ (`docs/city.md` §2, `ct-rico-1`, `ct-rico-2`); xe số 9 là tuyến của
  Sam, đỗ ở bãi xe buýt (§4, cityWorld.ts); Kit đọc phần thời tiết khi Marcus vắng (`ct-marcus-3`); Bay FM có "head
  office" (`ct-kit-2`, chats.ts); Gus giữ cổng, chín giờ cấm ô tô vào bến (`ct-gus-1`).

### Phi vụ 5. Ghế của bà Delaney

**Vì sao có:** lần đầu người chơi làm đúng việc của mình (người điều phối, plan §4.4) mà có người chấm. Và Kemp gọi tới
ngay lúc đó.

**(a) Nghe lệnh.** Không có lệnh: bà Delaney tới trạm gác, ngồi xuống cái ghế duy nhất, mở kẹp hồ sơ: "I'll just
watch, if that's alright. Pretend I'm not here." Rico ra đường chạy xe. Người chơi nghe máy số hai trong hai mươi phút
game. Mỗi cuộc gọi có ba mục: đón ở đâu, đi đâu, mấy giờ; người chơi ghép xe trên tấm bản đồ treo tường và gọi Rico
bằng mật mã.

Các cuộc gọi:
1. **Grace** [TT], giọng Anh, từ bệnh viện ngày thứ Tư: hai người, bà và Bridget, ra ga kịp chuyến 5:40. Bẫy: "five
   forty" và "five fourteen" (cùng kiểu "-ty / -teen", lần này trọng âm không dời vì đứng cuối câu, nên người tinh tai
   nghe được; người chưa quen thì chưa); "me and Bridget" là hai người.
2. **Nell**, dược sĩ, nói mọi thứ hai lần (`docs/city.md` §7: "explains every dose twice"). Cuộc dễ nhất, trừ một chỗ:
   lần thứ hai bà tự sửa giờ ("Half six. No, sorry, half seven. Half seven."). Ai chỉ nghe lần đầu thì sai.
3. **Kemp.** Một cuộc đặt xe thật: "a car from my office to the hearing, Thursday at nine." Rồi, biết thừa bà
   Delaney đang ngồi đó: "Did you think about my offer?" (nếu ở phi vụ 1 người chơi đã chọn "để nghĩ đã", câu này
   thành "You said you'd think about it.").

**(b) Trên đường.** Không lái. Nhịp này là bộ đàm: Rico nhận lệnh bằng mật mã và đáp lại; người chơi nghe Rico xác
nhận ("Two to Grace's, copy") và phải bắt chỗ Rico nghe nhầm chính mình (một lần anh nhắc lại sai giờ: người chơi
sửa hay để kệ là một lựa chọn theo ý).

**(c) Tại chỗ. Đáp lời theo ý**, trước mặt bà Delaney, với Kemp:
- "Từ chối lịch sự" ("Thanks, Mr Kemp. We're busy. Was there anything else?"): bà Delaney ghi một dòng tốt.
- "Đốp lại" ("Stop listening to our radio."): Kemp, rất bình tĩnh: "I've no idea what you mean." Bà Delaney ghi:
  "accusation, no evidence."
- "Chuyển máy cho Rico": Kemp: "He's driving. You're the one I wanted." Trung tính.

**(d) Kết.** Bà Delaney đứng dậy: "It's a real business. Small. Loud. Real." Hệ quả từng cuộc gọi sai: một xe tới
nhầm cửa hoặc trễ, bà ghi vào hồ sơ đúng câu đó. Nếu phi vụ 1 có trễ, bà hỏi ở đây: "We've had a complaint. A car
half an hour late, outside Meridian, on your first night." Người chơi trả lời theo ý (nhận lỗi / đổ cho kẹt xe):
nhận lỗi thì dòng đó được ghi "acknowledged".

- Nơi: trạm gác cũ.
- Người nói: bà Delaney, Rico (bộ đàm), Grace **[TT]**, Nell, Kemp, Tess (mang cà phê vào, một câu). Khoảng 45 câu.
  **Người thị trấn: Grace, 4 câu = 4 clip.**
- Canon dựa vào: Grace thứ Tư ở bệnh viện, Bridget học trò của Grace (`docs/city.md` §4, §7, §10); Nell nói mọi liều
  thuốc hai lần (§7); Grace giọng Anh (`core/town/voices.ts`).

### Phi vụ 6. Ba kênh

**Vì sao có:** đây là phi vụ "thám tử bằng tai" đầu tiên, và là thứ chuyển truyện từ "chịu trận" sang "phản công".
Ý tưởng của bà Mei: hỏi một câu mà chỉ người nhà mới trả lời được (`ct-mei-2`: bà bắt được thằng cháu giả bằng câu
hỏi về món sinh nhật).

**(a) Nghe lệnh.** Tại sạp há cảo, tối. Jun giải thích bẫy: nói ba điểm đón GIẢ trên ba kênh khác nhau, mỗi kênh một
điểm; xe Bayline tới điểm nào thì Kemp nghe kênh đó. Rồi ba người nói, mỗi người một lần, trên kênh của mình:
- Rico, kênh của hãng: "One to Two. Pick-up at the Lumen, half nine."
- Gus, kênh an ninh cổng cảng: "Gate to all. Fare waiting on Bay Street, by the jetty, half nine."
- Thuyền trưởng Odile, kênh của bến phà: "Ferry office. Somebody's after a taxi at Fountain Lane, half nine."

Sổ tay ghi kênh nào nói điểm nào:

| Mục | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Kênh của hãng ★ | rạp Lumen | xưởng Loom | "the Lumen" /ˈluːmən/ và "the Loom" /luːm/: cùng âm đầu, cùng nguyên âm dài; "-en" cuối không nhấn, rơi mất (cặp này đã là cặp dễ nhầm trong `taxiFares.ts` và M0) |
| Kênh cổng cảng ★ | Bay Street, chỗ cầu tàu | Bay Road | tên "Street" nhấn chữ ĐẦU (BAY Street), tên "Road" nhấn chữ SAU (Bay ROAD). Nên trong "Bay Street", chữ "Street" nhẹ và nhanh; tai giữ được "Bay" và đoán phần đuôi |
| Kênh bến phà ★ | Fountain Lane | quảng trường chợ (đài phun nước) | "Fountain Lane": "Lane" sau "Fountain" dính /n/ với /l/ ("fountin-lane"); tai nghe "fountain" thì nghĩ ngay tới cái đài phun nước nổi tiếng giữa chợ |

**(b) Trên đường.** Người chơi tự chọn đứng ở một trong ba điểm (gần cổng cảng nhất là Bay Street). Hai người còn lại
canh hai điểm kia và gọi về: Tess ở rạp Lumen (gần xe cà phê của cô), Sam [TT] ở Fountain Lane (hôm đó lên thành phố),
ba chữ một lần như phi vụ 4.

**(c) Tại chỗ.** Chín rưỡi. Một xe Bayline trờ tới **Bay Street**, chỗ cầu tàu. Người chơi hoặc thấy tận mắt, hoặc
nghe Tess / Sam báo "nothing here". **Mật khẩu / câu trao đổi**: tài xế Bayline xuống xe hỏi "Taxi for… Gate?" (hắn
gọi tên theo cách Gus gọi qua bộ đàm). Người chơi phải gõ lại đúng câu tài xế vừa nói (bài gõ lại hiện có) để Jun có
nguyên văn cho hồ sơ.

**(d) Kết.** Kemp nghe kênh an ninh của cổng cảng, kênh mà Ban quản lý cảng dùng để bàn chuyện thầu với Gus. Đó là
thông tin nội bộ của Ban. Bà Delaney, khi nghe Jun kể, giận thật: "That's our channel." Bà đồng ý giăng bẫy lần hai,
cho phiên xét (phi vụ 7–8).
- Ghi nhầm kênh nào nói gì: băng đổ cho nhầm kênh. Nếu đổ cho bến phà, Odile phật ý: "Thirty years, and I've never
  leaked a word." Nhập lại: bà Mei bảo hỏi "câu thứ hai": làm lại bẫy tối hôm sau, chỉ trên hai kênh (mất một ngày;
  hồ sơ không đổi, nhưng Rico sốt ruột và câu chốt đổi).
- Không gõ lại được câu của tài xế: Jun chỉ có lời kể, không có nguyên văn. Lộn xộn, vẫn đi tiếp.

- Nơi: sạp há cảo (chợ đêm), Bay Street / cầu tàu ở bờ vịnh, rạp Lumen, Fountain Lane.
- Người nói: Jun, Mei, Rico, Gus, Odile, Tess, Sam **[TT]**, tài xế Bayline, bà Delaney. Khoảng 50 câu.
  **Người thị trấn: Sam, 3 câu = 3 clip.**
- Canon dựa vào: câu hỏi của Mei (`ct-mei-2`); radio của Gus bắt được kênh lạ (phần 2, `cs-bigdeal-1`); Odile 30 năm
  không hủy chuyến (`ct-odile-2`); Fountain Lane có trên bản đồ (`cityWorld.ts`); Bay Street chỉ được NHẮC trong
  canon (`docs/city.md` §6: xe số 9 dừng ở Bay Street bên bờ biển ngày chạy marathon), chưa có trên bản đồ.

### Phi vụ 7. Tiền của Tess

**Vì sao có:** cái giá của chiến thắng phải được trả trước khi thắng. Và một phi vụ chạy việc thuần túy, khắp thành
phố, để thấy cả thành phố đứng về phía hãng (hay không).

**(a) Nghe lệnh.** Rico, khuya, ở trạm gác, nói nhiều hơn bao giờ hết vì đang hoảng. Phiên xét cần tiền đặt cọc và ba
thư giới thiệu. Thông tin nằm rải rác trong một tràng nói có sửa lời.

| Mục sổ tay | Đúng | Nhầm | Vì sao gần |
|---|---|---|---|
| Thiếu bao nhiêu ★ | 800 ("eight hundred short") | 1.800 ("eighteen hundred"); 80 | "eight hundred" nói nhanh: "eight" mất t ("ei'hundred"); "eighteen hundred" (kiểu Anh của 1.800) chỉ thêm âm "-teen" mà "-teen" lại mất trọng âm trước "HUN-dred" (stress shift). Lựa chọn 80 là người chỉ bắt được "eight" và thấy số nghe "nhỏ" |
| Xin thư của ai ★ | bà Okafor, Bridget, Gianna | bà Okafor, Dr Osei, Gianna | Rico sửa giữa câu: "Dr Osei, no, wait, he's on nights, Bridget, then." Tai bắt tên đầu rồi thôi |
| Hạn chót ★ | trưa thứ Năm | trưa thứ Ba | "Tuesday" /ˈtjuːzdeɪ/ và "Thursday" /ˈθɜːzdeɪ/: cùng hai âm tiết, cùng "-zday", khác âm đầu t / th mà nhiều người học (và nhiều người Anh nói nhanh) làm mờ |

**(b) Trên đường.** Kemp không ngồi yên: Shona đi xin thư giới thiệu từ chính những người đó, sớm hơn một bước. Ở mỗi
chỗ, người chơi nghe người ta kể Shona vừa ghé.

**(c) Tại chỗ.** Ba điểm, mỗi điểm một miếng:
- **Bà Okafor**, ô bán vé. Bà chưa từng ngồi taxi của Rico và sẽ không bao giờ (`docs/city.md` §6). Bà đọc thư giới
  thiệu thành tiếng trong khi viết: "I have never once ridden in Rico's taxi. I recommend it to everybody else." Và về
  Shona: "A Bayline woman came at nine. I told her the rank is for taxis, not for vultures."
- **Bridget**, bệnh viện. **Tìm người theo lời tả** trong hành lang: "she'll be the one folding a sheet, corners like
  envelopes" (cách gấp Grace dạy, §10).
- **Gianna**, quán Ý. Bà đọc thư cho người chơi viết, vừa đọc vừa quát vào bếp; câu nào là thư câu nào là quát bếp,
  người chơi phải chọn (đáp theo ý: "ghi câu này?"). Vui, và là bài nghe "hai người nói chồng nhau" của plan §4.9 ở
  mức dễ.

Cuối cùng, **xe cà phê của Tess**, sáng thứ Năm. Emma [TT] đang lên chợ như mọi thứ Năm (`docs/city.md` §4), ghé mua
cà phê. Tess đặt một phong bì lên quầy: tiền mở quán. Người chơi đáp theo ý (không nhận / nhận và hứa trả / im lặng);
ý nào thì Tess cũng đưa, chỉ câu chốt khác. Emma, biết cái quán đó với Tess là gì, nói nhỏ: "Your café can wait. And
when it opens, I'll send the cake up on the first bus. Not the recipe. The cake." (đúng canon: Emma chưa bao giờ cho
công thức, chỉ cho miếng bánh ăn trên xe, §6).

**(d) Kết và hệ quả:**
- Báo Tess thiếu 1.800: cô đưa hết, kể cả tiền tháng sau; Rico phải trả lại phần dư ở phi vụ 8. Lộn xộn, và một câu
  ngượng ngùng.
- Báo thiếu 80: Rico cười "Eighty? I've got eighty in my sock", rồi tự nói lại số thật. Mất một nhịp.
- Xin nhầm Dr Osei: ông đang ngủ sau ca đêm; Bridget nghe thấy và tự viết. Trễ.
- Ghi thứ Ba: người chơi chạy như điên hai ngày sớm hơn, độ nóng +1; không hại gì khác.
- Sạch: ba thư, đủ tiền, trước trưa thứ Năm. Gus, tối hôm đó, đọc câu bẫy lần hai lên kênh an ninh theo lời bà Delaney
  (người chơi được nghe và phải ghi: đây là chi tiết sẽ cần ở phi vụ 8): "Surveyor says the gatehouse roof's gone at
  the north corner. Don't put it in writing." Bẫy "north" / "south": "the north corner" nói nhanh, "north" mất /θ/ cuối
  dính vào "corner" thành "nor-corner".

- Nơi: trạm gác; ô bán vé, Ga trung tâm; bệnh viện Westbay; quán Gianna (Market Street); xe cà phê của Tess (bãi xe
  buýt).
- Người nói: Rico, bà Okafor, Bridget, Gianna, Tess, Emma **[TT]**, Gus, Dr Osei (một câu, ngái ngủ). Khoảng 60 câu.
  **Người thị trấn: Emma, 4 câu = 4 clip.**
- Canon dựa vào: Okafor không ngồi taxi của Rico, đỗ xe "như cướp biển" (`docs/city.md` §6, `ct-okafor-2`); Bridget
  gấp góc như phong bì (§10); Gianna nuôi ăn mọi người, không bao giờ ngồi (§2); Tess để dành mở quán, bánh chanh như
  của Emma, Emma chưa từng cho công thức (§6); Emma lên chợ thứ Năm (§4).

### Phi vụ 8. Một chữ sai

**Vì sao có:** kết hồi. Mọi thứ người chơi đã nghe được dồn vào một lúc: phải nghe ra MỘT câu trong cả một lá thư.

**(a) Nghe lệnh.** Sáng phiên xét, tại trạm gác. Rico tập nói trước gương, nói quá dài. Tess tóm lại kế hoạch. Sam
[TT], lên sớm bằng chuyến đầu, đứng ở cửa, ba chữ: "Talk. Less. Rico." Không có sổ tay mới: thứ cần nhớ là chi tiết
bẫy đã ghi ở phi vụ 7 (góc mái hỏng là góc nào).

**(b) Trên đường.** Đi bộ hai trăm mét sang văn phòng Ban quản lý cảng. Kemp đi cùng chiều, chào hỏi tử tế, hỏi thăm
Tess. Không có gì để kiểm; chỉ là cảm giác.

**(c) Tại chỗ.** Phòng họp tầng trên, bà Delaney chủ trì, hai người ngồi cạnh. Ba miếng:
1. **Hồ sơ.** Kemp đọc từng dòng hồ sơ của hãng (những dòng mà các phi vụ Lộn xộn / Hỏng đã ghi). Mỗi dòng là một câu
   hỏi cho Rico. Rico bắt đầu trả lời lan man; người chơi chuyển cho anh một mẩu giấy (đáp theo ý: "nhận lỗi, nói
   ngắn" / "kể chuyện" / "đổ cho Bayline"). Hồ sơ sạch thì phần này chỉ có một câu hỏi.
2. **Lá thư dự thầu của Kemp**, bà Delaney đọc to, khoảng mười câu, giọng đều đều của người đọc giấy tờ. Trong đó có
   câu: "We have, of course, allowed for the repairs to the north corner of the roof." Người chơi bấm "Đó!" đúng lúc
   câu đó vang lên (một nút trên màn hình, đếm theo câu đang được đọc). Đây là khoảnh khắc chính của cả hồi: không có
   chữ hiện ra trước, chỉ có cái tai.
3. **Đáp lời theo ý** khi Kemp được hỏi hắn biết chuyện mái nhà từ đâu. Kemp: "Common knowledge." Bà Delaney: "Our
   surveyor said it once. On our gate radio. As a test." Im lặng. Kemp mỉm cười, gập bút.

**(d) Kết.**
- Bắt đúng câu: Kemp bị loại theo luật của Ban. Trạm gác: "Rico and partner", tên người chơi được đọc to.
- Bấm nhầm câu hoặc không bấm: bà Delaney tự dừng ở lần đọc thứ hai ("One moment. The north corner?"). Vẫn thắng,
  nhưng là Lộn xộn và Rico biết thắng nhờ người khác. Ghi nhầm "south" ở phi vụ 7: người chơi bấm khi không có gì
  (Kemp: "Is something wrong?"), rồi Tess thì thầm đúng góc; thắng, Lộn xộn.
- Kemp ra về, ở chân cầu thang, không giận: "Enjoy the gatehouse. I bought warehouse fifteen this morning. Quiet
  tender. Nobody came." Rico: "Fifty?" Tess: "FIFTEEN, Rico. One, five." (gợi lại `cs-bigdeal-4`; câu này không kiểm,
  nó là cái móc của Hồi II).
- Giá: tối đó Marcus lên sóng lần cuối trước khi chương trình đêm bị cắt từ thứ Hai (Bayline rút tài trợ). Gus trong
  chòi, đài im. Rico ngồi cạnh Gus, lần thứ hai trong đời không biết nói gì.
- Cuộc gọi từ nhà (tùy chọn, chỉ khi người chơi đã cưới): người bạn đời hỏi có kịp chuyến 10:15 không; Rico giật máy:
  "I'll drive them home myself. Free." (Đã cân nhắc: Rico nói về người chơi bằng "them", trung tính.)

- Nơi: trạm gác cũ; văn phòng Ban quản lý cảng (Quay Street); chòi Gus; sân khấu Bay FM (bản tin cuối).
- Người nói: Rico, Tess, Sam **[TT]**, Kemp, bà Delaney, Marcus, Gus, (tùy chọn) người bạn đời **[TT, 11 giọng]**.
  Khoảng 60 câu. **Người thị trấn: Sam, 3 câu = 3 clip; tùy chọn: 2 câu × 11 giọng = 22 clip.**
- Canon dựa vào: Rico nghe nhầm "fifty" và Tess sửa "One, five" (`cs-bigdeal-4`); kho mười lăm chưa ai tới
  (`cs-bigdeal-2`, `cs-bigdeal-4`); Rico "for once, I don't know what to say" (`cs-bigdeal-6`); Gus nghe Bay FM cả đêm
  (`ct-gus-1`, `docs/city.md` §7).

### Đếm clip của Hồi I (chỉ câu người thị trấn)

| Phi vụ | Người thị trấn | Clip |
|---|---|---|
| 1 Máy số hai | không | 0 |
| 2 Nửa sáu | không | 0 |
| 3 Chip là ga | Max | 9 |
| 4 Ba chữ một lần | Sam | 9 |
| 5 Ghế của bà Delaney | Grace | 4 |
| 6 Ba kênh | Sam | 3 |
| 7 Tiền của Tess | Emma | 4 |
| 8 Một chữ sai | Sam | 3 |
| **Tám phi vụ** | | **32** (khoảng 1.300 ký tự) |
| hai chuỗi người lạ (mục 5) | Sam, Daniel | 7 |
| **Tổng** | | **39**, thêm 22 nếu làm cuộc gọi từ nhà |

Tổng số câu cả hồi: khoảng 450 câu cho tám phi vụ kể cả nhánh, khoảng 120 câu cho hai chuỗi người lạ. Ít hơn mức
60–90 câu một phi vụ của plan §7, có chủ ý: ít câu, câu nào cũng có việc.

---

## 5. Hai chuỗi "người lạ"

### Chuỗi A. Bà Okafor nghỉ phép (3 việc nhỏ)

Bà Okafor: hai mươi hai năm ở ô bán vé, thuộc lòng mọi giờ tàu xe, ngày nào cũng gọi cho Sam, chưa từng đi xe số 9,
muốn một ngày ngồi trên băng ghế của Sam và gặp con chó Chip, nhất định không ngồi taxi của Rico (`docs/city.md` §3,
§6; `ct-okafor-1`, `ct-okafor-2`). Mở sau phi vụ 3.

1. **Hộp bánh quy cho Chip.** Bà gửi một hộp bánh quy cho con chó của Sam theo chuyến số 9 đầu tiên sáng mai. Bà nói
   bằng giờ tàu: "The seven oh five from stand four. Not the seven twenty-five, that one's always late." Người chơi
   phải đưa hộp tới đúng xe, đúng bến, trao tận tay tài xế. Nhầm thì hộp nằm ở phòng đồ thất lạc, Pete ghi sổ: "One
   tin, biscuits, for the use of a dog." (Pete, `docs/city.md` §6.) Không có Sam; 0 clip.
2. **Ba chữ và ba con số.** Sáng nào bà cũng gọi Sam: "He says three words, I say three numbers" (`ct-okafor-1`). Hôm
   nay đường dây rè; người chơi đứng giữa, chuyển lời qua hai máy. Ba con số của bà là ba giờ xe (bẫy "oh five" /
   "fifty-five"); ba chữ của Sam [TT, 2 câu] là… một lời mời: "Come. Saturday. Chip." Người chơi phải chuyển đúng nguyên
   văn, kể cả khi nó cụt lủn.
3. **Chuyến đầu tiên.** Bà Okafor đi xe số 9 lần đầu trong đời, người chơi đi cùng. Trên xe, bà đọc tên từng trạm trước
   khi loa đọc (Old Bridge, Hill Farm: `docs/city.md` §6) và cãi với loa khi loa chậm một giây. Ở thị trấn, Sam [TT, 3
   câu] chờ ở băng ghế, Chip nằm dưới chân. Việc của người chơi: nghe loa và nói cho bà biết khi nào xuống (bà lần đầu
   không thuộc một tuyến). Kết: bà ngồi lên băng ghế. "Forty minutes. Twenty-two years. Well."

Người nói: bà Okafor, Pete, loa xe, Sam **[TT]**. Khoảng 55 câu. **Clip: Sam, 5.**
Lưu ý: chuỗi này dùng hết điều ước "ngồi băng ghế của Sam" của bà; nếu chủ dự án muốn giữ nó cho chỗ khác thì đổi
việc 3.

### Chuỗi B. Băng giọng của giáo sư (3 việc nhỏ)

Giáo sư Adeyemi, phòng thí nghiệm ngữ âm: cả đời nghiên cứu tiếng Anh thật ra được nói thế nào; nói thẳng, không hứa
gì; tự mình mất hai năm mới theo kịp một bộ phim; phương pháp của ông là cùng năm phút radio mỗi ngày, nghe ba lần
(`docs/city.md` §7, §10). Ví dụ trong plan §5 ("trả tiền để mày đi thu băng giọng"). Mở sau `ct-adeyemi-1`.

Ràng buộc kỹ thuật (plan §11.6): giọng trình duyệt không có thói quen nói. Nên khác biệt giữa các giọng nằm ở CHỮ:
người này nói "What do you want to do?", người kia "Whaddaya wanna do?". Đây đúng là bài của app.

1. **Năm người, một câu.** Ông cần năm người nói cùng một câu tự nhiên: "What do you want to do tonight?" Người chơi
   đi xin: Rico ("Whatcha wanna do tonight?"), bà Okafor (đủ từng chữ), Hal, Yuki (cẩn thận, chậm), Kit. Mỗi lần người
   chơi chọn trong ba cách viết xem người đó THẬT RA đã nói thế nào. Ông Adeyemi xem xong: "Nobody's lazy. It's rhythm."
   (câu của chính ông, §7).
2. **Hai lần đọc của Daniel.** Thứ Tư, Daniel [TT, 2 câu] ở nhà sách; giáo sư muốn ông học trò cũ đọc một câu hai
   cách: như đọc sách, rồi như nói với bạn. Người chơi mang máy ghi âm (của Max, cái bằng đồng xu, phần 2) và phải ghi
   lại đúng lúc Daniel đổi giọng. Daniel giọng Anh, có clip: đây là chỗ người chơi được nghe nối âm thật.
3. **Năm phút radio.** Ông nhờ tìm trong kho băng của Kit một bản tin cụ thể ("the night of the market, the Friday,
   the one with Frank") để làm bài năm phút cho Yuki. Người chơi nghe Kit đọc nhãn băng (ngày tháng dễ nhầm) và chọn
   đúng cuộn. Kết: Adeyemi đưa cuộn băng cho Yuki, và nói với người chơi đúng điều ông nói với mọi người: "Same five
   minutes. Every day. Three times. No promise. A method."

Người nói: Adeyemi, Rico, bà Okafor, Hal, Yuki, Kit, Daniel **[TT]**. Khoảng 60 câu. **Clip: Daniel, 2.**

---

## 6. Phi vụ 1 viết đủ: "Máy số hai"

**Đọc trước:** bản này và phi vụ mẫu M0 "Cuộn băng của Gus" (`src/data/city/jobs/ferry.ts`, phiên khác đang làm) là
**hai bản nháp độc lập**, viết cùng lúc, không chép nhau. Chủ dự án chơi / đọc cả hai rồi chọn kiểu nào. Hai bản dùng
chung canon Bayline (`docs/city.md` §13) nhưng không phụ thuộc nhau.

**Bối cảnh.** Trạm gác cũ ở cổng cảng (Pier Road), tối ngày đầu tiên của hãng. Giờ game khoảng 6:40 tối. Rico, Tess,
người chơi. Hai cái điện thoại trên bàn, tấm bản đồ Westbay trên tường.

**Mở khi:** đã nghe hết phần 2 (`cs-bigdeal-6`).

### Nhịp 1. Nghe lệnh

**01 · Rico**
"Two phones. A map on the wall. Tess, look at it. Just look at it."
→ Hai cái điện thoại. Một tấm bản đồ trên tường. Tess, nhìn đi. Nhìn nó mà xem.

**02 · Tess**
"It's lovely, Rico. It's also a shed with a radiator."
→ Đẹp lắm, anh Rico. Mà nó cũng là cái chòi có cái lò sưởi.

**03 · Rico**
"It's a gatehouse. And it's ours. Well. Gus says it's ours."
→ Là trạm gác. Và là của mình. À thì. Gus bảo là của mình.

*(Máy số hai đổ chuông.)*

**04 · Rico**
"That's phone two! Phone two's ringing! Tess, can you—"
→ Máy số hai kìa! Máy số hai đổ chuông! Tess, em nghe giùm…

**05 · Tess**
"I said I'd bring the coffee, Rico. I never said I'd answer it."
→ Em bảo em mang cà phê thôi, anh Rico. Em có bảo em nghe máy đâu.

**06 · Rico** *(với người chơi)*
"Then it's yours. Go on. Write everything down, yeah? Everything."
→ Thế thì máy của bạn. Nghe đi. Ghi hết lại nhé? Hết luôn.

*(Cuộc gọi. Giọng qua điện thoại. Mỗi câu nói một lần; "Xin nhắc lại" có sẵn, mỗi lần bấm đều được đếm.)*

**07 · Kemp**
"Hi there, is that Rico's? The new lot, down at the harbour gate?"
→ Chào, phải chỗ của Rico không? Chỗ mới mở dưới cổng cảng ấy?

**08 · Người chơi** *(tự động)*
"Yes, Rico's. Hello."
→ Vâng, hãng của Rico đây. Xin chào.

**09 · Kemp**
"Lovely. I need a car tonight. Just me, no bags."
→ Tốt quá. Tối nay tôi cần một xe. Mình tôi thôi, không hành lý.

**10 · Kemp** ★ *[Tên khách]*
"Put it down under Kemp, would you?"
→ Ghi tên Kemp giúp tôi nhé?

**11 · Kemp** ★ *[Đón ở đâu]*
"Pick me up outside Meridian. Not the front, sorry, round the side. By the paper kiosk."
→ Đón tôi ở Meridian. À không phải cửa trước, xin lỗi, vòng ra bên hông. Chỗ sạp báo.

**12 · Kemp** ★ *[Mấy giờ]*
"Quarter past seven, if that's alright. I'll be in a navy coat."
→ Bảy giờ mười lăm, nếu được. Tôi mặc áo khoác xanh than.

**13 · Kemp** ★ *[Đi đâu]*
"And I'm off to the night market. Mei's. The dumpling stall."
→ Rồi tôi ra chợ đêm. Chỗ bà Mei. Sạp há cảo.

**14 · Kemp**
"No rush, mind. I never rush anybody."
→ Mà không vội đâu. Tôi chẳng bao giờ giục ai.

**15 · Kemp**
"Tell Rico good luck with the new place. He'll need it."
→ Nhắn Rico là chúc may mắn với chỗ mới nhé. Anh ta sẽ cần đấy.

*"Xin nhắc lại": người chơi chọn mục muốn nghe lại, Kemp nói lại ngắn hơn. Lần thứ ba trở đi, hắn thêm một câu: hắn
không bao giờ bực, và đó chính là cái đáng sợ.*

- **10r** "Kemp. K, E, M, P." → Kemp. K-E-M-P.
- **11r** "Meridian. Round the side, by the kiosk. Not the front." → Meridian. Bên hông, chỗ sạp báo. Không phải cửa trước.
- **12r** "Quarter past. Seven fifteen." → Bảy giờ mười lăm.
- **13r** "Mei's. The dumplings. Night market." → Chỗ bà Mei. Há cảo. Chợ đêm.
- **14r** *(lần thứ ba)* "Take your time. You're new, aren't you? That's alright." → Cứ từ từ. Bạn mới vào nghề phải không? Không sao đâu.

**16 · Rico**
"Who was it? No, tell me later. The car's outside, keys are in it."
→ Ai gọi thế? Thôi, kể sau. Xe ngoài kia, chìa khóa cắm sẵn.

**16b · Rico** *(chỉ khi người chơi đã bấm "Xin nhắc lại" ít nhất một lần)*
"You asked him to say it again? Good. Nobody ever asks. They just nod and get it wrong."
→ Bạn bảo khách nói lại à? Tốt. Chẳng ai chịu hỏi. Người ta cứ gật đầu rồi làm sai.

**17 · Tess**
"Take a coffee. The first fare's always the strange one."
→ Cầm theo ly cà phê. Khách đầu tiên bao giờ cũng là khách lạ.

**Sổ tay** (không báo đúng sai; game dẫn người chơi theo đúng cái họ ghi):

| Mục | Lựa chọn | Vì sao lựa chọn sai là thứ tai thật sự nghe ra |
|---|---|---|
| Tên khách | **Kemp** / Ken / Kent | "Kemp, would you": /p/ cuối không bật hơi trước /w/ (âm tắc không nổ), /m/ + /p/ dính thành một khối mũi, nghe ra "Kem" rồi đầu tự sửa thành cái tên quen là "Ken". "Kent" là người nghe được có một âm tắc cuối nhưng âm tắc không nổ thì không còn dấu hiệu môi hay lưỡi, /p/ và /t/ nghe như nhau |
| Đón ở đâu | **sạp báo bên hông Meridian** / cửa trước Meridian / cửa xưởng Loom bên cạnh | lời sửa nằm ở đuôi câu, nói nhanh và nhỏ ("not the front, sorry, round the side"); tai giữ "outside Meridian" rồi buông. "Round the side" nghe lướt thì thành "bên cạnh", và bên cạnh Meridian là xưởng Loom |
| Mấy giờ | **7:15** / 6:45 / 7:45 | "quarter past seven": "past" teo thành /pəs/, /t/ rơi trước "seven"; "quarter to" thì "to" teo thành /tə/. Hai giới từ đều không nhấn, chỉ khác một hai âm. 7:45 là người nghe được "quarter" và "seven" mà không bắt được giới từ, rồi đoán theo kiểu "kém mười lăm" của giờ sau |
| Đi đâu | **sạp há cảo của bà Mei** / vòng đu quay của Fay / sân khấu Bay FM ở chợ đêm | "Mei's" và "Fay's" cùng vần /eɪz/, chỉ khác phụ âm đầu, và đứng một mình sau dấu ngắt nên không có ngữ cảnh đỡ. Sân khấu là người chỉ bắt được "night market" và nghĩ tới chỗ nổi tiếng nhất ở đó |

### Nhịp 2. Trên đường

*(Radio trong xe, bản tin giao thông. Kit đọc.)*

**18 · Kit** *(trên đài)*
"This is Bay FM traffic, brought to you by Bayline."
→ Đây là bản tin giao thông Bay FM, do Bayline tài trợ.

**19 · Kit** *(trên đài)*
"Roadworks on Station Avenue all week, so give it a miss if you can."
→ Đại lộ Station Avenue sửa đường cả tuần, tránh được thì tránh.

**20 · Quảng cáo** *(giọng Kemp, cùng giọng trình duyệt với Kemp ở câu 07–15: tai tinh có thể nhận ra)*
"Bayline. Wherever you're going, we're already there."
→ Bayline. Bạn đi đâu, chúng tôi đã ở đó rồi.

*(Tới Meridian. Bên hông, quanh sạp báo: Mr Whitlock mua báo, Hana đang về, Dev đứng chờ xe buýt với túi máy tính,
một người đàn ông áo khoác xanh than. Người chơi lại gần ai thì bấm "Hỏi"; câu hỏi dùng đúng cái tên người chơi đã ghi.)*

**21 · Người chơi**
"Car for Mr Kemp?" *(hoặc "Mr Ken?", "Mr Kent?", theo sổ tay)*
→ Xe cho ông Kemp phải không?

**22 · Mr Whitlock** *(hỏi nhầm người)*
"Me? Good heavens, no. Whitlock. I'm only here for the paper."
→ Tôi á? Ôi trời, không. Whitlock. Tôi chỉ ra mua tờ báo thôi.

**23 · Hana** *(hỏi nhầm người)*
"Not me, sorry. I'm off home. On foot, sadly."
→ Không phải tôi đâu, xin lỗi. Tôi về nhà. Đi bộ, buồn thay.

**24 · Dev** *(hỏi nhầm người; câu thứ hai chỉ khi người chơi hỏi "Ken")*
"Nah, I'm waiting for the bus. Who's Ken?"
→ Không, tôi đợi xe buýt. Ken là ai?

Kemp chào, một câu tùy chuyện gì đã xảy ra:

**25a · Kemp** *(đúng giờ, đúng tên)*
"Quarter past on the dot. And you said Kemp, not Ken. People usually drop the P."
→ Đúng bảy giờ mười lăm. Mà bạn gọi Kemp chứ không phải Ken. Người ta hay nuốt mất chữ P.

**25b · Kemp** *(ghi sai tên)*
"Kemp. With a P on the end. Everybody swallows the P. Don't worry about it."
→ Kemp. Có chữ P ở cuối. Ai cũng nuốt mất chữ P. Đừng lo.

**25c · Kemp** *(ghi 6:45: người chơi ngồi chờ từ sớm)*
"You've been sitting here since quarter to? Rico's paying you to wait, then."
→ Bạn ngồi đây từ bảy giờ kém mười lăm à? Vậy là Rico trả tiền cho bạn ngồi chờ.

**25c2 · Rico** *(gọi tới trong lúc người chơi ngồi chờ, nếu ghi 6:45)*
"Where are you? I had a fare at the station, and Bayline just took it."
→ Bạn đâu rồi? Có khách ở ga, mà Bayline vừa hốt mất.

**25d · Kemp** *(ghi 7:45: trễ nửa tiếng)*
"Half an hour. I counted. Bayline would've been here at ten past."
→ Nửa tiếng. Tôi đếm đấy. Bayline thì bảy giờ mười đã có mặt.

**25e · Kemp** *(ghi cửa trước hoặc xưởng Loom: hắn gọi vào máy của người chơi)*
"I can see your car from here. I'm round the side, by the kiosk. I did say."
→ Tôi thấy xe bạn từ đây. Tôi ở bên hông, chỗ sạp báo. Tôi có nói rồi mà.

**25f · Rico** *(trễ quá 30 phút so với 7:15: Kemp đã đi xe Bayline)*
"Your fare's gone. He got a Bayline car. Never mind. Go to Mei's anyway, she rang about her lights."
→ Khách đi rồi. Lên xe Bayline. Kệ. Cứ ra chỗ bà Mei, bà vừa gọi nhờ xem cái đèn.
*(Bỏ qua cảnh trong xe, sang thẳng nhịp 3; Kemp đã ở sạp bà Mei. Mức kết: Hỏng.)*

*(Trong xe. Kemp ngồi ghế sau. Không có lời chỉ đường để kiểm: phi vụ M0 đã thử miếng đó; ở đây là đối đáp.)*

**26 · Kemp**
"So you're the new voice on Rico's second phone. What's he paying you?"
→ Vậy bạn là giọng mới ở máy số hai của Rico. Anh ta trả bạn bao nhiêu?

Đáp theo ý (chọn ý tiếng Việt, nhân vật của người chơi nói câu tiếng Anh):

- **27a** *Đùa cho qua* → "Mostly coffee, so far." (Đến giờ thì chủ yếu bằng cà phê.)
  **28a · Kemp** "Tess's coffee? Then he's paying you well." → Cà phê của Tess à? Vậy là anh ta trả hậu đấy.
- **27b** *Không kể* → "That's between me and Rico." (Chuyện đó là giữa tôi với Rico.)
  **28b · Kemp** "Good answer. I like people who keep things to themselves." → Trả lời hay. Tôi quý người biết giữ chuyện cho mình.
- **27c** *Nói thật* → "Nothing yet. It's my first night." (Chưa có gì. Hôm nay là tối đầu tiên.)
  **28c · Kemp** "First night. Then I'm your first fare. I'm flattered." → Tối đầu tiên. Vậy tôi là khách đầu tiên của bạn. Hân hạnh quá.
  *(Ghi nhớ: Kemp biết người chơi chưa được trả công. Ở phi vụ 5 hắn dùng điều này.)*

**29 · Kemp**
"Stay off the avenue, by the way. Roadworks. College Road's quicker."
→ Mà nhớ tránh đại lộ nhé. Đang sửa đường. Đi College Road nhanh hơn.

**30 · Kemp**
"I'll be straight with you, because I always am. I've put in for that gatehouse."
→ Tôi nói thẳng nhé, vì tôi lúc nào cũng nói thẳng. Tôi đã nộp hồ sơ xin cái trạm gác đó.

**31 · Kemp**
"It's not Gus's to give, you see. It belongs to the Harbour Trust."
→ Bạn biết đấy, nó đâu phải của Gus mà cho. Nó thuộc về Ban quản lý cảng.

**32 · Kemp**
"They hear the bids in a fortnight. Rico can bid, I can bid. All above board."
→ Hai tuần nữa họ xét hồ sơ. Rico nộp được, tôi nộp được. Đàng hoàng cả.

**33 · Kemp**
"Mrs Vane tried to take this harbour with a pen and a lie. I'm just going to buy it."
→ Bà Vane định chiếm cái cảng này bằng một cây bút và một lời nói dối. Tôi thì chỉ định mua nó thôi.

**34 · Kemp**
"And if Rico can't pay you, Bayline pays every Friday. Have a think."
→ Còn nếu Rico không trả nổi, Bayline trả lương mỗi thứ Sáu. Nghĩ thử xem.

Đáp theo ý:

- **35a** *Từ chối* → "Thanks. I'm happy where I am." (Cảm ơn. Tôi đang ổn ở chỗ này.)
  **36a · Kemp** "For now. That's fine. Everybody's happy for now." → Lúc này thôi. Không sao. Lúc này thì ai cũng ổn.
- **35b** *Hỏi Bayline là ai* → "Sorry, what's Bayline?" (Xin lỗi, Bayline là gì?)
  **36b · Kemp** "Ah. He hasn't mentioned me. That's almost sweet." → À. Anh ta chưa nhắc tới tôi. Gần như là dễ thương.
- **35c** *Để nghĩ đã* → "I'll think about it." (Để tôi nghĩ đã.)
  **36c · Kemp** "Do. I'll ask again." → Cứ nghĩ đi. Tôi sẽ hỏi lại.
  *(Ghi nhớ cho phi vụ 5.)*

Tới nơi, một câu tùy chỗ người chơi đã ghi:

**37 · Fay** *(ghi Fay's: xe dừng ở vòng đu quay)*
"He's not going up, is he? Not in this wind."
→ Ông ấy không định lên đấy chứ? Gió thế này.

**38 · Kemp** *(sau 37)*
"Mei's, I said. The dumplings. Never mind, I'll walk. I like a walk."
→ Tôi bảo chỗ bà Mei. Há cảo. Thôi, tôi đi bộ. Tôi thích đi bộ.

**38b · Kemp** *(ghi sân khấu Bay FM)*
"That's a stage. Lovely. I can't eat a stage. Mei's, I said."
→ Đây là sân khấu. Đẹp đấy. Nhưng tôi đâu ăn được sân khấu. Tôi bảo chỗ bà Mei mà.
*(Sau 38 / 38b, Kemp đi bộ sang trước; người chơi tới sau, lỡ câu 40–42.)*

**39 · Kemp** *(ghi đúng)*
"Here we are. Keep the change. And the rest."
→ Tới rồi. Giữ tiền thừa đi. Cả phần còn lại nữa.

### Nhịp 3. Tại chỗ: sạp há cảo

*Miếng **nghe lén**: Kemp và bà Mei nói chuyện ở quầy. Người chơi đứng càng gần càng nghe rõ (rõ / loáng thoáng /
lào xào / không nghe thấy, như M0). Khác M0 một chỗ có chủ ý: lại sát cũng không sao. Kemp không bao giờ "phát hiện
ra" người chơi, vì hắn biết từ đầu; câu 47 luôn được nói. Đó là tính cách của phản diện, không phải lỗi thiết kế.*

**40 · Kemp**
"Six pork, please, Mrs Mei. Pork's better. Prawn is for tourists."
→ Cho sáu cái nhân thịt, bà Mei. Thịt ngon hơn. Tôm là cho khách du lịch.

**41 · Mei**
"That's my line. Where did you hear that?"
→ Câu đó là của tôi. Cậu nghe ở đâu ra thế?

**42 · Kemp**
"Everybody knows your lines since the tape, Mrs Mei. You're famous."
→ Từ vụ cuộn băng, ai chẳng thuộc câu của bà, bà Mei. Bà nổi tiếng rồi.

**43 · Kemp** ★ *[Hắn muốn gì]*
"If you ever want to sell this pitch, I'll pay what it's worth. Not a penny less."
→ Nếu có ngày bà muốn bán chỗ này, tôi trả đúng giá của nó. Không bớt một xu.

**44 · Mei**
"Is it urgent?"
→ Có gấp không?

**45 · Kemp**
"Not at all. Take a year. Take ten. I'm a patient man."
→ Không hề. Bà cứ để một năm. Mười năm. Tôi là người kiên nhẫn.

**46 · Mei**
"Hm. Nobody's ever said not urgent."
→ Hừm. Chưa ai từng bảo là không gấp.

**47 · Kemp** *(quay sang người chơi, dù họ đứng đâu)*
"You can come closer, you know. I never say anything I wouldn't say on the radio."
→ Lại gần hơn cũng được mà. Tôi chẳng bao giờ nói điều gì mà tôi không dám nói trên đài.

**48 · Kemp**
"Goodnight, Mrs Mei. Goodnight, Rico's new voice."
→ Chúc ngủ ngon, bà Mei. Chúc ngủ ngon, giọng mới của Rico.

**49 · Mei** *(với người chơi)*
"You heard him, dear. What does he want from me?"
→ Cháu nghe rồi đấy. Hắn muốn gì ở bà?

Đáp theo ý (★, kiểm câu 43):

- **49a** *Mua sạp của bà* → "He wants to buy your stall."
  **50a · Mei** "Yes. And he knew what I'd ask before I asked it." → Đúng. Mà hắn biết bà sẽ hỏi gì trước cả khi bà hỏi.
- **49b** *Chỉ mua há cảo* → "Just the dumplings, I think."
  **50b · Mei** "Dumplings? He wants my stall, dear. Listen with both ears." → Há cảo á? Hắn muốn cái sạp của bà, cháu ạ. Nghe bằng cả hai tai vào.
- **49c** *Rủ bà làm cho Bayline* → "He wants you to work for him."
  **50c · Mei** "Work? At my age? No, dear. He wants my stall." → Làm công á? Tuổi này? Không đâu cháu. Hắn muốn cái sạp của bà.

**51 · Mei** *(sau 50b / 50c)*
"And he knew what I'd ask before I asked it. Somebody's been listening."
→ Mà hắn biết bà sẽ hỏi gì trước cả khi bà hỏi. Có kẻ đang nghe lén.

### Nhịp 4. Kết

*(Điện thoại của người chơi. Rico.)*

**52 · Rico**
"How'd it go? Who was he, anyway? Give me the name."
→ Sao rồi? Mà khách là ai thế? Cho tôi cái tên.

*(Người chơi nói cái tên đã ghi.)*

**53 · Rico** *(ghi "Kemp")*
"Kemp? Navy coat, night market? That's Duncan Kemp. He owns Bayline."
→ Kemp? Áo khoác xanh than, chợ đêm? Đó là Duncan Kemp. Hắn là chủ Bayline.

**53b · Rico** *(ghi "Ken" hoặc "Kent")*
"Ken? Navy coat, night market… That's not Ken. That's Duncan Kemp. He owns Bayline."
→ Ken? Áo khoác xanh than, chợ đêm… Không phải Ken đâu. Đó là Duncan Kemp. Hắn là chủ Bayline.

Câu chốt của Rico theo mức kết:

**Sạch** (không hệ quả nào)
- **S1 · Rico** "On time, right door, right name, and he tipped. Partner, he was testing us. We passed."
  → Đúng giờ, đúng cửa, đúng tên, lại còn được boa. Cộng sự ơi, hắn thử mình đấy. Mình qua rồi.
- **S2 · Rico** "So Kemp wants our gatehouse. Right. Then we'd better be good. Very good."
  → Vậy là Kemp muốn trạm gác của mình. Được. Thế thì mình phải giỏi. Thật giỏi.

**Lộn xộn** (1–2 hệ quả)
- **L1 · Rico** "He'll tell the Trust about tonight, you know. Every minute of it."
  → Hắn sẽ kể với Ban quản lý cảng về tối nay đấy. Từng phút một.
- **L2 · Rico** "Never mind. Tomorrow, ask them to say it twice. People don't mind. Honestly."
  → Thôi kệ. Mai cứ bảo khách nói lại lần nữa. Người ta không phiền đâu. Thật đấy.

**Hỏng** (3 hệ quả trở lên, hoặc Kemp đã đi xe Bayline)
- **H1 · Rico** "Our very first fare, and he went home in a Bayline car."
  → Khách đầu tiên của mình, mà hắn về bằng xe Bayline.
- **H2 · Rico** "That's alright. My first day, I took a bride to the wrong church. She got married anyway."
  → Không sao. Ngày đầu của tôi, tôi chở cô dâu tới nhầm nhà thờ. Cuối cùng cô ấy vẫn cưới.

**Bản tin cuối ngày** (Kit, bản tin giao thông; theo mức kết)
- **N-sạch** "And a new taxi firm's opened at the harbour gate tonight. Good luck to them, from all of us."
  → Và tối nay có một hãng taxi mới mở ở cổng cảng. Cả đài chúc họ may mắn.
- **N-lộn xộn** "Reports of a taxi going round in circles near the harbour tonight. Somebody's new."
  → Tối nay có tin một chiếc taxi chạy vòng vòng gần cảng. Chắc có người mới vào nghề.
- **N-hỏng** "Bayline tells us they carried another happy customer to the night market. Bayline. We're already there."
  → Bayline cho biết họ vừa chở thêm một khách hàng vui vẻ ra chợ đêm. Bayline. Chúng tôi đã ở đó rồi.

### Hệ quả từng mục (mỗi mục một, rồi nhập lại)

| Mục ghi sai | Hệ quả | Nhập lại mạch chính |
|---|---|---|
| Tên (Ken / Kent) | hỏi nhầm người đứng ở sạp báo; Kemp sửa "with a P" | Kemp vẫn lên xe; Rico nói đúng tên ở câu 53b |
| Đón ở đâu | chờ ở cửa trước / cửa Loom; Kemp gọi điện (25e), trễ vài phút | Kemp vẫn lên xe |
| Giờ 6:45 | ngồi chờ nửa tiếng; Rico mất một khách ở ga vào tay Bayline (25c2) | Kemp tới đúng 7:15 |
| Giờ 7:45 | trễ nửa tiếng (25d); hồ sơ của hãng ghi dòng đầu tiên (phi vụ 5, 8) | Kemp vẫn lên xe; trễ hơn nữa thì 25f |
| Đi đâu | xe dừng nhầm chỗ, Kemp đi bộ trước; người chơi lỡ ba câu đầu ở sạp bà Mei | cảnh nghe lén vẫn chạy từ câu 43 |
| Hắn muốn gì (đáp sai bà Mei) | bà Mei mắng "nghe bằng cả hai tai" | bà vẫn nói câu 51 |

Mức kết: 0 hệ quả là Sạch, 1–2 là Lộn xộn, 3 trở lên hoặc 25f là Hỏng. Tiền: theo M0 (30 / 15 / 5 xu lần đầu trong
ngày) cho tới khi kinh tế được làm lại (plan §6).

### Đếm

- Một lượt chơi nghe khoảng 45 câu; cả kịch bản kể cả nhánh khoảng 75 câu. Chi tiết bị kiểm: 5 (4 mục sổ tay + câu
  hỏi của bà Mei). Thời lượng ước 8–10 phút.
- Người nói: Rico, Tess, Kemp, Kit, Mr Whitlock, Hana, Dev, Fay, Mei, người chơi. Tất cả giọng trình duyệt. **0 clip.**
- Canon dựa vào:
  - hai điện thoại, tấm bản đồ, Tess không nghe máy thứ hai, Rico nói nhiều vì không ai đáp: `ct-rico-3`,
    `src/data/city/episodesA.ts`;
  - Gus mời Rico về trạm gác cũ: `cs-bigdeal-6`, `src/data/city/seasonsMain2.ts`;
  - băng của bà Mei, Vane, ký nhượng sạp ở cảng: `cs-bigdeal-5`, `cs-bigdeal-6`;
  - "Pork is better. Prawn is for tourists.": `ct-mei-1`, `src/data/city/chats2.ts`;
  - quy tắc "if it's urgent, it's lying": `cs-bigdeal-5`, `docs/city.md` §11;
  - Bayline, xe đậu trên Station Avenue: `docs/city.md` §13;
  - Mr Whitlock mua báo ở sạp (bố ông chạy sạp báo ba mươi năm), Hana ở trụ sở, Dev: `docs/city.md` §7, §10;
  - Fay và vòng đu quay, sợ độ cao: `ct-fay-1`;
  - Kit làm chương trình và đọc thời tiết khi Marcus vắng: `ct-kit-1`, `ct-marcus-3` (Kit đọc bản tin GIAO THÔNG
    là tao thêm);
  - đường và chỗ: Meridian (Market Street đầu đông), sạp báo, xưởng Loom, College Road, Station Avenue, chợ đêm:
    `src/data/cityWorld.ts`.

---

## 7. Chỗ tao chưa chắc

### Canon mỏng, tao đã tự chọn

1. **Trạm gác cũ không có trên bản đồ.** Phần 2 nói "the old gatehouse is empty" mà Gus vẫn trực ở chòi của mình
   (`ct-gus-1`), nên đó là hai chỗ khác nhau. `src/data/cityWorld.ts` mới có chòi của Gus. Tao đặt trạm gác cũ ngay
   cạnh chòi Gus trên Pier Road. Cần thêm một chỗ trên bản đồ.
2. **Ban quản lý cảng (Harbour Trust) là mới.** Canon chưa nói ai sở hữu cảng. Tao chọn một ban có thật, trung thực,
   có luật, để Kemp thắng được bằng giấy tờ hợp pháp và thua được bằng chính luật của ban. Văn phòng ở tầng trên chợ
   đồ điện tử (Quay Street): chỗ mới.
3. **Kemp, bà Delaney, Shona** là người mới. Bayline thì đã là canon nhờ M0 (`docs/city.md` §13, do phiên M0 thêm,
   CHƯA commit). Nếu bỏ M0 thì phi vụ 1 vẫn tự giới thiệu Bayline (bản tin, quảng cáo, câu 53), nhưng §13 phải giữ
   lại hoặc viết lại.
4. **Kho số mười lăm có ai tới chưa.** Phần 2 không nói cảnh sát có lục kho đó không: Rico tới nhầm "kho năm mươi",
   rồi Vane bị bắt ở chợ đêm. Tao coi đó là một sợi chỉ còn bỏ ngỏ và dùng làm cái móc cuối hồi. Nếu chủ dự án đã
   nghĩ khác về kho mười lăm thì sửa câu cuối của phi vụ 8.
5. **Tiền tệ không thống nhất trong canon.** Phần 1 dùng bảng Anh (Crane đòi "five hundred pounds"), còn bà Mei, Fay,
   Sol dùng đô la ("Six for five dollars", "Three dollars", "twelve dollars"). Trong hồi này tao tránh gọi tên đơn vị
   ("eight hundred", "not a penny less"). Nên chốt một loại.
6. **Bay Street** chỉ được nhắc trong canon (§6, ngày chạy marathon), không có trên bản đồ. Phi vụ 6 dùng nó vì cặp
   "Bay Street / Bay Road" là cặp dễ nghe nhầm thật. Cần gán tên đó cho đoạn đường bờ biển (promenade).
7. **Chương trình đêm của Marcus sống nhờ tiền tài trợ.** Canon chỉ có "head office is sending a new desk"
   (`ct-kit-2`), tức Bay FM thuộc một công ty lớn hơn. Chuyện tài trợ là tao thêm.
8. **Luật ký lại hợp đồng sau vụ Vane** là tao thêm. Canon chỉ nói các sạp ở cảng, không nói ai cho thuê hay có thủ
   tục gì. Không mâu thuẫn, nhưng là thêm chứ không phải suy ra.
9. **Đụng với M0 nếu giữ cả hai.** Bản tin sạch của M0 cho Marcus "lên đài đánh Bayline" ("Bayline, if you're
   listening… tomorrow at eight"), trong khi Hồi I của tao cho Bayline nuôi chương trình đêm của Marcus. Giữ cả hai thì
   phải chọn: hoặc M0 thành một phi vụ phụ trước Hồi I và bản tin M0 bỏ câu thách thức, hoặc phi vụ 4 nói thêm rằng
    sau lần đó head office của Bay FM mới ký hợp đồng tài trợ với Bayline (Kemp mua cái miệng đã chửi mình: rất hợp
   tính hắn).
10. **Luật "người chơi không bao giờ nói"** (`docs/city.md` §5) bị phá bởi mọi câu đáp theo ý. Plan §3 đã đặt miếng
    này vào phi vụ, nhưng canon thành phố chưa đổi.

### File tao chưa đọc hết, có thể đụng

- Tao đã đọc từng dòng hai phần truyện chính, `docs/city.md`, `cityPeople.ts`, `cityWorld.ts`, kịch bản M0 và các
  cảnh của Rico, Okafor, Tess, Kit, Gus, Mei, Sol, Fay, Odile, Jun, Marcus. Tao CHƯA đọc hết: các tập của Nora, Frank,
  Gianna, Iris, Claire, Priya, Vivian, Osei, Adeyemi (episodesB/C/D), các cảnh nghe lỏm, các ca làm, các cuộc đi chơi,
  sáu truyện dài theo mùa (chỉ đọc tóm tắt trong `docs/city.md` §8, §12), và các cung của người thị trấn ngoài phần
  đầu. Chỗ dễ đụng nhất: lời của Grace, Emma, Max, Sam, Daniel mà tao viết ở dàn ý (tao chỉ dựa vào tóm tắt và các
  tập thành phố của họ đã đọc).
- Nếu một truyện dài đã cho Tess mở quán, hoặc cho Marcus thôi chương trình đêm, thì cái giá cuối hồi phải đổi. Tao
  không thấy điều đó trong §8–§12, nhưng chưa đọc từng câu.

### Chỗ khó dựng trong thị trấn 3D nhìn từ trên xuống

- **Phi vụ 4, bám đuôi:** cần một xe Bayline chạy theo lộ trình viết sẵn trên đường thành phố. Chưa có xe nào khác
  chạy (plan M2). Làm tạm được: một xe chạy theo đường kẻ sẵn như ông khách "ngồi sau xe" của M0. Vùng rẽ đúng / sai
  vẽ tay theo bản đồ đã giãn (96 × 96).
- **Phi vụ 6, ba điểm cùng lúc:** người chơi chỉ đứng được một chỗ; hai chỗ kia đến tai qua điện thoại. Dựng được,
  nhưng cái xe Bayline "trờ tới" ở một điểm người chơi không đứng thì chỉ là lời kể.
- **Phi vụ 2 và 8, tầng trên:** cầu thang và phòng họp không có trong 3D. Đặt cảnh ở cửa văn phòng (dip vào phòng
  như `three/interiors/` của thị trấn thì phải làm thêm một phòng).
- **Phi vụ 8, nút "Đó!":** cần biết câu nào đang được đọc lúc người chơi bấm. Với giọng trình duyệt thì biết theo
  từng câu (sự kiện kết thúc câu), không theo từng chữ. Bấm trong lúc câu đó đang đọc hoặc trong một giây sau nó là
  đúng.
- **Phi vụ 5, điều phối trên bản đồ treo tường:** cần một màn hình bản đồ dạng bảng (đã có Bản đồ toàn thành phố), chứ
  không phải thế giới 3D. Đây là miếng mới nhất của hồi.
- **Giờ game:** mọi giờ hẹn (7:15, 5:30…) là giờ của đồng hồ game 48 phút một ngày (`docs/town.md` §24). Phi vụ chỉ
  mở được khi đồng hồ game ở đúng khoảng; hoặc, như M0, giờ hẹn được nói theo đồng hồ lúc đó. Nếu theo M0 thì câu
  12 phải là câu có chỗ trống ({time}), và cặp nhầm "past / to" vẫn giữ được.

### Câu hỏi cho chủ dự án

1. **Kemp** (chủ Bayline, lịch sự, không bao giờ nói dối, thắng bằng cách nghe trộm và mua hợp pháp) có ổn làm phản
   diện cả Hồi I không, hay mày muốn một kiểu khác (thô hơn, có hù dọa)?
2. **Cái giá cuối hồi:** Tess bỏ tiền mở quán vào tiền cọc, và chương trình đêm của Marcus bị cắt (Gus ngồi với cái đài
   im). Buồn vừa hay buồn quá? Bỏ cái nào?
3. **Người chơi được nói** (đáp theo ý, giọng trình duyệt, hiện cả chữ) trong các phi vụ ở thành phố: đồng ý phá luật
   "người chơi không bao giờ nói" của `docs/city.md` không?
4. **Phi vụ 1 của tao và phi vụ M0** là hai bản nháp khác kiểu (M0: lái theo lời chỉ đường, nghe lén mật khẩu; của
   tao: đối đáp trong xe, phản diện biết người chơi đang nghe). Mày đọc / chơi rồi chọn kiểu nào để viết tiếp bảy phi
   vụ kia? Và có làm cuộc gọi từ nhà cho người đã cưới không (thêm 22 clip)?

---

## 8. As written (2026-11-27): phi vụ 6–8 và hai chuỗi người lạ thành dữ liệu chơi được

Viết thành tài liệu phi vụ (`src/core/town/jobDoc.ts`), chơi bằng engine chung (`features/town/jobs/useCityJob.tsx`),
cùng kiểu phi vụ 1 (`machine2.ts`, chép từ mục 6). Mỗi file có danh sách thay đổi ngay đầu file. Tóm tắt:

| Phi vụ | File | Câu (kể cả nhánh) | Mở sau |
|---|---|---|---|
| 6 Ba kênh | `src/data/city/jobs/channels.ts` | 63 | job 5 (`job-delaney`) |
| 7 Tiền của Tess | `src/data/city/jobs/tess.ts` | 71 | phi vụ 6 |
| 8 Một chữ sai | `src/data/city/jobs/hearing.ts` | 74 | phi vụ 7 |
| A1 Hộp bánh cho Chip | `src/data/city/jobs/sideOkafor.ts` | 22 | job 2 (`job-half5`) |
| A2 Ba con số | như trên | 32 | A1 |
| A3 Chuyến xe đầu tiên | như trên | 26 | A2 |
| B1 Một câu, ba cách nói | `src/data/city/jobs/sideProfessor.ts` | 18 | job 2 (`job-half5`) |
| B2 Trang chín mươi | như trên | 16 | B1 |
| B3 Năm phút radio | như trên | 18 | B2 |

**Đổi so với dàn ý ở mục 4–5, và vì sao:**

1. **Không người thị trấn nào nói, nên không cần clip nào.** Phi vụ chỉ phát bằng giọng trình duyệt
   (`core/town/jobVoice.ts`), và test chung của phi vụ cấm người thị trấn nói. Nên Sam (phi vụ 6, 8, chuỗi A), Emma
   (phi vụ 7) và Daniel (chuỗi B) được thay: Theo làm người canh ở phi vụ 6; ở phi vụ 7 Rico đứng ở xe cà phê và hứa
   từ nay mang cà phê cho Tess (lời của chính anh ở `ct-rico-3`, lật ngược); "Talk. Less. Rico." thành lời Tess và Gus;
   Sam chỉ NHẮN TIN, Rico đọc to ba chữ của cậu (đúng tính Sam); trang chín mươi do Claire đọc. Muốn Sam / Emma / Daniel
   nói thật thì engine phải phát clip Gemini cho người thị trấn trong phi vụ (mục "Cần engine" bên dưới).
2. **Phi vụ 6:** ba chỗ đón giả là chỗ có thật trên bản đồ, theo các cặp dễ nhầm đã có trong canon (`taxiFares.ts`): rạp
   Lumen / xưởng Loom, sân khấu / nhà ga (stage / station), nhà thuốc / bến phà (pharmacy / ferry). "Bay Street cạnh
   cầu tàu" và "Fountain Lane" không phải chỗ trên bản đồ. Người chơi bảo Tess và Theo đứng đâu theo đúng điều mình
   ghi; ghi nhầm thì kênh đó không được "rửa". Lời tay tài xế ("taxi for the gate") được gõ lại cho Jun ở sạp của anh.
3. **Phi vụ 7:** hạn chót là cặp "at noon / afternoon" và thứ Năm / thứ Ba; Bridget được tìm giữa ba người ở trạm điều
   dưỡng (bước pickup không chở ai đi); thư của Gianna là bài "hai người nói chồng nhau": bà đọc thư xen lời quát bếp,
   rồi hỏi bạn bà vừa viết gì ("never once been late" / "paid" / "said no").
4. **Phi vụ 8:** chi tiết bẫy là một con số (mười bốn viên ngói; nhầm thành bốn mươi hay bốn), không phải "góc phía
   bắc": cặp "-teen / -ty" mới là thứ tai nghe nhầm thật. Chưa có nút "Đó!", nên người chơi tới bên Rico và gõ lại mấy
   chữ làm Kemp lộ (bước password ngay sau đoạn nghe). Kemp tự đọc thư của hắn (bà Delaney bảo mỗi bên đọc to), vì câu
   nghe lén phải có người đứng nói trong thế giới. Câu hỏi của bà Delaney là cặp "calls / cars" (giọng Anh, "cars"
   không có r, "calls" có l tối gần như nuốt mất). Hồ sơ của hãng đọc từ chính những gì phi vụ trước để lại (điều kiện
   `past`: phi vụ 1 trễ hoặc mất khách, job 2 ký sau năm rưỡi, phi vụ 7 nộp sau mười hai giờ, phi vụ 6 có người làm
   chứng). Cuộc gọi từ nhà cho người đã cưới chưa làm (cần giọng Gemini của người bạn đời).
5. **Chuỗi A** dừng lúc bà Okafor lên xe (phi vụ diễn ra ở Westbay; đầu thị trấn của chuyến xe không dựng được).
   **Chuỗi B** thu ba người, không phải năm; khác biệt giữa ba giọng nằm ở chữ (`say` của từng câu), vì giọng trình
   duyệt không có thói quen nói riêng.
6. **Chỗ không có trên bản đồ** được đặt ở chỗ có thật gần nhất: trạm gác cũ ở chòi Gus, văn phòng Ban quản lý cảng ở sạp
   Jun (ngay dưới nó), bãi xe buýt ở xe cà phê của Tess.
7. **Chuỗi phụ có `after`, không có `side`**: test chung không cho một phi vụ `side` có `after`, mà mỗi việc nhỏ phải mở
   sau việc trước. Nên hai chuỗi là nhánh của mạch chính (mở sau job 2, không chặn phi vụ nào khác).

**Cần engine (chưa có loại bước nào làm được, đã dựng bằng loại gần nhất):**

- Clip Gemini cho người thị trấn trong phi vụ (Sam, Emma, Daniel, cuộc gọi của người bạn đời).
- Một nút "Đó!" bấm đúng câu đang được đọc (phi vụ 8), thay cho gõ lại sau.
- Một chiếc xe Bayline thật tới đậu ở sân khấu (phi vụ 6): bây giờ chỉ có tay tài xế đứng đó và lời nói. (Bà Delaney
  và tay tài xế đã đứng được trong thành phố nhờ `jobCast.ts` của phiên làm engine; phi vụ 6–8 gọi họ vào cảnh.)
- Trạm gác cũ và phòng họp của Ban quản lý cảng trên bản đồ.

**Đã chạy bằng script** (Edge headless trên dev server, chế độ admin, tiếng tắt nên mỗi câu "xong" ngay; script ở
ngoài repo): phi vụ 6 một lượt ghi đúng hết (Sạch) và một lượt nghe nhầm mọi chỗ (Hỏng, đủ bốn hệ quả); phi vụ 7 và 8
một lượt đúng hết (Sạch); A1 đúng hết (Sạch); A3 và B1 mỗi cái một chỗ ghi sai cố ý (Lộn xộn, đúng hệ quả). Lượt chạy
đầu của phi vụ 6 lộ một lỗi dàn cảnh: Jun còn đứng ở sạp bà Mei nên người chơi phải chờ anh đi bộ về sạp, gần ba phút;
đã sửa (một cảnh gọi Jun đứng ở sạp anh trước bước mật khẩu). **Chưa chạy:** A2, B2, B3, và lượt nghe nhầm của phi vụ 7,
8. Ở phi vụ 8, người chơi đã biết con số từ lời Gus nên gõ được mà không cần nghe Kemp đọc: bước gõ lại chỉ kiểm được
việc nhớ, chưa kiểm được việc nghe ra câu đó (chỗ này cần nút "Đó!").

**Chưa ai kiểm:** chưa ai đọc lại lời thoại (do model viết), chưa ai nghe; chưa chạy thử bằng tay hay trên điện thoại.
Tiền, mức kết, độ dài là đoán.

## 9. As written (2026-11-27): sáu chuỗi "người lạ" còn lại

Kế hoạch (`docs/gta-plan.md` §5) hẹn tám chuỗi "người lạ", mỗi chuỗi ba việc nhỏ; mục 5 ở trên mới có hai (Okafor,
giáo sư). Sáu chuỗi sau viết thẳng thành dữ liệu, mỗi chuỗi một KIỂU nghe, không lặp lại hai chuỗi cũ (Okafor: giờ tàu xe,
số bến; giáo sư: cùng một câu nói ba cách) hay lặp lại nhau. Chỉ dùng loại bước đã có ở đầu `src/core/town/jobDoc.ts`;
không cần thêm gì cho engine. Tất cả là người Westbay (giọng trình duyệt): **không clip mới nào**.

| Chuỗi | File | Việc (thứ tự, câu) | Kiểu nghe | Bước chính |
|---|---|---|---|---|
| C. Người gọi lúc nửa đêm (Kit) | `sideKit.ts` | Bài cho Rosie (41, 24), Đường dây rè (42, 21), Rosie gọi lại (43, 25) | người gọi nói lầm bầm, đường dây rè | notebook qua điện thoại, giọng người gọi của đài |
| D. Cuộc đua vịt (Fay) | `sideFay.ts` | Vịt số mấy (51, 21), Giải thưởng (52, 21), Chung kết (53, 20) | bình luận nhanh: số nối số, tự sửa giữa câu, đùa chen vào | notebook qua loa (Marcus), qua lời đọc vội (Fay) |
| E. Bộ đàm của bến phà (Odile) | `sideOdile.ts` | Thẻ hành lý (61, 20), Thuyền Petrel (62, 20), Sương mù (63, 20) | thủ tục bộ đàm: đánh vần Kilo / Echo, đọc từng chữ số, "fife", "niner", port / starboard | notebook qua bộ đàm |
| F. Hai người một lúc (Nell) | `sideNell.ts` | Hai quầy một lúc (71, 24), Giao ca (72, 24), Bánh sinh nhật (73, 25) | hai người nói cùng lúc | notebook rồi `threads` (hai luồng, câu chốt cách nhau ≥ 3 s) |
| G. Bài hát ngoài chợ (Jonah) | `sideJonah.ts` | Cái nhẫn trong mũ (81, 26), Tối thứ Năm (82, 26), Cửa sau lúc tám giờ (83, 26) | nghe lỏm một cuộc nói chuyện giữa chợ rồi làm theo | notebook, `overhear` có `noticed`, `intent` (cờ theo lựa chọn) |
| H. Ai đang gọi (Hana) | `sideHana.ts` | Giọng không tên (91, 21), Xin lỗi, xin lỗi (92, 20), Sarah ở Cầu Cũ (93, 20) | nhận ra ai đang nói qua cách nói (cùng một giọng trình duyệt) | notebook, `pick` ba tin nhắn không chữ, có `why` |

Mỗi việc 2–3 dữ kiện phải nghe ra, mỗi dữ kiện một hệ quả rồi nhập lại (`wellFormed`); việc đầu mỗi chuỗi mở sau job 2
(`after: 'job-half5'`, như chuỗi A, B) và cần đã gặp người đó (`opens: ['ct-<người>-1']`), việc sau mở sau việc trước. Không
chặn mạch chính.

**Chọn lựa, và vì sao:**

1. **Không ngựa, không cá cược.** Kế hoạch nói "trường đua ngựa với lời bình luận"; Westbay không có trường đua và dự án
   không làm cờ bạc. Thay bằng cuộc đua vịt cao su gây quỹ cho bệnh viện ở hội chợ cảng (lễ hội mùa thu của Fay, Marcus
   bình luận: docs/city.md §9), vé là vé từ thiện. Kiểu nghe giữ nguyên: số nối số, nhanh, có tự sửa.
2. **Khoa sáu là khoa sản** (bà đỡ tóc đỏ của bác sĩ Osei, docs/city.md §10), nên ông cụ của chuỗi Kit nằm khoa tám, khoa
   bảy là khoa nhi, khoa mười một là văn phòng.
3. **Hana phân biệt bằng CHỮ**, như băng giả của Hồi III: cả Westbay một giọng trình duyệt. Colin nói "mate" (mới), ông
   Finch xin lỗi hai lần (mới; canon chỉ nói ông thì thầm cả ngoài trời, mà giọng trình duyệt không thì thầm được), ông
   Whitlock gọi thị trấn của Sarah bằng tên một trạm xe số 9 (Old Bridge, Hill Farm: `ct-whitlock-1`, đã có).
4. **Chuỗi Nell chỉ "cùng lúc" từ mức lời nói 3**: ở mức 1–2 (`core/town/difficulty.ts` `together: false`) engine phát
   từng luồng một, nghe trọn cả hai, nên hai hệ quả của bước `threads` không xảy ra được. Đúng ý thiết kế độ khó, nhưng
   người mới chơi sẽ không thấy kiểu nghe riêng của chuỗi này.
5. **Chuỗi Jonah**: Mia được nhắc tới, không nói (người thị trấn trong phi vụ cần clip). Câu trả lời cho Jonah là một
   `intent`; lựa chọn sai đặt cờ (`flag`) để cảnh kết kể đúng chuyện xảy ra (tới lúc mười một giờ, gõ cửa trước...).

**Đã chạy bằng script** (Edge headless, phần mềm vẽ, dev server, chế độ admin, tiếng tắt; script ngoài repo): **cả 18 việc,
mỗi việc hai lượt tới bảng tổng kết**, một lượt ghi / chọn đúng hết (18 lượt Sạch) và một lượt sai mọi chỗ (17 Hỏng; "Thẻ
hành lý" chỉ có hai dữ kiện nên Lộn xộn, đúng luật). Ba việc của Nell chạy ở mức lời nói 3 (ghim), lượt sạch chuyển luồng
đúng lúc câu chốt, lượt sai nghe nhầm luồng ở cả hai câu chốt. Lượt sai của Jonah đứng sát người nói nên bị phát hiện
(hệ quả "Đứng gần quá" có trong bảng tổng kết). Không lỗi console. Chưa chạy ở mức 1–2 hay 4–5.

**Chưa ai kiểm:** chưa ai đọc lại 404 câu (do model viết), chưa ai nghe, chưa ai chơi bằng tay hay trên điện thoại. Tiền,
mức kết, độ kiên nhẫn là đoán.
