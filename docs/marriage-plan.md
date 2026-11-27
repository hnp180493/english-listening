# Kế hoạch: hôn nhân, drama gia đình, ly dị, tái hôn, cưới người Westbay

Viết 2026-11-27 theo yêu cầu của chủ dự án, sau khi được trả lời là chưa có ly dị hay drama hôn nhân: "vậy không giống
stardew valley rồi, học hỏi lên plans làm đi, ngoài mấy cái mày đề xuất thì thêm có thể li dị vô số lần và cưới cả người
ở thành phố, mọi thứ nhớ có context liên quan với nhau như ghen tuông... tạm thời lên plans trước khi nào tao bảo làm mới
làm".

Đây là ĐỀ XUẤT, chưa xây gì, chưa sửa dòng code nào. Số liệu về cái đang có lấy từ code ngày 2026-11-27 (`core/town/life.ts`,
`romance.ts`, `lifeStore.ts`, `friendship.ts`, `romanceAudio.ts`, `data/romance/`, `docs/town.md` §12, §14, §15, §21,
`docs/city.md`). Mọi con số của phần đề xuất (điểm, giá, số câu, số clip) là ước lượng để bàn, chưa cân.

## 0. Một trang

- **Hiện có**: một đường một chiều. 8 tim + bó hoa → tỏ tình → 3 buổi hẹn (mỗi ngày một) → 10 tim + nhẫn → cầu hôn → cưới
  hôm sau → mỗi ngày một câu chuyện với vợ/chồng, chơi với con (tối đa 3), đi chơi ở Westbay. Tim không bao giờ tụt. Drama
  duy nhất: Zoe bỏ Max trước khi cưới. Dữ liệu `town-life` hiện KHÔNG biểu diễn được ly dị: các mốc chỉ thêm, gộp theo thời
  điểm sớm nhất, và "người yêu" là người có `dating` sớm nhất mãi mãi (§1).
- **Đề xuất**: một **sổ sự kiện** của đời sống gia đình (thêm, không bao giờ xóa), từ đó tính ra mọi thứ: đang với ai, ấm
  lạnh hôm nay, lòng tin, ai trong thị trấn biết chuyện gì. Ghen, giận, xin lỗi, ly thân, ly dị, người cũ, tái hôn đều là
  sự kiện trong sổ; mọi người đọc cùng một sổ nên lời nói ở khắp nơi khớp nhau (§4, §5).
- **Mọi drama là cảnh nghe**: cãi nhau nhanh và chồng tiếng, giận lạnh nói ít mà lý do giấu trong một câu, xin lỗi phải nói
  lại đúng điều người kia trách, ghen mỗi người một kiểu nói theo tính cách đã có. Nghe ra điều người kia thật sự nói thì
  làm lành; nghe nhầm thì một hệ quả rồi quay lại mạch, không bao giờ "sai, làm lại" (§8).
- **Ly dị vô số lần**: người chơi chủ động ly dị ở phòng hộ tịch Westbay (phí xu, ba ngày cân nhắc rút lại được), hoặc người
  kia đòi sau khi ly thân hòa giải không thành. Không giới hạn số lần; cái giá là xu, ngày chờ, lòng tin của người cũ, và
  thị trấn nhớ (§6).
- **Cưới người Westbay**: rà 37 người, một số người lớn độc thân cưới được (§7). Họ nói giọng trình duyệt, nên cưới người
  Westbay **không tốn clip nào**.
- **Clip là nút thắt thật**: key free 10 clip một ngày. Drama đầy đủ cho 11 người thị trấn cưới được là khoảng 1.700
  clip, tức gần 6 tháng key free. Đề xuất làm theo từng người và hỏi chủ dự án ba lựa chọn (§9).
- **M0**: một lát cắt nhỏ nhất: Emma (người chơi nam) nói một câu hẹn tối thứ Sáu trong chuyện hằng ngày; không tới thì
  có một trận cãi nhau, rồi xin lỗi và làm lành hoặc một ngày giận lạnh. Khoảng 30 câu, khoảng 30 clip (§13).

## 1. Cái đang có, và chỗ nó chặn ly dị

Từ code:

- **`town-life` (đồng bộ, `core/town/life.ts`, gộp bằng `mergeTownLife`)**: `profile` (nhân vật của người chơi), `court`
  (mỗi cư dân: thời điểm `dating`, `date1..3`, `engaged`, `married`; chỉ thêm, gộp lấy sớm nhất), `kids` (tối đa 3),
  `choices` (lựa chọn đầu tiên mỗi cảnh), `talked` (40 ngày gần nhất).
- **`partnerOf`** = người có `dating` sớm nhất. Không có mốc "kết thúc", nên một khi đã hẹn hò ai thì người đó là người yêu
  mãi mãi; không thể có cuộc hôn nhân thứ hai, không thể ly dị, không thể quay lại.
- **Tim** nằm ở `town-progress` (`friends[placeId].up/down` mỗi máy, lấy max), 0–10 tim cho mọi cư dân. "Nothing decays":
  không có gì tụt theo ngày. Bó hoa 30 xu, nhẫn 150 xu ở Tiệm quà.
- **Sau cưới** (`romance.ts`): mỗi ngày một cảnh với vợ/chồng (8 cảnh xoay vòng mỗi người), mỗi con một cảnh, có em bé sau
  3 ngày cưới, đứa sau khi đứa út đủ 14 ngày. Không có cảnh nào phụ thuộc chuyện đã xảy ra hôm qua.
- **Giọng** (`romanceAudio.ts`): người được cưới nói giọng Gemini của chính họ, người chơi nói Puck (nam) / Callirrhoe
  (nữ), con nói Achird / Autonoe. Mỗi người cưới được có khoảng 70–80 câu (Emma: 46 câu của Emma, 26 câu của người chơi);
  cảnh con cái có 187 câu (44 câu của vợ/chồng viết một lần nhưng đọc bằng giọng của từng người, 95 câu của con × 2 giọng).
  Đi chơi ở Westbay: 441 clip (mỗi câu của "partner" × 11 giọng).
- **Westbay**: người chơi có nói (docs/city.md §5, chủ dự án 2026-11-27); trong phi vụ, lời người chơi đọc bằng giọng trình
  duyệt đúng giới tính (`jobVoice.ts PLAYER_VOICE`).

Kết luận cho thiết kế: phải đổi cách lưu `town-life` (§10). Phần còn lại (tim, cảnh, giọng, sân khấu dàn cảnh, cảnh nghe ở
ghế, Bay FM, điện thoại, phi vụ) dùng lại được.

## 2. Stardew làm gì, ta lấy gì, bỏ gì

Tra trên wiki chính thức (stardewvalleywiki.com) ngày 2026-11-27, qua công cụ tìm kiếm (trang wiki chặn tải tự động nên
không đọc được nguyên trang; chỗ nào wiki tự mâu thuẫn hay không tìm thấy thì ghi rõ).

