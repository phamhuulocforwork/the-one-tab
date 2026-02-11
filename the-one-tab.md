Tôi muốn viết một extension để lưu, quản lý các tab (thay cho chức năng favorite của trình duyệt),
Đồng bộ dữ liệu lên github gist (cần setup để xin permission từ github)

Các usecase cụ thể như sau:

Các tab sẽ được quản lý theo các group được đặt tên và description, extension sẽ luôn tạo một group mặc định tên là "Default"

Ở popup:

- Switch toggle "Đóng và lưu" (setting của extension)
- Button "Lưu tab hiện tại" -> đóng và lưu tab đang active hiện tại vào group mặc định, bên cạnh sẽ có button icon -> dropdown để chọn group cụ thể muốn lưu.
- Button "Lưu tất cả" -> đóng và lưu tất cả các tab đang mở vào group mặc định, bên cạnh sẽ có button icon -> dropdown để chọn group cụ thể muốn lưu.

- Button "Mở kho lưu" -> Mở tab mới (pinned), để hiện thị danh sách các group và các tab được lưu (load từ github gist)hub

Ở storing tab:

- Hiện thị danh sách các group (ẩn description nếu null)
- Danh sách các tab thuộc group