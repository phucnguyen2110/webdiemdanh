# 🚀 Hướng Dẫn Deploy - Hệ Thống Điểm Danh Thiếu Nhi

## 📋 Tổng Quan
- **Frontend:** Vercel (https://vercel.com)
- **Backend:** Railway (https://railway.app)
- **Database:** SQLite (tự động tạo trên Railway)

---

## PHẦN 1: DEPLOY BACKEND (Railway)

### Bước 1: Tạo tài khoản Railway
1. Truy cập https://railway.app
2. Đăng ký bằng GitHub account
3. Xác nhận email

### Bước 2: Deploy Backend
1. Click "New Project"
2. Chọn "Deploy from GitHub repo"
3. Chọn repository của bạn
4. Chọn thư mục `backend`
5. Railway sẽ tự động detect Node.js

### Bước 3: Cấu hình Environment Variables
Trong Railway dashboard:
1. Click vào service backend
2. Vào tab "Variables"
3. Thêm các biến:
   ```
   NODE_ENV=production
   PORT=3000
   ```

### Bước 4: Lấy Backend URL
1. Vào tab "Settings"
2. Click "Generate Domain"
3. Lưu lại URL (ví dụ: `https://diem-danh-backend.railway.app`)

### Bước 5: Kiểm tra Backend
Truy cập: `https://your-backend-url.railway.app/api/classes`
- Nếu thấy `{"success":true,"classes":[]}` → ✅ Thành công!

---

## PHẦN 2: DEPLOY FRONTEND (Vercel)

### Bước 1: Tạo tài khoản Vercel
1. Truy cập https://vercel.com
2. Đăng ký bằng GitHub account
3. Xác nhận email

### Bước 2: Cấu hình Environment Variable cho Frontend

**Tạo file `.env.production` trong thư mục `frontend`:**
```env
VITE_API_URL=https://your-backend-url.railway.app
```

**Hoặc cấu hình trực tiếp trên Vercel:**
1. Vào project settings
2. Tab "Environment Variables"
3. Thêm:
   - Name: `VITE_API_URL`
   - Value: `https://your-backend-url.railway.app`

### Bước 3: Deploy Frontend
1. Click "Add New Project"
2. Import repository từ GitHub
3. Chọn thư mục `frontend`
4. Framework Preset: Vite
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Click "Deploy"

### Bước 4: Lấy Frontend URL
Vercel sẽ tự động tạo URL:
- `https://your-project.vercel.app`

---

## PHẦN 3: CẤU HÌNH CORS (Backend)

### Cập nhật file `backend/server.js`:

```javascript
const cors = require('cors');

// Thêm CORS với frontend URL
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://your-project.vercel.app'  // Thay bằng URL Vercel của bạn
    ],
    credentials: true
}));
```

### Commit và push lại:
```bash
git add .
git commit -m "Update CORS for production"
git push
```

Railway sẽ tự động redeploy.

---

## PHẦN 4: CẤU HÌNH API URL (Frontend)

### Cập nhật file `frontend/src/services/api.js`:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

### Commit và push:
```bash
git add .
git commit -m "Update API URL for production"
git push
```

Vercel sẽ tự động redeploy.

---

## PHẦN 5: KIỂM TRA

### ✅ Checklist:
- [ ] Backend accessible: `https://your-backend.railway.app/api/classes`
- [ ] Frontend accessible: `https://your-project.vercel.app`
- [ ] CORS configured correctly
- [ ] API calls work from frontend
- [ ] Camera works on mobile (HTTPS)
- [ ] Upload Excel works
- [ ] QR Scanner works

---

## 🎯 TEST QR SCANNER TRÊN MOBILE

1. Mở `https://your-project.vercel.app` trên điện thoại
2. Vào trang "Điểm Danh QR"
3. Chọn lớp
4. Click "Bắt Đầu Quét QR"
5. Cho phép camera
6. **Camera sẽ mở và quét QR thành công!** ✅

---

## 📝 LƯU Ý QUAN TRỌNG

### Database:
- SQLite database sẽ được tạo tự động trên Railway
- Dữ liệu sẽ mất khi redeploy (Railway free tier)
- Nên backup database thường xuyên

### Uploads:
- File uploads sẽ lưu tạm trên Railway
- Có thể mất khi redeploy
- Nên dùng cloud storage (Cloudinary, S3) cho production

### Environment Variables:
- Không commit file `.env` lên Git
- Cấu hình trên Railway/Vercel dashboard

---

## 🔧 TROUBLESHOOTING

### Lỗi CORS:
```
Access to fetch at 'https://backend...' from origin 'https://frontend...' 
has been blocked by CORS policy
```
**Giải pháp:** Thêm frontend URL vào CORS whitelist trong `server.js`

### Lỗi API:
```
Failed to fetch
```
**Giải pháp:** Kiểm tra `VITE_API_URL` trong Vercel environment variables

### Camera không hoạt động:
**Giải pháp:** Đảm bảo truy cập qua HTTPS (Vercel tự động có HTTPS)

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề:
1. Kiểm tra logs trên Railway/Vercel
2. Kiểm tra browser console (F12)
3. Verify environment variables
4. Test API endpoints trực tiếp

---

## 🎉 HOÀN THÀNH!

Sau khi deploy xong:
- ✅ Frontend: `https://your-project.vercel.app`
- ✅ Backend: `https://your-backend.railway.app`
- ✅ QR Scanner hoạt động trên mobile
- ✅ Tất cả tính năng hoạt động với HTTPS

**Chúc mừng! Hệ thống của bạn đã online!** 🚀
