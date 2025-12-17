
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { peerService } from './services/peerService.ts';
import { NetworkMessage, ChatMessage } from './types.ts';
import { 
  Search, Menu, MoreVertical, Send, Paperclip, Smile, 
  CheckCheck, User, Settings, LogOut, Trash2, X, Phone, Video,
  ArrowLeft, Camera, Image as ImageIcon, Sun, Moon, Palette,
  Loader2, AlertCircle, ShieldCheck, Gift, Snowflake
} from 'lucide-react';

const App: React.FC = () => {
  // Persistence & States
  const [nickname, setNickname] = useState(() => localStorage.getItem('nexus_nick') || '');
  const [isReady, setIsReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light' | 'custom' | 'newyear'>(() => (localStorage.getItem('nexus_theme') as any) || 'dark');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('nexus_accent') || '#2b5278');
  
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

  // Auto-Login Logic
  useEffect(() => {
    if (nickname && !isReady) {
      handleInitialize();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nexus_convs', JSON.stringify(conversations));
    localStorage.setItem('nexus_contacts', JSON.stringify(contacts));
  }, [conversations, contacts]);

  useEffect(() => {
    document.body.className = `${theme}-theme`;
    if (theme === 'custom') {
      document.documentElement.style.setProperty('--tg-active', accentColor);
    } else {
      document.documentElement.style.removeProperty('--tg-active');
    }
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
    setContacts(prev => prev.includes(peerId) ? prev : [...prev, peerId]);
  };

  const handleInitialize = async () => {
    const cleanNick = (nickname || localStorage.getItem('nexus_nick') || '').trim().toUpperCase();
    if (!cleanNick) return;
    try {
      await peerService.init(cleanNick);
      setIsReady(true);
      setError('');
    } catch (err: any) {
      setError(err.message === "Ник занят" ? "Ник занят другим узлом" : "Сбой сети");
    }
  };

  const handleSearch = async () => {
    const target = searchQuery.trim().toUpperCase();
    if (!target || target === peerService.getPeerId()) return;
    setIsSearching(true);
    setError('');
    
    try {
      peerService.connectToPeer(target);
      setTimeout(() => {
        setIsSearching(false);
        setContacts(prev => prev.includes(target) ? prev : [...prev, target]);
        setActiveChatId(target);
        setSearchQuery('');
      }, 1500);
    } catch (err) {
      setIsSearching(false);
      setError("Узел не отвечает");
    }
  };

  const handleMessage = useCallback((msg: NetworkMessage) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (msg.type === 'CHAT' || msg.type === 'IMAGE') {
      addMessage(msg.senderId, {
        id: Math.random().toString(),
        senderId: msg.senderId,
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
      setContacts(prev => prev.includes(id) ? prev : [...prev, id]);
    });
    peerService.onCall(call => setIncomingCall(call));
  }, [isReady, handleMessage]);

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
    reader.onloadend = () => sendMessage(undefined, reader.result as string);
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
    } catch (err) { alert("Нет доступа к медиа"); }
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
    } catch (err) { alert("Ошибка ответа"); }
  };

  const setupCallHandlers = (call: any) => {
    call.on('stream', (remote: MediaStream) => {
      setRemoteStream(remote);
      // Принудительно ставим в видео элемент для воспроизведения звука
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remote;
      }
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
    if (theme === 'newyear') return 'from-red-600 to-green-700';
    const colors = ['from-blue-500 to-indigo-600', 'from-purple-500 to-pink-600', 'from-green-400 to-cyan-500', 'from-orange-400 to-red-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // Snowflake generator for New Year mode
  const renderSnow = () => {
    if (theme !== 'newyear') return null;
    return Array.from({ length: 20 }).map((_, i) => (
      <div key={i} className="snowflake" style={{ 
        left: `${Math.random() * 100}%`, 
        animationDelay: `${Math.random() * 5}s`,
        opacity: Math.random()
      }}>❄</div>
    ));
  };

  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center p-6 bg-[#0e1621]">
        <div className="w-full max-w-sm bg-[#17212b] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl scale-100 animate-in fade-in zoom-in duration-500">
          <div className="flex flex-col items-center mb-10">
            <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
              <Send className="w-12 h-12 text-white -rotate-12" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Nexus</h1>
            <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest font-bold opacity-60">Private P2P Network</p>
          </div>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Твой уникальный ник"
              className="w-full bg-[#242f3d] border-none rounded-2xl px-6 py-5 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 transition-all text-center font-bold"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInitialize()}
            />
            {error && <div className="text-red-500 text-center text-xs font-bold animate-pulse">{error}</div>}
            <button onClick={handleInitialize} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all shadow-xl active:scale-95">ПОДКЛЮЧИТЬСЯ</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-tg-bg relative">
      {renderSnow()}
      <div className="chat-bg"></div>

      {/* Drawer */}
      <div className={`fixed inset-0 z-[100] transition-all duration-500 ${isMenuOpen ? 'visible' : 'invisible'}`}>
        <div className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-500 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsMenuOpen(false)} />
        <div className={`absolute left-0 top-0 bottom-0 w-80 bg-tg-sidebar flex flex-col transition-transform duration-500 ease-out ${isMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
          <div className="p-8 bg-tg-active flex flex-col gap-6">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl font-black text-white">{nickname[0]}</div>
            <div>
              <p className="text-xl font-black text-white tracking-tight">{nickname}</p>
              <p className="text-xs text-white/50 font-mono mt-1">NODE: {peerService.getPeerId()}</p>
            </div>
          </div>
          <div className="flex-1 p-6 space-y-2">
             <div className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl cursor-pointer transition-colors">
               <User className="w-5 h-5 text-tg-gray" />
               <span className="font-bold">Мой аккаунт</span>
             </div>
             <div className="pt-6 mt-4 border-t border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-tg-gray mb-4">Темы оформления</p>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => setTheme('dark')} className={`p-3 rounded-xl flex justify-center ${theme === 'dark' ? 'bg-tg-active' : 'bg-tg-input'}`}><Moon className="w-5 h-5" /></button>
                  <button onClick={() => setTheme('light')} className={`p-3 rounded-xl flex justify-center ${theme === 'light' ? 'bg-tg-active' : 'bg-tg-input'}`}><Sun className="w-5 h-5" /></button>
                  <button onClick={() => setTheme('newyear')} className={`p-3 rounded-xl flex justify-center ${theme === 'newyear' ? 'bg-red-600' : 'bg-tg-input'}`}><Gift className="w-5 h-5" /></button>
                  <button onClick={() => setTheme('custom')} className={`p-3 rounded-xl flex justify-center ${theme === 'custom' ? 'bg-tg-active' : 'bg-tg-input'}`}><Palette className="w-5 h-5" /></button>
                </div>
             </div>
          </div>
          <div className="p-6 border-t border-white/5 space-y-2">
             <button onClick={logout} className="w-full flex items-center gap-4 p-4 text-red-500 hover:bg-red-500/10 rounded-2xl font-bold transition-all"><LogOut className="w-5 h-5" /> Выход</button>
             <button onClick={logout} className="w-full flex items-center gap-4 p-4 text-red-700 hover:bg-red-700/10 rounded-2xl font-black transition-all"><Trash2 className="w-5 h-5" /> Удалить данные</button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Sidebar */}
        <aside className={`w-full md:w-80 lg:w-[420px] bg-tg-sidebar border-r border-white/5 flex flex-col flex-shrink-0 ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-5 flex items-center gap-4">
             <button onClick={() => setIsMenuOpen(true)} className="p-2 hover:bg-white/5 rounded-xl transition-all"><Menu className="text-tg-gray w-6 h-6" /></button>
             <div className="flex-1 relative">
                <Search className={`absolute left-4 top-3.5 w-4 h-4 ${isSearching ? 'text-blue-500 animate-spin' : 'text-tg-gray'}`} />
                <input 
                  type="text" 
                  placeholder="Найти по нику..."
                  className="w-full bg-tg-input rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none border-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4">
            {contacts.map(id => {
              const last = conversations[id]?.slice(-1)[0];
              return (
                <div key={id} onClick={() => setActiveChatId(id)} className={`p-4 mb-1 rounded-[1.5rem] flex items-center gap-4 cursor-pointer transition-all active:scale-[0.98] ${activeChatId === id ? 'bg-tg-active shadow-lg' : 'hover:bg-white/5'}`}>
                   <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarColor(id)} flex items-center justify-center font-black text-white text-xl shadow-inner`}>{id[0]}</div>
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                         <span className="font-bold truncate text-base">{id}</span>
                         <span className="text-[9px] font-black uppercase opacity-40">Online</span>
                      </div>
                      <p className="text-xs truncate opacity-50">{last ? (last.text || '📷 Фото') : 'Начни общение'}</p>
                   </div>
                </div>
              );
            })}
            {contacts.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-20 p-10 text-center">
                 <Snowflake className="w-16 h-16 mb-4" />
                 <p className="text-sm font-bold">Найди друга, чтобы начать<br/>безопасный чат</p>
              </div>
            )}
          </div>
        </aside>

        {/* Chat */}
        <main className={`flex-1 flex flex-col bg-tg-bg relative ${!activeChatId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
           {!activeChatId ? (
             <div className="text-center p-10 max-w-sm">
                <div className="w-24 h-24 bg-tg-sidebar rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl border border-white/5">
                   <Send className="w-10 h-10 opacity-10" />
                </div>
                <h2 className="text-xl font-black mb-2">Nexus Premium</h2>
                <p className="text-sm opacity-40">Выберите чат или создайте новый через поиск по нику. Все данные передаются напрямую между вами.</p>
             </div>
           ) : (
             <>
               <header className="h-20 bg-tg-sidebar/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 flex-shrink-0">
                  <div className="flex items-center gap-4">
                     <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 -ml-2 text-tg-gray"><ArrowLeft className="w-6 h-6" /></button>
                     <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getAvatarColor(activeChatId)} flex items-center justify-center font-black text-white shadow-lg`}>{activeChatId[0]}</div>
                     <div>
                        <h3 className="font-black text-lg leading-tight">{activeChatId}</h3>
                        <span className="text-[10px] text-green-500 font-black uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> В сети</span>
                     </div>
                  </div>
                  <div className="flex items-center gap-1 md:gap-3">
                     <button onClick={() => startCall(false)} className="p-3 text-tg-gray hover:text-white transition-all"><Phone className="w-5 h-5" /></button>
                     <button onClick={() => startCall(true)} className="p-3 text-tg-gray hover:text-white transition-all"><Video className="w-5 h-5" /></button>
                     <button className="p-3 text-tg-gray hover:text-white transition-all"><MoreVertical className="w-5 h-5" /></button>
                  </div>
               </header>

               <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 custom-scrollbar">
                  {conversations[activeChatId]?.map(msg => (
                    <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                       <div className={`message-bubble relative p-4 shadow-xl ${msg.isMe ? 'bg-tg-active text-white rounded-[1.5rem] rounded-br-none' : 'bg-tg-sidebar text-white rounded-[1.5rem] rounded-bl-none'}`}>
                          {msg.imageUrl && <img src={msg.imageUrl} alt="P2P" className="rounded-xl mb-3 max-h-96 w-full object-contain bg-black/10" />}
                          {msg.text && <p className="text-[15px] leading-relaxed font-medium whitespace-pre-wrap">{msg.text}</p>}
                          <div className="flex items-center justify-end gap-1.5 mt-2 opacity-40">
                             <span className="text-[9px] font-black uppercase">{msg.time}</span>
                             {msg.isMe && <CheckCheck className="w-3.5 h-3.5" />}
                          </div>
                       </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
               </div>

               <footer className="p-4 safe-area-inset-bottom">
                  <div className="max-w-4xl mx-auto flex items-end gap-3 bg-tg-sidebar/90 backdrop-blur-2xl p-3 rounded-[2rem] border border-white/5 shadow-2xl">
                     <button onClick={() => fileInputRef.current?.click()} className="p-3.5 text-tg-gray hover:text-white transition-all"><Paperclip className="w-6 h-6" /></button>
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                     <textarea 
                        rows={1}
                        placeholder="Написать сообщение..."
                        className="flex-1 bg-transparent border-none focus:outline-none py-3.5 text-[15px] resize-none max-h-48 custom-scrollbar font-medium"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatMessage); } }}
                     />
                     <button onClick={() => sendMessage(chatMessage)} className={`p-4 rounded-2xl transition-all duration-300 ${chatMessage.trim() ? 'bg-tg-active text-white scale-100' : 'bg-white/5 text-white/20 scale-90 pointer-events-none'}`}><Send className="w-6 h-6 -rotate-12" /></button>
                  </div>
               </footer>
             </>
           )}
        </main>
      </div>

      {/* Call UI */}
      {(currentCall || incomingCall) && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col text-white animate-in slide-in-from-bottom duration-500">
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            {incomingCall && !currentCall ? (
              <div className="space-y-12">
                 <div className={`w-48 h-48 rounded-[3.5rem] bg-gradient-to-tr ${getAvatarColor(incomingCall.peer)} flex items-center justify-center text-6xl font-black shadow-[0_0_80px_rgba(255,255,255,0.1)] animate-pulse`}>{incomingCall.peer[0]}</div>
                 <div>
                    <h2 className="text-4xl font-black tracking-tight mb-4">{incomingCall.peer}</h2>
                    <p className="text-blue-400 font-black uppercase tracking-[0.4em] text-xs">P2P Call Incoming</p>
                 </div>
                 <div className="flex gap-10">
                    <button onClick={endCall} className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all"><X className="w-10 h-10" /></button>
                    <button onClick={answerCall} className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all animate-bounce"><Phone className="w-10 h-10" /></button>
                 </div>
              </div>
            ) : (
              <div className="w-full h-full max-w-6xl mx-auto flex flex-col bg-slate-900 rounded-[3rem] overflow-hidden relative border border-white/10 shadow-3xl">
                 <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" onLoadedMetadata={() => { if(remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream; }} />
                 <div className="absolute top-10 left-10 p-6 bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10">
                    <h3 className="text-2xl font-black">{currentCall?.peer || incomingCall?.peer}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mt-1">Live Connection</p>
                 </div>
                 <div className="absolute bottom-12 right-12 w-48 h-72 bg-black rounded-3xl overflow-hidden border-4 border-white/20 shadow-2xl ring-10 ring-black/50">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" onLoadedMetadata={() => { if(localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream; }} />
                 </div>
                 <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-white/5 backdrop-blur-2xl p-5 rounded-[3rem] border border-white/10">
                    <button className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center"><Camera className="w-8 h-8" /></button>
                    <button onClick={endCall} className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center shadow-2xl active:scale-90"><X className="w-12 h-12" /></button>
                    <button className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center"><Smile className="w-8 h-8" /></button>
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
