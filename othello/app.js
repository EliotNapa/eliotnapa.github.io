// --- 音響効果合成 (Web Audio API) ---
const SoundEffects = {
  ctx: null,
  enabled: true,

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  playPlace() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  },

  playFlip() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(130, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  },

  playPass() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [0, 0.12].forEach((delay) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now + delay);
      gain.gain.setValueAtTime(0.08, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.1);
    });
  },

  playWin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 (C Major)
    notes.forEach((freq, idx) => {
      const delay = idx * 0.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0.15, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.4);
    });
  },

  playLose() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [220.00, 207.65, 196.00, 164.81]; // A3, Ab3, G3, E3
    notes.forEach((freq, idx) => {
      const delay = idx * 0.15;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0.08, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.45);
    });
  }
};

// --- ゲームロジック変数 ---
let board = [];
let currentPlayer = 1; // 1 = プレイヤー(黒), -1 = CPU(白)
let difficulty = 2; // 1 = イージー, 2 = ノーマル, 3 = ハード
let gameActive = true;
let isCpuThinking = false;
let turnCount = 1;

// 履歴管理 (Undo / Redo 用)
let history = [];
let historyIndex = -1;

// 戦績記録
let stats = {
  1: { win: 0, lose: 0, draw: 0 }, // Easy
  2: { win: 0, lose: 0, draw: 0 }, // Medium
  3: { win: 0, lose: 0, draw: 0 }  // Hard
};

// 方向ベクトル（8方向）
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

// 評価テーブル (AI用)
const EVAL_MATRIX = [
  [120, -30,  20,   5,   5,  20, -30, 120],
  [-30, -50,  -5,  -5,  -5,  -5, -50, -30],
  [ 20,  -5,  15,   3,   3,  15,  -5,  20],
  [  5,  -5,   3,   3,   3,   3,  -5,   5],
  [  5,  -5,   3,   3,   3,   3,  -5,   5],
  [ 20,  -5,  15,   3,   3,  15,  -5,  20],
  [-30, -50,  -5,  -5,  -5,  -5, -50, -30],
  [120, -30,  20,   5,   5,  20, -30, 120]
];

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  initBoardDOM();
  setupEventListeners();
  startNewGame();
});

// 8x8のボードセルをDOMに生成
function initBoardDOM() {
  const othelloBoard = document.getElementById('othelloBoard');
  othelloBoard.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement('div');
      cell.className = 'board-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      othelloBoard.appendChild(cell);
    }
  }
}

// イベントリスナー設定
function setupEventListeners() {
  // セルクリック
  document.getElementById('othelloBoard').addEventListener('click', (e) => {
    const cell = e.target.closest('.board-cell');
    if (!cell) return;
    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    handleCellClick(r, c);
  });

  // サウンドトグル
  document.getElementById('soundToggleBtn').addEventListener('click', () => {
    SoundEffects.enabled = !SoundEffects.enabled;
    const btnText = document.getElementById('soundToggleBtn').querySelectorAll('span');
    btnText[0].textContent = SoundEffects.enabled ? '🔊' : '🔇';
    btnText[1].textContent = SoundEffects.enabled ? 'サウンド: ON' : 'サウンド: OFF';
    SoundEffects.init();
  });

  // ヘルプモーダル関連
  document.getElementById('rulesBtn').addEventListener('click', () => {
    document.getElementById('rulesModal').classList.add('active');
    SoundEffects.init();
  });
  document.getElementById('closeRulesBtn').addEventListener('click', () => {
    document.getElementById('rulesModal').classList.remove('active');
  });
  document.getElementById('confirmRulesBtn').addEventListener('click', () => {
    document.getElementById('rulesModal').classList.remove('active');
  });

  // 難易度変更
  document.getElementById('difficultySelector').addEventListener('click', (e) => {
    const option = e.target.closest('.segmented-option');
    if (!option || isCpuThinking) return;
    
    // クラス切り替え
    document.querySelectorAll('#difficultySelector .segmented-option').forEach(el => {
      el.classList.remove('selected');
    });
    option.classList.add('selected');
    
    difficulty = parseInt(option.dataset.level);
    
    // CPUが手番なら、難易度変更後に思考を開始させる
    if (currentPlayer === -1 && gameActive) {
      triggerCpuTurn();
    }
  });

  // アクションボタン
  document.getElementById('undoBtn').addEventListener('click', handleUndo);
  document.getElementById('redoBtn').addEventListener('click', handleRedo);
  document.getElementById('restartBtn').addEventListener('click', startNewGame);
  document.getElementById('playAgainBtn').addEventListener('click', () => {
    document.getElementById('gameOverModal').classList.remove('active');
    startNewGame();
  });
  document.getElementById('clearStatsBtn').addEventListener('click', clearStats);
}

