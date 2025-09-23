import { NS } from '@ns';


interface TurnResult {
  type: "pass" | "move" | "gameOver";
  x: number | null;
  y: number | null;
}

interface MoveInfo {
  board: string[];
  validMoves: boolean[][];
  liberties: number[][];
  chains: (number | null)[][];
}

let ns: NS;
const OPPONENTS: GoOpponent[] = [
  'Netburners', 
  'Slum Snakes',
  'The Black Hand',
  'Tetrads',
  'Daedalus',
  'Illuminati',
  '????????????',
  'No AI',
] as const;

function moveFromOptions(type: string, options: [number, number][]): [number?, number?] {
  const randomIndex = Math.floor(Math.random() * options.length);
  return options.at(randomIndex) ?? [];
}

function adjacentList(x: number, y: number): [[number, number], [number, number], [number, number], [number, number]] {
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ];
}

function isEnclosed(board: string[], x: number, y: number): boolean {
  const size = board[0].length;

  const visited: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const stack: [number, number][] = [[x, y]];
  visited[x][y] = true;

  let touchesAlly = false;

  while (stack.length > 0) {
    const [dx, dy] = stack.pop() as [number, number];

    for (const [ex, ey] of adjacentList(dx, dy).filter(([ex, ey]) => board[ex]?.[ey] !== undefined)) {
      const ch = board[ex][ey];

      if (ch === '.' && !visited[ex][ey]) {
        visited[ex][ey] = true;
        stack.push([ex, ey]);
      } else if (ch === 'O') {
        return false;
      } else if (ch === 'X') {
        touchesAlly = true;
      }
    }
  }

  return touchesAlly;
}

