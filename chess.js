// Chess Board View - Shared chess display logic
const PIECES = {
    white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
    black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
};

const PIECE_NAMES = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];

const INITIAL_BOARD = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

function getPieceDisplay(piece) {
    if (!piece) return '';
    const color = piece === piece.toUpperCase() ? 'white' : 'black';
    const type = PIECE_NAMES[['k', 'q', 'r', 'b', 'n', 'p'].indexOf(piece.toLowerCase())];
    return PIECES[color][type];
}

function getPieceColor(piece) {
    if (!piece) return null;
    return piece === piece.toUpperCase() ? 'white' : 'black';
}

// Chess board renderer - works with game state from server or local
class ChessBoardView {
    constructor(options = {}) {
        this.board = options.board ? options.board.map(r => [...r]) : INITIAL_BOARD.map(r => [...r]);
        this.selectedSquare = null;
        this.validMoves = [];
        this.turn = options.turn || 'white';
        this.moveHistory = options.moveHistory || [];
        this.capturedPieces = options.capturedPieces || { white: [], black: [] };
        this.lastMove = options.lastMove || null;
        this.checkStatus = options.checkStatus || null;
        this.gameOver = options.gameOver || false;
        this.onMove = options.onMove || null;
        this.myColor = options.myColor || null;
        this.kingMoved = { white: false, black: false };
        this.rookMoved = { white: { left: false, right: false }, black: { left: false, right: false } };
        this.enPassantTarget = options.enPassantTarget || null;
    }

    setState(state) {
        this.board = state.board ? state.board.map(r => [...r]) : this.board;
        this.turn = state.turn ?? this.turn;
        this.capturedPieces = state.captured || this.capturedPieces;
        this.lastMove = state.lastMove ?? this.lastMove;
        this.checkStatus = state.checkStatus ?? this.checkStatus;
        this.gameOver = state.status !== 'active' && state.status !== undefined;
    }

    updateBoard(board) {
        this.board = board.map(r => [...r]);
    }

    canPlay() {
        if (this.gameOver) return false;
        if (!this.myColor) return true;
        return this.turn === this.myColor;
    }

