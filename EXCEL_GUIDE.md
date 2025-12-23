# 📚 Hướng Dẫn Chuẩn Bị File Excel

## Format Chuẩn

File Excel cần có **ít nhất 2 cột**: `STT` và `Họ tên`

### Ví dụ:

| STT | Họ tên | Ghi chú (optional) |
|-----|--------|-------------------|
| 1 | Nguyễn Văn An | |
| 2 | Trần Thị Bình | |
| 3 | Lê Minh Châu | |
| 4 | Phạm Thị Dung | |
| 5 | Hoàng Văn Em | |

## Lưu Ý Quan Trọng

### ✅ Đúng Format

- Dòng đầu tiên phải là tiêu đề cột
- Cột "STT" chứa số thứ tự
- Cột "Họ tên" chứa tên đầy đủ của thiếu nhi
- Có thể có thêm các cột khác (sẽ bị bỏ qua)

### ❌ Tránh Các Lỗi Sau

1. **Không có tiêu đề**: File phải có dòng tiêu đề
2. **Thiếu cột**: Phải có cả "STT" và "Họ tên"
3. **Dòng trống**: Các dòng trống sẽ bị bỏ qua
4. **File quá lớn**: Tối đa 5MB
5. **Sai định dạng**: Chỉ chấp nhận .xlsx hoặc .xls

## Các Cách Đặt Tên Cột (Hệ Thống Tự Nhận Diện)

Hệ thống sẽ tự động nhận diện các tên cột sau:

### Cột STT:
- "STT"
- "Số TT"
- "So TT"
- "Number"

### Cột Họ Tên:
- "Họ tên"
- "Họ và tên"
- "Tên"
- "Full Name"
- "Name"

## Tạo File Excel Từ Google Sheets

1. Tạo Google Sheet với format như trên
2. File → Download → Microsoft Excel (.xlsx)
3. Upload file vừa tải về

## Tạo File Excel Từ Excel Desktop

1. Mở Microsoft Excel
2. Tạo bảng với format như trên
3. Save as → Excel Workbook (.xlsx)
4. Upload file

## Ví Dụ Thực Tế

### Lớp Rước Lễ Năm 2025

| STT | Họ tên | Ngày sinh | Phụ huynh |
|-----|--------|-----------|-----------|
| 1 | Nguyễn Minh An | 2015 | Nguyễn Văn A |
| 2 | Trần Thị Bảo | 2015 | Trần Văn B |
| 3 | Lê Hoàng Châu | 2016 | Lê Thị C |

**Lưu ý**: Hệ thống chỉ lấy cột "STT" và "Họ tên", các cột khác có thể giữ để tham khảo.

### Lớp Thêm Sức

| STT | Họ và Tên | Lớp Học |
|-----|-----------|---------|
| 1 | Phạm Minh Đức | 8A |
| 2 | Hoàng Thị Em | 8B |
| 3 | Võ Văn Phúc | 8C |

## Download File Mẫu

Bạn có thể tạo file mẫu nhanh bằng cách:

1. Mở Excel/Google Sheets
2. Copy bảng mẫu ở trên
3. Paste vào sheet
4. Thay đổi tên thiếu nhi theo danh sách thực tế
5. Save/Download thành .xlsx

## Troubleshooting

### "Không tìm thấy dữ liệu thiếu nhi"
- Kiểm tra xem có dòng tiêu đề không
- Kiểm tra tên cột có đúng không
- Kiểm tra có dữ liệu trong các dòng không

### "File phải có định dạng .xlsx hoặc .xls"
- Đảm bảo file được save đúng định dạng
- Không dùng .csv hoặc .txt

### "File không được vượt quá 5MB"
- File quá lớn, xóa bớt dữ liệu không cần thiết
- Hoặc chia thành nhiều file nhỏ hơn
