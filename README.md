# 🙏 Hệ Thống Điểm Danh Thiếu Nhi Giáo Lý

Hệ thống quản lý và điểm danh thiếu nhi giáo lý với QR Code.

> **Lưu ý:** Đây là repository **Frontend** của hệ thống. Backend được quản lý riêng ở repository khác.

## ✨ Tính Năng

- 📤 Upload danh sách thiếu nhi từ Excel
- 📊 Xem và quản lý danh sách
- ✅ Điểm danh thủ công
- 📱 Điểm danh bằng QR Code (hỗ trợ camera mobile)
- 📥 Xuất file Excel có điểm danh
- 📜 Xem lịch sử điểm danh

## 🚀 Quick Start

### Development

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
Backend được quản lý ở repository riêng. Vui lòng liên hệ để lấy link repository backend.

### Production

- **Frontend:** Deploy trên Vercel
- **Backend:** Deploy riêng (Railway/Render/VPS)

Xem hướng dẫn chi tiết trong [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)

## 📋 Tech Stack

**Frontend:**
- React + Vite
- Axios
- html5-qrcode
- React Router

**Backend (Repo riêng):**
- Node.js + Express
- Supabase
- ExcelJS
- Multer

## 🔧 Configuration

Frontend kết nối với backend thông qua biến môi trường `VITE_API_URL` trong file `.env`:

```env
VITE_API_URL=https://your-backend-url.com
```

## 📝 License

MIT

## 👨‍💻 Author

Developed with ❤️ for Giáo Lý Thiếu Nhi