// 新規ゲーム開始
function startNewGame() {
  board = Array(8).fill(null).map(() => Array(8).fill(0));
  // 初期配置
  board[3][3] = -1; // 白
  board[3][4] = 1;  // 黒
  board[4][3] = 1;  // 黒
  board[4][4] = -1; // 白

  currentPlayer = 1; // プレイヤー(黒)から開始
  gameActive = true;
  isCpuThinking = false;
  turnCount = 1;

  history = [];
  historyIndex = -1;
  saveState();

  // モーダルを閉じる
  document.getElementById('gameOverModal').classList.remove('active');

  // UI更新
  document.getElementById('turnCountVal').textContent = turnCount;
  renderBoard();
  updateScores();
  updateControls();
}

// --- 盤面描画 & アニメーション ---

// 盤面全体の描画（同期）
function renderBoard() {
  const cells = document.querySelectorAll('.board-cell');
  const validMoves = getValidMoves(board, currentPlayer);
  const isHumanTurn = currentPlayer === 1 && !isCpuThinking && gameActive;

  cells.forEach(cell => {
    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    const val = board[r][c];

    // 有効な手のハイライト
    if (isHumanTurn && validMoves.some(m => m.r === r && m.c === c)) {
      cell.classList.add('valid-move');
    } else {
      cell.classList.remove('valid-move');
    }

    // ディスクの描画
    let diskContainer = cell.querySelector('.disk-container');
    
    if (val === 0) {
      if (diskContainer) {
        cell.innerHTML = '';
      }
    } else {
      if (!diskContainer) {
        cell.innerHTML = `
          <div class="disk-container">
            <div class="disk ${val === 1 ? 'black-face' : 'white-face'}">
              <div class="disk-side front"></div>
              <div class="disk-side back"></div>
            </div>
          </div>
        `;
      } else {
        const disk = diskContainer.querySelector('.disk');
        if (val === 1 && disk.classList.contains('white-face')) {
          disk.classList.remove('white-face');
          disk.classList.add('black-face');
        } else if (val === -1 && disk.classList.contains('black-face')) {
          disk.classList.remove('black-face');
          disk.classList.add('white-face');
        }
      }
    }
  });

  updateStatusIndicator();
}

// 石の配置と反転エフェクトを伴う描画
function renderMoveVisual(placedRow, placedCol, flippedStones) {
  const cells = document.querySelectorAll('.board-cell');
  const isHumanTurn = currentPlayer === 1 && !isCpuThinking && gameActive;
  
  // 他のセルの有効手マークを一旦消す
  cells.forEach(c => c.classList.remove('valid-move'));

  // 1. 置いた位置に波紋エフェクト
  const targetCell = document.querySelector(`.board-cell[data-row="${placedRow}"][data-col="${placedCol}"]`);
  if (targetCell) {
    const ripple = document.createElement('div');
    ripple.className = 'cell-ripple';
    targetCell.appendChild(ripple);
    setTimeout(() => ripple.remove(), 400);

    // 置いた石を生成
    targetCell.innerHTML = `
      <div class="disk-container">
        <div class="disk ${currentPlayer === 1 ? 'black-face' : 'white-face'}">
          <div class="disk-side front"></div>
          <div class="disk-side back"></div>
        </div>
      </div>
    `;
  }

  // 2. 挟まれた石を波状にアニメーション（置いた石からの距離に応じてディレイをかける）
  flippedStones.forEach(([fr, fc]) => {
    const dist = Math.max(Math.abs(fr - placedRow), Math.abs(fc - placedCol));
    const delay = dist * 80; // 距離ごとに遅延を増やす

    setTimeout(() => {
      const cell = document.querySelector(`.board-cell[data-row="${fr}"][data-col="${fc}"]`);
      if (cell) {
        const disk = cell.querySelector('.disk');
        if (disk) {
          if (currentPlayer === 1) {
            disk.classList.remove('white-face');
            disk.classList.add('black-face');
          } else {
            disk.classList.remove('black-face');
            disk.classList.add('white-face');
          }
        }
      }
    }, delay);
  });
}

