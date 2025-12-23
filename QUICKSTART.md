# 🚀 Quick Start - Chạy Local Ngay

## Bước 1: Cài Đặt Backend (2 phút)

```bash
# Mở terminal và chạy:
cd d:\Prj_DiemDanh\backend
npm install
node server.js
```

✅ Nếu thấy thông báo này là thành công:
```
🚀 Server đang chạy tại:
   http://localhost:3000
✅ Database initialized successfully
```

**Giữ terminal này mở!** Backend đang chạy.

---

## Bước 2: Cài Đặt Frontend (2 phút)

Mở **terminal mới** (giữ terminal backend):

```bash
cd d:\Prj_DiemDanh\frontend
npm install
npm run dev
```

✅ Nếu thấy:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

---

## Bước 3: Mở Trình Duyệt

Truy cập: **http://localhost:5173**

Bạn sẽ thấy trang web điểm danh!

---

## Test Nhanh

### 1. Tạo File Excel Mẫu

Tạo file `test.xlsx` với nội dung:

| STT | Họ tên |
|-----|--------|
| 1 | Nguyễn Văn An |
| 2 | Trần Thị Bình |
| 3 | Lê Minh Châu |

### 2. Upload

1. Vào trang "Upload"
2. Nhập tên lớp: "Lớp Test"
3. Chọn file `test.xlsx`
4. Click "Upload"

### 3. Điểm Danh

1. Vào trang "Điểm danh"
2. Chọn "Lớp Test"
3. Chọn ngày hôm nay
4. Chọn "Học Giáo Lý"
5. Tick checkbox các em có mặt
6. Click "Lưu điểm danh"

### 4. Xem Lịch Sử

1. Vào trang "Lịch sử"
2. Chọn "Lớp Test"
3. Click vào buổi vừa điểm danh
4. Click "Export Excel" để tải file

---

## Troubleshooting

### Lỗi: "EADDRINUSE: address already in use"
Port 3000 hoặc 5173 đang được dùng. Tắt ứng dụng khác hoặc đổi port trong file config.

### Lỗi: "Cannot find module"
Chạy lại `npm install` trong thư mục đó.

### Frontend không kết nối được Backend
Kiểm tra backend có đang chạy không (terminal 1).

---

## Dừng Server

Nhấn `Ctrl + C` trong terminal để dừng backend hoặc frontend.

---

## Tiếp Theo

Sau khi test xong local, xem [DEPLOYMENT.md](DEPLOYMENT.md) để deploy lên internet!
