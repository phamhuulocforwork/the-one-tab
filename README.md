# The One Tab - Chrome Extension

Extension quản lý tabs với khả năng nhóm tabs, lưu trữ và đồng bộ với GitHub Gist.

## Yêu cầu

- Node.js version 20.19+ hoặc 22.12+
- npm hoặc yarn

## Cài đặt dependencies

```bash
npm install
```

## Build Extension

Để build extension thành file hoàn chỉnh:

```bash
npm run build
```

Sau khi build thành công:
- Thư mục `dist/` chứa các file extension đã được build
- File `release/crx-The One Tab-1.0.0.zip` sẽ được tạo tự động (file zip để chia sẻ)

## Cài đặt Extension vào Chrome

### Cách 1: Load từ thư mục dist (cho development)

1. Mở Chrome và vào `chrome://extensions/`
2. Bật "Developer mode" (góc trên bên phải)
3. Click "Load unpacked"
4. Chọn thư mục `dist/` trong project

### Cách 2: Cài từ file ZIP

1. Giải nén file `release/crx-The One Tab-1.0.0.zip`
2. Mở Chrome và vào `chrome://extensions/`
3. Bật "Developer mode"
4. Click "Load unpacked"
5. Chọn thư mục đã giải nén

## Development

Chạy development server:

```bash
npm run dev
```

## Tính năng

- Quản lý tabs theo nhóm
- Lưu trữ tabs vào local storage
- Đồng bộ với GitHub Gist
- Dark mode tự động theo cài đặt trình duyệt
- Drag & drop để sắp xếp tabs và groups

## Cấu trúc Project

```
src/
├── popup/          # Popup UI
├── options/        # Options page
├── storage/        # Storage management page
├── sidepanel/      # Side panel
├── background.ts   # Service worker
├── content/        # Content scripts
└── lib/            # Shared utilities và components
```
