// Main app - Online Chess
const API_URL = window.location.origin;

function getToken() { return localStorage.getItem('chess_token'); }
function getUser() {
  const u = localStorage.getItem('chess_user');
  return u ? JSON.parse(u) : null;
}

// Auth check - redirect to login if not authenticated
function checkAuth() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;

  const user = getUser();
  const lobbyView = document.getElementById('lobbyView');
  const gameView = document.getElementById('gameView');

  if (!lobbyView) return;

  document.getElementById('displayUsername').textContent = user?.username || 'لاعب';
  document.getElementById('eloBadge').textContent = user?.elo || 1200;

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('chess_token');
    localStorage.removeItem('chess_user');
    window.location.href = '/login.html';
  });

  const socket = io({ auth: {} });

  socket.on('connect', () => {
    socket.emit('authenticate', { token: getToken() });
  });

  socket.on('authenticated', () => {
    document.getElementById('onlineCount').textContent = 'متصل';
  });

  socket.on('auth_error', (data) => {
    alert(data.message || 'خطأ في المصادقة');
    window.location.href = '/login.html';
  });

  // Lobby
  const findGameBtn = document.getElementById('findGameBtn');
  const queueStatus = document.getElementById('queueStatus');
  const cancelQueueBtn = document.getElementById('cancelQueueBtn');

  findGameBtn?.addEventListener('click', () => {
    socket.emit('join_queue');
    findGameBtn.style.display = 'none';
    queueStatus?.classList.remove('hidden');
  });

  cancelQueueBtn?.addEventListener('click', () => {
    socket.emit('leave_queue');
    findGameBtn.style.display = 'block';
    queueStatus?.classList.add('hidden');
  });

  socket.on('queue_joined', (data) => {
    console.log('In queue', data);
  });

  socket.on('queue_left', () => {
    findGameBtn.style.display = 'block';
    queueStatus?.classList.add('hidden');
  });

  let chessView = null;
  let currentGame = null;

  socket.on('game_found', (data) => {
    findGameBtn.style.display = 'block';
    queueStatus?.classList.add('hidden');

    currentGame = {
      gameId: data.gameId,
      myColor: data.color,
      opponent: data.opponent,
      whiteName: data.color === 'white' ? user?.username : data.opponent?.username,
      blackName: data.color === 'black' ? user?.username : data.opponent?.username
    };

    lobbyView.classList.add('hidden');
    gameView.classList.remove('hidden');

    document.getElementById('whitePlayerName').textContent = currentGame.whiteName || 'الأبيض';
    document.getElementById('blackPlayerName').textContent = currentGame.blackName || 'الأسود';

    chessView = new ChessBoardView({
      board: data.board,
      turn: 'white',
      myColor: data.color,
      moveHistory: [],
      capturedPieces: { white: [], black: [] },
      onMove: (from, to, moveData) => {
        socket.emit('move', {
          gameId: currentGame.gameId,
          from: { row: from.row, col: from.col },
          to: { row: to.row, col: to.col },
          moveData: moveData || {}
        });
      }
    });
    chessView.render();
    chessView.updateUI();
    attachBoardClick(chessView);
  });

  socket.on('game_state', (data) => {
    if (!chessView) return;
    chessView.setState({
      board: data.board,
      turn: data.turn,
      lastMove: data.lastMove,
      checkStatus: data.checkStatus,
      status: data.status,
      captured: data.captured
    });
    chessView.capturedPieces = data.captured || chessView.capturedPieces;
    chessView.gameOver = data.status !== 'active';
    chessView.render();
    chessView.updateUI();
  });

  socket.on('game_over', (data) => {
    if (chessView) chessView.gameOver = true;
    const modal = document.getElementById('gameOverModal');
    const title = document.getElementById('gameOverTitle');
    const msg = document.getElementById('gameOverMessage');
    if (modal) {
      title.textContent = 'انتهت المباراة';
      const winnerName = data.winner === 'white' ? currentGame?.whiteName : currentGame?.blackName;
      msg.textContent = `${data.reason || ''} - الفائز: ${winnerName || data.winner}`;
      modal.classList.remove('hidden');
    }
  });

  document.getElementById('resignBtn')?.addEventListener('click', () => {
    if (currentGame?.gameId) socket.emit('resign', { gameId: currentGame.gameId });
  });

  document.getElementById('playAgainBtn')?.addEventListener('click', () => {
    document.getElementById('gameOverModal')?.classList.add('hidden');
    lobbyView.classList.remove('hidden');
    gameView.classList.add('hidden');
    currentGame = null;
    chessView = null;
  });

  document.getElementById('backToLobbyBtn')?.addEventListener('click', () => {
    if (confirm('هل تريد الاستسلام والعودة للوبي؟') && currentGame?.gameId) {
      socket.emit('resign', { gameId: currentGame.gameId });
    }
    document.getElementById('gameOverModal')?.classList.add('hidden');
    lobbyView.classList.remove('hidden');
    gameView.classList.add('hidden');
    currentGame = null;
    chessView = null;
  });

  function attachBoardClick(view) {
    const board = document.getElementById('chessBoard');
    if (!board) return;

    board.onclick = (e) => {
      const square = e.target.closest('.square');
      if (!square || !view) return;

      const row = parseInt(square.dataset.row);
      const col = parseInt(square.dataset.col);
      view.handleSquareClick(row, col);
    };
  }
});

// ChessBoardView needs getLegalMoves - we need to add that to chess.js
// The server validates moves, so client can use simple move validation for highlighting
// Let me add getLegalMoves to ChessBoardView - actually the ChessBoardView in chess.js
// doesn't have getLegalMoves or handleSquareClick. The server does validation.
// So we need: 1) Client sends intended move to server 2) Server validates and broadcasts
// For client-side highlighting of valid moves, we need the chess logic. Let me add a
// simplified version that fetches valid moves - or we could just let user click any square
// and server rejects invalid moves. Simpler: add full chess logic to ChessBoardView for
// computing valid moves for highlighting. I'll need to include the move logic in chess.js.
