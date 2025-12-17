
import Peer, { DataConnection } from 'peerjs';
import { NetworkMessage } from '../types';

class PeerService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private onMessageCallback: ((msg: NetworkMessage) => void) | null = null;
  private onConnectionCallback: ((id: string) => void) | null = null;
  private onDisconnectCallback: ((id: string) => void) | null = null;

  async init(nickname: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Испольуем никнейм как ID (очищаем от спецсимволов и переводим в верхний регистр)
      const sanitizedId = nickname.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      this.peer = new Peer(sanitizedId);

      this.peer.on('open', (id) => {
        console.log('Peer ID initialized:', id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        // Если ID занят, добавляем рандом
        if (err.type === 'unavailable-id') {
           const randomId = sanitizedId + '-' + Math.random().toString(36).substring(2, 5).toUpperCase();
           this.peer = new Peer(randomId);
           // Рекурсивно не будем, просто попробуем еще раз с новым ID
           reject(new Error("Никнейм занят. Попробуйте другой."));
        } else {
           reject(err);
        }
      });
    });
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      if (this.onConnectionCallback) this.onConnectionCallback(conn.peer);
    });

    conn.on('data', (data: any) => {
      if (this.onMessageCallback) this.onMessageCallback(data as NetworkMessage);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.onDisconnectCallback) this.onDisconnectCallback(conn.peer);
    });
  }

  connectToPeer(targetId: string) {
    if (!this.peer) return;
    const sanitizedTarget = targetId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const conn = this.peer.connect(sanitizedTarget);
    this.setupConnection(conn);
  }

  broadcast(message: NetworkMessage) {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }

  sendTo(targetId: string, message: NetworkMessage) {
    const conn = this.connections.get(targetId);
    if (conn && conn.open) {
      conn.send(message);
    }
  }

  onMessage(callback: (msg: NetworkMessage) => void) {
    this.onMessageCallback = callback;
  }

  onConnection(callback: (id: string) => void) {
    this.onConnectionCallback = callback;
  }

  onDisconnect(callback: (id: string) => void) {
    this.onDisconnectCallback = callback;
  }

  destroy() {
    this.connections.forEach(c => c.close());
    this.peer?.destroy();
  }

  getPeerId() {
    return this.peer?.id || null;
  }
}

export const peerService = new PeerService();
