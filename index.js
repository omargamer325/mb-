const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const gameManager = require('./gameManager');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => res.redirect('/index.html'));

// Game manager handles matchmaking and games
gameManager.init(io);

io.on('connection', (socket) => {
  gameManager.handleConnection(socket);
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Chess Online running on port ${PORT}`);
});
