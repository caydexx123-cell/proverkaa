
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { peerService } from './services/peerService.ts';
import { Player, GameState, NetworkMessage, MessageType } from './types.ts';
import { 
  Search, 
  Menu, 
  MoreVertical, 
  Send, 
  Paperclip, 
  Smile, 
  Check, 
  CheckCheck,
  Search as SearchIcon,
  User,
  Settings,
  Info
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const App: React.FC = () => {
  const [nickname, setNickname] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    status: 'idle',
    roomId: null,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<{sender: string, text: string, time: string, isMe: boolean}[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInitialize = async () => {
    if (!nickname.trim()) return;
    try {
      const id = await peerService.init(nickname);
      setGameState(prev => ({ 
        ...prev, 
        roomId: id,
        players: [{ id, nickname, isHost: true, joinedAt: Date.now() }] 
      }));
      setIsReady(true);
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const target = searchQuery.toUpperCase();
    if (target === gameState.roomId) return;
    peerService.connectToPeer(target);
    setSearchQuery('');
  };

  const handleMessage = useCallback((msg: NetworkMessage) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    switch (msg.type) {
      case 'CHAT':
        setMessages(prev => [...prev, { 
          sender: msg.senderNickname, 
          text: msg.payload, 
          time, 
          isMe: false 
        }]);
        break;
      case 'PLAYER_JOINED':
        setGameState(prev => {
          const newPlayer = msg.payload;
          if (prev.players.find(p => p.id === newPlayer.id)) return prev;
          return { ...prev, players: [...prev.players, newPlayer] };
        });
        setMessages(prev => [...prev, { 
          sender: 'System', 
          text: `${msg.senderNickname} присоединился к сети`, 
          time, 
          isMe: false 
        }]);
        break;
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    peerService.onMessage(handleMessage);
    peerService.onConnection((id) => {
      setActiveChatId(id);
      peerService.sendTo(id, {
        type: 'PLAYER_JOINED',
        payload: { id: peerService.getPeerId()!, nickname, isHost: false, joinedAt: Date.now() },
        senderId: peerService.getPeerId()!,
        senderNickname: nickname
      });
    });
  }, [isReady, handleMessage, nickname]);

  const sendMessage = () => {
    if (!chatMessage.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg: NetworkMessage = {
      type: 'CHAT',
      payload: chatMessage,
      senderId: peerService.getPeerId()!,
      senderNickname: nickname
    };
    peerService.broadcast(msg);
    setMessages(prev => [...prev, { sender: 'Вы', text: chatMessage, time, isMe: true }]);
    setChatMessage('');
  };

  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-tg-chat">
        <div className="w-full max-w-sm p-8 bg-tg-sidebar rounded-2xl border border-tg shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-tg-active rounded-full flex items-center justify-center mb-4 shadow-lg">
              <Send className="text-white w-10 h-10 -rotate-12 ml-1" />
            </div>
            <h1 className="text-2xl font-bold">Вход в Nexus</h1>
            <p className="text-tg-gray text-sm mt-1">Используйте ваш ник как адрес</p>
          </div>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Ваш никнейм"
              className="w-full bg-tg-input border border-tg rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-tg-active transition-all"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInitialize()}
            />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button 
              onClick={handleInitialize}
              className="w-full bg-tg-active hover:brightness-110 text-white font-bold py-3 rounded-xl transition-all"
            >
              ПРОДОЛЖИТЬ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-[320px] bg-tg-sidebar border-r border-tg flex flex-col flex-shrink-0">
        <div className="p-4 flex items-center gap-4">
          <Menu className="text-tg-gray cursor-pointer" />
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-tg-gray" />
            <input 
              type="text" 
              placeholder="Поиск по нику..."
              className="w-full bg-tg-input rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-tg-active"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {gameState.players.filter(p => p.id !== gameState.roomId).map((player) => (
            <div 
              key={player.id}
              onClick={() => setActiveChatId(player.id)}
              className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-tg-chat transition-colors ${activeChatId === player.id ? 'bg-tg-active' : ''}`}
            >
              <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-lg">
                {player.nickname.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h4 className="font-bold text-sm truncate">{player.nickname}</h4>
                  <span className="text-[10px] text-tg-gray">Online</span>
                </div>
                <p className="text-xs text-tg-gray truncate">Нажмите, чтобы открыть чат</p>
              </div>
            </div>
          ))}
          {gameState.players.length <= 1 && (
            <div className="p-8 text-center text-tg-gray">
              <p className="text-sm">Никого нет онлайн.</p>
              <p className="text-xs mt-2 italic">Введите ник друга в поиске выше</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-tg-chat flex flex-col relative">
        {/* Header */}
        <div className="h-14 bg-tg-sidebar border-b border-tg flex items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-tg-active flex items-center justify-center font-bold text-sm">
              {activeChatId ? activeChatId.charAt(0) : 'N'}
            </div>
            <div>
              <h3 className="font-bold text-sm">{activeChatId || 'Общий Nexus'}</h3>
              <p className="text-[10px] text-tg-active font-medium uppercase tracking-widest">
                {gameState.players.length} участников
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-tg-gray">
            <Search className="w-5 h-5 cursor-pointer" />
            <MoreVertical className="w-5 h-5 cursor-pointer" />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div className="mx-auto bg-black/30 rounded-full px-4 py-1 text-[10px] text-tg-gray uppercase font-bold tracking-tighter mb-4">
            Ваш ID: {gameState.roomId}
          </div>
          
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] p-3 shadow-md relative group ${msg.isMe ? 'chat-bubble-out' : 'chat-bubble-in'}`}>
                {!msg.isMe && msg.sender !== 'System' && (
                  <p className="text-[10px] font-bold text-tg-active mb-1">{msg.sender}</p>
                )}
                <p className={`text-sm ${msg.sender === 'System' ? 'italic text-tg-gray' : ''}`}>
                  {msg.text}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-tg-gray/70">{msg.time}</span>
                  {msg.isMe && <CheckCheck className="w-3 h-3 text-green-400" />}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-tg-chat">
          <div className="max-w-4xl mx-auto flex items-end gap-3 bg-tg-sidebar p-2 rounded-2xl shadow-xl border border-tg">
            <div className="p-2 text-tg-gray cursor-pointer hover:text-white transition-colors">
              <Smile className="w-6 h-6" />
            </div>
            <textarea 
              rows={1}
              placeholder="Написать сообщение..."
              className="flex-1 bg-transparent border-none focus:outline-none py-2 text-sm resize-none scrollbar-hide max-h-32"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <div className="p-2 text-tg-gray cursor-pointer hover:text-white transition-colors">
              <Paperclip className="w-6 h-6" />
            </div>
            <button 
              onClick={sendMessage}
              className="p-2 bg-tg-active text-white rounded-full hover:brightness-110 transition-all shadow-lg"
            >
              <Send className="w-6 h-6 -rotate-12 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
