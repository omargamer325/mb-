const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'chess-data.json');

function loadDb() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return { users: [], games: [], nextUserId: 1, nextGameId: 1 };
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

const INITIAL_BOARD = JSON.stringify([
  ['r','n','b','q','k','b','n','r'],
  ['p','p','p','p','p','p','p','p'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['P','P','P','P','P','P','P','P'],
  ['R','N','B','Q','K','B','N','R']
]);

module.exports = {
  createUser(username, password_hash) {
    const db = loadDb();
    const user = { id: db.nextUserId++, username, password_hash, elo: 1200, created_at: new Date().toISOString() };
    db.users.push(user);
    saveDb(db);
    return { id: user.id, username, elo: 1200 };
  },
  
  getUserById(id) {
    const db = loadDb();
    const user = db.users.find(u => u.id === id);
    if (!user) return null;
    return { id: user.id, username: user.username, elo: user.elo };
  },
  
  getUserByUsername(username) {
    const db = loadDb();
    return db.users.find(u => u.username === username) || null;
  },
  
  createGame(whiteId, blackId) {
    const db = loadDb();
    const id = db.nextGameId++;
    db.games.push({ id, white_id: whiteId, black_id: blackId, board_state: INITIAL_BOARD, status: 'active' });
    saveDb(db);
    return id;
  },
  
  getGame(id) {
    const db = loadDb();
    return db.games.find(g => g.id === id) || null;
  },
  
  updateGame(id, data) {
    const db = loadDb();
    const game = db.games.find(g => g.id === id);
    if (game) Object.assign(game, data);
    saveDb(db);
  },
  
  updateElo(userId, delta) {
    const db = loadDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) return;
    user.elo = Math.max(100, Math.min(3000, (user.elo || 1200) + delta));
    saveDb(db);
  }
};
