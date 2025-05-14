const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class BlackjackBot {
  constructor(serverUrl, botName = "Bot", avatar = "user") {
    this.serverUrl = serverUrl;
    this.botName = botName;
    this.avatar = avatar;
    this.clientId = null;
    this.gameId = null;
    this.theClient = null;
    this.connected = false;
    this.joinedTable = false;
    this.isMyTurn = false;
    this.strategy = "basic"; // basic (cơ bản), conservative (bảo thủ), aggressive (tấn công)
  }

  // Kết nối đến máy chủ
  connect() {
    this.ws = new WebSocket(this.serverUrl);
    
    this.ws.on('open', () => {
      console.log(`Bot ${this.botName} đã kết nối đến máy chủ`);
      this.connected = true;
    });
    
    this.ws.on('message', (data) => {
      this.handleMessage(JSON.parse(data));
    });
    
    this.ws.on('close', () => {
      console.log(`Bot ${this.botName} đã ngắt kết nối`);
      this.connected = false;
    });
  }

  // Xử lý tin nhắn từ máy chủ
  handleMessage(response) {
    if (response.method === "connect") {
      this.clientId = response.clientId;
      this.theClient = response.theClient;
      this.theClient.nickname = this.botName;
      this.theClient.avatar = this.avatar;
      console.log(`Bot được gán clientId: ${this.clientId}`);
    }
    
    if (response.method === "create" || response.method === "roomExists") {
      this.gameId = response.game?.id || response.gameId;
      this.roomId = response.roomId;
      
      // Tham gia vào trò chơi sau 1 giây
      setTimeout(() => this.joinGame(), 1000);
    }
    
    if (response.method === "joinTable" || response.method === "update") {
      // Bot đã ở bàn chơi, kiểm tra nếu cần đặt cược
      if (!this.theClient.isReady && !this.joinedTable) {
        this.joinedTable = true;
        setTimeout(() => this.placeBet(), 2000);
      }
    }
    
    if (response.method === "thePlay" && response.player?.clientId === this.clientId) {
      // Đến lượt bot chơi
      this.isMyTurn = true;
      setTimeout(() => this.makeDecision(response.player), 2000);
    }
    
    // Cập nhật thông tin client của bot
    if (response.players) {
      for (const player of response.players) {
        if (player.clientId === this.clientId) {
          this.theClient = player;
        }
      }
    }
    
    // Trò chơi reset, chuẩn bị cho vòng mới
    if (response.method === "resetGameState") {
      this.isMyTurn = false;
      this.joinedTable = false;
      // Chuẩn bị cho vòng tiếp theo
      setTimeout(() => {
        if (this.joinTableSlot && !this.joinedTable) {
          this.joinTableSlot();
        }
      }, 5000);
    }
  }

  // Tham gia vào trò chơi
  joinGame() {
    if (!this.connected || !this.clientId) return;
    
    const payload = {
      method: "join",
      clientId: this.clientId,
      gameId: this.gameId,
      roomId: this.roomId,
      theClient: this.theClient,
      nickname: this.botName,
      avatar: this.avatar
    };
    
    this.ws.send(JSON.stringify(payload));
    console.log(`Bot ${this.botName} đang tham gia trò chơi: ${this.gameId}`);
    
    // Thử tham gia vào một slot bàn chơi sau 2 giây
    setTimeout(() => this.joinTableSlot(), 2000);
  }

  // Tham gia vào một slot trên bàn chơi
  joinTableSlot() {
    if (!this.connected || this.joinedTable) return;
    
    // Chọn ngẫu nhiên một slot (0-6)
    const slotIndex = Math.floor(Math.random() * 7);
    
    const payload = {
      method: "joinTable",
      players: [],
      spectators: [],
      theClient: this.theClient,
      theSlot: slotIndex,
      playerSlotHTML: [],
      gameId: this.gameId
    };
    
    this.ws.send(JSON.stringify(payload));
    console.log(`Bot ${this.botName} đang tham gia slot bàn: ${slotIndex}`);
  }

  // Đặt cược
  placeBet() {
    if (!this.connected || !this.joinedTable) return;
    
    // Logic đặt cược - từ 10% đến 30% số dư
    const minBet = 10;
    const betPercent = Math.random() * 0.2 + 0.1; // 10-30%
    let betAmount = Math.floor(this.theClient.balance * betPercent);
    
    // Đảm bảo cược tối thiểu và không vượt quá số dư
    betAmount = Math.max(minBet, Math.min(betAmount, this.theClient.balance));
    
    this.theClient.bet = betAmount;
    this.theClient.balance -= betAmount;
    this.theClient.isReady = true;
    
    const payload = {
      method: "isReady",
      players: [],
      spectators: [],
      theClient: this.theClient
    };
    
    this.ws.send(JSON.stringify(payload));
    console.log(`Bot ${this.botName} đã đặt cược: ${betAmount}`);
  }

  // Ra quyết định khi đến lượt chơi
  makeDecision(playerState) {
    if (!this.isMyTurn) return;
    
    // Lấy giá trị bài hiện tại
    const currentSum = Array.isArray(playerState.sum) 
      ? playerState.sum[playerState.sum.length - 1] // Sử dụng giá trị cao nhất của Át không bị quá
      : playerState.sum;
    
    // Chiến lược cơ bản
    let decision;
    if (currentSum >= 17) {
      // Dừng nếu từ 17 trở lên
      decision = "stand";
    } else if (currentSum <= 11) {
      // Luôn rút thêm nếu 11 hoặc thấp hơn
      decision = "hit";
    } else {
      // Với 12-16, sử dụng ngẫu nhiên có trọng số dựa trên chiến lược
      const hitChance = this.strategy === "aggressive" ? 0.8 :
                        this.strategy === "conservative" ? 0.3 : 0.5;
      
      decision = Math.random() < hitChance ? "hit" : "stand";
    }
    
    // Áp dụng quyết định
    console.log(`Bot ${this.botName} quyết định ${decision} với tổng điểm ${currentSum}`);
    
    const payload = {
      method: "thePlay",
      players: [],
      spectators: [],
      player: playerState,
      currentPlayer: 0,
      theClient: this.theClient,
      dealersTurn: false,
      gameId: this.gameId,
      // Dữ liệu bổ sung để chỉ ra quyết định của bot
      botDecision: decision
    };
    
    this.ws.send(JSON.stringify(payload));
    this.isMyTurn = false;
  }
}

// Ví dụ sử dụng:
// Tạo và kết nối bot
const bot = new BlackjackBot('ws://localhost:8080', 'BlackjackBot', 'detective');
bot.connect();

// Tạo nhiều bot:
const bots = [];
const botNames = ['Bot Jack', 'Bot Virus', 'Bot Charlie'];
const avatars = ['user', 'detective', 'casino'];

for (let i = 0; i < botNames.length; i++) {
  const bot = new BlackjackBot('ws://localhost:8080', botNames[i], avatars[i]);
  bot.connect();
  bots.push(bot);
}