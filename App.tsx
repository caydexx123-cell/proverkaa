
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { peerService } from './services/peerService.ts';
import { Player, NetworkMessage, ChatMessage } from './types.ts';
import { 
  Search, Menu, MoreVertical, Send, Paperclip, Smile, 
  CheckCheck, User, Settings, LogOut, Trash2, X, Phone, Video,
  ArrowLeft, Camera, Image as ImageIcon, Sun, Moon, Palette,
  Loader2, AlertCircle, ShieldCheck
} from 'lucide-react';

const App: React.FC = () => {
  // Persistence
  const [nickname, setNickname] = useState(() => localStorage.getItem('nexus_nick') || '');
  const [isReady, setIsReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light' | 'custom'>(() => (localStorage.getItem('nexus_theme') as any) || 'dark');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('nexus_accent') || '#2b5278');
  
  // App Logic
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>(() => {
    const saved = localStorage.getItem('nexus_convs');
    return saved ? JSON.parse(saved) : {};
  });
  const [contacts, setContacts] = useState<string[]>(() => {
    const saved = localStorage.getItem('nexus_contacts');
    return saved ? JSON.parse(saved) : [];
  });
  
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

  // Sync state to storage
  useEffect(() => {
    localStorage.setItem('nexus_convs', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('nexus_contacts', JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    document.body.className = `${theme}-theme`;
    document.documentElement.style.setProperty('--tg-active', theme === 'custom' ? accentColor : '');
    localStorage.setItem('nexus_theme', theme);
  }, [theme, accentColor]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeChatId]);

  const addMessage = (peerId: string, msg: ChatMessage) => {
    setConversations(prev => ({
      ...prev,
      [peerId]: [...(prev[peerId] || []), msg]
    }));
    if (!contacts.includes(peerId)) {
      setContacts(prev => [...prev, peerId]);
    }
  };

  const handleInitialize = async () => {
    const cleanNick = nickname.trim().toUpperCase();
    if (!cleanNick) return;
    try {
      const id = await peerService.init(cleanNick);
      localStorage.setItem('nexus_nick', cleanNick);
      setIsReady(true);
      setError('');
    } catch (err: any) {
      setError(err.message === "Ник занят" ? "Этот ник уже кем-то используется" : "Ошибка инициализации");
    }
  };

  const handleSearch = async () => {
    const target = searchQuery.trim().toUpperCase();
    if (!target) return;
    if (target === peerService.getPeerId()) {
      setError("Нельзя искать самого себя");
      return;
    }

    setIsSearching(true);
    setError('');
    
    // Пытаемся подключиться. Если за 5 секунд не удастся - значит пользователя нет в сети
    try {
      peerService.connectToPeer(target);
      
      // Небольшая задержка для проверки соединения
      setTimeout(() => {
        setIsSearching(false);
        if (!contacts.includes(target)) {
          setContacts(prev => [...prev, target]);
        }
        setActiveChatId(target);
        setSearchQuery('');
      }, 1000);

    } catch (err) {
      setIsSearching(false);
      setError("Пользователь не найден или не в сети");
    }
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
  }, [contacts]);

  useEffect(() => {
    if (!isReady) return;
    peerService.onMessage(handleMessage);
    peerService.onConnection(id => {
      if (!contacts.includes(id)) {
        setContacts(prev => [...prev, id]);
      }
      if (!activeChatId) setActiveChatId(id);
    });

    peerService.onCall(async (call) => {
      setIncomingCall(call);
    });
  }, [isReady, handleMessage, activeChatId, contacts]);

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

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-blue-500 to-indigo-600',
      'from-purple-500 to-pink-600',
      'from-green-400 to-cyan-500',
      'from-orange-400 to-red-500',
      'from-amber-400 to-orange-600'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center p-4 bg-slate-950">
        <div className="w-full max-w-sm bg-[#17212b] p-8 rounded-[2rem] border border-white/5 shadow-2xl animate-in fade-in zoom-in duration-500">
          <div className="flex flex-col items-center mb-10">
            <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(37,99,235,0.3)] animate-bounce-slow">
              <Send className="w-12 h-12 text-white -rotate-12 ml-1" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Nexus Premium</h1>
            <p className="text-slate-400 text-sm mt-2 font-medium">Безопасный P2P Мессенджер</p>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Придумайте никнейм"
                className="w-full bg-[#242f3d] border border-transparent rounded-2xl px-6 py-5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInitialize()}
              />
              <User className="absolute right-5 top-5 text-slate-500 w-5 h-5" />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs px-2 animate-pulse">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
            <button 
              onClick={handleInitialize}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-5 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 group"
            >
              ВОЙТИ В СЕТЬ
              <ArrowLeft className="w-5 h-5 rotate-180 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest mt-4">P2P Encryption Active</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden relative">
      <div className="chat-bg"></div>

      {/* Drawer */}
      <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
        <div className={`absolute left-0 top-0 bottom-0 w-80 bg-[#17212b] shadow-[20px_0_50px_rgba(0,0,0,0.5)] flex flex-col transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-8 bg-gradient-to-br from-blue-700 to-indigo-900 flex flex-col gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center font-black text-3xl text-white shadow-xl border border-white/10">
              {nickname.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-white text-xl flex items-center gap-2">
                {nickname}
                <ShieldCheck className="w-5 h-5 text-blue-300" />
              </p>
              <p className="text-blue-200/60 text-xs font-mono tracking-tighter">NODE: {peerService.getPeerId()}</p>
            </div>
          </div>
          <div className="flex-1 p-6 space-y-4">
            <div className="p-4 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer group flex items-center gap-4">
              <User className="w-5 h-5 text-slate-400 group-hover:text-blue-400" />
              <span className="font-medium">Мой профиль</span>
            </div>
            <div className="space-y-4 pt-4 border-t border-white/5">
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Персонализация</p>
              <div className="flex p-1 bg-black/20 rounded-xl">
                <button onClick={() => setTheme('dark')} className={`p-2 rounded-lg flex-1 flex justify-center ${theme === 'dark' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}><Moon className="w-4 h-4" /></button>
                <button onClick={() => setTheme('light')} className={`p-2 rounded-lg flex-1 flex justify-center ${theme === 'light' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}><Sun className="w-4 h-4" /></button>
                <button onClick={() => setTheme('custom')} className={`p-2 rounded-lg flex-1 flex justify-center ${theme === 'custom' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}><Palette className="w-4 h-4" /></button>
              </div>
              {theme === 'custom' && (
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                   <div className="w-4 h-4 rounded-full" style={{backgroundColor: accentColor}}></div>
                   <input type="color" value={accentColor} onChange={(e) => {setAccentColor(e.target.value); localStorage.setItem('nexus_accent', e.target.value);}} className="flex-1 h-8 opacity-0 absolute cursor-pointer" />
                   <span className="text-xs font-mono opacity-50 uppercase">{accentColor}</span>
                </div>
              )}
            </div>
          </div>
          <div className="p-6 border-t border-white/5 space-y-3">
            <button onClick={logout} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-400 hover:bg-red-500/10 font-bold transition-all"><LogOut className="w-5 h-5" /> Выйти</button>
            <button onClick={logout} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-500/20 hover:text-red-500 hover:bg-red-500/10 border border-red-500/10 font-black transition-all"><Trash2 className="w-5 h-5" /> Удалить аккаунт</button>
          </div>
        </div>
      </div>

      {/* List Sidebar */}
      <div className={`flex-shrink-0 w-full md:w-80 lg:w-[400px] bg-[#17212b] border-r border-white/5 flex flex-col z-20 ${activeChatId && 'hidden md:flex'}`}>
        <div className="p-5 flex items-center gap-4">
          <button onClick={() => setIsMenuOpen(true)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <Menu className="text-slate-400 w-6 h-6" />
          </button>
          <div className="flex-1 relative group">
            <Search className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${isSearching ? 'text-blue-500 animate-spin' : 'text-slate-500 group-focus-within:text-blue-500'}`} />
            <input 
              type="text" 
              placeholder="Поиск по нику..."
              className="w-full bg-[#242f3d] rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 border border-transparent transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {error && searchQuery && <p className="px-6 py-2 text-red-400 text-xs">{error}</p>}
          
          <div className="px-5 py-2">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mb-4">Чаты</p>
            {contacts.map(peerId => {
              const lastMsg = conversations[peerId]?.slice(-1)[0];
              return (
                <div 
                  key={peerId}
                  onClick={() => setActiveChatId(peerId)}
                  className={`p-4 mb-2 flex items-center gap-4 cursor-pointer rounded-2xl transition-all duration-200 active:scale-[0.98] ${activeChatId === peerId ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/5'}`}
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${getAvatarColor(peerId)} flex items-center justify-center font-bold text-xl shadow-inner`}>
                    {peerId[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-bold truncate text-base">{peerId}</span>
                      <span className={`text-[9px] opacity-60 font-bold uppercase`}>Online</span>
                    </div>
                    <p className={`text-xs truncate ${activeChatId === peerId ? 'text-blue-50' : 'text-slate-500'}`}>
                      {lastMsg ? (lastMsg.text || '📷 Фотография') : 'Нет сообщений'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {contacts.length === 0 && !isSearching && (
            <div className="p-12 text-center">
              <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 opacity-10" />
              </div>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                Введите ник друга в поиске,<br/>чтобы начать общение
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-[#0e1621] relative z-10 ${!activeChatId && 'hidden md:flex items-center justify-center text-slate-500'}`}>
        {!activeChatId ? (
          <div className="text-center p-12 max-w-sm animate-pulse">
            <div className="bg-[#17212b] w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <Send className="w-10 h-10 opacity-10" />
            </div>
            <p className="font-medium text-lg">Nexus Premium</p>
            <p className="text-sm mt-2 opacity-50">Выберите чат для начала зашифрованного P2P сеанса</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-20 bg-[#17212b]/95 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 z-30">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 -ml-2 text-slate-400">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${getAvatarColor(activeChatId)} flex items-center justify-center font-bold text-white shadow-lg`}>
                  {activeChatId[0]}
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight tracking-tight">{activeChatId}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] text-green-500 font-black uppercase tracking-widest">В сети</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startCall(false)} className="p-3 text-slate-400 hover:text-blue-400 hover:bg-white/5 rounded-xl transition-all"><Phone className="w-5 h-5" /></button>
                <button onClick={() => startCall(true)} className="p-3 text-slate-400 hover:text-blue-400 hover:bg-white/5 rounded-xl transition-all"><Video className="w-5 h-5" /></button>
                <button className="p-3 text-slate-400 hover:text-white rounded-xl transition-all"><MoreVertical className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Messages Scroll */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar relative z-10">
              <div className="sticky top-0 z-20 flex justify-center pb-4 pointer-events-none">
                 <span className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-blue-300 border border-white/5">
                   P2P SESSION SECURED
                 </span>
              </div>

              {conversations[activeChatId]?.map((msg, idx) => (
                <div key={msg.id} className={`flex message-anim ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`group relative max-w-[80%] md:max-w-[65%] p-4 shadow-xl transition-all duration-200 ${msg.isMe ? 'bg-blue-600 rounded-[1.5rem] rounded-br-none text-white' : 'bg-[#182533] rounded-[1.5rem] rounded-bl-none text-slate-100'}`}>
                    {msg.imageUrl && (
                      <div className="rounded-xl overflow-hidden mb-3 border border-white/10">
                        <img src={msg.imageUrl} alt="P2P Media" className="max-h-[400px] w-full object-cover hover:scale-105 transition-transform duration-500" />
                      </div>
                    )}
                    {msg.text && <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                    <div className="flex items-center justify-end gap-1.5 mt-2">
                      <span className={`text-[9px] font-bold opacity-50`}>{msg.time}</span>
                      {msg.isMe && <CheckCheck className="w-3.5 h-3.5 text-blue-300" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 bg-transparent safe-area-bottom z-30">
              <div className="max-w-4xl mx-auto flex items-end gap-3 bg-[#17212b]/95 backdrop-blur-xl p-3 rounded-[2rem] border border-white/5 shadow-2xl">
                <div className="flex items-center gap-1">
                  <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-blue-400 hover:bg-white/5 rounded-full transition-all">
                    <Paperclip className="w-6 h-6" />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                  <button className="p-3 text-slate-400 hover:text-blue-400 hover:bg-white/5 rounded-full transition-all">
                    <Smile className="w-6 h-6" />
                  </button>
                </div>
                
                <textarea 
                  rows={1}
                  placeholder="Написать сообщение..."
                  className="flex-1 bg-transparent border-none focus:outline-none py-3 text-[15px] resize-none max-h-48 custom-scrollbar placeholder:text-slate-600"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { 
                      e.preventDefault(); 
                      sendMessage(chatMessage); 
                    }
                  }}
                />
                
                <button 
                  onClick={() => sendMessage(chatMessage)}
                  className={`p-4 rounded-2xl shadow-xl active:scale-90 transition-all duration-200 ${chatMessage.trim() ? 'bg-blue-600 text-white translate-x-0' : 'bg-slate-800 text-slate-500 scale-90 translate-x-2 opacity-50 pointer-events-none'}`}
                >
                  <Send className="w-6 h-6 -rotate-12 ml-0.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Call UI - Modern OS style */}
      {(currentCall || incomingCall) && (
        <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col p-8 text-white animate-in slide-in-from-bottom duration-500">
          <div className="flex-1 flex flex-col items-center justify-center gap-12">
            {incomingCall && !currentCall ? (
              <>
                <div className={`w-40 h-40 rounded-[3rem] bg-gradient-to-tr ${getAvatarColor(incomingCall.peer)} flex items-center justify-center text-6xl font-bold shadow-[0_0_50px_rgba(37,99,235,0.4)] animate-pulse`}>
                  {incomingCall.peer[0]}
                </div>
                <div className="text-center">
                  <h2 className="text-4xl font-extrabold tracking-tight mb-2">{incomingCall.peer}</h2>
                  <p className="text-blue-400 font-black uppercase tracking-[0.3em] text-sm">Входящий P2P звонок</p>
                </div>
                <div className="flex gap-12 mt-12">
                  <button onClick={endCall} className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-2xl hover:bg-red-600 transition-all active:scale-90 ring-8 ring-red-500/10">
                    <X className="w-10 h-10" />
                  </button>
                  <button onClick={answerCall} className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-2xl hover:bg-green-600 transition-all active:scale-90 ring-8 ring-green-500/10 animate-bounce-slow">
                    <Phone className="w-10 h-10" />
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full h-full max-w-5xl mx-auto flex flex-col bg-black rounded-[3rem] overflow-hidden shadow-2xl relative border border-white/10">
                 <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" 
                   onLoadedMetadata={() => remoteVideoRef.current && remoteStream && (remoteVideoRef.current.srcObject = remoteStream)} />
                 <div className="absolute top-10 left-10 flex flex-col gap-2">
                    <h2 className="text-3xl font-extrabold drop-shadow-lg">{currentCall?.peer || incomingCall?.peer}</h2>
                    <span className="bg-green-500/80 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] w-fit shadow-lg">LIVE</span>
                 </div>
                 <div className="absolute bottom-10 right-10 w-40 h-60 bg-slate-900 rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover"
                      onLoadedMetadata={() => localVideoRef.current && localStream && (localVideoRef.current.srcObject = localStream)} />
                 </div>
                 <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/40 backdrop-blur-xl p-4 rounded-[2.5rem] border border-white/10">
                    <button className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"><Camera className="w-7 h-7" /></button>
                    <button onClick={endCall} className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-xl hover:bg-red-600 transition-all active:scale-90">
                      <X className="w-10 h-10" />
                    </button>
                    <button className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"><Smile className="w-7 h-7" /></button>
                 </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