| Stardew (nguồn) | Ta lấy | Ta làm khác / bỏ, vì sao |
|---|---|---|
| Ứng viên dừng ở 8 tim cho tới khi nhận bó hoa; tặng bó hoa là bắt đầu hẹn hò ([Friendship](https://stardewvalleywiki.com/Friendship), [Bouquet](https://stardewvalleywiki.com/Bouquet)) | Đã có: 8 tim + bó hoa | Giữ |
| Cầu hôn bằng Mermaid's Pendant 5.000g, cần 10 tim và nhà đã nâng cấp; đám cưới 3 ngày sau ([Mermaid's Pendant](https://stardewvalleywiki.com/Mermaid's_Pendant), lời Emily / Elliott) | Đã có: nhẫn, 10 tim, 3 buổi hẹn, cưới hôm sau | Giữ. Không bắt "nâng cấp nhà" vì chưa có nhà riêng |
| Vợ/chồng lên tới 14 tim; không nói chuyện thì tụt 20 điểm một ngày và không bao giờ ngừng tụt ([Friendship](https://stardewvalleywiki.com/Friendship), [Marriage](https://stardewvalleywiki.com/Marriage)) | Bỏ bê có hậu quả | **Không trừ tim theo ngày vắng mặt.** Đây là app luyện nghe: người học nghỉ ba ngày không được bị phạt vì nghỉ. Chỉ tính ngày người chơi CÓ vào thị trấn mà bỏ qua vợ/chồng, và hậu quả rơi vào "ấm / tin" (§4), không xóa tim đã kiếm bằng việc nghe |
| Vợ/chồng vui thì giúp việc: tưới cây, cho thú ăn, sửa hàng rào, làm bữa sáng; tuần trăng mật 7 ngày ([Marriage](https://stardewvalleywiki.com/Marriage)) | Tâm trạng đổi hành vi | Thay "giúp việc" bằng thứ có nghĩa ở đây: vợ/chồng vui thì nhắc trước một việc sắp tới (một câu nói, nghe ra thì có lợi), mang quà nhỏ, đi cùng lên Westbay. Tuần trăng mật: 7 ngày đầu không có cãi nhau |
| Tặng quà (không phải món họ ghét) cho ứng viên đã nhận bó hoa của mình khi đang có vợ/chồng: 20–40% (theo vận may) bị ghen, mất 30 điểm và một câu trách hôm sau; quà sinh nhật được miễn. Wiki tự mâu thuẫn: trang Luck nói chỉ khi đang hẹn hò người đó ([Marriage](https://stardewvalleywiki.com/Marriage), [Friendship](https://stardewvalleywiki.com/Friendship), [Luck](https://stardewvalleywiki.com/Luck)) | Ghen vì quà | **Không ngẫu nhiên.** Ghen có lý do kể lại được: ai thấy, ai kể, kể ở đâu (§5). Mức ghen theo những gì đã thật sự xảy ra, không theo "vận may" |
| Hẹn hò hết các ứng viên cùng giới thì có "sự kiện 10 tim nhóm": họ chất vấn người chơi; sau đó cả nhóm lạnh nhạt khoảng một tuần, không nhận quà, không mất điểm ([Bouquet](https://stardewvalleywiki.com/Bouquet), [Haley](https://stardewvalleywiki.com/Haley)) | Hẹn hò nhiều người trước cưới, có ngày bị lật tẩy | Cảnh chất vấn là cảnh **nhiều người nói chồng lên nhau** (`threads`). Ai cũng đã biết chuyện qua lời đồn trước đó, không phải đột ngột |
| Ly dị: cuốn sổ ở nhà thị trưởng, 50.000g, hủy được trước khi hết ngày; người cũ về nhà cũ, đối xử tệ, không nhận quà; con ở lại nhà người chơi. Tim về 0 (wiki tiếng Hungary) hay "như 2 tim" (wiki tiếng Anh): mâu thuẫn ([Marriage](https://stardewvalleywiki.com/Marriage), [Mayor's Manor](https://stardewvalleywiki.com/Mayor%27s_Manor)) | Ly dị ở một văn phòng, có phí, rút lại được | Có **ba ngày cân nhắc**, mỗi ngày là một cảnh nghe; người cũ không "đối xử tệ" mãi mà theo đúng cách cuộc hôn nhân kết thúc (§6) |
| Đền Ký ức (lều phù thủy) 30.000g xóa ký ức người cũ, coi như chưa từng cưới, cưới lại được ([Dark Shrine of Memory](https://stardewvalleywiki.com/Dark_Shrine_of_Memory)) | Tái hôn được | **Bỏ việc xóa ký ức.** Luật của hệ Thân thiết là "facts không bao giờ quên". Muốn quay lại thì phải hàn gắn bằng cảnh nghe (§6). Thế lại hay hơn: người cũ nhớ, và lời họ nói khác |
| Đền Ích kỷ: một Prismatic Shard biến con thành chim bồ câu, vĩnh viễn ([Dark Shrine of Selfishness](https://stardewvalleywiki.com/Dark_Shrine_of_Selfishness)) | Không | **Bỏ.** Lạc giọng app (đời thường, ấm áp). Con cái sau ly dị là chuyện chia ngày ở với ai (§6) |
| Con: cần 10 tim, phòng trẻ, vợ/chồng hỏi; sinh sau 14 ngày; sơ sinh 14 ngày, đứng trong nôi 14 ngày, bò 28 ngày, rồi mãi là trẻ con ([Children](https://stardewvalleywiki.com/Children)) | Đã có (nhanh hơn: 7 / 21 ngày) | Giữ nhịp hiện tại. Số con tối đa của Stardew không kiểm được qua tìm kiếm |
| Vợ/chồng có phòng riêng trong nhà ([Marriage](https://stardewvalleywiki.com/Marriage)) | Chưa | Chưa có nhà riêng (docs/town.md §15 "Not built"). Ngoài phạm vi; nêu ở câu hỏi |

Game khác, ngắn:

- **My Time at Portia**: hẹn hò nhiều người cùng lúc được; bị bắt gặp hẹn người khác thì "ghen" và phải bỏ ra 7 ngày chuộc
  lỗi; theo một hướng dẫn, ly dị xong cưới lại được và con ở lại nhà ([devlog "Jealousy comes to Portia"](https://patheagames.itch.io/my-time-at-portia/devlog/19872/jealousy-comes-to-portia),
  [TheGamer](https://www.thegamer.com/my-time-at-portia-romance-guide/); nguồn cộng đồng, chưa kiểm trong game). Ta lấy ý
  **ghen vì bị bắt gặp**, không vì một con số.
- **The Sims 4**: ngoại tình chỉ gây chuyện khi người kia **nhận ra**; mất điểm quan hệ, giận ([The Sims Wiki: Affair](https://sims.fandom.com/wiki/Affair));
  có bảng "ranh giới tình cảm" để chỉnh ghen ([PC Gamer](https://www.pcgamer.com/games/the-sims/sims-4-romantic-boundaries)).
  Ta lấy ý **ai biết thì mới ghen**, và **danh tiếng** lan qua lời đồn.
- **Fable II**: ai cũng có thể chủ động ly dị, kể cả vợ/chồng; có thể nhiều vợ/chồng (mỗi nhà một người) ([Wikipedia](https://en.wikipedia.com/wiki/Fable_2),
  [Giant Bomb](https://giantbomb.com/wiki/Games/Fable_II)). Ta lấy ý **người kia cũng có thể đòi ly dị**; bỏ đa thê (không hợp
  giọng app, và chồng chéo dữ liệu).

**Cái ta phải làm KHÁC Stardew, một câu**: ở Stardew mọi thứ đi qua quà và lịch; ở đây mọi thưởng phạt đi qua việc NGHE:
ghen bắt đầu từ một câu ai đó nói ra, làm lành là nghe ra điều người kia thật sự trách, ly dị là kết quả của những lần
nghe sai hoặc bỏ mặc (hay quyết định của chính người chơi), và mỗi câu nghe hụt vào Ôn tập như mọi nơi khác.

## 3. Năm nguyên tắc

1. **Nghe là cách duy nhất để sửa chuyện.** Không có nút "xin lỗi", không có món quà mua được để xóa lỗi. Quà chỉ có tác dụng
   khi chọn đúng món người kia ĐÃ NÓI là thích (như Tặng quà bây giờ).
2. **Một hệ quả rồi quay lại mạch** (như phi vụ, docs/gta-plan.md §11): nghe nhầm thì chuyện rẽ, có hậu quả kể lại được,
   rồi đời sống tiếp tục; không "sai, thử lại", không game over.
3. **Không phạt người học vì nghỉ học.** Ngày không mở thị trấn không tính là bỏ bê. Chỉ ngày có vào mà lờ vợ/chồng đi mới
   tính (§4).
4. **Một sổ, mọi người cùng đọc.** Mọi chuyện quan trọng là một sự kiện trong sổ; lời chào, chuyện trên ghế, Bay FM, buổi
   họp mặt, con cái, họ hàng đều đọc từ đó. Không có lời nói nào mâu thuẫn với chuyện đã xảy ra (§5).
5. **Trung thực và lành**: tim, ấm, tin là điểm trò chơi, không đo trình độ; drama đời thường, không bạo lực, không nội dung
   người lớn (§12).

## 4. Mô hình quan hệ sau cưới

### Ba thang đo

| Thang | Là gì | Lưu hay tính | Đi theo |
|---|---|---|---|
| **Tim** (0–10, đã có) | Đã nghe người đó bao nhiêu (mọi cư dân) | Lưu ở `town-progress` như bây giờ | Không tụt theo ngày. Chỉ ly dị và vài chuyện lớn đặt **trần** tạm thời (tính ra từ sổ, không ghi "down", §10) |
| **Ấm** (0–100, mới, chỉ vợ/chồng và người yêu) | Hôm nay họ thấy thế nào với mình | **Tính ra** từ sổ sự kiện 14 ngày gần nhất, không lưu | Chuyện hằng ngày nghe đúng, quên hẹn, cãi nhau, làm lành |
| **Tin** (0–100, mới, vợ/chồng, người yêu, người cũ) | Họ còn tin mình tới đâu | **Tính ra** từ các sự kiện lớn (ghen, xin lỗi được chấp nhận, ly thân...), mỗi sự kiện mờ dần theo thời gian | Ghen, hứa rồi quên, xin lỗi đúng, hòa giải |

Vì sao không dùng tim cho drama: tim là phần thưởng của việc nghe từng ngày, chủ dự án đã chốt "điểm trò chơi, không đo
khả năng nghe", và một trận cãi nhau không nên xóa ba tuần nghe. Ấm cho cái hôm nay, tin cho cái lâu dài.

### Trạng thái

```
độc thân ──tỏ tình──▶ hẹn hò ──cầu hôn──▶ đính hôn ──cưới──▶ đang cưới
   ▲                     │ chia tay (cả hai phía)                │
   │                     ▼                                      ├─ ấm thấp: "lạnh nhạt" (một trạng thái hiển thị, không phải mốc)
người cũ ◀──────── ly dị ◀── ba ngày cân nhắc ◀── ly thân ◀───────┤
   │  (hoặc người chơi chủ động: đang cưới ──đơn ly dị──▶ ba ngày cân nhắc)
   └──hàn gắn──▶ hẹn hò lại (rút gọn) ──▶ tái hôn
```

- **Đang cưới / lạnh nhạt**: lạnh nhạt là khi ấm dưới 30: câu hằng ngày ngắn đi, họ không nhắc trước việc gì, không đi cùng
  lên Westbay. Tự hết khi ấm lên lại.
- **Ly thân**: khi tin dưới 25 và đã có ít nhất hai trận cãi nhau không làm lành trong 14 ngày, vợ/chồng nói ra (một cảnh).
  Họ về chỗ ở cũ của họ (cư dân thị trấn về nhà mình; người Westbay về Westbay). Kéo dài tối đa 7 ngày thật. Trong đó có
  đúng một cảnh hòa giải có người thứ ba (§8). Hòa giải thành thì về lại "đang cưới" (tin +15); không thành, hoặc hết 7 ngày
  mà không ai làm gì, thì họ nộp đơn (ly dị do người kia).
- **Ly dị**: từ "đang cưới" người chơi nộp đơn được bất cứ lúc nào (§6). Ba ngày cân nhắc, rút được. Hết ba ngày thì xong.
- **Người cũ**: nhớ hết (facts), lời chào và chuyện trên đường khác đi theo cách kết thúc (§6).
- **Tái hôn**: với người mới thì đi lại đường bình thường; với chính người cũ thì một đường rút gọn (§6).

### Cái gì đẩy lên, kéo xuống (theo ngày thật)

Số là để bàn. "Ngày có vào" = ngày người chơi mở thị trấn hoặc Westbay.

| Chuyện | Ấm | Tin | Ghi chú |
|---|---|---|---|
| Chuyện hằng ngày, nghe đúng câu chính | +6 | | Giữ +10 tim như bây giờ |
| Chuyện hằng ngày, nghe nhầm câu chính | +1 | | Câu nhầm vào Ôn tập. Vẫn có mặt là quý |
| Ngày có vào mà không nói chuyện với vợ/chồng | −8 | | Ngày không vào: 0. Tối đa −24 cho một chuỗi; ba ngày liền như vậy thì có cảnh "Dạo này bận gì thế?" |
| Nghe ra một lời hẹn và tới đúng giờ (§8 "lời hẹn") | +10 | +3 | Lời hẹn nói một lần trong chuyện hằng ngày, kiểu tự nhiên |
| Lời hẹn đã nghe mà không tới / nghe nhầm giờ | −15 | −5 | Mở một trận cãi nhau ngày đó |
| Sinh nhật, kỷ niệm ngày cưới: nhớ (đã ghi được ngày khi nghe) | +12 | +4 | Ngày sinh nhật nói trong chuyện hằng ngày, phải nghe ra và ghi |
| Quên | −12 | −6 | |
| Cãi nhau, làm lành ngay (nghe đúng điều họ trách) | +4 | +2 | Cãi xong mà hiểu nhau thì gần hơn |
| Cãi nhau, không làm lành | −10 | −8 | Ngày hôm sau là "giận lạnh" |
| Một lần ghen có lý do (§5) | −10 | −10 | Mức theo chuyện, xem bảng ghen |
| Xin lỗi được chấp nhận | +8 | +6 | Chỉ khi nói lại đúng điều đã làm sai |
| Đi chơi Westbay cùng nhau | +5 | | Đã có (+15 tim một ngày) |
| Chơi với con | +2 | | Đã có |

Ấm bắt đầu 70 sau cưới, kẹp 0–100, chỉ 14 ngày gần nhất tính vào. Tin bắt đầu 70, mỗi sự kiện mờ đi một nửa sau 30 ngày.
Tuần trăng mật: 7 ngày đầu không có cãi nhau, không có ghen.

## 5. Mọi thứ có context liên quan nhau

Đây là yêu cầu chính. Cách làm: **một sổ sự kiện chung** (`life.events`, §10), và một bảng "ai biết" tính ra từ sổ. Không
có lời nói nào tự bịa chuyện: lời nào nhắc một chuyện thì chuyện đó phải có trong sổ.

### Sổ sự kiện

Mỗi sự kiện: loại, ai (cư dân hoặc người Westbay), người thứ ba nếu có, thời điểm, ngày, và "ai đã thấy". Các loại:

- Đời sống: `confess`, `date`, `engaged`, `married`, `anniversary`, `birthday-kept` / `birthday-missed`, `promise-kept` /
  `promise-missed`, `quarrel`, `made-up`, `cold-day`, `apology`, `separated`, `mediation`, `divorce-filed`,
  `divorce-withdrawn`, `divorced`, `reconcile-step`, `remarried`, `kid-born`, `custody-day`.
- Chuyện gây ghen (chỉ ghi khi đang hẹn hò hoặc đang cưới): `gift-to-candidate` (tặng quà cho một người cưới được khác),
  `outing-with` (rủ một người cưới được khác lên Westbay: bus panel "Rủ đi cùng"), `hearts-with` (lên 8 tim với một người
  cưới được khác), `date-other` (trước cưới: đang hẹn hò hai người), `seen` (ai đó thấy: tính ra từ chỗ xảy ra, §5 bảng).

### Ai biết, theo đường nào

Một chuyện lan theo năm đường, mỗi đường một nơi lời nói đổi:

1. **Tận mắt**: người có mặt (người được tặng quà, người ở chỗ đó lúc đó: chủ tiệm, người đi ngang theo lịch sống
   `engine/life.ts`). Biết ngay.
2. **Người thân**: anh chị em, bố con, họ hàng theo canon (bảng dưới). Biết sau 1 ngày.
3. **Lời đồn trên ghế**: hai cư dân bàn chuyện ở một trong 24 cái ghế ("Ngồi xuống nghe", docs/town.md §19). Người chơi nghe
   lỏm được chính chuyện của mình. Đây là cách thị trấn "biết": sau lần đồn đầu tiên, ai có mặt ở ghế đó hoặc thân với hai
   người đó (≥ 3 tim của người chơi không liên quan; dùng bảng bạn bè canon) thì biết.
4. **Bay FM**: chỉ chuyện công khai (đám cưới, ly dị xong, tái hôn) và chỉ khi có liên quan Westbay (cưới người Westbay, đám
   cưới ở Westbay) hoặc người trong cuộc gọi lên chương trình (Tom ghét radio, Marcus là bạn viết thư của Tom: chuyện của Tom
   thì Marcus nhắc khéo). Không bao giờ tin đồn ghen tuông.
5. **Con cái**: con đủ tuổi đi học hỏi đúng chuyện con thấy (bố/mẹ ngủ ở đâu, sao hôm nay không đi chơi).

### Ai ghen thế nào (theo tính cách đã có trong canon), và đó là kiểu nghe gì

| Người | Canon dựa vào | Ghen kiểu | Kiểu nghe |
|---|---|---|---|
| Emma (quán cà phê) | Chủ quán, luôn bận quầy | Vừa pha đồ vừa nói, câu trách lẫn trong lời gọi khách | Hai luồng: lời với khách và lời với mình (`threads`) |
| Mia (nhà bạn) | Hát karaoke tối thứ Năm, ban nhạc cũ với Jonah | Nói vòng, hát một câu có ý | Nghe ra ý trong lời nói vòng (câu hỏi sau cảnh) |
| Sarah (văn phòng) | Tám năm một công ty, họp hằng tuần | Kể lại chuyện theo giờ, theo ngày, như biên bản | Số, giờ, ngày (sổ tay) |
| Kim (phòng khám) | Năm đầu suýt bỏ nghề, ca dài | Sau ca đêm nói nhanh, mệt, gắt | Nói nhanh, nối âm dày |
| Lily (công viên) | Việc mới, căng thẳng | Nói dồn, chen điện thoại công việc | Hai luồng: cuộc gọi công việc và lời với mình |
| Zoe (rạp phim) | Đã bỏ Max để đến với người chơi | "Tôi biết cảm giác của Max": nói bằng ngôn ngữ phim | Ẩn ý, so sánh |
| Leo (quảng trường) | Thẳng, tổ chức tối board game | Nói thẳng, rủ "nói chuyện" sau tối board game | Nghe điều kiện trong câu ("only if...") |
| Ben (cửa hàng) | "Người kể chuyện cười dở nhất" (bố Frank nói) | Đùa mà có gai | Giọng mỉa: hiểu nghĩa ngược lời |
| Sam (bến xe) | Ghét gọi điện, nhắn ba chữ | Im; tin nhắn ngắn hơn nữa; Rico gọi "hộ" | Nghe cái không được nói (Rico kể lại) |
| Tom (bảng tin) | Ghét nói trước đám đông, "um", chuyển nhà mỗi năm hồi nhỏ | Ngập ngừng, né, sợ bị bỏ lại | Câu chính bị "um" chen ngang (`broken`) |
| Daniel (trường) | Giọng Anh, viết tiểu thuyết, chị Claire | Lịch sự kiểu Anh: "I'm sure it's nothing" | Nói giảm, nói tránh: hiểu ý thật |

Grace là "bà của thị trấn" (docs/town.md §15): không cưới được, là người hòa giải mặc định. Max là người cũ của Zoe: tiền lệ
cho cách người cũ cư xử (không thoại trong cảnh tình cảm, được kể lại; quay phim đám cưới). Muốn Max có thoại thì là clip mới.

### Họ hàng và phe

Họ hàng theo canon (docs/city.md §2–§3; danh sách đầy đủ ở §7): cưới người có người thân thì người thân thành họ hàng, đổi
lời chào và có mặt ở đám cưới, ở buổi hòa giải, và chọn phe khi ly dị.

| Cưới | Thành họ hàng |
|---|---|
| Leo | Nora (chị), Theo (anh rể), bé Maya (cháu) |
| Ben | Frank (bố chồng) |
| Sam | Rico (anh họ), dì Rosa (mẹ chồng, chỉ được nhắc, không nói) |
| Daniel | Claire (chị chồng) |
| Tom | Marcus không phải họ hàng mà là bạn thân (bạn viết thư) |
| Một người Westbay có người thân dưới thị trấn | xem §7 |

**Phe khi ly dị** (tính ra, không lưu): người thân của người cũ đứng về người cũ; bạn thân theo canon của người cũ nghiêng về
người cũ trong 14 ngày; còn lại trung lập. Ai đứng về phía nào thì lời chào và một câu dẫn cảnh "Gặp trên đường" đổi. Không
ai ghét người chơi mãi: sau 30 ngày mọi người về trung lập, trừ người cũ (theo cách kết thúc).

### Ma trận: chuyện gì → ai biết → lời đổi ở đâu

| Chuyện | Ai biết, khi nào | Lời đổi ở đâu |
|---|---|---|
| Tỏ tình được nhận | Người đó; người thân sau 1 ngày; thị trấn qua một lời đồn trên ghế | Ghế (cảnh đồn mới), lời chào người thân, câu dẫn "Gặp trên đường" của bạn thân người đó |
| Hẹn hò hai người cùng lúc (trước cưới) | Cả hai, khi một trong hai thấy (tặng quà / đi Westbay ở chỗ người kia có mặt), hoặc qua đồn | Ghế, rồi cảnh chất vấn nhóm khi đủ điều kiện (§8) |
| Đám cưới | Cả thị trấn (đã có: cả thị trấn tới quảng trường); Westbay qua Bay FM nếu cưới người Westbay | Lời chào mọi người tuần đầu, buổi họp mặt trong tuần nhắc, Bay FM đọc lời chúc |
| Quà cho người cưới được khác khi đang cưới | Người nhận; người có mặt; vợ/chồng nếu có mặt hoặc qua người thân / ghế | Cảnh ghen (kiểu của từng người), ghế |
| Rủ người cưới được khác lên Westbay | Vợ/chồng ngay (chuyến xe số 9 đi qua bến của Sam; Sam là người kể nếu không phải chính Sam) | Cảnh ghen; Rico nói một câu ở Westbay (giọng trình duyệt) |
| Quên sinh nhật / kỷ niệm | Vợ/chồng; con | Cảnh giận lạnh; câu của con |
| Cãi nhau không làm lành | Vợ/chồng; người ở chỗ đó; con | Cảnh giận lạnh hôm sau; câu dẫn "Gặp trên đường" của người thân |
| Ly thân | Thị trấn qua ghế; người thân ngay | Ghế, lời chào người thân (đứng về phe), buổi họp mặt (một câu ngập ngừng của chủ nhà), con hỏi |
| Ly dị xong | Mọi người; Bay FM nếu dính Westbay | Lời chào (phe), Sổ tay ("người cũ"), con chia ngày, buổi họp mặt xếp chỗ khác |
| Tái hôn với người cũ | Mọi người | Ghế ("lại về với nhau rồi"), lời chào người thân, Bay FM nếu dính Westbay |
| Phi vụ / truyện Westbay | Chỉ một câu nhắc khi vợ/chồng là người Westbay có vai trong phi vụ đó, hoặc vợ/chồng đi cùng làm "người trong băng" (luật băng đã có: theo tim) | Câu dẫn của phi vụ, không đổi truyện chính |

**Tiền lệ Zoe – Max** (`data/romance/cinema.ts`): Max bước vào lúc tỏ tình, lặng lẽ đi; buổi hẹn thứ nhất thị trấn xì xào và
Zoe thấy mình là kẻ xấu; buổi thứ hai Max mang chân máy quay tới; buổi thứ ba anh mang bắp rang, không giận; anh quay phim
đám cưới. Cách này (người cũ được kể bằng lời dẫn, phản ứng có nhịp qua nhiều ngày, cuối cùng tử tế) là khuôn cho người cũ
của người chơi.

## 6. Ly dị vô số lần, và tái hôn

### Thủ tục

- **Ở đâu**: **phòng hộ tịch Westbay** (registry office) ở khu văn phòng: một chỗ mới nhỏ, một nhân viên mới (giọng trình
  duyệt, không clip). Vì sao không ở thị trấn: thị trấn không có tòa thị chính, "Văn phòng" là chỗ làm của Sarah (một ứng
  viên cưới được), và một chuyến xe số 9 bốn mươi phút để đi nộp đơn là đúng sức nặng của việc đó. Bản nháp tên:
  bà **Penrose**, nhân viên hộ tịch.
- **Giá**: 500 xu (bàn ở §11: Stardew để giá ly dị gấp 10 lần mặt dây chuyền; ta lấy khoảng 3 lần nhẫn để không thành vòng
  cày, cũng không rẻ tới mức bấm cho vui).
- **Ba ngày cân nhắc** (ngày thật): ngày nộp đơn là một cảnh ở phòng hộ tịch (nghe số và ngày: ngày nào xong, giấy gì, §8).
  Mỗi ngày trong ba ngày có đúng một cảnh với vợ/chồng (họ biết). Rút đơn được ở bất kỳ cảnh nào (lựa chọn theo ý định); rút
  thì hoàn nửa phí, sự kiện `divorce-withdrawn`, tin −10 (đã nộp đơn là một vết). Hết ba ngày: `divorced`.
- **Do người kia**: sau ly thân không thành (§4). Không tốn xu của người chơi. Người chơi vẫn có ba ngày, trong đó có một cảnh
  "níu kéo": nghe ra điều họ cần nghe thì họ rút đơn.

### Sau ly dị

- **Người cũ** về chỗ ở của họ. Tim không về 0 (tim là chuyện đã nghe): đặt **trần 4 tim** trong 30 ngày (tính ra từ sổ), rồi
  bỏ trần. Ly dị vì người kia lạnh nhạt lâu ngày (người chơi bỏ bê) thì trần 3; ly dị êm (hai bên làm lành trước khi chia
  tay, có một cảnh chia tay tử tế) thì trần 5.
- **Facts không quên**: người cũ nhớ mọi điều. Lời chào người cũ có ba bộ theo cách kết thúc (người chơi bỏ đi / người kia bỏ
  đi / chia tay êm), mỗi bộ hai câu.
- **Không nhận quà** của người chơi trong 7 ngày (như Stardew), sau đó nhận như cư dân thường.
- **Thị trấn**: phe (§5), lời đồn trên ghế, Sổ tay ghi "người cũ" và ngày.

### Con cái sau ly dị

Không làm kiểu "biến con thành chim". Ba lựa chọn, đề xuất C:

| Lựa chọn | Thế nào | Được / mất |
|---|---|---|
| A. Con ở với người chơi | Như Stardew | Đơn giản; người cũ biến mất khỏi đời con, lạ |
| B. Con ở với người cũ | Người chơi tới thăm | Người học mất phần chơi với con mỗi ngày |
| **C. Chia ngày theo thứ trong tuần** (đề xuất) | Thứ Hai, Tư, Sáu, Chủ nhật con ở với người chơi (đi theo sau như bây giờ); thứ Ba, Năm, Bảy ở với người cũ: chơi với con vẫn được, ở chỗ người cũ, người cũ có mặt và nói một câu (cảnh giao con: nghe ngày, giờ đón) | Giữ việc chơi với con mỗi ngày; mỗi lần giao con là một cảnh nghe nhỏ; con có hai nhà như đời thật |

Con của nhiều cuộc hôn nhân: mỗi con ghi cha/mẹ (cuộc hôn nhân nào); tổng số con đang có tối đa 4 (tăng từ 3, vì tái hôn có
thể có thêm con). Con hỏi chuyện ly dị bằng câu đơn giản (giọng con), câu trả lời theo ý định chọn những lời nhẹ nhàng; không
có lựa chọn nào đổ lỗi cho người kia trước mặt con (luật nội dung, §12).

### Tái hôn

- **Với người mới**: đi lại đường bình thường (8 tim + bó hoa…), không chờ gì thêm ngoài 7 ngày sau khi ly dị xong.
- **Với chính người cũ**: một đường **hàn gắn** rút gọn: khi trần tim đã bỏ và đủ 8 tim, mở cảnh "nói chuyện lại" (người cũ
  nhắc một chuyện cũ có trong facts: nghe ra là chuyện gì); rồi một buổi hẹn (ở đúng chỗ buổi hẹn đầu của hai người, lời khác);
  rồi cầu hôn lại (nhẫn mới). Ba cảnh mới mỗi người, không phải ba buổi hẹn.
- **Vô số lần** nhưng không lạm dụng được: không giới hạn số lần, nhưng mỗi vòng tốn xu (đơn ly dị 500, nhẫn 150, bó hoa 30),
  ngày thật (ba ngày cân nhắc + 7 ngày chờ + một bước mỗi ngày), và tin của người cũ (mỗi lần ly dị trước với người đó
  trừ 15 tin ban đầu khi tái hôn, tối thiểu 30). Không có phần thưởng xu nào khi cưới, nên không có vòng cày xu.
- **Tiếng** (tính ra, không lưu, không hiển thị như một con số): số lần ly dị trong 90 ngày. Từ 2 lần, Grace nói một câu ở
  buổi họp mặt Chủ nhật, lời đồn trên ghế nhắc, ứng viên mới tỏ ra dè dặt trong cảnh tỏ tình (một biến thể câu). Không chặn
  gì.

## 7. Cưới người Westbay

### Ai cưới được

Rà cả 37 người trong `core/town/cityPeople.ts` với docs/city.md và lời thoại ở `data/city/` (một subagent rà, có trích dòng;
bản đầy đủ không đưa vào repo). Canon gần như **không ghi tuổi**: số tuổi dưới đây phần lớn lấy từ lời nhắc vẽ chân dung
(`docs/portraits/westbay/<id>.md`), không phải canon. Không ai trong 37 người là phản diện (Kemp, Shona, Lyle, Ashby, bà
Delaney, Jas không nằm trong danh sách này). Không ai là trẻ vị thành niên.

**Không cưới được (7):**

| Người | Lý do (canon) |
|---|---|
| Nora | Đã cưới Theo, có bé Maya ba tháng (city.md §2) |
| Theo | Chồng Nora (city.md §2, §3) |
| Frank | Bố của Ben, đã nghỉ hưu (city.md §2; `episodesA.ts` "My son's coming up today"); vợ chưa từng được nhắc |
| Mr Finch | "My wife says I whisper", có cháu nội (`chats2.ts`) |
| Gus | "Notes on the fridge with his wife for twenty years" (city.md §10), "My wife works days" (`chats2.ts`) |
| Mei | Tám mươi mốt tuổi, có cháu nội thật (city.md §10, `chats2.ts`) |
| Prof Adeyemi | Thầy cũ của Daniel từ mười lăm năm trước, sang đây năm hai mươi tuổi; lớn tuổi (city.md §10) |

**Chưa chắc (6), đề xuất không mở ở đợt đầu**: Mrs Okafor (22 năm ở ô bán vé), Gianna (20 năm không nghỉ tối thứ Sáu),
Mr Whitlock (cha bán báo 30 năm), Dr Osei (40 năm làm bác sĩ, thầy của Kim), Bridget (vừa tròn năm mươi, chuỗi Nell), Captain
Odile (30 năm lái phà). Canon không nói gì về bạn đời của họ; họ lớn tuổi và là "người thầy, người dì" của nhiều người. Mở
thì không sai canon, nhưng đổi hẳn giọng của họ. Câu hỏi cho chủ dự án (§14).

**Cưới được (24)**, mỗi người một dòng:

| Người | Giới | Cái cần biết khi viết |
|---|---|---|
| Rico | nam | Anh họ của Sam: cưới Rico thì Sam thành em họ. Nhân vật chính của mọi phi vụ: hãng "Rico and partner" (city.md §16) có thêm nghĩa thứ hai. Đề xuất đợt đầu |
| Pete | nam | Giữ đồ thất lạc; ít thông tin, cần viết thêm |
| Hal | nam | Bán cá, lớn tuổi hơn (khoảng 50 theo chân dung) |
| Jonah | nam | Ban nhạc cũ với Mia, bài "Paper Boats" (city.md §23). Đề xuất đợt đầu |
| Kit | nam | Kỹ thuật viên Bay FM, chuỗi người gọi lúc nửa đêm. Đề xuất đợt đầu |
| Bo | nam | Chủ quán karaoke 12 năm |
| Colin | nam | Quản lý vùng FreshWay, đối thủ của tiệm Frank ("not a villain"). Cưới Colin thì Ben và Frank có chuyện để nói |
| Dev | nam | Bạn chơi game qua mạng của Max |
| Jun | nam | Thợ sửa đồ, ông chủ đầu tiên của Max, lớn tuổi hơn (khoảng 50) |
| Marcus | nam | Người dẫn Bay FM, bạn viết thư của Tom. Đề xuất đợt đầu |
| Sol | nam | Bán lồng đèn ở chợ đêm |
| Tess | nữ | Học pha cà phê ở quán Emma năm mười bảy tuổi; bỏ tiền dành dụm vào hãng xe (city.md §16). Đề xuất đợt đầu |
| Poppy | nữ | Thợ bánh; em sinh đôi Dot chỉ nói từ trong bếp |
| Amira | nữ | Bán gia vị, bạn học cũ của Nora; quản lý sạp của người chơi (city.md §22). Đề xuất đợt đầu |
| Iris | nữ | Phụ trách chương trình rạp Lumen, thẳng tới mức phũ |
| Wren | nữ | Bán vé rạp Lumen, đầu hai mươi theo chân dung |
| Claire | nữ | Chị gái của Daniel: cưới Claire thì Daniel thành em vợ. Đề xuất đợt đầu |
| Dana | nữ | Đồng nghiệp của Mia, người rủ cả nhóm đi karaoke |
| Priya | nữ | Quản lý vận hành Meridian, ngồi chung bàn với Sarah năm đầu. Đề xuất đợt đầu |
| Vivian | nữ | Sếp của Lily, 26 năm trong nghề (lớn tuổi hơn) |
| Hana | nữ | Lễ tân Meridian, nhận ra mọi giọng (chuỗi Hana) |
| Yuki | nữ | Du học sinh; tuổi chỉ có ở chân dung (đầu hai mươi), canon không ghi. **Đề xuất không mở**: sinh viên trao đổi, ở tạm, là "người cùng học nghe như bạn" |
| Nell | nữ | Dược sĩ, chuỗi Nell |
| Fay | nữ | Bán vé vòng đu quay; chân dung đầu hai mươi nhưng canon nói đã bán vé chín năm: mâu thuẫn tuổi, sửa một bên trước khi viết |

**Đợt đầu đề xuất (8, bốn nam bốn nữ)**: Rico, Jonah, Kit, Marcus; Tess, Claire, Priya, Amira. Lý do: đã có nhiều lời thoại và
quan hệ để bám, có người thân hoặc bạn dưới thị trấn (nên "context liên quan nhau" có chất liệu thật), không ai lớn tuổi hơn
hẳn. Mười sáu người còn lại vào đợt sau, cùng khuôn.

### Sống ở đâu, cưới ở đâu

- **Chưa có nhà riêng** (docs/town.md §15). Đề xuất "hôn nhân hai nơi": vợ/chồng người Westbay vẫn ở chỗ của họ ở Westbay;
  người chơi ở thị trấn như bây giờ. Mỗi ngày: gặp ở Westbay thì nói chuyện trực tiếp; ở thị trấn thì một **cuộc gọi** (hệ
  điện thoại đã có ở Westbay: cuộc gọi, tin nhắn thoại; cần đưa nút điện thoại xuống thị trấn). Nghe qua điện thoại khó hơn
  một bậc, đúng kiểu nghe của app. Thứ Bảy vợ/chồng xuống thị trấn bằng xe số 9 (họ thành "khách" của thị trấn, như cư dân
  thị trấn là khách của Westbay: `TownWorld.guests`).
- **Chỗ ẩn** (800 xu, đã có) có thể là "nhà" của hai người ở Westbay: nêu ở câu hỏi, không bắt buộc.
- **Đám cưới**: trên phố biển (seafront promenade), người Westbay quen đứng quanh (dàn cảnh `crowd` với thế giới Westbay),
  người thân dưới thị trấn lên bằng xe số 9 (Sam nếu cưới Rico, Daniel nếu cưới Claire), được kể bằng lời dẫn hoặc nói bằng
  giọng Gemini của họ (clip, §9).
- **Ghen giữa hai nơi**: vợ/chồng người Westbay biết chuyện dưới thị trấn qua người thân (Rico biết qua Sam) và qua Bay FM;
  vợ/chồng dưới thị trấn biết chuyện trên Westbay qua chuyến xe số 9 (Sam ở bến) và qua người thân trên đó.

### Luật giới tính

Hiện tại: nhân vật nam tán nữ, nhân vật nữ tán nam (chủ dự án chọn, docs/town.md §15). Giữ hay mở là câu hỏi cho chủ dự án;
**bản nháp: giữ** cho đợt này (code, lời thoại và giọng người chơi đều theo cặp đó), và thiết kế dữ liệu không khóa cứng giới
tính (mỗi ứng viên có danh sách "ai tán được" thay vì một giá trị), để mở sau không phải đổi dữ liệu.

## 8. Mỗi cảnh là nghe gì

Lời người chơi: người chơi có nói (docs/city.md §5). Trả lời theo **ý định tiếng Việt** (như phi vụ và lựa chọn trong tập
truyện); câu tiếng Anh của người chơi được hiện và đọc. Không câu nào của người chơi là dữ kiện bị hỏi.

Các panel và bước đã có để dùng lại:

- `romance/StoryChat.tsx`: cảnh chữ từng câu, có một lựa chọn (đang dùng cho tỏ tình, hẹn hò, chuyện hằng ngày).
- `scenes/SceneFlow.tsx`: chỉ nghe trước, rồi 1–3 câu hỏi, rồi mới hiện chữ (cảnh nghe ở ghế, radio, Westbay).
- Bộ đồ nghề phi vụ (`features/town/jobs/`): `JobThreads` (nhiều luồng nói cùng lúc, chuyển luồng), `JobSpot` (nút "Đó!"),
  `JobPick` (chọn đoạn không chữ), `JobIntents` (đáp theo ý), `JobNotebook` (sổ tay có các cách ghi na ná). Hiện chỉ chạy
  trong engine phi vụ ở Westbay (`useCityJob.tsx`).
- Câu gõ của thị trấn (`Turn` trong `Conversation.tsx`): gõ lại một cụm 1–4 chữ, gợi ý một lần.
- Lời chào có giọng (`friends/useGreeting.ts`), câu dẫn "Gặp trên đường" (`data/townStreet.ts`, chữ tiếng Việt, không tiếng).

**Việc engine cần (một lần):** một trình phát cảnh drama dùng chung cho thị trấn và Westbay, ghép từ các miếng trên (tên
nháp `DramaFlow`): lời thoại theo điều kiện trên sổ sự kiện, các bước `listen` (như SceneFlow), `threads`, `spot`, `intent`,
`notebook`, `typed`, và "hệ quả" như phi vụ. Đây là phần code lớn nhất của M0. Không đụng engine phi vụ: lấy các component
hiển thị, viết lại phần điều phối nhỏ hơn.

| Cảnh | Kiểu nghe | Bước | Nghe sai thì | Thẻ ôn |
|---|---|---|---|---|
| **Lời hẹn** (trong chuyện hằng ngày) | Giờ, ngày nói một lần, tự nhiên ("Friday, seven-ish, the usual table?") | `notebook` 2 mục, các cách ghi na ná (7:00 / 7:30 / 11:00; thứ Sáu / thứ Năm) | Tới sai giờ hay sai ngày: cảnh cãi nhau ngày đó | Câu chứa giờ |
| **Cãi nhau** | Nói nhanh, câu dài, hai luồng (người kia và một người thứ ba: khách ở quầy, con, điện thoại công việc) | `threads` 2 luồng, câu chính ở luồng người kia; rồi `intent` 3 ý | Đáp trúng chuyện phụ chứ không trúng điều họ trách: thành "giận lạnh" hôm sau, rồi mạch đi tiếp | Câu chính |
| **Giận lạnh** | Nói ít, câu ngắn; lý do thật nằm trong một câu nói giảm ("It's fine. It was just a Friday.") | `spot`: bấm "Đó!" đúng câu lộ lý do | Bấm sai hay không bấm: hôm sau họ nói thẳng hơn (một câu), mất điểm làm lành của hôm nay | Câu lộ lý do |
| **Xin lỗi** | Nói lại đúng điều đã làm sai | `typed`: gõ cụm then chốt họ đã nói ("forgot our anniversary", "didn't call") | Gõ sai hai lần: họ nhận lời xin lỗi "cho có" (ấm +2 thay vì +8) | Câu chứa cụm |
| **Ghen** | Kiểu của từng người (bảng §5): hai luồng, mỉa, nói giảm, "um", ẩn ý, số và ngày | Theo kiểu: `threads` / `listen` + câu hỏi / `spot` / `notebook` | Hiểu nhầm điều họ ghen (tưởng vì quà trong khi vì chuyến Westbay): đáp lạc, tin −5 thêm, rồi họ nói rõ | Câu nói ra điều ghen |
| **Hòa giải có người thứ ba** (Grace, người thân, bạn thân theo canon) | Hai người nói về mình, chen nhau | `threads` (người hòa giải và vợ/chồng), rồi `listen` + 2 câu hỏi về điều mỗi người cần | Sai một câu: hòa giải thành nhưng tin chỉ +5; sai cả hai: không thành, họ nộp đơn | Câu nói điều cần |
| **Phòng hộ tịch** | Số và ngày: phí, ngày có hiệu lực, giấy tờ ("the fifteenth", "fifty pounds", "two forms") | `notebook` 3 mục, các cặp -teen / -ty | Ghi sai ngày: tới sai ngày, nhân viên nói lại (một hệ quả, chỉ mất thời gian) | Câu chứa số |
| **Chia ngày nuôi con** | Thứ trong tuần, giờ đón | `notebook` 2 mục (thứ Ba / thứ Năm, 4 giờ / 2 giờ) | Ghi sai: tới đón sai ngày, con chờ ở nhà người kia, một câu của con | Câu chứa ngày |
| **Con hỏi** | Câu ngắn của trẻ, giọng trẻ con | `listen` + 1 câu hỏi (con hỏi gì), rồi `intent` (lời trả lời nhẹ nhàng) | Hiểu nhầm câu hỏi: trả lời lạc, con hỏi lại theo cách khác | Câu của con |
| **Gặp lại người cũ** | Nghe lỏm người cũ nói với một người bạn trên ghế (giọng trình duyệt, theo luật ghế) | Cảnh ghế có sẵn (`ListenPanel`), câu hỏi: người cũ đang thế nào | Không phạt; nghe đúng mở một câu khác trong lời chào người cũ | Không (cảnh ghế không vào ôn, như bây giờ) |
| **Chất vấn nhóm** (hẹn hò nhiều người trước cưới) | Nhiều người nói cùng lúc | `threads` 3 luồng; câu hỏi sau: ai nói gì | Không có "thua": cả nhóm lạnh 7 ngày như Stardew; nghe đúng hết thì mỗi người một câu riêng lúc chia tay | Câu chính mỗi luồng |
| **Níu kéo, ba ngày cân nhắc** | Điều người kia cần nghe ẩn trong lời buồn | `listen` + `intent` | Đáp lạc: họ không rút đơn (khi họ nộp), hoặc không có gì thêm (khi người chơi nộp) | Câu chính |
| **Hàn gắn** (tái hôn với người cũ) | Người cũ nhắc một chuyện cũ có trong facts, không nói thẳng là chuyện gì | `listen` + 1 câu hỏi "họ đang nhắc chuyện gì" (3 chuyện có thật trong facts của hai người) | Sai: họ "chưa sẵn sàng", mở lại sau 3 ngày (không "sai, làm lại" ngay) | Câu nhắc |

Ở mức lời nói 1–2 (`core/town/difficulty.ts`), các bước `threads` phát lần lượt từng luồng (như phi vụ bây giờ), nên cãi nhau
"chồng tiếng" chỉ thật sự chồng từ mức 3. Đúng ý thang độ khó; ghi ra để không ai bất ngờ.

**Thẻ ôn**: mỗi câu drama có id riêng `dr-<người>-<cảnh>-<n>` (cư dân thị trấn, giọng Gemini) hoặc `drc-<người>-…` (người
Westbay, giọng trình duyệt), thẻ `talk:<id>` như tập truyện; thêm vào `features/review/resolve.ts` một nhánh tìm câu theo id.
Câu người chơi nói không bao giờ thành thẻ.

**Nhịp, chống spam**: tối đa một cảnh drama mỗi ngày mỗi người; drama chỉ nảy từ sự kiện có thật trong sổ, không có nút "cãi
nhau". Ngày có cảnh drama thì chuyện hằng ngày nhường chỗ.

## 9. Giọng và clip, tính thật

**Luật của chủ dự án**: 13 cư dân thị trấn nói giọng Gemini (clip chủ dự án tự tạo); người Westbay và nhân vật mới nói giọng
trình duyệt, không clip. Key free tạo được **10 clip một ngày** (đo ngày 2026-11-27); hiện đang còn nợ khoảng 45 clip.

Hệ số clip của từng loại câu, theo cách hệ thống đang làm:

| Loại câu | Clip mỗi câu |
|---|---|
| Câu riêng của MỘT cư dân thị trấn (viết cho đúng người đó) | 1 (giọng người đó, chỉ bản nối âm) |
| Câu chung cho "vợ/chồng là ai cũng được" (kiểu `partner` của đi chơi Westbay) | 11 (mỗi giọng người cưới được) |
| Câu của con | 2 (giọng bé trai, bé gái) |
| Câu của người chơi trong cảnh thị trấn | 1 (Puck hoặc Callirrhoe theo người được cưới) |
| Câu của người chơi trong cảnh Westbay | 0 (giọng trình duyệt, như phi vụ) |
| Cảnh ghế, buổi họp mặt, Bay FM, câu dẫn "Gặp trên đường" | 0 (giọng trình duyệt hoặc chữ, theo luật đã có) |
| Mọi câu của người Westbay | 0 |

Vì vậy **viết drama theo từng người** (mỗi câu 1 clip) rẻ hơn nhiều so với viết chung rồi nhân 11, và hay hơn (đúng tính cách,
§5). Độ dài trung bình một câu hiện có khoảng 40 ký tự (đo trên `data/romance/cafe.ts`).

**Ước lượng cho một người cưới được dưới thị trấn (gói drama đầy đủ):**

| Phần | Câu của họ | Câu người chơi | Người thứ ba (Gemini) |
|---|---|---|---|
| Lời hẹn, sinh nhật, kỷ niệm trong chuyện hằng ngày | 6 | 0 | |
| Bỏ bê, lạnh nhạt | 6 | 0 | |
| Hai trận cãi nhau (một vì lời hẹn, một vì tiền hoặc họ hàng) | 20 | 6 | |
| Giận lạnh, xin lỗi, làm lành | 12 | 4 | |
| Ghen (hai cảnh theo kiểu của họ) | 16 | 4 | |
| Ly thân, hòa giải | 8 | 3 | 6 |
| Ba ngày cân nhắc, chia tay | 10 | 3 | |
| Người cũ: lời chào ba bộ, một chuyện trên đường | 10 | 2 | |
| Hàn gắn, cầu hôn lại | 17 | 7 | |
| **Cộng** | **105** | **29** | **6** |

Khoảng **140 clip, 5.600 ký tự một người**. Mười một người: khoảng **1.540 clip, 62.000 ký tự**. Cộng phần chung: con cái
(khoảng 12 câu mới × 2 giọng + câu giao con của vợ/chồng 3 câu × 11 người ≈ 57 clip), lời chào cư dân khác về chuyện của
người chơi (2 câu × 13 người ≈ 26 clip), chất vấn nhóm (5 câu × 11 + 5 ≈ 60 clip). **Tổng khoảng 1.680 clip, 67.000 ký tự,
khoảng 170 ngày key free** (cộng cả 45 clip đang nợ).

Người Westbay: một gói tỏ tình + hẹn hò + cưới + chuyện hằng ngày (khoảng 75 câu như người thị trấn) và một gói drama (khoảng
135 câu): khoảng 210 câu một người, **0 clip**. Tám người đợt đầu: khoảng 1.700 câu; hai mươi bốn người: khoảng 5.000 câu.
Không tốn clip, nhưng tốn chữ: mỗi câu cần nghĩa tiếng Việt và bản tiếng Anh của nghĩa (bộ từ điển `city`, luật i18n).

**Cách giữ số clip nhỏ** (đề xuất, theo thứ tự):

1. **Làm từng người một**: hệ thống làm một lần, gói drama đầy đủ cho Emma và Leo trước (một nữ, một nam: khoảng 280 clip,
   khoảng một tháng key free), chín người còn lại lần lượt. Ai chưa có gói drama thì chỉ có phần chung (sổ sự kiện, ghen qua
   lời đồn, người cũ được kể bằng câu dẫn tiếng Việt) và chưa cãi nhau, chưa ly thân bằng giọng được. Đề xuất chính.
2. **Câu của người chơi trong drama đọc bằng giọng trình duyệt** (như phi vụ ở Westbay): bớt khoảng 20% (29 trên 140). Khác
   cách cảnh hẹn hò dưới thị trấn đang làm (Puck / Callirrhoe), nên phải hỏi chủ dự án.
3. **Key trả phí** (Batch API, không bị giới hạn 10 clip một ngày): chủ dự án biết giá; với khoảng 67.000 ký tự thì một lần chạy
   là xong. Phải hỏi.
4. **Cưới người Westbay trước**: toàn bộ hệ thống chạy được với người Westbay mà không cần clip nào; người thị trấn có gói drama
   dần dần (xem câu hỏi về M0, §14).

Phần nào dùng giọng trình duyệt cho cư dân thị trấn là trái luật giọng: không làm nếu chủ dự án chưa đồng ý.

## 10. Dữ liệu

### `town-life` phiên bản 2

Giữ mọi trường cũ, thêm:

```ts
events: Record<eventId, LifeEvent>   // sổ sự kiện: chỉ thêm, không sửa, không xóa
LifeEvent = {
  kind: LifeEventKind;               // §5
  who: string;                       // place id của cư dân hoặc id người Westbay (cityPeople)
  other?: string;                    // người thứ ba (người được tặng quà, người hòa giải…)
  union?: string;                    // cuộc tình / hôn nhân nào (id dưới đây)
  at: number;                        // ms
  day: string;                       // ngày địa phương 'YYYY-MM-DD' ("một bước mỗi ngày", mốc 14 / 30 ngày)
  data?: { o?: string; ok?: boolean; n?: number };  // lựa chọn, nghe đúng hay sai, một con số (phí…)
}
eventId  = `${kind}-${who}-${at}`    // định danh từ chính nội dung: hai máy ghi cùng một chuyện thì trùng id
union id = `u-${who}-${thời điểm tỏ tình}`
kids[id].union?: string              // con của cuộc hôn nhân nào
```

- **Gộp**: hợp theo id (`events` của hai bên cộng lại; cùng id thì giữ bản có `at` nhỏ hơn, bằng nhau thì so chuỗi JSON). Hợp
  tập hợp là giao hoán, kết hợp, lũy đẳng; kiểm bằng `syncMerge.props.test.ts` như mọi khóa.
- **Mọi trạng thái là tính ra** bằng cách duyệt sổ theo thứ tự (at, id): đang với ai, giai đoạn nào, ấm, tin, phe, trần tim,
  tiếng. Không lưu trạng thái, nên không có chuyện hai máy lưu hai trạng thái khác nhau.
- **Hai máy cùng đổi** (ly dị ở máy A, kỷ niệm ở máy B lúc offline): cả hai sự kiện vào sổ; khi duyệt, sự kiện nào không hợp lệ
  với trạng thái lúc đó thì bỏ qua (kỷ niệm của một cuộc hôn nhân đã kết thúc không có tác dụng). Thứ tự duyệt cố định nên mọi
  máy ra cùng một kết quả. Một `divorce-withdrawn` không khớp đơn nào thì bỏ qua.
- **`court` cũ** vẫn được ghi song song cho cuộc tình hiện tại (để bản cũ của app trên máy khác còn đọc được), nhưng bản mới
  chỉ đọc sổ. Chuyển từ phiên bản 1: mỗi mốc trong `court` thành một sự kiện cùng thời điểm (`dating` → `confess`, …), id cuộc
  tình lấy từ thời điểm `dating`.
- **Rủi ro**: một máy còn chạy bản cũ của app sẽ bỏ trường `events` khi tự ghi (`parseTownLife` bỏ trường lạ). Sổ không mất vì
  máy chạy bản mới gộp lại từ bản của chính nó, nhưng nếu máy duy nhất có sổ bị xóa dữ liệu thì mất. Cách giảm: ra bản đọc được
  phiên bản 2 trước, đợi các máy cập nhật, rồi mới bật drama.
- **Giới hạn**: sự kiện lớn (cưới, ly dị, ghen, xin lỗi…) giữ mãi (một năm chơi đều chỉ vài trăm). Sự kiện hằng ngày (chuyện
  hằng ngày nghe đúng hay sai, ngày có vào mà lờ đi) chỉ giữ 40 ngày như `talked`, vì ấm chỉ đọc 14 ngày.
- **Tim**: điểm vẫn ở `town-progress`. Trần tim sau ly dị **tính ra từ sổ** khi đọc (`friendPoints` nhận thêm phần điều chỉnh
  từ `town-life`), không ghi `down`, nên hai máy không trừ hai lần.
- **Reset**: "Xóa dữ liệu", khôi phục, "Xóa lịch sử" đã có dấu reset cho cả khóa: không đổi. Không cần tombstone vì không có gì
  bị xóa: rút đơn là một sự kiện mới.
- **Lời hẹn và sinh nhật người chơi ghi được**: một sự kiện `noted` (giá trị người chơi ghi), để cuộc hẹn diễn ra theo điều
  người chơi ghi, đúng luật "sổ tay dẫn đường" của phi vụ.
- **Người Westbay** dùng cùng khóa `town-life`, `who` là id của họ (đã tuân theo mẫu id của khóa).

## 11. Kinh tế và nhịp

- **Không có nguồn xu mới.** Cảnh drama không trả xu (chỉ ấm, tin, tim), nên không có vòng cày. Đi chơi Westbay vẫn trả như
  bây giờ.
- **Chỗ tiêu mới**: đơn ly dị 500 xu (rút thì hoàn nửa), nhẫn cưới lại 150 (đã có), bó hoa 30 (đã có). Vì sao 500: Stardew để
  ly dị đắt gấp 10 lần mặt dây chuyền; ở đây gấp khoảng 3 lần nhẫn, đủ nặng để không bấm cho vui, không nặng tới mức người học
  phải cày.
- **`economyModel.ts` hiện chưa có quà, bó hoa, nhẫn** (Tiệm quà nằm ngoài mô hình). Đề xuất thêm nhóm "đời sống" làm chỗ tiêu:
  quà hằng ngày (mức trung bình), một lần cưới (180), một lần ly dị (500); giữ các thuộc tính cũ (lô đất vẫn lâu như trước,
  không nguồn nào quá 40% ngày của người chơi 20 phút).
- **Nhịp**: một bước mỗi ngày (đã có), một cảnh drama mỗi người mỗi ngày, ba ngày cân nhắc, bảy ngày chờ sau ly dị trước khi
  tỏ tình người mới, tuần trăng mật 7 ngày.

## 12. Giới hạn nội dung

- Drama gia đình đời thường: hiểu lầm, bỏ bê, quên hẹn, ghen, tiền, họ hàng, mệt vì công việc. Không bạo lực gia đình, không đe
  dọa, không chửi rủa, không nội dung người lớn, không rượu chè làm nguyên nhân.
- Sau cưới, người chơi không tán ai khác được (cảnh tỏ tình từ chối nhẹ nhàng: "Bạn đang có gia đình mà"). Ghen đến từ sự thân
  thiết bình thường (quà, đi chơi, số tim), không có ngoại tình.
- Mọi người cưới được là người lớn; ai tuổi mơ hồ (Yuki, Fay) không mở cho tới khi canon ghi rõ.
- Trước mặt con, không lựa chọn nào đổ lỗi cho người kia.
- Không hứa gì về trình độ người học; tim, ấm, tin là điểm trò chơi (Sổ tay và mọi chỗ hiện số đều nói vậy, như bây giờ).
- Không ai bị biến mất, không "xóa ký ức", không biến con thành gì cả.

## 13. Các mốc

| Mốc | Phạm vi | Chạm tới | Câu mới | Clip mới | Test kiểm được | Cần người chơi thật |
|---|---|---|---|---|---|---|
| **M0. Một trận cãi nhau với Emma** | Emma nói một lời hẹn trong chuyện hằng ngày ("Friday, seven, the usual table?"); người chơi ghi vào sổ tay. Không tới đúng giờ đã ghi: cãi nhau ở quán (hai luồng: Emma và một khách), đáp theo ý; đáp trúng thì làm lành, trượt thì một ngày giận lạnh rồi cảnh xin lỗi (gõ cụm). Sổ sự kiện tối thiểu, ấm tính ra, trình phát `DramaFlow` bản đầu | `town-life` v2 (chỉ `events`), `core/town/drama.ts` (thuần), `data/romance/drama/cafe.ts`, `features/town/romance/DramaFlow.tsx`, một nhánh `features/review/resolve.ts`, merger + test luật gộp | khoảng 30 (Emma 24, người chơi 6) | khoảng 30 (3 ngày key free; 24 nếu câu người chơi đọc bằng giọng trình duyệt) | Gộp sổ (luật gộp), duyệt sổ ra đúng trạng thái, mọi câu được nói, mỗi câu sai có một hệ quả (như `wellFormed` của phi vụ) | Vòng lặp có vui không, câu có tự nhiên không, bị giận có khó chịu quá không |
| M1. Mô hình đầy đủ | Ấm và tin, bỏ bê (chỉ ngày có vào), sinh nhật và kỷ niệm (nghe ra ngày), lạnh nhạt; gói drama đầy đủ cho Emma và Leo | `life.ts`, `romance.ts`, `drama.ts`, `data/romance/drama/{cafe,square}.ts` | khoảng 280 | khoảng 280 (khoảng 1 tháng key free) | Mô phỏng 60 ngày: người chơi đều đặn không bao giờ ly thân; người bỏ bê có lạnh nhạt, nhưng không vì những ngày vắng mặt | Nhịp cãi nhau có quá dày không |
| M2. Ghen và cả thị trấn biết | Sổ ghi chuyện gây ghen, ai biết theo năm đường, cảnh ghế về chuyện của người chơi, Bay FM, buổi họp mặt, câu dẫn "Gặp trên đường", phe, họ hàng | `drama.ts` (ai biết), `data/scenes/` (cảnh ghế mới, giọng trình duyệt), `data/townStreet.ts`, lời chào | khoảng 200 (cảnh ghế, Bay FM, câu dẫn) + 26 lời chào | khoảng 26 | Mọi lời nhắc một chuyện đều có chuyện đó trong sổ (duyệt ngẫu nhiên nhiều sổ) | Thị trấn có thấy "sống" không, có thấy bị soi quá không |
| M3. Ly thân, ly dị, người cũ, tái hôn | Phòng hộ tịch Westbay (chỗ mới, nhân viên mới), ba ngày cân nhắc, ly dị do người kia, trần tim, người cũ, con chia ngày, hàn gắn | `drama.ts`, `life.ts` (con theo cuộc hôn nhân, tối đa 4), `data/city/` (phòng hộ tịch), `cityWorld.ts` (một chỗ), `economyModel.ts` | khoảng 150 phần chung (Emma, Leo đã có ở M1) | khoảng 60 (con, giao con) | Ly dị rồi tái hôn nhiều vòng trên hai máy gộp vẫn ra một trạng thái; con không bao giờ mất | Ly dị có nặng nề quá với một app học không |
| M4. Cưới người Westbay | Tám người đợt đầu: tỏ tình, ba buổi hẹn, cầu hôn, cưới ở phố biển, chuyện hằng ngày (gặp hoặc qua điện thoại), gói drama | `data/city/romance/`, điện thoại xuống thị trấn, `TownWorld.guests` thứ Bảy, i18n `city` | khoảng 1.700 | 0 | Như M0–M3 cho người Westbay; mọi câu giọng trình duyệt (`cityAudio.test.ts` kiểu) | Hôn nhân hai nơi có hợp lý không |
| M5. Hẹn hò nhiều người, chất vấn nhóm | Trước cưới hẹn hò nhiều người; lời đồn; cảnh chất vấn ba luồng | `drama.ts`, `romance.ts` (bỏ "chỉ một người yêu") | khoảng 70 | khoảng 60 | Không ai cưới được hai người cùng lúc | Có thấy giống Stardew không |
| M6. Gói drama cho chín người còn lại, hoàn thiện | Mỗi người khoảng 140 câu; cân lại điểm, giá | `data/romance/drama/*.ts`, `economyModel.ts` | khoảng 1.260 | khoảng 1.260 (khoảng 4 tháng key free) | Như M1 | Đọc lời thoại |

Thứ tự đề xuất: M0 → (chủ dự án chơi, chốt) → M1 → M3 → M2 → M4 → M5 → M6. M3 trước M2 vì ly dị là điều chủ dự án hỏi trước
tiên; M4 có thể làm song song từ sau M1 vì không tốn clip.

**Rủi ro thật**: lời thoại do model viết, chưa ai đọc; drama là thứ không tự kiểm được bằng test, nên M0 phải được chủ dự án
chơi trước khi viết hàng nghìn câu. Clip là nút thắt thời gian (§9). Trình phát cảnh dùng chung là phần code mới lớn nhất.

## 14. Câu hỏi cho chủ dự án (mỗi câu có bản nháp đã chọn, để việc không phải chờ)

1. **Clip**: key free chỉ 10 clip một ngày; drama đầy đủ cho 11 người thị trấn khoảng 1.700 clip. Bản nháp: làm từng người, Emma
   và Leo trước; hỏi có dùng key trả phí cho đợt lớn không.
2. **Câu của người chơi trong drama**: Gemini (Puck / Callirrhoe, như cảnh hẹn hò) hay giọng trình duyệt (như phi vụ, bớt 20%
   clip)? Bản nháp: Gemini, cho khớp cảnh hẹn hò đang có.
3. **Luật giới tính** (nam cưới nữ, nữ cưới nam): giữ hay mở? Bản nháp: giữ đợt này, dữ liệu không khóa cứng.
4. **Người lớn tuổi ở Westbay** (bà Okafor, Gianna, ông Whitlock, bác sĩ Osei, Bridget, thuyền trưởng Odile): mở cho cưới không?
   Bản nháp: không ở đợt đầu.
5. **Ai trong 24 người Westbay mở trước**: bản nháp tám người Rico, Jonah, Kit, Marcus, Tess, Claire, Priya, Amira.
6. **Ly dị ở đâu**: bản nháp phòng hộ tịch Westbay, nhân viên mới bà Penrose (giọng trình duyệt), 500 xu, ba ngày cân nhắc.
7. **Con sau ly dị**: bản nháp chia ngày theo thứ trong tuần; không làm "biến con thành chim".
8. **Bỏ bê**: bản nháp chỉ tính ngày có vào game mà lờ vợ/chồng; ngày nghỉ học không bị phạt (khác Stardew).
9. **Hẹn hò nhiều người trước cưới** như Stardew (có ngày bị chất vấn): làm không? Bản nháp: có, ở M5.
10. **Nhà riêng** (Stardew có phòng của vợ/chồng): chưa có trong game. Bản nháp: ngoài phạm vi kế hoạch này; người Westbay ở chỗ
    của họ, gặp nhau hoặc gọi điện; chỗ ẩn có thể làm "nhà" nếu chủ dự án muốn.
11. **Max có thoại không** (người cũ của Zoe, khuôn cho người cũ): bản nháp không, vẫn được kể bằng lời dẫn.
12. **M0 dùng ai**: bản nháp Emma (người chơi nam), khoảng 30 clip. Nếu không muốn chờ clip: làm M0 với một người Westbay (Tess),
    0 clip, nhưng phải làm trước phần cưới người Westbay tối thiểu cho một người.

## 15. Chỗ không chắc về canon

- Canon gần như không ghi tuổi người Westbay; số tuổi ở §7 lấy từ lời nhắc vẽ chân dung. Fay (chân dung đầu hai mươi, canon "bán
  vé chín năm"), Poppy (chân dung cuối hai mươi, Dot "mười tám năm" chưa ra quầy), bác sĩ Osei (chân dung cuối năm mươi, canon
  "bốn mươi năm làm bác sĩ") mâu thuẫn; Yuki không có tuổi.
- Mei vừa có "cháu trai giả" (kẻ lừa đảo) vừa có cháu nội thật (`chats2.ts`); vợ của Frank chưa từng được nhắc.
- Tính cách ghen ở §5 suy từ những gì canon nói về từng người (Sam ghét gọi điện, Tom "um", Ben đùa dở, Daniel giọng Anh...),
  chưa có dòng canon nào nói họ ghen thế nào. Cần chủ dự án đọc bảng đó.
- Bạn thân theo canon (để tính phe) chưa có một danh sách đầy đủ; phải lập từ các tập truyện (`data/stories/`) trước M2.
- Ngày sinh nhật của các cư dân chưa có trong canon; M1 phải thêm (mỗi người một ngày, nói trong một câu hằng ngày).
- Wiki Stardew tự mâu thuẫn ở hai chỗ (ghen chỉ khi đang hẹn hò người kia hay khi họ đã nhận bó hoa; tim của người cũ về 0 hay
  "như 2 tim"); số con tối đa của Stardew không kiểm được qua tìm kiếm. Không chỗ nào trong kế hoạch dựa vào các số đó.
