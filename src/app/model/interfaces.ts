export interface Token {
  id: number;
  x: number;
  y: number;
  color: string;
  label?: string;
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
  individualDice?: { sides: number; result: number }[];
}

export interface RoomState {
  tokens: Token[];
  gridConfig: GridConfig;
  backgroundImage: string | null;
  zoomLevel: number;
  chatMessages: ChatMessage[];
}