// index.js

// Websocket server
const express = require("express");
const app = express();
const server = require("http").createServer(app);
const PORT = process.env.PORT || 8080;
const WebSocket = require("ws")
const WEB_URL = process.env.NODE_ENV === "production" ? `https://${process.env.DOMAIN_NAME}/` : `http://192.168.0.103:${PORT}/`;

const wss = new WebSocket.Server({ server:server })


const cacheDuration = 1000 * 60 * 60 * 24 * 365; // 1 year

// Serve all the static files, (ex. index.html app.js style.css)
app.use(express.static("public", {
  maxAge: cacheDuration,
  setHeaders: (res, path) => {
    // Set caching headers
    res.setHeader('Cache-Control', `public, max-age=${cacheDuration}`);
    res.setHeader('Expires', new Date(Date.now() + cacheDuration).toUTCString());
  }
}));

server.listen(PORT, () =>
  console.log(`Listening on ${process.env.PORT} or 8080`)
);



// hashmap clients
const clients = {};
const games = {};
const players = {};
const spectators = {};

let dealer = null;
let gameOn = null;



wss.on("connection", (ws) => { // wsServer || wss AND request || connection
  // Someone trying to connect
  // const connection = connection.accept(null, connection.origin);
  ws.on("open", () => console.log("opened")); // connection || wss
  ws.on("close", () => {
    // connection || wss
    console.log("closed");
  });

  ws.on("message", (message) => {
    // connection || wss
    const result = JSON.parse(message);

    // a user want to create a new game
    if (result.method === "create") {
      const clientId = result.clientId;
      const playerSlot = result.playerSlot;
      const offline = result.offline;
      const roomId = partyId();
      const gameId = WEB_URL + roomId;

      app.get("/" + roomId, (req, res) => {
        res.sendFile(__dirname + "/public/index.html");
      });

      // .route.path
      games[gameId] = {
        id: gameId,
        clients: [],
        players: [],
        dealer: dealer,
        gameOn: gameOn,
        player: player,
        spectators: [],
        playerSlot: playerSlot,
        playerSlotHTML: [
          // 7 objectes because the playerSlot has a length of 7
          {},
          {},
          {},
          {},
          {},
          {},
          {},
        ],
        roomOwner: clientId, // Thêm roomOwner để lưu thông tin chủ phòng
        roomId: roomId // Lưu trữ roomId để dễ dàng tham chiếu
      };

      const payLoad = {
        method: "create",
        game: games[gameId],
        roomId: roomId,
        offline: offline,
      };

      if (clients[clientId]) {
        clients[clientId].ws.send(JSON.stringify(payLoad));
      }
      
    }

    // a client want to join
    if (result.method === "join") {
      const nickname = result.nickname;
      const avatar = result.avatar;
      const gameId = result.gameId;
      const roomId = result.roomId;
      let theClient = result.theClient;
      const clientId = result.clientId;
      const game = games[gameId];
      let players = game.players;
      const spectators = game.spectators;
      const playerSlot = game.playerSlot;
      const playerSlotHTML = game.playerSlotHTML;
      const roomOwner = game.roomOwner; // Lấy thông tin chủ phòng

      theClient.nickname = nickname;
      theClient.avatar = avatar;

      if (game.spectators.length >= 7) {
        // Max players reached
        return;
      }

      // Push unique Id to the client
      theClient.clientId = clientId;
      // Push client to players array
      // game.players.push(theClient)
      game.spectators.push(theClient);

      // Assign theClient to game.spectators[i]
      for (let i = 0; i < game.spectators.length; i++) {
        if (game.spectators[i].clientId === clientId) {
          // theClient = game.spectators[i]
          game.spectators[i] = theClient;
          // Thêm thông tin chủ phòng vào client
          game.spectators[i].isRoomOwner = (clientId === roomOwner);
        }
      }

      const payLoad = {
        method: "join",
        game: game,
        players: players,
        spectators: spectators,
        playerSlotHTML: playerSlotHTML,
        roomId: roomId,
        roomOwner: roomOwner,
      };

      // loop through all clients and tell them that people has joined
      // if(game.players.length === 0) {
      if (!game.gameOn === true) {
        game.spectators.forEach((c) => {
          clients[c.clientId].ws.send(JSON.stringify(payLoad));
        });
      }

      // }

      const payLoadClient = {
        method: "joinClient",
        theClient: theClient,
        game: game,
      };
      // Send theClient to THE CLIENT
      if (!game.gameOn === true) {
        clients[clientId].ws.send(JSON.stringify(payLoadClient));
      }

      const newPlayer = theClient;
      // Important to send this payLoad last, because it needs to know the the clientId
      const payLoadClientArray = {
        method: "updateClientArray",
        players: players,
        newPlayer: newPlayer,
        spectators: spectators,
        playerSlot: playerSlot,
        playerSlotHTML: playerSlotHTML,
        roomOwner: roomOwner, // Thêm thông tin chủ phòng
      };

      if (!game.gameOn === true) {
        game.spectators.forEach((c) => {
          clients[c.clientId].ws.send(JSON.stringify(payLoadClientArray));
        });
      }

      // If a player joins mid-game
      const payLoadMidGame = {
        method: "joinMidGame",
        theClient: theClient,
        game: game,
      };

      if (game.gameOn === true) {
        clients[clientId].ws.send(JSON.stringify(payLoadMidGame));
      }

      // Send this to ALL clients, to let them know that a new spectator joined
      const payLoadMidGameUpdate = {
        method: "joinMidGameUpdate",
        spectators: spectators,
        newPlayer: newPlayer,
      };
      if (game.gameOn === true) {
        game.spectators.forEach((c) => {
          clients[c.clientId].ws.send(JSON.stringify(payLoadMidGameUpdate));
        });
      }
    }

    // Xử lý yêu cầu kick người chơi
    if (result.method === "kickPlayer") {
      const gameId = result.gameId;
      const game = games[gameId];
      const kickedClientId = result.kickedClientId;
      const requesterId = result.requesterId;
      
      // Chỉ cho phép chủ phòng kick người khác
      if (requesterId === game.roomOwner) {
        // Tìm người chơi bị kick
        const kickedPlayerIndex = game.spectators.findIndex(
          (spectator) => spectator.clientId === kickedClientId
        );
        
        if (kickedPlayerIndex !== -1) {
          // Thông báo cho người bị kick
          const kickPayload = {
            method: "youWereKicked",
          };
          
          clients[kickedClientId].ws.send(JSON.stringify(kickPayload));
          
          // Thông báo cho tất cả người chơi khác
          const notifyPayload = {
            method: "playerKicked",
            kickedClientId: kickedClientId,
            kickedPlayerName: game.spectators[kickedPlayerIndex].nickname,
          };
          
          game.spectators.forEach((c) => {
            if (c.clientId !== kickedClientId) {
              clients[c.clientId].ws.send(JSON.stringify(notifyPayload));
            }
          });
          
          // Nếu người chơi đang ở trên bàn, cần xóa khỏi bàn
          const playerIndex = game.players.findIndex(
            (player) => player.clientId === kickedClientId
          );
          
          if (playerIndex !== -1) {
            game.players.splice(playerIndex, 1);
            
            // Xóa khỏi playerSlotHTML
            for (let i = 0; i < game.playerSlotHTML.length; i++) {
              if (game.playerSlotHTML[i] === kickedClientId) {
                game.playerSlotHTML[i] = {};
              }
            }
          }
          
          // Xóa khỏi danh sách người xem
          game.spectators.splice(kickedPlayerIndex, 1);
        }
      }
    }
    
    // Xử lý chuyển quyền chủ phòng
    if (result.method === "transferOwnership") {
      const gameId = result.gameId;
      const game = games[gameId];
      const newOwnerId = result.newOwnerId;
      const requesterId = result.requesterId;
      
      // Chỉ cho phép chủ phòng hiện tại chuyển quyền
      if (requesterId === game.roomOwner) {
        // Cập nhật chủ phòng mới
        game.roomOwner = newOwnerId;
        
        // Cập nhật trạng thái isRoomOwner cho tất cả người chơi
        for (let i = 0; i < game.spectators.length; i++) {
          game.spectators[i].isRoomOwner = (game.spectators[i].clientId === newOwnerId);
        }
        
        // Thông báo cho tất cả người chơi về sự thay đổi
        const ownershipPayload = {
          method: "ownershipTransferred",
          newOwnerId: newOwnerId,
          newOwnerName: game.spectators.find(spec => spec.clientId === newOwnerId)?.nickname || "Unknown",
        };
        
        game.spectators.forEach((c) => {
          clients[c.clientId].ws.send(JSON.stringify(ownershipPayload));
        });
      }
    }

    // bets
    if (result.method === "bet") {
      const players = result.players;
      const spectators = result.spectators;

      const payLoad = {
        method: "bet",
        players: players,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "deck") {
      const spectators = result.spectators;
      const deck = result.deck;
      const clientDeal = result.clientDeal;
      const gameOn = result.gameOn;

      const payLoad = {
        method: "deck",
        deck: deck,
        gameOn: gameOn,
        clientDeal: clientDeal,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "isReady") {
      const theClient = result.theClient;
      const players = result.players;
      const spectators = result.spectators;

      const payLoad = {
        method: "isReady",
        players: players,
        theClient: theClient,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "hasLeft") {
      const theClient = result.theClient;
      const players = result.players;
      const spectators = result.spectators;

      const payLoad = {
        method: "hasLeft",
        players: players,
        spectators: spectators,
        theClient: theClient,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "currentPlayer") {
      const players = result.players;
      const player = result.player;
      const dealersTurn = result.dealersTurn;
      const spectators = result.spectators;

      const payLoad = {
        method: "currentPlayer",
        player: player,
      };

      if (dealersTurn === false) {
        spectators.forEach((c) => {
          clients[c.clientId].ws.send(JSON.stringify(payLoad));
        });
      }

      if (dealersTurn === true) {
        players.pop(players.slice(-1)[0]);
        spectators.forEach((c) => {
          clients[c.clientId].ws.send(JSON.stringify(payLoad));
        });
      }
    }

    if (result.method === "update") {
      const players = result.players;
      const dealer = result.dealer;
      const deck = result.deck;
      const spectators = result.spectators;
      const gameOn = result.gameOn;

      const payLoad = {
        method: "update",
        players: players,
        dealer: dealer,
        deck: deck,
        gameOn: gameOn,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "thePlay") {
      const gameId = result.gameId;
      const game = games[gameId];
      const player = result.player;
      const dealersTurn = result.dealersTurn;
      const currentPlayer = result.currentPlayer;

      const payLoad = {
        method: "thePlay",
        player: player,
        currentPlayer: currentPlayer,
        players: player,
      };

      if (dealersTurn === false) {
        game.players.forEach((c) => {
          clients[c.clientId].ws.send(JSON.stringify(payLoad));
        });
      }
    }

    if (result.method === "showSum") {
      const players = result.players;
      const spectators = result.spectators;

      const payLoad = {
        method: "showSum",
        players: players,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "joinTable") {
      let theClient = result.theClient;
      const user = result.theClient;
      const theSlot = result.theSlot;
      const gameId = result.gameId;
      const game = games[gameId];
      const spectators = result.spectators;
      const players = result.players;
      const playerSlotHTML = result.playerSlotHTML;

      // Push client to players array
      players.push(theClient);
      // Push client Id to playerSlotHTML array
      playerSlotHTML[theSlot] = clientId;

      // Assign theClient to game.players[i]
      for (let i = 0; i < players.length; i++) {
        if (players[i].clientId === clientId) {
          // theClient = game.players[i]
          players[i] = theClient;
        }
      }

      game.players = players;
      game.playerSlotHTML = playerSlotHTML;

      const payLoad = {
        method: "joinTable",
        theSlot: theSlot,
        user: user,
        game: game,
        players: players,
        spectators: spectators,
        playerSlotHTML: playerSlotHTML,
        theClient: theClient,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });

    }

    if (result.method === "updatePlayerCards") {
      const resetCards = result.resetCards;
      const players = result.players;
      const player = result.player;
      const spectators = result.spectators;

      const payLoad = {
        method: "updatePlayerCards",
        players: players,
        player: player,
        resetCards: resetCards,
      };
      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "updateDealerCards") {
      const players = result.players;
      const spectators = result.spectators;
      const player = result.player;
      const dealer = result.dealer;
      const dealersTurn = result.dealersTurn;
      const payLoad = {
        method: "updateDealerCards",
        player: player,
        dealer: dealer,
        players: players,
        dealersTurn: dealersTurn,
      };
      if (dealersTurn === false) {
        spectators.forEach((c) => {
          clients[c.clientId].ws.send(JSON.stringify(payLoad));
        });
      }

      if (dealersTurn === true) {
        players.pop(players.slice(-1)[0]);
        spectators.forEach((c) => {
          clients[c.clientId].ws.send(JSON.stringify(payLoad));
        });
      }
    }

    if (result.method === "dealersTurn") {
      const dealersTurn = result.dealersTurn;
      const spectators = result.spectators;
      const payLoad = {
        method: "dealersTurn",
        dealersTurn: dealersTurn,
      };
      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "terminate") {
      let gameId = result.gameId;
      let game = games[gameId];
      let spectators = result.spectators;
      let players = result.players;
      const theClient = result.theClient;
      let playerSlotHTML = result.playerSlotHTML;
      const reload = result.reload;
      const gameOn = result.gameOn;

      const oldPlayerIndex = spectators.findIndex(
        (spectators) => spectators.clientId === theClient.clientId
      );

      // To prevent error when user disconnects outside a game
      if (game === undefined) {
        game = {
          spectators: {},
          players: {},
          playerSlotHTML: {},
        };
      }

      // Get what index the player is in so we can later delete him from the table on the client side
      let playerSlotIndex = null;

      // Append hasLeft to the spectators array
      for (let i = 0; i < players.length; i++) {
        for (let s = 0; s < spectators.length; s++) {
          if (players[i].hasLeft === true) {
            if (spectators[s].clientId === players[i].clientId) {
              spectators[s].hasLeft = true;
            }
          }
        }
      }

      // Terminate player from playerSlotHTML
      for (let i = 0; i < playerSlotHTML.length; i++) {
        if (clientId === playerSlotHTML[i]) {
          playerSlotIndex = i;
        }
      }

      // If spectators.length === 1 and dealers is in PLAYERS array, splice dealer in both in PLAYERS array
      if (spectators.length === 1 && players.some((e) => e.hiddenCard)) {
        players.splice(-1)[0];
      }

      // Kiểm tra nếu người rời đi là chủ phòng và còn người chơi khác
      if (theClient.clientId === game.roomOwner && spectators.length > 1) {
        // Tìm người chơi đầu tiên còn lại để chuyển quyền chủ phòng
        const newOwnerIndex = spectators.findIndex(
          (s) => s.clientId !== theClient.clientId && !s.hasLeft
        );
        
        if (newOwnerIndex !== -1) {
          game.roomOwner = spectators[newOwnerIndex].clientId;
          spectators[newOwnerIndex].isRoomOwner = true;
          
          // Thông báo cho tất cả người chơi về chủ phòng mới
          const ownershipPayload = {
            method: "ownershipTransferred",
            newOwnerId: spectators[newOwnerIndex].clientId,
            newOwnerName: spectators[newOwnerIndex].nickname,
            previousOwnerLeft: true,
          };
          
          spectators.forEach((c) => {
            if (c.clientId !== theClient.clientId) {
              clients[c.clientId].ws.send(JSON.stringify(ownershipPayload));
            }
          });
        }
      }

      if (gameOn === false || spectators.length === 1) {
        // if(spectators.length === 1) gameOn = false;

        // If player reloads page, remove him from spectators array
        if (reload === true) {
          // Terminate player from spectators
          for (let i = 0; i < spectators.length; i++) {
            if (clientId === spectators[i].clientId) {
              spectators.splice(i, 1);
              // spectators.splice(i, 1)
            }
          }
        }

        // Terminate player from playerSlotHTML
        for (let i = 0; i < playerSlotHTML.length; i++) {
          if (clientId === playerSlotHTML[i]) {
            // playerSlotIndex = i;
            playerSlotHTML[i] = {};
          }
        }
        // Terminate player from players array
        for (let i = 0; i < players.length; i++) {
          if (clientId === players[i].clientId) {
            players.splice(i, 1);
            // players.splice(i, 1)
          }
        }
      }

      game.spectators = spectators;
      game.players = players;
      game.playerSlotHTML = playerSlotHTML;

      const payLoad = {
        method: "leave",
        playerSlotIndex: playerSlotIndex,
        players: players,
        playerSlotHTML: playerSlotHTML,
        spectators: spectators,
        oldPlayerIndex: oldPlayerIndex,
        game: game,
        gameOn: gameOn,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });

    }

    if (result.method === "playersLength") {
      const gameId = result.gameId;
      const game = games[gameId];
      const playersLength = game.spectators.length;

      const payLoadLength = {
        method: "playersLength",
        playersLength: playersLength,
      };

      ws.send(JSON.stringify(payLoadLength));
    }

    if (result.method === "resetRound") {
      const spectators = result.spectators;
      const theClient = result.theClient;

      const payLoad = {
        method: "resetRound",
        theClient: theClient,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "playerResult") {
      const spectators = result.spectators;
      const players = result.players;

      const payLoad = {
        method: "playerResult",
        players: players,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "playerResultNatural") {
      const spectators = result.spectators;
      const players = result.players;
      const playerNaturalIndex = result.playerNaturalIndex;

      const payLoad = {
        method: "playerResultNatural",
        players: players,
        playerNaturalIndex: playerNaturalIndex,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "finalCompare") {
      const spectators = result.spectators;
      const gameId = result.gameId;
      const game = games[gameId];
      const players = result.players;
      game.players = players;

      const payLoad = {
        method: "finalCompare",
        // "players": players
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "resetGameState") {
      const spectators = result.spectators;
      const gameId = result.gameId;
      const game = games[gameId];
      const players = result.players;
      game.players = players;

      const payLoad = {
        method: "resetGameState",
        game: game,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "wsDealCards") {
      dealCards();
    }

    if (result.method === "getRoute") {
      const getRouteId = result.getRouteId;
      const gameId = WEB_URL + getRouteId;
      let isRouteDefined = false;
      let existingGame = null;

      // Kiểm tra xem route có tồn tại không
      for (let i = 3; i < app._router.stack.length; i++) {
        if (app._router.stack[i].route && app._router.stack[i].route.path === "/" + getRouteId) {
          isRouteDefined = true;
          break;
        }
      }

      // Kiểm tra xem phòng có tồn tại không
      if (games[gameId]) {
        existingGame = games[gameId];
      } else {
        // Tìm phòng dựa vào roomId
        for (const id in games) {
          if (games[id].roomId === getRouteId) {
            existingGame = games[id];
            break;
          }
        }
      }

      // Nếu phòng tồn tại nhưng route không tồn tại, tạo route mới
      if (existingGame && !isRouteDefined) {
        app.get("/" + getRouteId, (req, res) => {
          res.sendFile(__dirname + "/public/index.html");
        });
        isRouteDefined = true;
        console.log("Tạo lại route cho phòng hiện có: " + getRouteId);
      }

      // Phản hồi
      const payLoadRoute = {
        method: existingGame ? "roomExists" : "redirect",
        isRouteDefined: isRouteDefined,
        gameId: existingGame ? existingGame.id : null,
        roomId: getRouteId,
        existingGame: existingGame ? {
          id: existingGame.id,
          playerCount: existingGame.spectators.length,
          gameOn: existingGame.gameOn,
          roomOwner: existingGame.roomOwner
        } : null
      };

      try {
        ws.send(JSON.stringify(payLoadRoute));
      } catch (error) {
        console.error("Error sending route check response:", error);
      }
    }

    if (result.method === "dealersHiddenCard") {
      const spectators = result.spectators;
      const dealersHiddenCard = result.dealersHiddenCard;

      const payLoad = {
        method: "dealersHiddenCard",
        dealersHiddenCard: dealersHiddenCard,
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "startTimer") {
      const spectators = result.spectators;

      const payLoad = {
        method: "startTimer",
      };

      spectators.forEach((c) => {
        clients[c.clientId].ws.send(JSON.stringify(payLoad));
      });
    }

    if (result.method === "syncGame") {
      const gameId = result.gameId;
      let game = games[gameId];
      const gameOn = result.gameOn;
      const dealer = result.dealer;
      const players = result.players;
      const player = result.player;
      const spectators = result.spectators;
      const playerSlotHTML = result.playerSlotHTML;

      if (game === undefined) {
        game = {};
      }
      // Sync players & spectators arrays
      game.gameOn = gameOn;
      game.dealer = dealer;
      game.players = players;
      game.player = player;
      game.spectators = spectators;
      game.playerSlotHTML = playerSlotHTML;
    }
  });
  // The ClientId
  const clientId = guid();
  // The Client
  clients[clientId] = {
    ws: ws,
  };

  // The client object
  let theClient = {
    nickname: "",
    avatar: "",
    cards: [],
    bet: 0,
    balance: 5000,
    sum: null,
    hasAce: false,
    isReady: false,
    blackjack: false,
    hasLeft: false,
    isRoomOwner: false, // Thêm trường isRoomOwner mặc định là false
  };
  let player = null;
  // The players Array
  players[theClient] = {
    ws: ws,
  };
  players[player] = {
    ws: ws,
  };
  // The spectator Array
  spectators[theClient] = {
    ws: ws,
  };

  // Send this to client
  const payLoad = {
    method: "connect",
    clientId: clientId,
    theClient: theClient,
  };

  // Send the payLoad to the client
  ws.send(JSON.stringify(payLoad));
});

// Generates unique guid (i.e. unique user ID)
const guid = () => {
  const s4 = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4() + s4() + s4()}`;
};

// Random Part ID
function partyId() {
  var result = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

app.get("/offline", (req, res) => {
  res.sendFile(__dirname + "/public/offline.html");
});


app.get("/:id", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("*", function (req, res) {
  res.redirect("/");
});