// ターン表示などのステータス更新
function updateStatusIndicator() {
  const pulseDot = document.getElementById('statusPulseDot');
  const textEl = document.getElementById('turnIndicatorText');
  const playerCard = document.getElementById('playerCard');
  const cpuCard = document.getElementById('cpuCard');

  // カードのアクティブクラスクリア
  playerCard.classList.remove('active-turn', 'cpu-turn');
  cpuCard.classList.remove('active-turn', 'cpu-turn');

  if (!gameActive) {
    pulseDot.style.display = 'none';
    textEl.textContent = '対局終了';
    return;
  }

  pulseDot.style.display = 'inline-block';

  if (currentPlayer === 1) {
    pulseDot.className = 'pulse-dot';
    textEl.textContent = 'あなたの番です (黒)';
    playerCard.classList.add('active-turn');
  } else {
    pulseDot.className = 'pulse-dot cpu-color';
    textEl.textContent = 'CPUが考え中... (白)';
    cpuCard.classList.add('active-turn', 'cpu-turn');
  }
}

// --- ゲームロジックコア ---

// 有効な手を取得する
function getValidMoves(targetBoard, color) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (targetBoard[r][c] !== 0) continue;
      const flipped = getFlippedStones(targetBoard, r, c, color);
      if (flipped.length > 0) {
        moves.push({ r, c, flipped });
      }
    }
  }
  return moves;
}

// 特定のマスに石を置いた場合に挟める敵石のリストを返す
function getFlippedStones(targetBoard, r, c, color) {
  const opponent = -color;
  const toFlip = [];

  for (const [dr, dc] of DIRECTIONS) {
    let currR = r + dr;
    let currC = c + dc;
    const path = [];

    // 隣が相手の石である限り進む
    while (currR >= 0 && currR < 8 && currC >= 0 && currC < 8 && targetBoard[currR][currC] === opponent) {
      path.push([currR, currC]);
      currR += dr;
      currC += dc;
    }

    // 自分の石で終わるなら反転対象に追加
    if (currR >= 0 && currR < 8 && currC >= 0 && currC < 8 && targetBoard[currR][currC] === color) {
      if (path.length > 0) {
        toFlip.push(...path);
      }
    }
  }

  return toFlip;
}

// セルクリック時の処理
function handleCellClick(r, c) {
  if (!gameActive || isCpuThinking || currentPlayer !== 1) return;

  const validMoves = getValidMoves(board, 1);
  const matchedMove = validMoves.find(m => m.r === r && m.c === c);

  if (!matchedMove) return;

  // 手番の進行
  isCpuThinking = true;
  executeMove(r, c, matchedMove.flipped);
}

// 石の配置の実行
function executeMove(r, c, flippedStones) {
  // メモリ上のボードを更新
  board[r][c] = currentPlayer;
  flippedStones.forEach(([fr, fc]) => {
    board[fr][fc] = currentPlayer;
  });

  // 音を出す
  SoundEffects.playPlace();
  if (flippedStones.length > 0) {
    setTimeout(() => SoundEffects.playFlip(), 80);
  }

  // アニメーション表示
  renderMoveVisual(r, c, flippedStones);
  updateScores();

  // アニメーション完了時間（最大距離のディレイ＋多少の余白）を考慮して次のターンへ
  const maxDist = flippedStones.reduce((max, [fr, fc]) => Math.max(max, Math.abs(fr - r), Math.abs(fc - c)), 1);
  const animationDuration = maxDist * 80 + 350;

  setTimeout(() => {
    isCpuThinking = false;
    processNextTurn();
  }, animationDuration);
}

