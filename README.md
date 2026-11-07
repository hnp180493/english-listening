# Nghe Nối Âm

Web luyện nghe tiếng Anh bản xứ cho người Việt, tập trung vào **connected speech**: nối âm, nuốt âm, đồng hóa âm, âm yếu, T bật (giọng Mỹ), rút gọn (gonna/wanna), mất âm H, viết tắt.

## Chạy

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit test (vitest)
npm run lint     # oxlint
npm run build    # bản production vào dist/ (có PWA, dùng offline được)
npm run preview  # xem thử bản build
```

Nên mở bằng **Microsoft Edge**: Edge có sẵn giọng đọc "Natural", nghe giống người bản xứ nhất. Chọn giọng ở **Cài đặt → Giọng đọc**. Phần **Nói nhại** cần Chrome hoặc Edge (nhận dạng giọng nói) và quyền dùng micro.

## Các phần

**Học**

| Trang | Làm gì |
|---|---|
| Hôm nay | Kế hoạch học trong ngày (ôn tập, bài tiếp theo, cụm từ mới, chính tả, luyện điểm yếu, nói nhại), vòng mục tiêu, chuỗi ngày, "Câu của ngày". Lần đầu mở có phần giới thiệu 3 bước. |
| Ôn tập | Một phiên ôn trộn mỗi ngày: câu chép chính tả, bộ cặp âm, bài học, từng từ trong bài, cụm từ, câu video đã học quay lại đúng lúc sắp quên. Xem [Ôn tập](#ôn-tập-lặp-lại-ngắt-quãng). |
| Bài học | 4 khóa học: **Nghe nối âm** (10 bài: nhập môn, 8 hiện tượng, ôn tập), **Chữ viết → âm đọc** (gh, sh, ch, th, -tion…), **Từ bất quy tắc** (colonel, read, bought… mỗi từ kèm câu chuyện "Vì sao lại thế?"), **Từ mượn, tên riêng, Anh – Mỹ**. Mỗi bài có ví dụ nghe được (bảng từ có nút nghe thường và nghe chậm) và bài kiểm tra 8 câu (đạt từ 70%). Trang Bài học mở danh sách khóa, nút "Học tiếp" ở khóa bạn đang học. Khóa chưa có bài thì chưa hiện. |
| Giải mã câu | Dán một câu bất kỳ, xem câu đó *được nói ra* thế nào. Mỗi chỗ biến âm được tô màu kèm giải thích. Có lịch sử, link chia sẻ, chuyển sang chép chính tả / nói nhại. |

**Luyện**

| Trang | Làm gì |
|---|---|
| Chép chính tả | 300 câu, 3 cấp độ, lọc theo chủ đề và hiện tượng. Chế độ: chép cả câu, điền từ, ôn đến hạn, câu của tôi (tự thêm câu). Web chỉ ra bạn nghe sai vì hiện tượng nào. |
| Phân biệt âm | 16 bộ cặp dễ nhầm (can/can't, tell him/tell them, fifteen/fifty, 'd like/like…), 120 câu. Câu sai được hỏi lại trong lượt. |
| Cụm từ | 192 cụm hay bị nói nhanh, ôn theo lặp lại ngắt quãng (SM-2), có thẻ gõ lại và thẻ chọn đáp án, luyện theo hiện tượng. |
| Nói nhại | Nghe câu mẫu, ghi âm giọng mình, trình duyệt nhận dạng và so với câu gốc; nghe lại giọng mình cạnh giọng mẫu. |
| Video thật | Dán link YouTube + transcript, hoặc mở file audio/video + phụ đề (SRT/VTT). Luyện từng câu với **giọng người thật**: nghe lại, chép chính tả, xem vì sao khó nghe. |

**Theo dõi**

| Trang | Làm gì |
|---|---|
| Tiến độ | **Tổng quan**: chuỗi ngày, độ chính xác, lịch ôn 7 ngày tới, điểm yếu theo hiện tượng, theo từng phần luyện, xu hướng 8 tuần, lịch hoạt động 12 tuần. **Báo cáo** (4 tuần / 3 tháng / Tất cả): giờ nghe theo tuần, điểm kiểm tra định kỳ, tự đánh giá mức hiểu, luyện trong app và vài nhận xét rút ra từ số liệu (không phóng đại từ vài điểm dữ liệu). Xem [docs/progress-report.md](docs/progress-report.md). |
| Nhật ký nghe | Ghi giờ nghe tiếng Anh thật mỗi ngày (phim, YouTube, podcast…): ghi nhanh hoặc bấm giờ (đồng hồ vẫn chạy khi đóng tab), video thật trong app được ghi tự động. Mục tiêu phút nghe mỗi ngày, tổng giờ và mốc 10 / 25 / 50 / 100… giờ. |
| Kiểm tra định kỳ | Bài nghe khoảng 10 phút, cứ 2 tuần một lần, 6 đề tương đương A–F với câu chưa gặp trong app: 10 câu chép chính tả + 4 đoạn nghe hiểu, tốc độ tự nhiên, mỗi câu nghe tối đa 2 lần. Điểm 0–100 để so với chính mình (mở từ Hôm nay, Nhật ký nghe hoặc Báo cáo). |
| Cài đặt | Giọng đọc và tốc độ, giao diện sáng/tối, IPA, mục tiêu mỗi ngày, phút nghe tiếng Anh thật mỗi ngày, thời lượng ôn mỗi ngày, đồng bộ thư mục, xóa dữ liệu. |

Toàn bộ dữ liệu học lưu trong localStorage của trình duyệt, không có backend.

## Ôn tập (lặp lại ngắt quãng)

Học xong mà không ôn thì quên. Trang **Ôn tập** gom những gì bạn đã luyện vào một phiên ôn mỗi ngày. Mỗi mục quay lại
lúc bạn sắp quên: nhớ đúng thì lần sau cách xa hơn (1 ngày, 3 ngày, 1 tuần…), quên thì quay lại sớm.

**Mục nào được đưa vào ôn**

| Phần | Ôn cái gì | Khi nào được thêm |
|---|---|---|
| Chép chính tả | Từng câu, cả câu của tôi | Sau mỗi lần chép cả câu. Câu sai luôn được thêm; câu đúng được thêm trong giới hạn mục mới mỗi ngày. |
| Phân biệt âm | Từng bộ cặp âm, ôn bằng 4 câu (ưu tiên câu hay sai) | Khi trả lời sai trong bộ, hoặc khi đã trả lời từ 20 câu của bộ. |
| Bài học | Từng bài của mọi khóa, ôn bằng 4 câu của bài kiểm tra (ưu tiên câu nghe) | Khi đạt bài kiểm tra (từ 70%). Bài đã nhớ lâu (lần sau cách từ 3 tuần) thì thôi ôn. |
| Từ trong bài | Từng từ của bảng từ (khóa Từ bất quy tắc, Từ mượn; khóa Chữ viết → âm đọc chỉ những từ được đánh dấu). Một từ dạy ở hai bài là một mục; từ viết giống nhau mà đọc khác (read/read) là hai mục. | Khi đạt bài. Từ mới vào lịch dần, tối đa 6 từ mỗi ngày (bài đạt hôm nay: từ ngày mai). |
| Cụm từ | Từng cụm | Dùng luôn lịch ôn của trang Cụm từ, dữ liệu không đổi. |
| Video thật | Câu transcript bạn chép chưa đúng | Ôn bằng giọng đọc máy (video gốc không dùng được khi offline). Câu chép đúng không thêm. |
| Nói nhại | — | Câu mẫu nói chưa tốt (dưới 70%) được thêm vào ôn chép chính tả. |

**Chấm tự động.** Chép chính tả chấm theo số lỗi: đúng hết ngay lần đầu thì 4 ngày sau mới gặp lại; sai 1 từ trong câu
từ 4 từ trở lên là "hơi khó" nhưng lịch vẫn giãn ra; sai nhiều hoặc xem đáp án thì ôn lại sớm. Bộ cặp âm: 4/4 là nhớ,
3/4 là hơi khó, từ 2/4 trở xuống là chưa nhớ. Bài học: từ 90% là nhớ, từ 70% là hơi khó. Cụm từ: bạn tự chọn một trong
4 nút như ở trang Cụm từ. Từ trong bài có hai kiểu ôn: **Nghe → nhận ra** (nghe từ, hoặc câu chứa từ, rồi chọn chữ viết
đúng trong 3–4 từ đọc khác hẳn nhau; chọn đúng là nhớ, sai là ôn lại sớm) và **Đọc → nói** (thấy chữ, đọc thành tiếng,
lật thẻ xem cách đọc, chữ câm, ghi chú, câu chuyện "Vì sao", rồi tự chấm 4 nút). Từ mới và từ lần trước chưa nhớ ôn kiểu
Đọc → nói trước; từ đã thuộc xen kẽ hai kiểu. Từ đọc giống hệt một từ khác (knight/night) chỉ ôn kiểu nghe khi có câu
ngữ cảnh, không thì ôn kiểu đọc. Quên một mục đã thuộc chỉ giữ lại 1/4 khoảng cách và mục đó quay lại ngày mai. Luyện lại một
mục chưa đến hạn ở trang khác không làm lịch giãn thêm; làm sai thì mục đó quay lại sớm hơn (chậm nhất ngày mai).

**Không để quá tải**

- Mỗi ngày Ôn tập chỉ đưa ra số mục vừa với **Cài đặt → Mục tiêu mỗi ngày → Thời lượng ôn mỗi ngày** (5, 10, 15 hoặc
  20 phút; mặc định 10). Mỗi phiên khoảng 5 phút. Hết giờ thì có nút "Ôn thêm 5 phút". Phần còn lại được chia sang các
  ngày sau; lịch đã lưu không bị sửa.
- Mỗi ngày thêm tối đa 10 mục mới bạn đã làm đúng. Mục làm sai luôn được thêm. Từ mới trong bài cũng tính vào số này
  (tối đa 6 từ mỗi ngày), chỉ ra khi còn thời gian sau các mục đến hạn và không ra khi còn mục tồn.
- Khi còn mục tồn: trang Hôm nay đổi gợi ý học mới thành "Ôn trước, học mới sau", trang Cụm từ tạm không đưa thẻ mới
  (nút "Học thêm 5 thẻ mới" vẫn dùng được) và mục mới làm đúng chưa được thêm.
- Không muốn ôn một mục nữa: chọn "Không ôn mục này nữa" trong phiên ôn. Bật lại ở **Tiến độ → Ôn tập → Bật lại**.

**Xem ở đâu.** Trang Hôm nay đưa "Ôn tập · khoảng N phút" lên đầu kế hoạch. Thanh điều hướng hiện số mục đến hạn (trên
điện thoại là chấm trên tab Ôn tập). Trang Tiến độ có dự báo 7 ngày tới và số mục theo từng phần. Chép chính tả có chế
độ "Ôn đến hạn" để ôn riêng câu đến hạn, không tính giới hạn mỗi ngày.

**Những gì bạn đã học trước khi có Ôn tập** (câu sai, bài đã đạt, bộ cặp âm, câu video sai, câu nói nhại chưa tốt) được
tự xếp lịch ôn, mỗi ngày tối đa 8 mục để không dồn một lúc. Từ của các bài đã đạt trước khi có ôn từ cũng vậy. Việc này chạy mỗi lần mở app, nên tiến độ mới đồng bộ từ
máy khác cũng được xếp lịch; chạy lại không tạo mục trùng.

**Đồng bộ.** Lịch ôn lưu ở khóa `nghe-noi-am:review-cards`, đi theo sao lưu và đồng bộ thư mục. Khi gộp hai máy, mỗi
mục giữ bản được chấm gần nhất. Giới hạn: máy còn chạy bản cũ (chưa có Ôn tập) coi lịch ôn như dữ liệu thường (bản mới
hơn thắng cả khóa), và câu làm đúng trên máy đó sau khi Ôn tập đã chạy sẽ không được xếp lịch. Hãy cập nhật mọi máy: bản
PWA tự cập nhật ở lần mở sau, bản 1 file thì chạy lại `npm run portable`.

Chi tiết kỹ thuật: `docs/review-system.md`.

## Học trên nhiều máy (OneDrive, Google Drive, Dropbox…)

Đồng bộ dùng một thư mục bình thường trên máy, nên chạy với bất kỳ dịch vụ nào đồng bộ thư mục về máy: OneDrive, Google Drive for desktop, Dropbox, iCloud Drive, Syncthing, ổ mạng/NAS, hay cả ổ USB cắm qua lại. Ví dụ dưới dùng OneDrive.

1. Tạo bản 1 file và đặt thẳng vào thư mục đồng bộ:
   ```bash
   npm run portable -- --out "C:/Users/<tên>/OneDrive/NgheNoiAm"
   ```
   (không có `--out` thì file nằm ở `portable/Nghe-Noi-Am.html`). Máy nào cũng chỉ cần nhấp đúp `Nghe-Noi-Am.html` để mở bằng Edge/Chrome, không cần cài Node.
2. Mở app → **Cài đặt → Dữ liệu & đồng bộ** → **Chọn thư mục…** → chọn đúng thư mục `NgheNoiAm`. App ghi dữ liệu vào `nghe-noi-am-data.json` trong đó, tự ghi sau mỗi lần luyện và đọc bản mới nhất mỗi lần mở.
3. Ở máy khác làm lại bước 2 với cùng thư mục. Nếu máy đó đã có tiến độ riêng, chọn **Gộp với dữ liệu máy này**.
4. Khi Edge hỏi quyền, chọn **Cho phép mỗi lần truy cập**. Nếu đầu trang hiện "Bấm để kết nối thư mục dữ liệu OneDrive", bấm **Kết nối**.

Sau khi sửa code, chạy lại lệnh ở bước 1 để cập nhật file trong OneDrive. Firefox/Safari không hỗ trợ đồng bộ thư mục: trên hai trình duyệt này, mục **Cài đặt → Dữ liệu & đồng bộ** hiện nút **Xuất tệp / Chọn tệp** để chuyển dữ liệu bằng tay.

## Cấu trúc

- `src/core/decoder/`: bộ phân tích nối âm theo quy tắc (tokenize → lexicon → reductions → sự kiện tại ranh giới từ → segments). Quy ước phiên âm ở đầu `tables.ts`.
- `src/core/dictation/`: chuẩn hóa câu trả lời (I'm = I am, gonna = going to…), dóng hàng từ, phân loại lỗi, chế độ điền từ, câu tự thêm
- `src/core/media/`: đọc link YouTube, transcript, SRT/VTT, tách câu
- `src/core/`: router (`nav.ts`), thống kê, mục tiêu, cài đặt, giọng đọc (`tts.ts`), nhận dạng giọng nói (`speech.ts`), lịch ôn (`srs.ts`), sao lưu (`backup.ts`)
- `src/core/review/`: Ôn tập (lặp lại ngắt quãng cho mọi phần: chấm điểm, xếp lịch, giới hạn thời gian, gộp khi đồng bộ)
- `src/data/`: câu luyện, cụm từ, bài học, cặp âm. Bài học: khóa "Nghe nối âm" ở `lessons.ts`, các khóa khác ở `courses/*.ts`; cách viết bài: `docs/courses.md`
- `src/features/*`: giao diện từng trang (mỗi trang tải riêng khi mở)
- `public/sw.js`, `public/manifest.webmanifest`: PWA (chỉ bật ở bản build)
