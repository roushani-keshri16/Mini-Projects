let cells = document.querySelectorAll(".cell");
let message = document.getElementById("message");
let restartBtn = document.getElementById("restart");
let mode = document.getElementById("mode");
let sound = document.getElementById("clickSound");

let xScore = 0, oScore = 0;
let currentPlayer = "X";
let gameActive = true;

const winPatterns = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

// 🔊 sound
function playSound() {
  sound.currentTime = 0;
  sound.play();
}

// winner check
function checkWinner() {
  for (let p of winPatterns) {
    let [a,b,c] = p;

    if (cells[a].innerText &&
        cells[a].innerText === cells[b].innerText &&
        cells[b].innerText === cells[c].innerText) {

      p.forEach(i => cells[i].classList.add("win"));

      let winner = cells[a].innerText;
      message.innerText = winner + " Wins 🎉";

      if (winner === "X") {
        xScore++;
        xScoreEl.innerText = xScore;
      } else {
        oScore++;
        oScoreEl.innerText = oScore;
      }

      gameActive = false;
      return true;
    }
  }

  if ([...cells].every(c => c.innerText !== "")) {
    message.innerText = "Draw 😐";
    gameActive = false;
    return true;
  }

  return false;
}

// EASY AI
function easyAI() {
  let empty = [...cells].map((c,i)=>c.innerText===""?i:null).filter(v=>v!==null);
  let move = empty[Math.floor(Math.random()*empty.length)];
  cells[move].innerText = "O";
  checkWinner();
}

// HARD AI (minimax lite)
function hardAI() {
  let board = [...cells].map(c=>c.innerText);

  function checkWin(b,p){
    return winPatterns.some(pat=>pat.every(i=>b[i]===p));
  }

  function empty(b){
    return b.map((v,i)=>v===""?i:null).filter(v=>v!==null);
  }

  function minimax(b, isMax){
    if (checkWin(b,"O")) return {score:1};
    if (checkWin(b,"X")) return {score:-1};
    if (empty(b).length===0) return {score:0};

    let moves=[];

    empty(b).forEach(i=>{
      let move={index:i};
      b[i]= isMax ? "O":"X";
      move.score=minimax(b,!isMax).score;
      b[i]="";
      moves.push(move);
    });

    return isMax
      ? moves.reduce((a,b)=>a.score>b.score?a:b)
      : moves.reduce((a,b)=>a.score<b.score?a:b);
  }

  let best = minimax(board,true);
  cells[best.index].innerText="O";
  checkWinner();
}

// click
cells.forEach(cell=>{
  cell.addEventListener("click",()=>{

    if (!gameActive || cell.innerText !== "") return;

    playSound();

    let m = mode.value;

    if (m==="friend") {
      cell.innerText = currentPlayer;
      if (!checkWinner())
        currentPlayer = currentPlayer==="X"?"O":"X";
    }

    else {
      cell.innerText="X";
      if (!checkWinner()) {
        setTimeout(()=>{
          m==="easy"?easyAI():hardAI();
        },300);
      }
    }
  });
});

// restart
restartBtn.addEventListener("click",()=>{
  cells.forEach(c=>{
    c.innerText="";
    c.classList.remove("win");
  });
  message.innerText="";
  currentPlayer="X";
  gameActive=true;
});