// ターン切り替え処理
function processNextTurn() {
  currentPlayer = -currentPlayer;
  turnCount++;
  document.getElementById('turnCountVal').textContent = turnCount;

  saveState();

  const nextValidMoves = getValidMoves(board, currentPlayer);

  if (nextValidMoves.length === 0) {
    // 置ける手がない（パス）
    const otherPlayer = -currentPlayer;
    const otherValidMoves = getValidMoves(board, otherPlayer);

    if (otherValidMoves.length === 0) {
      // お互いに置く場所がないのでゲーム終了
      endGame();
    } else {
      // パス処理
      SoundEffects.playPass();
      
      const passedName = currentPlayer === 1 ? 'あなた' : 'CPU';
      const textEl = document.getElementById('turnIndicatorText');
      textEl.textContent = `${passedName}はパスします。`;

      setTimeout(() => {
        currentPlayer = otherPlayer;
        saveState();
        renderBoard();
        updateControls();
        
        if (currentPlayer === -1) {
          triggerCpuTurn();
        }
      }, 1500);
    }
  } else {
    renderBoard();
    updateControls();
    
    if (currentPlayer === -1) {
      triggerCpuTurn();
    }
  }
}

// CPUの着手発火
function triggerCpuTurn() {
  isCpuThinking = true;
  updateStatusIndicator();

  // CPUに人間のような「考える時間」の演出を与える (800ms)
  setTimeout(() => {
    if (!gameActive) return;
    
    const validMoves = getValidMoves(board, -1);
    if (validMoves.length === 0) {
      isCpuThinking = false;
      processNextTurn();
      return;
    }

    let selectedMove;
    if (difficulty === 1) {
      selectedMove = getCpuMoveEasy(validMoves);
    } else if (difficulty === 2) {
      selectedMove = getCpuMoveMedium(validMoves);
    } else {
      selectedMove = getCpuMoveHard(validMoves);
    }

    executeMove(selectedMove.r, selectedMove.c, selectedMove.flipped);
  }, 900);
}

// --- CPU AI 思考ロジック ---

// イージー：ランダム
function getCpuMoveEasy(validMoves) {
  const idx = Math.floor(Math.random() * validMoves.length);
  return validMoves[idx];
}

// ノーマル：貪欲法 + ポジション評価 (1手読み)
function getCpuMoveMedium(validMoves) {
  let bestScore = -Infinity;
  let bestMoves = [];

  for (const move of validMoves) {
    // 評価値 ＝ 置いたマスの基本評価 ＋ (ひっくり返す枚数 * 2)
    const baseWeight = EVAL_MATRIX[move.r][move.c];
    const score = baseWeight + (move.flipped.length * 2);

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  // 同率スコアの場合はランダム
  const idx = Math.floor(Math.random() * bestMoves.length);
  return bestMoves[idx];
}

// ハード：Minimax法 + αβ枝刈り + 先読み (深さ4-6) + 動的重み制御
function getCpuMoveHard(validMoves) {
  // 残り空きマス数
  let emptyCells = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === 0) emptyCells++;
    }
  }

  // 残りマスが少ない場合は読みの深さを自動で増やす (終盤は全探索に近い精度に)
  const depth = emptyCells <= 12 ? 6 : 4;
  
  let bestScore = -Infinity;
  let bestMoves = [];

  for (const move of validMoves) {
    // 一手進めた仮想盤面を作成
    const nextBoardState = makeMoveCopy(board, move.r, move.c, -1);
    
    // minimaxの評価を実行
    const evalScore = minimax(nextBoardState, depth - 1, -Infinity, Infinity, false, -1);

    if (evalScore > bestScore) {
      bestScore = evalScore;
      bestMoves = [move];
    } else if (evalScore === bestScore) {
      bestMoves.push(move);
    }
  }

  const idx = Math.floor(Math.random() * bestMoves.length);
  return bestMoves[idx];
}

// 仮想的に手を打つ
function makeMoveCopy(targetBoard, r, c, color) {
  const newBoard = targetBoard.map(row => [...row]);
  newBoard[r][c] = color;
  const flipped = getFlippedStones(newBoard, r, c, color);
  flipped.forEach(([fr, fc]) => {
    newBoard[fr][fc] = color;
  });
  return newBoard;
}

