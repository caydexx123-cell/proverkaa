
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { peerService } from './services/peerService';
import { Player, GameState, NetworkMessage, MessageType } from './types';
import { 
  Users, 
  Copy, 
  PlusCircle, 
  LogIn, 
  ArrowRight, 
  Activity, 
  ShieldAlert,
  Wifi,
  Terminal,
  MessageSquare
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

// Components
const Header = () => (
  <header className="py-6 px-8 flex justify-between items-center border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center neon-glow">
        <Wifi className="text-white w-6 h-6" />
      </div>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Multiplayer Nexus</h1>
        <p className="text-xs text-slate-400 font-medium">REAL-TIME CONNECTIVITY TEST</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
      <span className="text-xs font-mono text-slate-300 uppercase">System Ready</span>
    </div>
  </header>
);

const App: React.FC = () => {
  const [nickname, setNickname] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    status: 'idle',
    roomId: null,
  });
  const [joinId, setJoinId] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{sender: string, text: string}[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  
  const pingTimers = useRef<Map<string, number>>(new Map());

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  };

  const analyzeSessionWithAI = async (playersCount: number) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this multiplayer test session: ${playersCount} players connected. Nickname: ${nickname}. Provide a very short, cool, tech-oriented welcome or status report (2 sentences max).`,
      });
      setAiAnalysis(response.text || 'Connection optimized.');
    } catch (e) {
      console.error('AI error:', e);
    }
  };

  const handleInitialize = async () => {
    if (!nickname.trim()) return;
    const id = await peerService.init(nickname);
    setGameState(prev => ({ 
      ...prev, 
      status: 'idle', 
      roomId: id,
      players: [{ id, nickname, isHost: true, joinedAt: Date.now() }] 
    }));
    setIsReady(true);
    addLog(`Initialized as ${nickname}`);
  };

  const handleHost = () => {
    setGameState(prev => ({ ...prev, status: 'hosting' }));
    addLog('Waiting for incoming connections...');
    analyzeSessionWithAI(1);
  };

  const handleJoin = () => {
    if (!joinId.trim()) return;
    setGameState(prev => ({ ...prev, status: 'joining' }));
    peerService.connectToPeer(joinId);
    addLog(`Attempting to join: ${joinId}`);
  };

  const sendPing = useCallback((targetId: string) => {
    pingTimers.current.set(targetId, Date.now());
    peerService.sendTo(targetId, {
      type: 'PING',
      payload: {},
      senderId: peerService.getPeerId()!,
      senderNickname: nickname
    });
  }, [nickname]);

  const handleMessage = useCallback((msg: NetworkMessage) => {
    switch (msg.type) {
      case 'CHAT':
        setChatHistory(prev => [...prev, { sender: msg.senderNickname, text: msg.payload }]);
        break;
      
      case 'PING':
        peerService.sendTo(msg.senderId, {
          type: 'PONG',
          payload: {},
          senderId: peerService.getPeerId()!,
          senderNickname: nickname
        });
        break;

      case 'PONG':
        const startTime = pingTimers.current.get(msg.senderId);
        if (startTime) {
          const latency = Date.now() - startTime;
          setGameState(prev => ({
            ...prev,
            players: prev.players.map(p => p.id === msg.senderId ? { ...p, latency } : p)
          }));
        }
        break;

      case 'SYNC_PLAYERS':
        if (gameState.status === 'joining' || gameState.status === 'connected') {
          setGameState(prev => ({ 
            ...prev, 
            players: msg.payload, 
            status: 'connected',
            roomId: msg.senderId
          }));
          addLog(`Server synchronized players list.`);
        }
        break;

      case 'PLAYER_JOINED':
        setGameState(prev => {
          const newPlayer: Player = msg.payload;
          if (prev.players.find(p => p.id === newPlayer.id)) return prev;
          const nextPlayers = [...prev.players, newPlayer];
          
          // If we are host, broadcast the updated list to everyone
          if (prev.status === 'hosting') {
             peerService.broadcast({
               type: 'SYNC_PLAYERS',
               payload: nextPlayers,
               senderId: peerService.getPeerId()!,
               senderNickname: nickname
             });
             addLog(`${newPlayer.nickname} connected.`);
             analyzeSessionWithAI(nextPlayers.length);
          }
          return { ...prev, players: nextPlayers };
        });
        break;
    }
  }, [gameState.status, nickname]);

  useEffect(() => {
    if (!isReady) return;

    peerService.onMessage(handleMessage);

    peerService.onConnection((id) => {
      // If we joined someone, send our info
      peerService.sendTo(id, {
        type: 'PLAYER_JOINED',
        payload: { id: peerService.getPeerId()!, nickname, isHost: false, joinedAt: Date.now() },
        senderId: peerService.getPeerId()!,
        senderNickname: nickname
      });
      // Start pinging
      const interval = setInterval(() => sendPing(id), 5000);
      return () => clearInterval(interval);
    });

    peerService.onDisconnect((id) => {
      setGameState(prev => {
        const nextPlayers = prev.players.filter(p => p.id !== id);
        if (prev.status === 'hosting') {
          peerService.broadcast({
            type: 'SYNC_PLAYERS',
            payload: nextPlayers,
            senderId: peerService.getPeerId()!,
            senderNickname: nickname
          });
        }
        return { ...prev, players: nextPlayers };
      });
      addLog(`User ${id} disconnected.`);
    });
  }, [isReady, handleMessage, nickname, sendPing]);

  const sendChat = () => {
    if (!chatMessage.trim()) return;
    const msg: NetworkMessage = {
      type: 'CHAT',
      payload: chatMessage,
      senderId: peerService.getPeerId()!,
      senderNickname: nickname
    };
    peerService.broadcast(msg);
    setChatHistory(prev => [...prev, { sender: 'You', text: chatMessage }]);
    setChatMessage('');
  };

  const copyId = () => {
    if (gameState.roomId) {
      navigator.clipboard.writeText(gameState.roomId);
      addLog('ID copied to clipboard');
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950">
        <div className="w-full max-w-md glass p-8 rounded-3xl neon-glow border-indigo-500/20">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center neon-glow">
              <Users className="text-white w-8 h-8" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-center mb-2">Identify Yourself</h2>
          <p className="text-slate-400 text-center mb-8">Enter your alias to initialize the nexus node.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2 ml-1">Nickname</label>
              <input 
                type="text" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Maverick"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleInitialize()}
              />
            </div>
            <button 
              onClick={handleInitialize}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 group"
            >
              Initialize Node
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Header />
      
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        
        {/* Left Panel: Server Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass p-6 rounded-2xl border-slate-800">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              Node Status
            </h3>
            
            <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 mb-6">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-slate-500 font-mono">NODE_ID:</span>
                <button onClick={copyId} className="text-indigo-400 hover:text-indigo-300 transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xl font-mono font-bold text-indigo-300 break-all leading-tight">
                {gameState.roomId}
              </div>
            </div>

            {gameState.status === 'idle' && (
              <div className="space-y-4">
                <button 
                  onClick={handleHost}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" /> Create Lobby
                </button>
                
                <div className="relative py-2 flex items-center">
                   <div className="flex-grow border-t border-slate-800"></div>
                   <span className="flex-shrink mx-4 text-xs font-mono text-slate-600">OR</span>
                   <div className="flex-grow border-t border-slate-800"></div>
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Enter Peer ID..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={joinId}
                    onChange={(e) => setJoinId(e.target.value)}
                  />
                  <button 
                    onClick={handleJoin}
                    className="bg-slate-800 hover:bg-slate-700 px-4 py-3 rounded-xl transition-all"
                  >
                    <LogIn className="w-5 h-5 text-indigo-400" />
                  </button>
                </div>
              </div>
            )}

            {gameState.status !== 'idle' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                  <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-indigo-300">
                    {gameState.status === 'hosting' ? 'Public Lobby Active' : 'Connected to Lobby'}
                  </span>
                </div>
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 rounded-xl text-sm font-semibold border border-red-500/20 transition-all"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          <div className="glass p-6 rounded-2xl border-slate-800 flex-1 flex flex-col">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              Event Console
            </h3>
            <div className="flex-1 font-mono text-xs overflow-y-auto space-y-2 max-h-[300px] scrollbar-hide">
              {logs.map((log, i) => (
                <div key={i} className={`${i === 0 ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`}>
                  {log}
                </div>
              ))}
              {logs.length === 0 && <div className="text-slate-700 italic">No events recorded.</div>}
            </div>
          </div>
        </div>

        {/* Center Panel: Player List & AI Analysis */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Player List */}
            <div className="glass p-6 rounded-2xl border-slate-800 h-full min-h-[400px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Peers ({gameState.players.length})
                </h3>
              </div>
              
              <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                {gameState.players.map((player) => (
                  <div 
                    key={player.id} 
                    className={`flex items-center justify-between p-4 rounded-xl border ${player.id === peerService.getPeerId() ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-slate-900 border-slate-800'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-indigo-400 border border-slate-700">
                        {player.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{player.nickname}</span>
                          {player.isHost && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold uppercase">Host</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{player.id.substring(0, 12)}...</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 text-xs text-green-400">
                        <Activity className="w-3 h-3" />
                        {player.latency !== undefined ? `${player.latency}ms` : '---'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Analysis & Chat */}
            <div className="flex flex-col gap-6">
              <div className="glass p-5 rounded-2xl border-slate-800 bg-indigo-600/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                  <Wifi className="w-12 h-12 text-indigo-400" />
                </div>
                <h3 className="text-xs font-bold text-indigo-400 uppercase mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></div>
                  Nexus Insight (Gemini AI)
                </h3>
                <p className="text-sm leading-relaxed text-indigo-100 italic">
                  {aiAnalysis || "Initializing neural analysis of network topology..."}
                </p>
              </div>

              <div className="glass p-6 rounded-2xl border-slate-800 flex-1 flex flex-col min-h-[300px]">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  Nexus Comms
                </h3>
                <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2 font-mono text-xs">
                  {chatHistory.map((chat, i) => (
                    <div key={i} className="flex flex-col">
                      <span className={`font-bold ${chat.sender === 'You' ? 'text-indigo-400' : 'text-amber-400'}`}>
                        &lt;{chat.sender}&gt;
                      </span>
                      <span className="text-slate-300 ml-2">{chat.text}</span>
                    </div>
                  ))}
                  {chatHistory.length === 0 && <div className="text-slate-700">Comms line silent...</div>}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                    placeholder="Broadcast message..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button 
                    onClick={sendChat}
                    className="bg-indigo-600 hover:bg-indigo-500 p-2 rounded-xl"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      <footer className="py-4 px-8 border-t border-slate-900 bg-slate-950 text-center">
        <p className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">
          &copy; 2024 Multiplayer Nexus // Encrypted P2P Data Protocol // Version 1.0.4-Alpha
        </p>
      </footer>
    </div>
  );
};

export default App;
