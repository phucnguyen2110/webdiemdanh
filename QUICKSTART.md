# 🚀 Quick Start - Chạy Frontend Local

> **Lưu ý:** Hướng dẫn này chỉ cho **Frontend**. Backend được quản lý ở repository riêng.

## Yêu Cầu

- Node.js (v16 trở lên)
- npm hoặc yarn
- Backend API đang chạy (xem repository backend)

---

## Bước 1: Clone và Cài Đặt

```bash
# Clone repository
git clone <repository-url>
cd Prj_DiemDanh

# Cài đặt dependencies
cd frontend
npm install
```

---

## Bước 2: Cấu Hình Backend URL

Tạo file `.env` trong thư mục `frontend`:

```env
VITE_API_URL=http://localhost:3000
```

Hoặc nếu backend đã deploy:
```env
VITE_API_URL=https://your-backend-url.com
```

---

## Bước 3: Chạy Development Server

```bash
npm run dev
```

✅ Nếu thấy:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

---

## Bước 4: Mở Trình Duyệt

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
Port 5173 đang được dùng. Tắt ứng dụng khác hoặc đổi port trong `vite.config.js`.

### Lỗi: "Cannot find module"
Chạy lại `npm install` trong thư mục frontend.

### Frontend không kết nối được Backend
1. Kiểm tra backend có đang chạy không
2. Kiểm tra `VITE_API_URL` trong file `.env`
3. Kiểm tra CORS settings ở backend

### Lỗi: "Network Error" hoặc "Failed to fetch"
- Backend chưa chạy
- URL backend sai trong `.env`
- CORS chưa được cấu hình đúng ở backend

---

## Build Production

```bash
npm run build
```

File build sẽ nằm trong thư mục `dist/`.

---

## Deploy

### Vercel (Khuyến nghị)

1. Push code lên GitHub
2. Import project vào Vercel
3. Thêm environment variable `VITE_API_URL`
4. Deploy

Xem chi tiết trong [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md)

---

## Dừng Server

Nhấn `Ctrl + C` trong terminal để dừng dev server.

---

## Cấu Trúc Thư Mục

```
frontend/
├── src/
│   ├── pages/          # Các trang chính
│   ├── services/       # API calls
│   ├── index.css       # Global styles
│   └── main.jsx        # Entry point
├── public/             # Static assets
├── .env                # Environment variables (tạo file này)
└── package.json
```

---

## Liên Hệ Backend

Backend được quản lý riêng. Để chạy đầy đủ hệ thống, bạn cần:
1. Clone repository backend
2. Chạy backend server
3. Cấu hình `VITE_API_URL` trỏ đến backend

Liên hệ để lấy link repository backend.