// 盤面評価関数
function evaluateBoard(targetBoard, aiColor) {
  const opponentColor = -aiColor;
  let myDisks = 0;
  let oppDisks = 0;
  let myWeight = 0;
  let oppWeight = 0;
  let emptyCount = 0;

  // 動的ウェイトマトリクス (角が取られたらその隣のペナルティをなくす)
  const currentWeights = EVAL_MATRIX.map(row => [...row]);
  
  const corners = [
    { r: 0, c: 0, adj: [[0, 1], [1, 0], [1, 1]] },
    { r: 0, c: 7, adj: [[0, 6], [1, 7], [1, 6]] },
    { r: 7, c: 0, adj: [[7, 1], [6, 0], [6, 1]] },
    { r: 7, c: 7, adj: [[7, 6], [6, 7], [6, 6]] }
  ];

  corners.forEach(corner => {
    if (targetBoard[corner.r][corner.c] !== 0) {
      // 角が埋まっている場合、その角の周囲マスのペナルティを中立化する
      corner.adj.forEach(([ar, ac]) => {
        currentWeights[ar][ac] = 5; 
      });
    }
  });

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const val = targetBoard[r][c];
      if (val === 0) {
        emptyCount++;
      } else if (val === aiColor) {
        myDisks++;
        myWeight += currentWeights[r][c];
      } else {
        oppDisks++;
        oppWeight += currentWeights[r][c];
      }
    }
  }

  // 終盤（空きマスが12マス以下）は枚数重視に切り替える
  if (emptyCount <= 12) {
    return (myDisks - oppDisks) * 100;
  }

  // 可動性（着手可能数）の計算
  const myMoves = getValidMoves(targetBoard, aiColor).length;
  const oppMoves = getValidMoves(targetBoard, opponentColor).length;
  
  let mobilityScore = 0;
  if (myMoves + oppMoves > 0) {
    mobilityScore = 100 * (myMoves - oppMoves) / (myMoves + oppMoves);
  }

  // 総合評価
  const weightScore = myWeight - oppWeight;
  
  return weightScore + (mobilityScore * 12);
}

// アルファ・ベータ探索木
function minimax(targetBoard, depth, alpha, beta, isMaximizing, aiColor) {
  const activeColor = isMaximizing ? aiColor : -aiColor;
  
  const validMoves = getValidMoves(targetBoard, activeColor);
  const isGameOver = getValidMoves(targetBoard, aiColor).length === 0 && getValidMoves(targetBoard, -aiColor).length === 0;

  if (depth === 0 || isGameOver) {
    return evaluateBoard(targetBoard, aiColor);
  }

  // パス処理
  if (validMoves.length === 0) {
    return minimax(targetBoard, depth - 1, alpha, beta, !isMaximizing, aiColor);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of validMoves) {
      const nextBoardState = makeMoveCopy(targetBoard, move.r, move.c, activeColor);
      const evalScore = minimax(nextBoardState, depth - 1, alpha, beta, false, aiColor);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break; // βカット
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of validMoves) {
      const nextBoardState = makeMoveCopy(targetBoard, move.r, move.c, activeColor);
      const evalScore = minimax(nextBoardState, depth - 1, alpha, beta, true, aiColor);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break; // αカット
    }
    return minEval;
  }
}

// --- ユーティリティ & UI表示制御 ---

// スコア再計算と表示
function updateScores() {
  let blackCount = 0;
  let whiteCount = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === 1) blackCount++;
      if (board[r][c] === -1) whiteCount++;
    }
  }

  document.getElementById('playerScore').textContent = blackCount;
  document.getElementById('cpuScore').textContent = whiteCount;
}

// 歴史のセーブ
function saveState() {
  // 現在の履歴ポインタ以降の履歴を削除し、新規状態を追加
  history = history.slice(0, historyIndex + 1);
  history.push({
    board: board.map(row => [...row]),
    currentPlayer: currentPlayer,
    turnCount: turnCount
  });
  historyIndex = history.length - 1;
}

// 履歴のロード
function restoreState(state) {
  board = state.board.map(row => [...row]);
  currentPlayer = state.currentPlayer;
  turnCount = state.turnCount;
  document.getElementById('turnCountVal').textContent = turnCount;
}

// Undo/Redoボタンの活性状態の管理
function updateControls() {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');

  if (isCpuThinking || !gameActive) {
    undoBtn.disabled = true;
    redoBtn.disabled = true;
    return;
  }

  // 戻れる手（人間が最後に打った状態）が履歴に存在するか
  let canUndo = false;
  let uIndex = historyIndex - 1;
  while (uIndex >= 0) {
    // 手戻り先に黒の手番(1)があるなら戻れる
    if (history[uIndex].currentPlayer === 1) {
      canUndo = true;
      break;
    }
    uIndex--;
  }

  // 初期盤面(index=0)かつプレイヤーの番なら戻れない
  undoBtn.disabled = !canUndo;

  // 進める手が存在するか
  let canRedo = historyIndex < history.length - 1;
  redoBtn.disabled = !canRedo;
}

