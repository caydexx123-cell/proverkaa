
export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  joinedAt: number;
  latency?: number;
}

export interface GameState {
  players: Player[];
  status: 'idle' | 'hosting' | 'joining' | 'connected';
  roomId: string | null;
}

export type MessageType = 'PLAYER_JOINED' | 'PLAYER_LEFT' | 'SYNC_PLAYERS' | 'CHAT' | 'IMAGE' | 'PING' | 'PONG';

export interface NetworkMessage {
  type: MessageType;
  payload: any;
  senderId: string;
  senderNickname: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  imageUrl?: string;
  time: string;
  isMe: boolean;
}
