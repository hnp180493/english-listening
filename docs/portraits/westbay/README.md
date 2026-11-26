# Chân dung người Westbay (nhân vật mới)

37 người của Westbay, thành phố cạnh thị trấn, chưa có ảnh vẽ: mỗi người một file `<tên>.md` trong thư mục này,
cùng một khung với 13 người dân thị trấn ở thư mục cha (`docs/portraits/`), cách làm và thứ tự 9 ô như
`docs/portrait-prompts.md`. Màu tóc, da, áo và phụ kiện (kính, mũ, râu, khăn, tạp dề) lấy theo nhân vật 3D của họ
(`src/features/town/city/cityLooks.ts`), tuổi và nghề theo `docs/city.md`, để ảnh vẽ và người 3D trông là một người.

Tải ảnh về đặt tên `<tên>.png` như cột đầu bảng dưới, bỏ vào `portraits-src/westbay/` ở gốc repo (thư mục này không
lên git) cho khỏi lẫn với ảnh người thị trấn.

Rồi chạy `npm run portraits` như với người thị trấn: script đọc cả `portraits-src/westbay/`, làm ra
`public/portraits/<tên>.webp` và ghi vào danh sách; từ đó người đó hiện bằng ảnh vẽ ở mọi chỗ của Westbay (Người quen,
cảnh nghe, sự kiện). Ai chưa có ảnh vẫn dùng chân dung 3D. Tên có danh xưng cũng được (`Mrs-Okafor.png`, `dr osei.png`),
sửa riêng một mặt cũng như người thị trấn (`rico-cuoi.png`…).

| Tên file | Người | Nơi | Khu |
|---|---|---|---|
| `rico.png` | Rico | Bến taxi | Ga & bến xe |
| `okafor.png` | Mrs Okafor | Ga trung tâm | Ga & bến xe |
| `pete.png` | Pete | Phòng đồ thất lạc | Ga & bến xe |
| `tess.png` | Tess | Xe cà phê | Ga & bến xe |
| `nora.png` | Nora | Tiệm hoa Sunflower Corner | Chợ cũ |
| `theo.png` | Theo | Xe đẩy của bé Maya | Chợ cũ |
| `frank.png` | Frank | Sạp truyện tranh cũ | Chợ cũ |
| `poppy.png` | Poppy | Tiệm bánh Twin Ovens | Chợ cũ |
| `gianna.png` | Gianna | Quán Ý Gianna's | Chợ cũ |
| `hal.png` | Hal | Hàng cá | Chợ cũ |
| `amira.png` | Amira | Hàng gia vị | Chợ cũ |
| `jonah.png` | Jonah | Góc hát rong | Chợ cũ |
| `iris.png` | Iris | Rạp Lumen | Phố nghệ thuật |
| `wren.png` | Wren | Quầy vé | Phố nghệ thuật |
| `claire.png` | Claire | Nhà sách Harbour Press | Phố nghệ thuật |
| `kit.png` | Kit | Đài Bay FM | Phố nghệ thuật |
| `bo.png` | Bo | Karaoke Bo's | Phố nghệ thuật |
| `dana.png` | Dana | Bàn ngoài hiên | Phố nghệ thuật |
| `priya.png` | Priya | Trụ sở Meridian | Khu văn phòng |
| `vivian.png` | Vivian | Xưởng thiết kế Loom | Khu văn phòng |
| `whitlock.png` | Mr Whitlock | Sạp báo | Khu văn phòng |
| `hana.png` | Hana | Quầy thông tin | Khu văn phòng |
| `colin.png` | Colin | Văn phòng FreshWay | Khu văn phòng |
| `dev.png` | Dev | Phòng máy | Khu văn phòng |
| `osei.png` | Dr Osei | Bệnh viện Westbay | Đại học & bệnh viện |
| `bridget.png` | Bridget | Trạm điều dưỡng | Đại học & bệnh viện |
| `adeyemi.png` | Prof Adeyemi | Phòng thí nghiệm ngữ âm | Đại học & bệnh viện |
| `finch.png` | Mr Finch | Thư viện | Đại học & bệnh viện |
| `yuki.png` | Yuki | Bàn học ngoài sân | Đại học & bệnh viện |
| `nell.png` | Nell | Nhà thuốc | Đại học & bệnh viện |
| `jun.png` | Jun | Sạp sửa đồ điện tử | Bến cảng |
| `marcus.png` | Marcus | Sân khấu Bay FM | Bến cảng |
| `odile.png` | Captain Odile | Bến phà | Bến cảng |
| `gus.png` | Gus | Chòi gác cảng | Bến cảng |
| `mei.png` | Mei | Sạp há cảo | Bến cảng |
| `sol.png` | Sol | Sạp lồng đèn | Bến cảng |
| `fay.png` | Fay | Vòng đu quay | Bến cảng |