// Undo 実行
function handleUndo() {
  if (isCpuThinking || !gameActive) return;

  let targetIndex = historyIndex - 1;
  // プレイヤーが石を打つ前の状態（currentPlayer = 1）まで遡る
  while (targetIndex >= 0 && history[targetIndex].currentPlayer !== 1) {
    targetIndex--;
  }

  if (targetIndex >= 0) {
    historyIndex = targetIndex;
    restoreState(history[historyIndex]);
    renderBoard();
    updateScores();
    updateControls();
    SoundEffects.playPlace();
  }
}

// Redo 実行
function handleRedo() {
  if (isCpuThinking || !gameActive) return;

  let targetIndex = historyIndex + 1;
  // 次のプレイヤー手番(1)か、履歴の最後を探す
  while (targetIndex < history.length - 1 && history[targetIndex].currentPlayer !== 1) {
    targetIndex++;
  }

  if (targetIndex < history.length) {
    historyIndex = targetIndex;
    restoreState(history[historyIndex]);
    renderBoard();
    updateScores();
    updateControls();
    SoundEffects.playPlace();

    // 復元した手がCPUの番なら、CPUターンを実行する
    if (currentPlayer === -1) {
      triggerCpuTurn();
    }
  }
}

// 対戦終了
function endGame() {
  gameActive = false;
  isCpuThinking = false;
  renderBoard();
  updateStatusIndicator();
  updateControls();

  // スコア算出
  let pScore = 0;
  let cScore = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === 1) pScore++;
      if (board[r][c] === -1) cScore++;
    }
  }

  // リザルト判定と戦績登録
  let resultMsg = "";
  let resultClass = "";

  if (pScore > cScore) {
    resultMsg = "あなたの勝利！";
    resultClass = "result-win";
    stats[difficulty].win++;
    SoundEffects.playWin();
  } else if (cScore > pScore) {
    resultMsg = "CPUの勝利...";
    resultClass = "result-lose";
    stats[difficulty].lose++;
    SoundEffects.playLose();
  } else {
    resultMsg = "引き分け";
    resultClass = "result-draw";
    stats[difficulty].draw++;
    SoundEffects.playWin(); // warm sound
  }

  // 成績をローカルストレージにセーブして表示更新
  saveStats();
  updateStatsTable();

  // モーダルの準備
  document.getElementById('gameOverTitle').textContent = pScore > cScore ? "勝利！" : (cScore > pScore ? "敗北..." : "引き分け！");
  const diffNames = { 1: "イージー", 2: "ノーマル", 3: "ハード" };
  document.getElementById('gameOverSubtitle').textContent = `難易度: ${diffNames[difficulty]}`;
  
  const resultEl = document.getElementById('gameResultMsg');
  resultEl.textContent = resultMsg;
  resultEl.className = `game-result-msg ${resultClass}`;
  
  document.getElementById('goPlayerScore').textContent = pScore;
  document.getElementById('goCpuScore').textContent = cScore;

  // モーダルオープン
  setTimeout(() => {
    document.getElementById('gameOverModal').classList.add('active');
  }, 1000);
}

// --- ローカルストレージ成績データ管理 ---

function saveStats() {
  localStorage.setItem('neo_othello_stats', JSON.stringify(stats));
}

function loadStats() {
  const data = localStorage.getItem('neo_othello_stats');
  if (data) {
    try {
      stats = JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
  }
  updateStatsTable();
}

function updateStatsTable() {
  const levels = { 1: 'easy', 2: 'medium', 3: 'hard' };
  for (const [levelId, levelKey] of Object.entries(levels)) {
    const levelStats = stats[levelId] || { win: 0, lose: 0, draw: 0 };
    document.getElementById(`stats-${levelKey}-win`).textContent = levelStats.win;
    document.getElementById(`stats-${levelKey}-lose`).textContent = levelStats.lose;
    document.getElementById(`stats-${levelKey}-draw`).textContent = levelStats.draw;
  }
}

function clearStats() {
  if (confirm("これまでの成績をクリアしてもよろしいですか？")) {
    stats = {
      1: { win: 0, lose: 0, draw: 0 },
      2: { win: 0, lose: 0, draw: 0 },
      3: { win: 0, lose: 0, draw: 0 }
    };
    saveStats();
    updateStatsTable();
  }
}
