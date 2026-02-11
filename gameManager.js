const jwt = require('jsonwebtoken');
const db = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'chess-online-secret-key-2024';

const INITIAL_BOARD = [
  ['r','n','b','q','k','b','n','r'],
  ['p','p','p','p','p','p','p','p'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['P','P','P','P','P','P','P','P'],
  ['R','N','B','Q','K','B','N','R']
];

class GameManager {
  constructor() {
    this.io = null;
    this.matchmakingQueue = [];
    this.games = new Map();
  }

  init(io) {
    this.io = io;
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }
  }

  handleConnection(socket) {
    socket.on('authenticate', (data) => {
      const decoded = this.verifyToken(data?.token);
      if (!decoded) {
        socket.emit('auth_error', { message: 'تسجيل الدخول مطلوب' });
        return;
      }
      socket.userId = decoded.id;
      socket.username = decoded.username;
      socket.emit('authenticated', { username: socket.username });
    });

    socket.on('join_queue', () => {
      if (!socket.userId) return socket.emit('auth_error', { message: 'تسجيل الدخول مطلوب' });
      if (this.matchmakingQueue.find(p => p.id === socket.id)) return;
      
      this.matchmakingQueue.push({
        id: socket.id,
        userId: socket.userId,
        username: socket.username
      });
      socket.emit('queue_joined', { waiting: this.matchmakingQueue.length });
      
      this.tryMatchmaking();
    });

    socket.on('leave_queue', () => {
      this.matchmakingQueue = this.matchmakingQueue.filter(p => p.id !== socket.id);
      socket.emit('queue_left');
    });

    socket.on('move', (data) => {
      const { gameId, from, to, moveData } = data;
      const game = this.games.get(gameId);
      if (!game) return;
      
      const playerColor = game.whiteId === socket.userId ? 'white' : 
                         game.blackId === socket.userId ? 'black' : null;
      if (!playerColor || game.turn !== playerColor || game.status !== 'active') return;
      
      const validMove = this.validateAndApplyMove(game, from, to, moveData);
      if (!validMove) return;
      
      const opponentId = playerColor === 'white' ? game.blackId : game.whiteId;
      const whiteSocket = this.getSocketByUserId(game.whiteId);
      const blackSocket = this.getSocketByUserId(game.blackId);
      
      [whiteSocket, blackSocket].forEach(s => {
        if (s) s.emit('game_state', {
          board: game.board,
          turn: game.turn,
          lastMove: { from, to },
          checkStatus: game.checkStatus,
          status: game.status,
          winner: game.winner,
          captured: { white: game.capturedWhite, black: game.capturedBlack }
        });
      });
      
      if (game.status !== 'active') {
        this.finishGame(gameId);
      }
    });

    socket.on('resign', (data) => {
      const { gameId } = data;
      const game = this.games.get(gameId);
      if (!game) return;
      if (game.whiteId !== socket.userId && game.blackId !== socket.userId) return;
      
      const winner = game.whiteId === socket.userId ? 'black' : 'white';
      game.status = 'resigned';
      game.winner = winner;
      this.finishGame(gameId);
      
      const whiteSocket = this.getSocketByUserId(game.whiteId);
      const blackSocket = this.getSocketByUserId(game.blackId);
      [whiteSocket, blackSocket].forEach(s => {
        if (s) s.emit('game_over', { winner, reason: 'استسلام' });
      });
    });

    socket.on('disconnect', () => {
      this.matchmakingQueue = this.matchmakingQueue.filter(p => p.id !== socket.id);
      const gameId = this.getUserGame(socket.userId);
      if (gameId) {
        const game = this.games.get(gameId);
        if (game && game.status === 'active') {
          const opponentId = game.whiteId === socket.userId ? game.blackId : game.whiteId;
          game.status = 'disconnect';
          game.winner = opponentId === game.whiteId ? 'white' : 'black';
          const oppSocket = this.getSocketByUserId(opponentId);
          if (oppSocket) oppSocket.emit('game_over', { winner: game.winner, reason: 'الخصم غادر' });
          this.finishGame(gameId);
        }
      }
    });
  }

  getSocketByUserId(userId) {
    const sockets = Array.from(this.io?.sockets?.sockets?.values() || []);
    return sockets.find(s => s.userId === userId);
  }

  tryMatchmaking() {
    while (this.matchmakingQueue.length >= 2) {
      const p1 = this.matchmakingQueue.shift();
      const p2 = this.matchmakingQueue.shift();
      const gameId = this.createGame(p1, p2);
      
      const s1 = this.io.sockets.sockets.get(p1.id);
      const s2 = this.io.sockets.sockets.get(p2.id);
      
      if (s1) {
        s1.emit('game_found', {
          gameId,
          color: 'white',
          opponent: { username: p2.username },
          board: INITIAL_BOARD
        });
        s1.join(`game-${gameId}`);
      }
      if (s2) {
        s2.emit('game_found', {
          gameId,
          color: 'black',
          opponent: { username: p1.username },
          board: INITIAL_BOARD
        });
        s2.join(`game-${gameId}`);
      }
    }
  }

  createGame(p1, p2) {
    const gameId = db.createGame(p1.userId, p2.userId);
    this.games.set(gameId, {
      id: gameId,
      whiteId: p1.userId,
      blackId: p2.userId,
      whiteName: p1.username,
      blackName: p2.username,
      board: INITIAL_BOARD.map(r => [...r]),
      turn: 'white',
      moveHistory: [],
      capturedWhite: [],
      capturedBlack: [],
      checkStatus: null,
      status: 'active',
      winner: null,
      kingMoved: { white: false, black: false },
      rookMoved: { white: { left: false, right: false }, black: { left: false, right: false } },
      enPassantTarget: null
    });
    return gameId;
  }

  getUserGame(userId) {
    for (const [id, game] of this.games) {
      if ((game.whiteId === userId || game.blackId === userId) && game.status === 'active') {
        return id;
      }
    }
    return null;
  }

  validateAndApplyMove(game, from, to, moveData) {
    const { row: fr, col: fc } = from;
    const { row: tr, col: tc } = to;
    const piece = game.board[fr]?.[fc];
    if (!piece) return false;
    
    const color = piece === piece.toUpperCase() ? 'white' : 'black';
    if (game.turn !== color) return false;
    
    const targetPiece = game.board[tr]?.[tc];
    if (targetPiece && this.getPieceColor(targetPiece) === color) return false;
    
    game.board[tr] = [...game.board[tr]];
    game.board[tr][tc] = piece;
    game.board[fr] = [...game.board[fr]];
    game.board[fr][fc] = '';
    
    if (moveData?.enPassant && game.enPassantTarget) {
      const epRow = color === 'white' ? tr + 1 : tr - 1;
      const captured = game.board[epRow]?.[tc];
      if (captured) {
        game.board[epRow] = [...game.board[epRow]];
        game.board[epRow][tc] = '';
        game.capturedWhite.push(captured);
      }
    } else if (targetPiece) {
      (color === 'white' ? game.capturedWhite : game.capturedBlack).push(targetPiece);
    }
    
    if (moveData?.castling) {
      const kingRow = color === 'white' ? 7 : 0;
      if (moveData.castling === 'kingside') {
        game.board[kingRow][5] = color === 'white' ? 'R' : 'r';
        game.board[kingRow][7] = '';
      } else {
        game.board[kingRow][3] = color === 'white' ? 'R' : 'r';
        game.board[kingRow][0] = '';
      }
    }
    
    if (piece.toLowerCase() === 'p' && (tr === 0 || tr === 7)) {
      game.board[tr][tc] = color === 'white' ? 'Q' : 'q';
    }
    
    game.enPassantTarget = null;
    if (piece.toLowerCase() === 'p' && Math.abs(fr - tr) === 2) {
      game.enPassantTarget = { row: (fr + tr) / 2, col: tc };
    }
    
    if (piece.toLowerCase() === 'k') game.kingMoved[color] = true;
    if (piece.toLowerCase() === 'r') {
      if (fc === 0) game.rookMoved[color].left = true;
      if (fc === 7) game.rookMoved[color].right = true;
    }
    
    game.turn = color === 'white' ? 'black' : 'white';
    game.checkStatus = this.isKingInCheck(game, game.turn) ? game.turn : null;
    
    if (game.checkStatus && this.isCheckmate(game)) {
      game.status = 'checkmate';
      game.winner = game.turn === 'white' ? 'black' : 'white';
    } else if (!game.checkStatus && this.isStalemate(game)) {
      game.status = 'stalemate';
    }
    
    return true;
  }

  getPieceColor(piece) {
    return piece === piece.toUpperCase() ? 'white' : 'black';
  }

  isKingInCheck(game, color) {
    let kingPos = null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = game.board[r][c];
        if (p && p.toLowerCase() === 'k' && this.getPieceColor(p) === color) {
          kingPos = { r, c };
          break;
        }
      }
      if (kingPos) break;
    }
    if (!kingPos) return false;
    const opp = color === 'white' ? 'black' : 'white';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = game.board[r][c];
        if (p && this.getPieceColor(p) === opp) {
          const moves = this.getRawMoves(game, r, c);
          if (moves.some(m => m.row === kingPos.r && m.col === kingPos.c)) return true;
        }
      }
    }
    return false;
  }

  getRawMoves(game, row, col) {
    const piece = game.board[row]?.[col];
    if (!piece) return [];
    const moves = [];
    const color = this.getPieceColor(piece);
    const dir = color === 'white' ? -1 : 1;
    
    switch (piece.toLowerCase()) {
      case 'p':
        if (!game.board[row + dir]?.[col]) moves.push({ row: row + dir, col });
        if (row === (color === 'white' ? 6 : 1) && !game.board[row + dir]?.[col] && !game.board[row + 2*dir]?.[col])
          moves.push({ row: row + 2*dir, col });
        for (const dc of [-1, 1]) {
          if (game.board[row + dir]?.[col + dc]) moves.push({ row: row + dir, col: col + dc });
        }
        break;
      case 'r':
        for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          let nr = row + dr, nc = col + dc;
          while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            moves.push({ row: nr, col: nc });
            if (game.board[nr][nc]) break;
            nr += dr; nc += dc;
          }
        }
        break;
      case 'n':
        for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
          const nr = row + dr, nc = col + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && this.getPieceColor(game.board[nr]?.[nc] || '') !== color)
            moves.push({ row: nr, col: nc });
        }
        break;
      case 'b':
      case 'q':
        const dirs = piece.toLowerCase() === 'q' ? 
          [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]] : 
          [[1,1],[1,-1],[-1,1],[-1,-1]];
        for (const [dr, dc] of dirs) {
          let nr = row + dr, nc = col + dc;
          while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            moves.push({ row: nr, col: nc });
            if (game.board[nr][nc]) break;
            nr += dr; nc += dc;
          }
        }
        break;
      case 'k':
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++)
            if (dr || dc) {
              const nr = row + dr, nc = col + dc;
              if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && this.getPieceColor(game.board[nr]?.[nc] || '') !== color)
                moves.push({ row: nr, col: nc });
            }
        break;
    }
    return moves;
  }

  isCheckmate(game) {
    const color = game.turn;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = game.board[r][c];
        if (p && this.getPieceColor(p) === color) {
          const moves = this.getRawMoves(game, r, c);
          for (const m of moves) {
            const orig = game.board[m.row][m.col];
            game.board[m.row] = [...game.board[m.row]];
            game.board[m.row][m.col] = p;
            game.board[r] = [...game.board[r]];
            game.board[r][c] = '';
            const stillCheck = this.isKingInCheck(game, color);
            game.board[r][c] = p;
            game.board[m.row][m.col] = orig;
            if (!stillCheck) return false;
          }
        }
      }
    return true;
  }

  isStalemate(game) {
    if (game.checkStatus) return false;
    const color = game.turn;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = game.board[r][c];
        if (p && this.getPieceColor(p) === color) {
          const moves = this.getRawMoves(game, r, c);
          if (moves.length > 0) return false;
        }
      }
    return true;
  }

  finishGame(gameId) {
    const game = this.games.get(gameId);
    if (game && game.winner && game.status !== 'stalemate') {
      const winnerId = game.winner === 'white' ? game.whiteId : game.blackId;
      const loserId = game.winner === 'white' ? game.blackId : game.whiteId;
      db.updateElo(winnerId, 15);
      db.updateElo(loserId, -15);
    }
    this.games.delete(gameId);
  }
}

module.exports = new GameManager();