    getLegalMoves(row, col) {
        const piece = this.board[row]?.[col];
        if (!piece) return [];
        const color = getPieceColor(piece);
        if (color !== this.turn) return [];
        const type = piece.toLowerCase();
        let moves = [];
        const dir = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        switch (type) {
            case 'p':
                const nr = row + dir;
                if (nr >= 0 && nr < 8 && !this.board[nr][col]) {
                    moves.push({ row: nr, col });
                    if (row === startRow && !this.board[nr + dir][col]) moves.push({ row: nr + dir, col });
                }
                for (const dc of [-1, 1]) {
                    if (col + dc >= 0 && col + dc < 8) {
                        if (this.board[nr]?.[col + dc] && getPieceColor(this.board[nr][col + dc]) !== color)
                            moves.push({ row: nr, col: col + dc });
                        if (this.enPassantTarget && this.enPassantTarget.row === nr && this.enPassantTarget.col === col + dc)
                            moves.push({ row: nr, col: col + dc, enPassant: true });
                    }
                }
                break;
            case 'r':
                for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                    let r = row + dr, c = col + dc;
                    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        moves.push({ row: r, col: c });
                        if (this.board[r][c]) break;
                        r += dr; c += dc;
                    }
                }
                break;
            case 'n':
                for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
                    const r = row + dr, c = col + dc;
                    if (r >= 0 && r < 8 && c >= 0 && c < 8 && getPieceColor(this.board[r]?.[c]) !== color)
                        moves.push({ row: r, col: c });
                }
                break;
            case 'b':
            case 'q':
                const dirs = type === 'q' ? [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]] : [[1,1],[1,-1],[-1,1],[-1,-1]];
                for (const [dr, dc] of dirs) {
                    let r = row + dr, c = col + dc;
                    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        moves.push({ row: r, col: c });
                        if (this.board[r][c]) break;
                        r += dr; c += dc;
                    }
                }
                break;
            case 'k':
                for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++)
                    if ((dr || dc) && row + dr >= 0 && row + dr < 8 && col + dc >= 0 && col + dc < 8 && getPieceColor(this.board[row + dr]?.[col + dc]) !== color)
                        moves.push({ row: row + dr, col: col + dc });
                const kingRow = color === 'white' ? 7 : 0;
                if (row === kingRow && col === 4 && !this.kingMoved[color]) {
                    if (!this.rookMoved[color].right && !this.board[kingRow][5] && !this.board[kingRow][6])
                        moves.push({ row: kingRow, col: 6, castling: 'kingside' });
                    if (!this.rookMoved[color].left && !this.board[kingRow][1] && !this.board[kingRow][2] && !this.board[kingRow][3])
                        moves.push({ row: kingRow, col: 2, castling: 'queenside' });
                }
                break;
        }
        return moves.filter(m => !this.wouldBeInCheck(row, col, m.row, m.col));
    }

    wouldBeInCheck(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const captured = this.board[toRow]?.[toCol];
        const color = getPieceColor(piece);
        this.board[toRow] = [...(this.board[toRow] || [])];
        this.board[toRow][toCol] = piece;
        this.board[fromRow] = [...this.board[fromRow]];
        this.board[fromRow][fromCol] = '';
        const inCheck = this.isKingInCheck(color);
        this.board[fromRow][fromCol] = piece;
        this.board[toRow][toCol] = captured;
        return inCheck;
    }

    isKingInCheck(color) {
        let kingPos = null;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
            if (this.board[r]?.[c]?.toLowerCase() === 'k' && getPieceColor(this.board[r][c]) === color) { kingPos = { r, c }; break; }
        if (!kingPos) return false;
        const opp = color === 'white' ? 'black' : 'white';
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const p = this.board[r]?.[c];
            if (p && getPieceColor(p) === opp) {
                const moves = this.getRawMoves(r, c);
                if (moves.some(m => m.row === kingPos.r && m.col === kingPos.c)) return true;
            }
        }
        return false;
    }

    getRawMoves(row, col) {
        const piece = this.board[row]?.[col];
        if (!piece) return [];
        const color = getPieceColor(piece);
        const moves = [];
        const dir = color === 'white' ? -1 : 1;
        switch (piece.toLowerCase()) {
            case 'p':
                if (!this.board[row + dir]?.[col]) moves.push({ row: row + dir, col });
                for (const dc of [-1, 1])
                    if (this.board[row + dir]?.[col + dc]) moves.push({ row: row + dir, col: col + dc });
                break;
            case 'r':
                for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                    let r = row + dr, c = col + dc;
                    while (r >= 0 && r < 8 && c >= 0 && c < 8) { moves.push({ row: r, col: c }); if (this.board[r][c]) break; r += dr; c += dc; }
                }
                break;
            case 'n':
                for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
                    const r = row + dr, c = col + dc;
                    if (r >= 0 && r < 8 && c >= 0 && c < 8) moves.push({ row: r, col: c });
                }
                break;
            case 'b':
            case 'q':
                const dirs = piece.toLowerCase() === 'q' ? [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]] : [[1,1],[1,-1],[-1,1],[-1,-1]];
                for (const [dr, dc] of dirs) {
                    let r = row + dr, c = col + dc;
                    while (r >= 0 && r < 8 && c >= 0 && c < 8) { moves.push({ row: r, col: c }); if (this.board[r][c]) break; r += dr; c += dc; }
                }
                break;
            case 'k':
                for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++)
                    if ((dr || dc) && row + dr >= 0 && row + dr < 8 && col + dc >= 0 && col + dc < 8) moves.push({ row: row + dr, col: col + dc });
                break;
        }
        return moves;
    }

    handleSquareClick(row, col) {
        if (!this.canPlay() || !this.onMove) return;
        row = parseInt(row); col = parseInt(col);
        const piece = this.board[row]?.[col];
        const isValidMove = this.validMoves.find(m => m.row === row && m.col === col);
        if (isValidMove && this.selectedSquare) {
            this.onMove(this.selectedSquare, { row, col }, isValidMove);
            this.selectedSquare = null;
            this.validMoves = [];
        } else if (piece && getPieceColor(piece) === this.turn) {
            this.selectedSquare = { row, col };
            this.validMoves = this.getLegalMoves(row, col);
        } else {
            this.selectedSquare = null;
            this.validMoves = [];
        }
        this.render();
    }

    render() {
        const boardEl = document.getElementById('chessBoard');
        if (!boardEl) return;

        boardEl.innerHTML = '';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;

                const piece = this.board[row][col];
                if (piece) {
                    const pieceSpan = document.createElement('span');
                    pieceSpan.className = `piece ${getPieceColor(piece)}`;
                    pieceSpan.textContent = getPieceDisplay(piece);
                    square.appendChild(pieceSpan);
                }

                if (this.lastMove &&
                    ((this.lastMove.from?.row === row && this.lastMove.from?.col === col) ||
                     (this.lastMove.to?.row === row && this.lastMove.to?.col === col))) {
                    square.classList.add('last-move');
                }

                if (this.checkStatus && piece && piece.toLowerCase() === 'k') {
                    const color = getPieceColor(piece);
                    if ((color === 'white' && this.checkStatus === 'white') ||
                        (color === 'black' && this.checkStatus === 'black')) {
                        square.classList.add('check');
                    }
                }

                if (this.selectedSquare && this.selectedSquare.row === row && this.selectedSquare.col === col) {
                    square.classList.add('selected');
                }

                if (this.validMoves.some(m => m.row === row && m.col === col)) {
                    const targetPiece = this.board[row][col];
                    square.classList.add(targetPiece ? 'valid-capture' : 'valid-move');
                }

                boardEl.appendChild(square);
            }
        }
    }

    updateUI() {
        const turnEl = document.getElementById('turnIndicator');
        const statusEl = document.getElementById('gameStatus');
        const capturedBlack = document.getElementById('capturedBlack');
        const capturedWhite = document.getElementById('capturedWhite');
        const movesList = document.getElementById('movesList');

        if (turnEl) {
            turnEl.textContent = this.gameOver
                ? (this.checkStatus ? `كش ملك! فوز ${this.checkStatus === 'white' ? 'الأسود' : 'الأبيض'}` : 'تعادل')
                : `دور ${this.turn === 'white' ? 'الأبيض' : 'الأسود'}`;
        }
        if (statusEl) {
            statusEl.textContent = this.gameOver
                ? (this.checkStatus ? 'انتهت اللعبة - كش ملك' : 'تعادل')
                : (this.checkStatus ? 'كش!' : 'جاري اللعب');
        }
        if (capturedBlack) capturedBlack.textContent = this.capturedPieces.black?.map(getPieceDisplay).join(' ') || '';
        if (capturedWhite) capturedWhite.textContent = this.capturedPieces.white?.map(getPieceDisplay).join(' ') || '';
        if (movesList) {
            movesList.innerHTML = '';
            this.moveHistory.forEach((move, i) => {
                const div = document.createElement('div');
                div.className = 'move-item';
                const from = String.fromCharCode(97 + move.from.col) + (8 - move.from.row);
                const to = String.fromCharCode(97 + move.to.col) + (8 - move.to.row);
                div.textContent = `${i + 1}. ${from} → ${to}`;
                movesList.appendChild(div);
            });
        }
    }
}

// Export for use in app.js
window.ChessBoardView = ChessBoardView;
window.getPieceDisplay = getPieceDisplay;
window.getPieceColor = getPieceColor;
window.INITIAL_BOARD = INITIAL_BOARD;
