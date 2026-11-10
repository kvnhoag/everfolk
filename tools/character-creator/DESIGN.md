# Everfolk · Living Legacies — quy tắc thiết kế

## Nhân vật lịch sử bắt buộc có khung riêng

1. Mọi nhân vật lịch sử phải có `state.figure` trùng với ID trong catalog. Renderer giữ cờ này khi nhập JSON hoặc mở mẫu trong editor; đổi trang phục không biến nhân vật lịch sử thành NPC.
2. Không dùng khung NPC cho nhân vật lịch sử. NPC dùng khung `citizen` giản dị. Khung lịch sử phải có kiến trúc nổi bật: cột vàng chạm khắc, diềm bậc thang và huy hiệu phía trên chân dung.
3. Mỗi nhân vật lịch sử có một mẫu khung và background riêng, không chỉ đổi màu. Quy tắc được khai báo trong `src/historical-frame.js` và được kiểm tra trước khi xuất collection.
4. Khung lịch sử phải gợi cảm giác quý hiếm, sang trọng và huyền bí: nền obsidian/onyx, vàng chạm nổi, đá quý có mặt cắt, huy hiệu và ánh sáng điểm. Giữ biểu tượng riêng của từng nhân vật ở vị trí nhìn rõ.
5. Biến thể Common–Legendary tăng dần số lượng đá quý, mật độ chạm khắc và điểm sáng. Cấu trúc khung lịch sử và huy hiệu phải còn nguyên ở tất cả độ hiếm. Không diễn giải khung bản gốc thành một rarity đã được mint; màu khung không tự gán rarity hoặc số lượng token.

## Phạm vi và không khí của nền lịch sử

- Chỉ bốn background lịch sử và khung lịch sử dùng phong cách quý hiếm này. Không thay nền, khung, chân dung hoặc rarity artwork của sáu nhóm NPC khi sửa hướng art lịch sử.
- Dùng bảng màu đêm giàu sắc độ: Alexander xanh hoàng gia–vàng, Aristotle tím amethyst–đồng vàng, Euclid xanh thiên thanh–aquamarine, Cleomenes xanh emerald–vàng cổ.
- Nền có chiều sâu với kiến trúc tối, nét ánh sáng phản chiếu và vòng thiên thể chạm mảnh phía sau nhân vật. Điểm sáng phải thưa, đặt ở vùng phụ; khuôn mặt và đạo cụ luôn rõ.
- Cảm giác huyền bí đến từ màu, ánh sáng và hoa văn; tiếp tục giữ cảnh đặc trưng theo nghề và hành động của từng nhân vật. Không thay cả bốn nền thành cùng một cổng hoặc một cung điện.
- Không làm mờ hay nội suy sprite; không vẽ hiệu ứng che mặt, tên, đạo cụ hoặc giả số serial/rarity/token đã mint. Không mạ vàng toàn bộ nền làm mất tương phản của khung.

## Bốn hướng tạo hình

- **Alexander — `royal-laurel`:** chạm khắc lá nguyệt quế, huy hiệu giáo; background thành phố ven biển đang xây, giàn dựng, cờ Macedonia. Đọc vai trò chỉ huy và hành động “Found and build” từ catalog; không mô tả địa điểm như phục dựng khảo cổ.
- **Aristotle — `lyceum-scroll`:** đầu cột cuộn, huy hiệu cuộn chữ; background vườn học Lyceum, hàng cột, cây ô liu và chỗ đọc sách. Mặt dài, mắt sâu, sống mũi dài, vẻ trầm tư.
- **Euclid — `museum-geometry`:** hoa văn ô vuông, huy hiệu tam giác; background sân học hình học, kệ cuộn sách, bảng các hình và bàn chứng minh. Giữ dấu hiệu hình học ở đạo cụ để phân biệt với nhà triết học.
- **Cleomenes — `granary-wheat`:** chạm bông lúa, huy hiệu lúa mì; background kho lương bên bến, bao ngũ cốc và cân hàng. Dáng đầy, mặt trái tim, mắt sâu và vẻ nghiêm nghị; không vẽ thành vua hoặc chiến binh.

## Đa dạng khuôn mặt

- Có sáu hình khối đầu thực sự khác nhau: tròn, trái xoan, vuông, dài, trái tim và gò má rõ.
- Có sáu kiểu mắt, bốn kiểu lông mày, năm kiểu mũi và sáu biểu cảm. Các lựa chọn phải làm thay đổi pixel, không chỉ đổi tên trong giao diện.
- Không tạo khác biệt nhân vật chỉ bằng màu da, bộ râu hay màu áo. Mỗi mẫu gốc có tổ hợp đầu–mắt–mũi–lông mày–biểu cảm được chỉ định trong `src/nft-collection.js`.
- Biến thể khuôn mặt vẫn phải đọc được ở sprite 64×96 và ba góc nhìn. Da, nét mặt và trang phục tiếp tục dùng palette của công cụ; chỉ background và khung được dùng bảng màu môi trường riêng.
- `nft-collection/face-study.png` và `face-studies.json` là bảng nghiên cứu 12 khuôn mặt. Đây là mẫu art để chỉnh tiếp, không phải 12 loại NFT mới.

## Luật xuất bản artwork

- Pixel nguyên, không nội suy mượt khi phóng sprite. Giữ cùng tỷ lệ cơ thể và hướng sáng từ trên trái.
- Tách landscape, từng lớp nhân vật, khung lịch sử và chữ. `.ora` phải ghép lại đúng từng pixel với PNG giao hàng.
- Không để khung che khuôn mặt, đạo cụ hoặc tên nhân vật. Huy hiệu nằm trên vùng chân dung; cột nằm ngoài vùng sprite.
- Xuất riêng background của từng mẫu dưới tên `<id>/background.png`.
- Chân dung là diễn giải nghệ thuật. Không khẳng định đây là diện mạo thật của các nhân vật lịch sử.
- Tên, mô tả, hành động và giới hạn nguồn cung lấy từ `chain/`; không tạo dữ liệu mint, Affection hoặc xác suất mới trong thiết kế.

## Kiểm tra trước khi giao

```sh
node tools/character-creator/scripts/build-collection.mjs
node --test tools/character-creator/tests/*.test.mjs
python tools/character-creator/scripts/verify-collection.py
```

Script kiểm tra Python cần Pillow. Xem trực tiếp contact sheet, bảng mặt và collection trong trình duyệt sau khi xuất.
