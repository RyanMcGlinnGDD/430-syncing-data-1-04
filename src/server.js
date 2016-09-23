const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

// determine active port
const port = process.env.PORT || process.env.NODE_PORT || 3000;

// read client html into memory
const index = fs.readFileSync(`${__dirname}/../client/index.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`listening on 127.0.0.1: ${port}`);

// pass http server into socketio
const io = socketio(app);

const set = {};

// join logic, adds users to room1
const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', () => {
    socket.join('room1');
    // work out a new unique ID for the user
    let userId;
    let flag = true;
    while (flag) {
      userId = `user${Math.floor(Math.random() * 10000) + 1}`;
      if (set[userId] !== null) {
        flag = false;
      }
    }

    // give a placeholder value
    set[userId] = 0;

    socket.emit('serveUserId', userId);
    // save userId to socket so disconnect can be handled
    socket.userId = userId;

    console.log(`${userId} has successfully joined the room...`);
  });
};

// handles requests
const onShapeRequest = (sock) => {
  const socket = sock;

  socket.on('requestShapeUpdate', (data) => {
    // ensure that data is freshest possible
    if (set[data.user].t < data.t) {
      // apply the x and y changes sent as data
      set[data.user] = {
        x: (set[data.user].x + data.x),
        y: (set[data.user].y + data.y),
        t: data.t,
        user: data.user,
      };

      // share this updated shape with the room
      io.sockets.in('room1').emit('serveShape', set[data.user]);
    }
  });

  socket.on('draw', (data) => {
    socket.broadcast.to('room1').emit('serveDraw', data);
  });
};

// disconnect logic, removes users from room1
const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    console.log(`${socket.userId} disconnecting from server...`);

    set[socket.userId] = null;
    io.sockets.in('room1').emit('serveRemoveShape', socket.userId);

    // leave the room
    socket.leave('room1');
  });
};

// connect logic, attaches events
io.sockets.on('connection', (socket) => {
  console.log('connecting');

  onJoined(socket);
  onShapeRequest(socket);
  onDisconnect(socket);
});

console.log('Websocket server started');
