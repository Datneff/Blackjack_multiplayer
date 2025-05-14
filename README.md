# Blackjack-Game-Multiplayer

![Game Screenshot](https://i.ibb.co/S3vjPCX/blackjack-background.jpg)

## Giới thiệu
Blackjack-Game-Multiplayer là một trò chơi casino trực tuyến miễn phí cho nhiều người chơi. Đây là phiên bản trực tuyến của trò blackjack truyền thống thường thấy tại các sòng bạc thật. Bạn có thể chơi một mình hoặc tạo phòng riêng để chơi cùng bạn bè. Mục tiêu của trò chơi là đánh bại nhà cái và kiếm được càng nhiều tiền càng tốt.

## Cài đặt
Clone dự án về trình soạn thảo mã bạn yêu thích
Mở terminal và cài đặt các thư viện cần thiết bằng lệnh npm install
Khi các thư viện đã được cài đặt xong, khởi động máy chủ bằng cách gõ node index.js trong terminal
Mở trình duyệt và truy cập localhost:8080

## Công nghệ sử dụng
* JavaScript
* SCSS
* Node.js
* Express
* WebSocket

## Cách chơi

### Mục tiêu trò chơi

Mỗi người chơi cố gắng đánh bại nhà cái bằng cách có tổng điểm càng gần 21 càng tốt, nhưng không vượt quá 21.

### Giá trị lá bài / Tính điểm

Thông thường người chơi sẽ quyết định lá A có giá trị là 1 hay 11. Tuy nhiên trong trò chơi này, nếu người chơi chọn "dừng" và có lá A, nó sẽ được tính là 11 nếu tổng điểm không vượt quá 21.
Các lá hình (J, Q, K) có giá trị là 10, các lá còn lại giữ nguyên giá trị.

### Cược

Trước khi nhà cái chia bài, mỗi người chơi cần đặt cược.

### Chia bài

Vòng chơi bắt đầu khi nhà cái chia 2 lá bài cho mỗi người chơi, và chia cho mình 1 lá ngửa + 1 lá úp.

### Tự nhiên (Blackjack)

Nếu người chơi có tổng điểm là 21 ngay từ 2 lá đầu tiên, đó là Blackjack.
Người chơi sẽ được trả thưởng theo tỉ lệ 3:2 và chờ tới vòng tiếp theo

### Lượt chơi của người chơi

Người chơi có thể chọn:

Rút bài (Hit): Rút thêm 1 lá để tăng tổng điểm gần 21 hơn
Dừng (Stand): Không rút thêm, chuyển lượt cho người chơi khác
Gấp đôi (Double Down): Gấp đôi tiền cược và rút 1 lá bài duy nhất. (Chỉ được dùng 1 lần mỗi vòng và không được rút thêm sau đó)

### Lượt chơi của nhà cái

Nhà cái sẽ lật lá bài úp của mình. Sau đó:
Rút bài cho đến khi tổng điểm đạt ít nhất 17
Khi đạt 17 trở lên, nhà cái sẽ dừng

### Trả thưởng

Nếu người chơi bị “quắc” (vượt quá 21), họ thua cược, kể cả khi nhà cái cũng bị quắc
Nếu người chơi có tổng điểm cao hơn nhà cái → người chơi thắng
Nếu nhà cái có điểm cao hơn → nhà cái thắng

