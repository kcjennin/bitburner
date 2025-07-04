import { NS } from '@ns';

type MoveResults = {
  random: [number, number];
  expand: [number, number];
  capture: [number, number];
};

function getMoves(board: string[], validMoves: boolean[][], liberties: number[][]): MoveResults {
  const random: [number, number][] = [];
  const expand: [number, number][] = [];
  const capture: [number, number][] = [];
  const size = board[0].length;
  const neighbors = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const notReserverd = x % 2 === 1 || y % 2 === 1;
      if (validMoves[x][y] && notReserverd) {
        const hasNeighbor = neighbors.some(([dx, dy]) => {
          return board[x + dx]?.[y + dy] === 'X';
        });
        const isCapture = neighbors.some(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          return board[nx]?.[ny] === 'O' && liberties[nx]?.[ny] === 1;
        });
        random.push([x, y]);
        if (hasNeighbor) expand.push([x, y]);
        if (isCapture) capture.push([x, y]);
      }
    }
  }
  return {
    random: random[Math.floor(Math.random() * random.length)] ?? [],
    expand: expand[Math.floor(Math.random() * expand.length)] ?? [],
    capture: capture[Math.floor(Math.random() * capture.length)] ?? [],
  };
}

export async function main(ns: NS): Promise<void> {
  let result, x, y;

  while (true) {
    ns.go.resetBoardState('Daedalus', 13);
    ns.go.analysis.getChains();

    do {
      const board = ns.go.getBoardState();
      const validMoves = ns.go.analysis.getValidMoves();
      const liberties = ns.go.analysis.getLiberties();

      const moveResults = getMoves(board, validMoves, liberties);

      [x, y] = [
        moveResults.capture[0] ?? moveResults.expand[0] ?? moveResults.random[0],
        moveResults.capture[1] ?? moveResults.expand[1] ?? moveResults.random[1],
      ];

      if (x === undefined) {
        result = await ns.go.passTurn();
      } else {
        result = await ns.go.makeMove(x, y);
      }

      await ns.go.opponentNextTurn();
    } while (result?.type !== 'gameOver');
  }
}
