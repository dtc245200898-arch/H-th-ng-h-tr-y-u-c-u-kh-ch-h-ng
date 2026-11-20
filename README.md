# Hệ thống hỗ trợ yêu cầu khách hàng

Ứng dụng quản lý yêu cầu hỗ trợ với REST API, Assignment Worker, thông báo realtime và lưu trữ dữ liệu bằng JSON.

## Chức năng

- Tạo yêu cầu hỗ trợ mới
- Xem, lọc yêu cầu theo trạng thái
- Tự động đưa yêu cầu vào hàng đợi và phân công cho Worker
- Cập nhật trạng thái: `New`, `Assigned`, `InProgress`, `Resolved`, `Closed`
- Phân công thủ công cho nhân viên
- Xem lịch sử thay đổi
- Cập nhật danh sách realtime bằng Server-Sent Events

## API

| Method | Endpoint | Chức năng |
|---|---|---|
| POST | `/api/tickets` | Tạo yêu cầu |
| GET | `/api/tickets` | Danh sách yêu cầu |
| GET | `/api/tickets/:id` | Chi tiết yêu cầu |
| PATCH | `/api/tickets/:id/status` | Cập nhật trạng thái |
| PATCH | `/api/tickets/:id/assign` | Phân công nhân viên |
| GET | `/api/users/:userId/tickets` | Yêu cầu của nhân viên |
| GET | `/api/tickets/:id/history` | Lịch sử thay đổi |
| GET | `/api/events` | Kết nối realtime |

## Chạy dự án

```powershell
npm install
npm start
```

Mở `http://localhost:3000`.

Chạy test:

```powershell
npm test
```

Dữ liệu mặc định được lưu trong thư mục `data/tickets.json`. Cấu hình cổng qua biến môi trường `PORT`.

## Kiến trúc

```text
Client -> REST API -> Ticket Queue -> Assignment Worker -> Database
                                     -> Realtime Notification Service
```