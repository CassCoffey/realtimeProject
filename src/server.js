const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../client/index.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

const io = socketio(app);

const rooms = [];
let numRooms = 0;

const chooseRoom = (play) => {
  const player = play;
  for (let i = 0; i < numRooms; i++) {
    if (!rooms[i].full) {
      player.room = rooms[i];
      if (rooms[i].playerOne != null) {
        rooms[i].playerTwo = player;
        rooms[i].full = true;
      } else {
        rooms[i].playerOne = player;
        if (rooms[i].playerTwo != null) {
          rooms[i].full = true;
        }
      }
      return;
    }
  }

  const room = {};
  room.full = false;
  room.playerOne = player;
  room.playerTwo = null;
  room.name = `room${numRooms}`;
  room.board = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
  room.turn = 'x';
  rooms[numRooms] = room;
  player.room = room;
  numRooms++;
};

const updateRoom = (play) => {
  const player = play;

  let playerOne = 'N/A';
  let playerTwo = 'N/A';
  let oneScore = 0;
  let twoScore = 0;
  if (player.room.playerOne != null) {
    playerOne = player.room.playerOne.name;
    oneScore = player.room.playerOne.score;
  }
  if (player.room.playerTwo != null) {
    playerTwo = player.room.playerTwo.name;
    twoScore = player.room.playerTwo.score;
  }

  const roomName = player.room.name;
  io.sockets.in(roomName).emit('updateRoomInfo', { playerOne, playerTwo, oneScore, twoScore });
};

const checkWin = (play) => {
  const player = play;
  const room = player.room;
  const board = room.board;
  // All the win states
  if ((board[0][0] === board[1][0] && board[1][0] === board[2][0] && board[1][0] !== null) ||
    (board[0][1] === board[1][1] && board[1][1] === board[2][1] && board[1][1] !== null) ||
    (board[0][2] === board[1][2] && board[1][2] === board[2][2] && board[1][2] !== null) ||
    (board[0][0] === board[0][1] && board[0][1] === board[0][2] && board[0][1] !== null) ||
    (board[1][0] === board[1][1] && board[1][1] === board[1][2] && board[1][1] !== null) ||
    (board[2][0] === board[2][1] && board[2][1] === board[2][2] && board[2][1] !== null) ||
    (board[0][0] === board[1][1] && board[1][1] === board[2][2] && board[1][1] !== null) ||
    (board[2][0] === board[1][1] && board[1][1] === board[0][2] && board[1][1] !== null)) {
    player.score += 1;
    room.turn = 'x';
    room.board = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
    ];

    updateRoom(player);
  }

  // Check for draw too
  let drawCheck = true;
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      if (board[x][y] === null) {
        drawCheck = false;
      }
    }
  }

  // All spaces are filled and no win, it's a draw.
  if (drawCheck) {
    room.turn = 'x';
    room.board = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
    ];

    updateRoom(player);
  }
};

const processMove = (x, y, player) => {
  const room = player.room;
  let character = null;
  if (room.playerOne === player) {
    character = 'x';
  }
  if (room.playerTwo === player) {
    character = 'o';
  }

  if (room.full && room.turn === character && room.board[x][y] === null) {
    room.board[x][y] = character;

    checkWin(player);

    if (character === 'x') {
      room.turn = 'o';
    } else {
      room.turn = 'x';
    }
  }
};

const onJoined = (sock) => {
  const socket = sock;
  socket.on('join', (data) => {
    const player = {};
    player.name = data.name;
    player.score = 0;
    socket.player = player;
    chooseRoom(player);
    const roomName = player.room.name;
    socket.join(roomName);
    socket.emit('connected', null);
    updateRoom(player);
  });

  socket.on('makeMove', (data) => {
    const player = socket.player;
    const room = player.room;

    processMove(data.x, data.y, player);

    io.sockets.in(room.name).emit('updateBoard', { board: room.board });
  });
};

const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    const player = socket.player;
    const room = player.room;
    if (room.playerOne === player) {
      room.playerOne = null;
    } else {
      room.playerTwo = null;
    }
    room.full = false;
    room.turn = 'x';
    room.board = [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];

    updateRoom(player);
    io.sockets.in(room.name).emit('updateBoard', { board: room.board });
  });
};

io.sockets.on('connection', (socket) => {
  onJoined(socket);
  onDisconnect(socket);
});
