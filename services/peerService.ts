
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
      
      // Cleanup existing peer if re-initializing
      if (this.peer) {
        this.peer.destroy();
      }

      this.peer = new Peer(sanitizedId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ],
          sdpSemantics: 'unified-plan'
        }
      });

      this.peer.on('open', (id) => {
        console.log('Peer opened with ID:', id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        console.log('Incoming connection from:', conn.peer);
        this.setupConnection(conn);
      });

      this.peer.on('call', (call) => {
        console.log('Incoming call from:', call.peer);
        if (this.onCallCallback) this.onCallCallback(call);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'unavailable-id') reject(new Error("Ник занят"));
        else reject(err);
      });

      this.peer.on('disconnected', () => {
        console.log('Peer disconnected, attempting to reconnect...');
        this.peer?.reconnect();
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

    conn.on('error', (err) => {
      console.error('Connection error with', conn.peer, ':', err);
    });
  }

  connectToPeer(targetId: string) {
    if (!this.peer || this.peer.destroyed) return;
    const sanitizedTarget = targetId.toUpperCase();
    
    // Check if already connected
    if (this.connections.has(sanitizedTarget)) {
        const existing = this.connections.get(sanitizedTarget);
        if (existing?.open) return;
    }

    const conn = this.peer.connect(sanitizedTarget, {
      reliable: true
    });
    this.setupConnection(conn);
  }

  callPeer(targetId: string, stream: MediaStream): MediaConnection | null {
    if (!this.peer || this.peer.destroyed) return null;
    return this.peer.call(targetId.toUpperCase(), stream, {
      metadata: { 
        nickname: localStorage.getItem('mm_nick'),
        avatar: localStorage.getItem('mm_avatar')
      }
    });
  }

  sendTo(targetId: string, message: NetworkMessage) {
    const target = targetId.toUpperCase();
    let conn = this.connections.get(target);
    
    if (conn && conn.open) {
      conn.send(message);
    } else {
      console.log('Connection not ready, attempting to connect to', target);
      this.connectToPeer(target);
      
      // Wait a bit and try sending again
      const checkAndSend = (retries: number) => {
          if (retries <= 0) return;
          const retryConn = this.connections.get(target);
          if (retryConn && retryConn.open) {
              retryConn.send(message);
          } else {
              setTimeout(() => checkAndSend(retries - 1), 1000);
          }
      };
      checkAndSend(5);
    }
  }

  onMessage(cb: (msg: NetworkMessage) => void) { this.onMessageCallback = cb; }
  onConnection(cb: (id: string) => void) { this.onConnectionCallback = cb; }
  onDisconnect(cb: (id: string) => void) { this.onDisconnectCallback = cb; }
  onCall(cb: (call: MediaConnection) => void) { this.onCallCallback = cb; }

  getPeerId() { return this.peer?.id || null; }
}

export const peerService = new PeerService();