function analysisGetChains(board: string[]): (number | null)[][] {
  const size = board[0].length;
  const chains: (number | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  
  let currentId = 0;
  const visited: boolean[][] = Array.from({ length: size}, () => Array(size).fill(false));

  for (let x = 0; x < size; ++x) {
    for (let y = 0; y < size; ++y) {
      if (visited[x][y]) continue;
      if (board[x][y] === '#') {
        visited[x][y] = true;
        continue;
      }

      const ch = board[x][y];
      const stack: [number, number][] = [[x, y]];
      visited[x][y] = true;
      chains[x][y] = currentId;

      while (stack.length > 0) {
        const [dx, dy] = stack.pop() as [number, number];

        for (const [ex, ey] of adjacentList(dx, dy)) {
          if (visited[ex]?.[ey] === false && board[ex]?.[ey] === ch) {
            visited[ex][ey] = true;
            chains[ex][ey] = currentId;
            stack.push([ex, ey]);
          }
        }
      }
      currentId++;
    }
  }
  return chains;
}

function analysisGetLiberties(board: string[], chains: (number | null)[][]): number[][] {
  const size = board[0].length;
  const liberties = Array.from({ length: size }, () => Array(size).fill(-1));

  const idMap = new Map<number, [number, number][]>();
  chains.forEach((v, x) =>
    v.forEach((id, y) => {
      if (id !== null) idMap.set(id, [[x, y], ...(idMap.get(id) ?? [])])
    })
  )

  for (const [, chain] of idMap) {
    const ch = board[chain[0][0]][chain[0][1]];
    // empty chains are -1
    if (ch === '.') continue;

    const adjacentEmpties = new Set<string>();
    chain.forEach(([x, y]) =>
      adjacentList(x, y)
        .filter(([dx, dy]) => board[dx]?.[dy] === '.')
        .forEach(([dx, dy]) => adjacentEmpties.add(`${dx},${dy}`))
    );
    const chainLiberties = adjacentEmpties.size;

    chain.forEach(([x, y]) => liberties[x][y] = chainLiberties);
  }

  return liberties;
}

function getRandomMove({ board, validMoves }: MoveInfo): [number?, number?] {
  const moveOptions: [number, number][] = [];
  const size = board[0].length;

  for (let x = 0; x < size; ++x) {
    for (let y = 0; y < size; ++y) {
      const notReserved = x % 2 === 1 || y % 2 === 1;
      // if we have this surrounded we essentially already own it
      if (validMoves[x][y] && notReserved && !isEnclosed(board, x, y)) moveOptions.push([x, y]);
    }
  }
  // instead of just picking a random move focus on one corner
  return moveOptions.sort(([ax, ay], [bx, by]) => ax - bx || ay - by).at(0) ?? [];
}

function getExpansionMove({ board, validMoves, liberties }: MoveInfo): [number?, number?] {
  const moveOptions: [number, number][] = [];
  const size = board[0].length;

  for (let x = 0; x < size; ++x) {
    for (let y = 0; y < size; ++y) {
      const notReserved = x % 2 === 1 || y % 2 === 1;
      const friendlyAdjacent =
        adjacentList(x, y).some(([dx, dy]) => board[dx]?.[dy] === 'X')
      // if we have this surrounded we essentially already own it
      const notSuicide =
        // two or more empty spaces adjacent
        (adjacentList(x, y).filter(([dx, dy]) => board[dx]?.[dy] === '.').length >= 2) ||
        // strong network adjacent
        adjacentList(x, y).some(([dx, dy]) => board[dx]?.[dy] === 'X' && liberties[dx]?.[dy] >= 3)
      if (validMoves[x][y] && notReserved && friendlyAdjacent && notSuicide && !isEnclosed(board, x, y)) moveOptions.push([x, y]);
    }
  }
  return moveFromOptions('Expansion', moveOptions);
}

function getCaptureMove({ board, validMoves, liberties }: MoveInfo): [number?, number?] {
  const moveOptions: [number, number][] = [];
  const size = board[0].length;

  for (let x = 0; x < size; ++x) {
    for (let y = 0; y < size; ++y) {
      const weakEnemy = 
        adjacentList(x, y).some(([dx, dy]) => board[dx]?.[dy] === 'O' && liberties[dx]?.[dy] === 1);
      if (validMoves[x][y] && weakEnemy) moveOptions.push([x, y]);
    }
  }
  return moveFromOptions('Capture', moveOptions);
}

function getDefenseMove({ board, validMoves, liberties }: MoveInfo): [number?, number?] {
  const moveOptions: [number, number][] = [];
  const size = board[0].length;

  for (let x = 0; x < size; ++x) {
    for (let y = 0; y < size; ++y) {
      const weakAlly = 
        adjacentList(x, y).some(([dx, dy]) => board[dx]?.[dy] === 'X' && liberties[dx]?.[dy] === 1);
      const notSuicide =
        // two or more empty spaces adjacent
        (adjacentList(x, y).filter(([dx, dy]) => board[dx]?.[dy] === '.').length >= 2) ||
        // strong network adjacent
        adjacentList(x, y).some(([dx, dy]) => board[dx]?.[dy] === 'X' && liberties[dx]?.[dy] >= 3)


      if (validMoves[x][y] && weakAlly && notSuicide) moveOptions.push([x, y]);
    }
  }
  return moveFromOptions('Defense', moveOptions);
}

function getBolsterMove({ board, validMoves, liberties, chains }: MoveInfo): [number?, number?] {
  let moveOptions = new Map<number, [number, number][]>();
  const size = board[0].length;

  for (let x = 0; x < size; ++x) {
    for (let y = 0; y < size; ++y) {
      // only check >1, since defense already does 1
      const [lowLiberty, lx, ly] = 
        adjacentList(x, y)
          .filter(([dx, dy]) => board[dx]?.[dy] === 'X' && (liberties[dx]?.[dy] ?? -1) > 1)
          .reduce(([min, mx, my], [dx, dy]) => {
            if (liberties[dx]?.[dy] ?? Infinity < min) {
              return [liberties[dx]?.[dy], dx, dy];
            } else {
              return [min, mx, my];
            }
          }, [Infinity, -1, -1]);
      const highLiberty =
        adjacentList(x, y)
          .filter(([dx, dy]) => 
            board[dx]?.[dy] === 'X' &&
            // adjacent, low liberty network exists
            chains[lx]?.[ly] !== undefined &&
            // a different, adjacent high liberty network exists
            chains[dx]?.[dy] !== chains[lx]?.[ly]
          ).reduce((max, [dx, dy]) => Math.max(max, liberties[dx]?.[dy]), -1);

      // two or more empty spaces adjacent
      const emptySpaces = adjacentList(x, y).filter(([dx, dy]) => board[dx]?.[dy] === '.').length >= 2;
      // strong *different* network adjacent
      const strongAdjacent = (lowLiberty !== Infinity && highLiberty >= 3)
      const notSuicide = emptySpaces || strongAdjacent;


      if (validMoves[x][y] && lowLiberty > 0 && lowLiberty !== Infinity && notSuicide && !isEnclosed(board, x, y)) {
        moveOptions.set(lowLiberty, [[x, y], ...(moveOptions.get(lowLiberty) ?? [])]);
      }
    }
  }

  moveOptions = new Map([...moveOptions].sort());

  let move: [number?, number?] = [undefined, undefined];
  for (const [k, v] of moveOptions) {
    move = moveFromOptions(`Bolster ${k}`, v);
    if (move[0] !== undefined && move[1] !== undefined) break;
  }
  return move;
}

function getEmptyCaptureMove({ board, validMoves }: MoveInfo): [number?, number?] {
  const moveOptions: [number, number][] = [];
  const size = board[0].length;

  for (let x = 0; x < size; ++x) {
    for (let y = 0; y < size; ++y) {
      const potentials = adjacentList(x, y)
        .filter(([dx, dy]) => validMoves[dx]?.[dy]);
      
      const wouldEnclose = potentials.some(([dx, dy]) => {
        const adj = adjacentList(dx, dy).map(([px, py]) => board[px]?.[py]).filter((v) => v !== undefined);
        const deadOrOwned = adj.filter((v) => v === 'X' || v === '#').length;
        const empty = adj.filter((v) => v === '.').length;
        return empty === 1 && (deadOrOwned + empty === adj.length);
      });

      if (validMoves[x][y] && wouldEnclose && !isEnclosed(board, x, y)) moveOptions.push([x, y]);
    }
  }
  return moveFromOptions('Empty Capture', moveOptions);
}

export async function main(nsContext: NS) {
  ns = nsContext;
  ns.disableLog('ALL');
  ns.clearLog();

  // only one copy of the script
  const otherPid = ns.getRunningScript(ns.getScriptName())?.pid;
  if (otherPid && otherPid !== ns.pid) ns.kill(otherPid);

  const target = await ns.prompt('Opponent', { type: 'select', choices: OPPONENTS, }) as GoOpponent;

  while (true) {
    ns.go.resetBoardState(target, 13);

    let result: TurnResult | undefined = undefined;
    let opponentTurn: TurnResult | undefined = undefined;
    do {
      if (opponentTurn?.type === 'pass') {
        const { whiteScore, blackScore, komi } = ns.go.getGameState();
        // if the opponent passed and we're going to win just end it
        if (blackScore > whiteScore + komi) {
          await ns.go.passTurn();
          break;
        }
      }

      const board = ns.go.getBoardState();
      const validMoves = ns.go.analysis.getValidMoves();
      const chains = analysisGetChains(board);
      const liberties = analysisGetLiberties(board, chains);
      const mi = { board, validMoves, liberties, chains };

      // moves in order of priority
      const moves: [string, (mi: MoveInfo) => [number?, number?]][] = [
        ['def', getDefenseMove],
        ['cap', getCaptureMove],
        ['ecp', getEmptyCaptureMove],
        ['bol', getBolsterMove],
        ['exp', getExpansionMove],
        ['rnd', getRandomMove],
      ];

      const [n, x, y] = moves.map(([n, fn]) => [n, ...fn(mi)] as [string, number?, number?]).find(([n, x, y]) => x !== undefined && y !== undefined) ?? [];
      if (n === undefined || x === undefined || y === undefined) {
        result = await ns.go.passTurn();
      } else {
        ns.print(`${n} [${x}, ${y}]`);
        result = await ns.go.makeMove(x, y);
      }
      
      // await ns.prompt('Continue?');
      opponentTurn = await ns.go.opponentNextTurn();
    } while (result?.type !== 'gameOver');
  }
}
