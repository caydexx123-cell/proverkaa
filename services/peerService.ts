
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
      // Create a random readable ID suffix or use standard random
      const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      this.peer = new Peer(`MN-${randomId}`);

      this.peer.on('open', (id) => {
        console.log('Peer ID initialized:', id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        reject(err);
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
    const conn = this.peer.connect(targetId);
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
