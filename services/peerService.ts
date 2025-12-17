
import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { NetworkMessage } from '../types.ts';

class PeerService {
  public peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private onMessageCallback: ((msg: NetworkMessage) => void) | null = null;
  private onConnectionCallback: ((id: string) => void) | null = null;
  private onDisconnectCallback: ((id: string) => void) | null = null;
  private onCallCallback: ((call: MediaConnection) => void) | null = null;

  async init(nickname: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const sanitizedId = nickname.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      this.peer = new Peer(sanitizedId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (id) => resolve(id));
      this.peer.on('connection', (conn) => this.setupConnection(conn));
      this.peer.on('call', (call) => {
        if (this.onCallCallback) this.onCallCallback(call);
      });
      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') reject(new Error("Ник занят"));
        else reject(err);
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
    const sanitizedTarget = targetId.toUpperCase();
    const conn = this.peer.connect(sanitizedTarget, {
      reliable: true
    });
    this.setupConnection(conn);
  }

  callPeer(targetId: string, stream: MediaStream): MediaConnection | null {
    if (!this.peer) return null;
    return this.peer.call(targetId.toUpperCase(), stream, {
      metadata: { nickname: localStorage.getItem('nexus_nick') }
    });
  }

  sendTo(targetId: string, message: NetworkMessage) {
    const conn = this.connections.get(targetId.toUpperCase());
    if (conn && conn.open) conn.send(message);
  }

  onMessage(cb: (msg: NetworkMessage) => void) { this.onMessageCallback = cb; }
  onConnection(cb: (id: string) => void) { this.onConnectionCallback = cb; }
  onDisconnect(cb: (id: string) => void) { this.onDisconnectCallback = cb; }
  onCall(cb: (call: MediaConnection) => void) { this.onCallCallback = cb; }

  getPeerId() { return this.peer?.id || null; }
}

export const peerService = new PeerService();
