export interface Token {
  id: number;
  x: number;
  y: number;
  color: string;
  label?: string;
  image?: string | null;
  name?: string | null;
  character_id?: number | null;
  locked?: boolean;
  conditions?: string[] | null;
  hp?: number | null;
  max_hp?: number | null;
}

export interface GridConfig {
  size: number;
  columns: number;
  rows: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'dice' | 'system';
  diceRoll?: DiceRoll;
}

export interface DiceRoll {
  formula: string;
  results: number[];
  total: number;
  individualDice: { sides: number, result: number }[];
  attackTotal?: number;
  damageTotal?: number;
  isCritical?: boolean;
  isFumble?: boolean;
}

export interface RoomState {
  tokens: Token[];
  gridConfig: GridConfig;
  backgroundImage: string | null;
  zoomLevel: number;
  chatMessages: ChatMessage[];
  freeMovement: boolean;
  combatActive: boolean;
  initiativeOrder: any[];
  currentTurn: number;
  currentRound: number;
}