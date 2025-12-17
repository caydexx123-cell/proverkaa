
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { peerService } from './services/peerService.ts';
import { Player, NetworkMessage, ChatMessage } from './types.ts';
import { 
  Search, Menu, MoreVertical, Send, Paperclip, Smile, 
  CheckCheck, User, Settings, LogOut, Trash2, X, Phone, Video,
  ArrowLeft, Camera, Image as ImageIcon, Sun, Moon, Palette
} from 'lucide-react';

const App: React.FC = () => {
  const [nickname, setNickname] = useState(() => localStorage.getItem('nexus_nick') || '');
  const [isReady, setIsReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light' | 'custom'>(() => (localStorage.getItem('nexus_theme') as any) || 'dark');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('nexus_accent') || '#2b5278');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [error, setError] = useState('');

  // Call States
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.className = `${theme}-theme`;
    document.documentElement.style.setProperty('--tg-active', theme === 'custom' ? accentColor : '');
  }, [theme, accentColor]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeChatId]);

  const addMessage = (peerId: string, msg: ChatMessage) => {
    setConversations(prev => ({
      ...prev,
      [peerId]: [...(prev[peerId] || []), msg]
    }));
  };

  const handleInitialize = async () => {
    if (!nickname.trim()) return;
    try {
      const id = await peerService.init(nickname);
      localStorage.setItem('nexus_nick', nickname);
      setIsReady(true);
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const target = searchQuery.toUpperCase();
    if (target === peerService.getPeerId()) return;
    peerService.connectToPeer(target);
    setActiveChatId(target);
    setSearchQuery('');
  };

  const handleMessage = useCallback((msg: NetworkMessage) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const peerId = msg.senderId;
    
    if (msg.type === 'CHAT' || msg.type === 'IMAGE') {
      addMessage(peerId, {
        id: Math.random().toString(),
        senderId: peerId,
        senderName: msg.senderNickname,
        text: msg.type === 'CHAT' ? msg.payload : undefined,
        imageUrl: msg.type === 'IMAGE' ? msg.payload : undefined,
        time,
        isMe: false
      });
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    peerService.onMessage(handleMessage);
    peerService.onConnection(id => {
      if (!activeChatId) setActiveChatId(id);
    });

    peerService.onCall(async (call) => {
      setIncomingCall(call);
    });
  }, [isReady, handleMessage, activeChatId]);

  const sendMessage = (text?: string, imageUrl?: string) => {
    if (!activeChatId || (!text?.trim() && !imageUrl)) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const networkMsg: NetworkMessage = {
      type: imageUrl ? 'IMAGE' : 'CHAT',
      payload: imageUrl || text,
      senderId: peerService.getPeerId()!,
      senderNickname: nickname
    };

    peerService.sendTo(activeChatId, networkMsg);
    addMessage(activeChatId, {
      id: Math.random().toString(),
      senderId: peerService.getPeerId()!,
      senderName: nickname,
      text,
      imageUrl,
      time,
      isMe: true
    });
    setChatMessage('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      sendMessage(undefined, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const startCall = async (video: boolean) => {
    if (!activeChatId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      setLocalStream(stream);
      const call = peerService.callPeer(activeChatId, stream);
      if (call) {
        setupCallHandlers(call);
        setCurrentCall(call);
      }
    } catch (err) {
      alert("Доступ к камере/микрофону запрещен");
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
      incomingCall.answer(stream);
      setupCallHandlers(incomingCall);
      setCurrentCall(incomingCall);
      setIncomingCall(null);
    } catch (err) {
      alert("Ошибка при ответе");
    }
  };

  const setupCallHandlers = (call: any) => {
    call.on('stream', (remote: MediaStream) => {
      setRemoteStream(remote);
    });
    call.on('close', () => endCall());
    call.on('error', () => endCall());
  };

  const endCall = () => {
    currentCall?.close();
    incomingCall?.close();
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setCurrentCall(null);
    setIncomingCall(null);
  };

  const logout = () => {
    localStorage.clear();
    window.location.reload();
  };

  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-tg-sidebar p-8 rounded-3xl border border-tg shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-tg-active rounded-full flex items-center justify-center mb-4 shadow-lg text-white">
              <Send className="w-10 h-10 -rotate-12 ml-1" />
            </div>
            <h1 className="text-2xl font-bold text-center">Nexus</h1>
            <p className="text-tg-gray text-sm mt-1">Твой приватный узел связи</p>
          </div>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Придумай никнейм"
              className="w-full bg-tg-input border border-tg rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-tg-active transition-all"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInitialize()}
            />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button 
              onClick={handleInitialize}
              className="w-full bg-tg-active hover:brightness-110 text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-95"
            >
              ВОЙТИ В СЕТЬ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden relative">
      {/* Drawer / Sidebar */}
      <div className={`fixed inset-0 z-50 transition-transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setIsMenuOpen(false)} />
        <div className="absolute left-0 top-0 bottom-0 w-80 bg-tg-sidebar shadow-2xl flex flex-col">
          <div className="p-6 bg-tg-active flex flex-col gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center font-bold text-2xl text-white">
              {nickname.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-white text-lg">{nickname}</p>
              <p className="text-white/70 text-xs">ID: {peerService.getPeerId()}</p>
            </div>
          </div>
          <div className="flex-1 p-4 space-y-2">
            <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-tg-input cursor-pointer" onClick={() => alert(`Твой ник: ${nickname}`)}>
              <User className="w-5 h-5 text-tg-gray" />
              <span>Аккаунт</span>
            </div>
            <div className="p-3">
              <p className="text-xs text-tg-gray uppercase font-bold mb-2">Тема оформления</p>
              <div className="flex gap-2">
                <button onClick={() => setTheme('dark')} className={`p-2 rounded-lg flex-1 ${theme === 'dark' ? 'bg-tg-active' : 'bg-tg-input'}`}><Moon className="w-4 h-4 mx-auto" /></button>
                <button onClick={() => setTheme('light')} className={`p-2 rounded-lg flex-1 ${theme === 'light' ? 'bg-tg-active' : 'bg-tg-input'}`}><Sun className="w-4 h-4 mx-auto" /></button>
                <button onClick={() => setTheme('custom')} className={`p-2 rounded-lg flex-1 ${theme === 'custom' ? 'bg-tg-active' : 'bg-tg-input'}`}><Palette className="w-4 h-4 mx-auto" /></button>
              </div>
              {theme === 'custom' && (
                <input type="color" value={accentColor} onChange={(e) => {setAccentColor(e.target.value); localStorage.setItem('nexus_accent', e.target.value);}} className="w-full mt-2 h-8 rounded-lg cursor-pointer bg-transparent" />
              )}
            </div>
          </div>
          <div className="p-4 border-t border-tg space-y-2">
            <button onClick={logout} className="w-full flex items-center gap-4 p-3 rounded-xl text-red-400 hover:bg-red-500/10"><LogOut className="w-5 h-5" /> Выход</button>
            <button onClick={logout} className="w-full flex items-center gap-4 p-3 rounded-xl text-red-500 hover:bg-red-500/20 font-bold"><Trash2 className="w-5 h-5" /> Удалить аккаунт</button>
          </div>
        </div>
      </div>

      {/* Main UI */}
      <div className={`flex-shrink-0 w-full md:w-80 lg:w-96 bg-tg-sidebar border-r border-tg flex flex-col ${activeChatId && 'hidden md:flex'}`}>
        <div className="p-4 flex items-center gap-3">
          <Menu className="text-tg-gray cursor-pointer" onClick={() => setIsMenuOpen(true)} />
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-tg-gray" />
            <input 
              type="text" 
              placeholder="Поиск по нику..."
              className="w-full bg-tg-input rounded-2xl py-2 pl-10 pr-4 text-sm focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {Object.keys(conversations).map(peerId => (
            <div 
              key={peerId}
              onClick={() => setActiveChatId(peerId)}
              className={`p-4 flex items-center gap-3 cursor-pointer transition-colors ${activeChatId === peerId ? 'bg-tg-active text-white' : 'hover:bg-tg-input'}`}
            >
              <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center font-bold">{peerId[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold truncate">{peerId}</span>
                  <span className="text-[10px] opacity-70">Online</span>
                </div>
                <p className="text-xs opacity-60 truncate">
                  {conversations[peerId].slice(-1)[0]?.text || 'Изображение'}
                </p>
              </div>
            </div>
          ))}
          {Object.keys(conversations).length === 0 && (
            <div className="p-10 text-center text-tg-gray">
              <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Нет активных чатов.<br/><small>Найди друга по никнейму!</small></p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-tg-chat relative ${!activeChatId && 'hidden md:flex items-center justify-center text-tg-gray'}`}>
        {!activeChatId ? (
          <div className="text-center p-8">
            <div className="bg-tg-sidebar w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 opacity-20" />
            </div>
            <p>Выберите чат, чтобы начать общение</p>
          </div>
        ) : (
          <>
            <div className="h-16 bg-tg-sidebar border-b border-tg flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <ArrowLeft className="md:hidden cursor-pointer" onClick={() => setActiveChatId(null)} />
                <div className="w-10 h-10 rounded-full bg-tg-active flex items-center justify-center font-bold text-white">
                  {activeChatId[0]}
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-none">{activeChatId}</h3>
                  <span className="text-[10px] text-tg-gray">Печатает...</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-tg-gray">
                <Phone className="w-5 h-5 cursor-pointer hover:text-white" onClick={() => startCall(false)} />
                <Video className="w-5 h-5 cursor-pointer hover:text-white" onClick={() => startCall(true)} />
                <MoreVertical className="w-5 h-5" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="mx-auto text-center">
                 <span className="bg-black/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider opacity-60">Ник: {nickname}</span>
              </div>
              {conversations[activeChatId]?.map(msg => (
                <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 shadow-sm ${msg.isMe ? 'chat-bubble-out text-white' : 'chat-bubble-in'}`}>
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="img" className="rounded-lg mb-2 max-h-64 object-contain" />
                    )}
                    {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                    <div className="flex items-center justify-end gap-1 mt-1 opacity-60">
                      <span className="text-[9px]">{msg.time}</span>
                      {msg.isMe && <CheckCheck className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-tg-chat safe-area-bottom">
              <div className="max-w-4xl mx-auto flex items-end gap-2 bg-tg-sidebar p-2 rounded-2xl border border-tg shadow-lg">
                <div className="p-2 text-tg-gray cursor-pointer hover:text-white" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="w-6 h-6" />
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                <textarea 
                  rows={1}
                  placeholder="Сообщение..."
                  className="flex-1 bg-transparent border-none focus:outline-none py-2 text-sm resize-none max-h-32"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatMessage); }
                  }}
                />
                <button 
                  onClick={() => sendMessage(chatMessage)}
                  className="p-3 bg-tg-active text-white rounded-xl shadow-lg active:scale-90 transition-transform"
                >
                  <Send className="w-5 h-5 -rotate-12" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Call UI */}
      {(currentCall || incomingCall) && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6 text-white animate-in fade-in">
          {incomingCall && !currentCall ? (
            <div className="text-center space-y-8">
              <div className="w-32 h-32 bg-tg-active rounded-full flex items-center justify-center text-4xl font-bold mx-auto animate-pulse">
                {incomingCall.peer[0]}
              </div>
              <h2 className="text-3xl font-bold">Входящий вызов от {incomingCall.peer}</h2>
              <div className="flex gap-8 justify-center">
                <button onClick={answerCall} className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-xl hover:scale-110"><Phone className="w-8 h-8" /></button>
                <button onClick={endCall} className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-xl hover:scale-110"><X className="w-8 h-8" /></button>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col">
              <div className="flex-1 bg-black rounded-3xl overflow-hidden relative">
                 <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" 
                   onLoadedMetadata={() => remoteVideoRef.current && remoteStream && (remoteVideoRef.current.srcObject = remoteStream)} />
                 <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-6 right-6 w-32 h-48 bg-slate-800 rounded-xl object-cover border-2 border-white/20"
                   onLoadedMetadata={() => localVideoRef.current && localStream && (localVideoRef.current.srcObject = localStream)} />
                 <div className="absolute top-8 left-8">
                    <h2 className="text-2xl font-bold drop-shadow-lg">{currentCall.peer}</h2>
                    <span className="bg-green-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">В эфире</span>
                 </div>
              </div>
              <div className="h-32 flex items-center justify-center gap-8">
                <button className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20"><Camera className="w-6 h-6" /></button>
                <button onClick={endCall} className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95"><X className="w-10 h-10" /></button>
                <button className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20"><Smile className="w-6 h-6" /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
