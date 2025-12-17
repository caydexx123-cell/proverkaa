
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { peerService } from './services/peerService.ts';
import { NetworkMessage, ChatMessage, PlayerProfile, AppSettings } from './types.ts';
import { 
  Search, Menu, Paperclip, 
  CheckCheck, LogOut, X, Phone, Video,
  Camera, Sun, Moon, 
  Mic, MicOff, Video as VideoIcon, VideoOff, 
  Play, Pause, Lock, ChevronLeft, User, ShieldCheck, Loader2, Trash2,
  Palette, UserPlus, Users, RefreshCw, Volume2
} from 'lucide-react';

interface Account {
  nickname: string;
  password: string;
  avatar?: string;
}

const SettingsSection: React.FC<{ title: string, icon: any, children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3 text-slate-400">
      <Icon size={18} />
      <h3 className="text-xs font-black uppercase tracking-widest">{title}</h3>
    </div>
    {children}
  </div>
);

const VoiceMessagePlayer: React.FC<{ url: string, isMe: boolean }> = ({ url, isMe }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <button onClick={toggle} className={`flex items-center gap-3 p-3 rounded-2xl ${isMe ? 'bg-white/20 text-white' : 'bg-black/5 text-black dark:bg-white/10 dark:text-white'} transition-all active:scale-95`}>
      {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      <div className="flex flex-col items-start text-left">
        <span className="text-[10px] font-black uppercase tracking-widest">Voice Message</span>
        <div className="flex gap-1 mt-1">
            {[...Array(8)].map((_, i) => (
                <div key={i} className={`w-0.5 h-2 rounded-full ${playing ? 'animate-pulse' : ''} ${isMe ? 'bg-white/40' : 'bg-black/20 dark:bg-white/20'}`} style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
        </div>
      </div>
    </button>
  );
};

const App: React.FC = () => {
  // --- Состояния аккаунтов ---
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('mm_accounts');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentAccountIndex, setCurrentAccountIndex] = useState<number | null>(() => {
    const saved = localStorage.getItem('mm_cur_acc');
    return saved !== null ? parseInt(saved) : null;
  });

  const activeAccount = currentAccountIndex !== null ? accounts[currentAccountIndex] : null;

  // --- Состояния авторизации ---
  const [authNickname, setAuthNickname] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [tempAvatar, setTempAvatar] = useState<string | undefined>();
  
  // --- Состояния UI ---
  const [regStep, setRegStep] = useState(() => (currentAccountIndex !== null ? 3 : 1));
  const [isReady, setIsReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(() => currentAccountIndex !== null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('mm_theme') as any) || 'light');
  
  // --- Состояния чата ---
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>({});
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>({});
  const [contacts, setContacts] = useState<string[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ isMicMuted: false, isCamOff: false });

  // --- Refs ---
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Звонки ---
  const [isRecording, setIsRecording] = useState(false);
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // --- Эффекты ---
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('mm_theme', theme);
  }, [theme]);

  useEffect(() => {
    const cleanup = () => peerService.destroy();
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, []);

  useEffect(() => {
    if (activeAccount) {
      const savedConvs = localStorage.getItem(`mm_convs_${activeAccount.nickname}`);
      const savedContacts = localStorage.getItem(`mm_contacts_${activeAccount.nickname}`);
      const savedProfs = localStorage.getItem(`mm_profiles_${activeAccount.nickname}`);
      setConversations(savedConvs ? JSON.parse(savedConvs) : {});
      setContacts(savedContacts ? JSON.parse(savedContacts) : []);
      setProfiles(savedProfs ? JSON.parse(savedProfs) : {});
    }
  }, [currentAccountIndex, activeAccount?.nickname]);

  useEffect(() => {
    localStorage.setItem('mm_accounts', JSON.stringify(accounts));
    if (currentAccountIndex !== null) localStorage.setItem('mm_cur_acc', currentAccountIndex.toString());
    else localStorage.removeItem('mm_cur_acc');
  }, [accounts, currentAccountIndex]);

  useEffect(() => {
    if (activeAccount && isAuthed) {
        localStorage.setItem(`mm_convs_${activeAccount.nickname}`, JSON.stringify(conversations));
        localStorage.setItem(`mm_contacts_${activeAccount.nickname}`, JSON.stringify(contacts));
        localStorage.setItem(`mm_profiles_${activeAccount.nickname}`, JSON.stringify(profiles));
    }
  }, [conversations, contacts, profiles, activeAccount, isAuthed]);

  // Загрузка устройств
  useEffect(() => {
    if (isMenuOpen) {
      navigator.mediaDevices.enumerateDevices().then(setDevices);
    }
  }, [isMenuOpen]);

  // --- Функции управления ---
  const handleInitialize = useCallback(async () => {
    if (!activeAccount) return;
    setIsReady(false);
    setSearchError(null);
    try {
      await peerService.init(activeAccount.nickname);
      setIsReady(true);
    } catch (err: any) { 
      console.error("[App] Initialization failed:", err);
      setSearchError(err.message || "Ошибка связи");
    }
  }, [activeAccount]);

  useEffect(() => {
    if (isAuthed && regStep === 3 && !isReady) handleInitialize();
  }, [isAuthed, regStep, isReady, handleInitialize]);

  const handleAuthSubmit = () => {
    const nick = authNickname.trim().toUpperCase();
    const pass = authPassword.trim();
    if (!nick || !pass) return;

    if (isRegistering) {
      if (accounts.length >= 3) {
        setSearchError("Максимум 3 аккаунта! Удалите старый.");
        return;
      }
      if (accounts.some(a => a.nickname === nick)) {
        setSearchError("Этот ник уже сохранен. Используйте Вход.");
        return;
      }
      const newAcc = { nickname: nick, password: pass, avatar: tempAvatar };
      const newAccounts = [...accounts, newAcc];
      setAccounts(newAccounts);
      setCurrentAccountIndex(newAccounts.length - 1);
      setRegStep(3);
      setIsAuthed(true);
    } else {
      const idx = accounts.findIndex(a => a.nickname === nick && a.password === pass);
      if (idx !== -1) {
        setCurrentAccountIndex(idx);
        setRegStep(3);
        setIsAuthed(true);
      } else {
        setSearchError("Аккаунт не найден или неверный пароль");
      }
    }
  };

  const switchAccount = (idx: number) => {
    if (idx === currentAccountIndex) return;
    console.log("[App] Switching to account:", accounts[idx].nickname);
    peerService.destroy();
    setIsReady(false);
    setIsMenuOpen(false);
    setActiveChatId(null);
    setSearchError(null);
    setConversations({});
    setContacts([]);
    setProfiles({});
    setCurrentAccountIndex(idx);
    setRegStep(3);
    setIsAuthed(true);
  };

  const logoutAndClear = () => {
    peerService.destroy();
    localStorage.removeItem('mm_cur_acc');
    setCurrentAccountIndex(null);
    setIsAuthed(false);
    setIsReady(false);
    setRegStep(1);
    setSearchError(null);
    setAuthNickname('');
    setAuthPassword('');
  };

  const deleteAccount = (idx: number) => {
    const acc = accounts[idx];
    localStorage.removeItem(`mm_convs_${acc.nickname}`);
    localStorage.removeItem(`mm_contacts_${acc.nickname}`);
    localStorage.removeItem(`mm_profiles_${acc.nickname}`);
    const newAccounts = accounts.filter((_, i) => i !== idx);
    setAccounts(newAccounts);
    if (currentAccountIndex === idx) logoutAndClear();
    else if (currentAccountIndex !== null && currentAccountIndex > idx) setCurrentAccountIndex(currentAccountIndex - 1);
  };

  const handleMessage = useCallback((msg: NetworkMessage) => {
    if (msg.type === 'HEARTBEAT') return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (msg.type === 'SYNC_PROFILE') {
      setProfiles(prev => ({ ...prev, [msg.senderId]: { nickname: msg.senderNickname, avatar: msg.payload.avatar, joinedAt: Date.now(), online: true } }));
      if (!contacts.includes(msg.senderId)) setContacts(prev => [...new Set([...prev, msg.senderId])]);
      return;
    }

    const newMessage: ChatMessage = { id: msg.messageId || Math.random().toString(), senderId: msg.senderId, senderName: msg.senderNickname, time, isMe: false, type: msg.type };
    if (msg.type === 'CHAT') newMessage.text = msg.payload;
    if (msg.type === 'IMAGE') newMessage.imageUrl = msg.payload;
    if (msg.type === 'VOICE') newMessage.voiceUrl = msg.payload;

    setConversations(prev => ({ ...prev, [msg.senderId]: [...(prev[msg.senderId] || []), newMessage] }));
    if (!contacts.includes(msg.senderId)) setContacts(prev => [...new Set([...prev, msg.senderId])]);
  }, [contacts]);

  useEffect(() => {
    if (!isReady) return;
    peerService.onMessage(handleMessage);
    peerService.onConnection(id => {
        if (activeAccount) {
            peerService.sendTo(id, { type: 'SYNC_PROFILE', payload: { avatar: activeAccount.avatar || '' }, senderId: peerService.getPeerId()!, senderNickname: activeAccount.nickname });
        }
        setProfiles(prev => ({ ...prev, [id]: { ...prev[id], online: true } }));
    });
    peerService.onDisconnect(id => setProfiles(prev => ({ ...prev, [id]: { ...prev[id], online: false } })));
    peerService.onCall(call => setIncomingCall(call));
  }, [isReady, handleMessage, activeAccount]);

  const handleSearch = () => {
    const id = searchQuery.trim().toUpperCase();
    if (!id || id === peerService.getPeerId()) return;
    if (!contacts.includes(id)) {
      setContacts(prev => [...prev, id]);
      peerService.connectToPeer(id);
    }
    setActiveChatId(id);
    setSearchQuery('');
  };

  const sendMessage = (type: any, payload: any) => {
    if (!activeChatId || !activeAccount) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = Math.random().toString();
    peerService.sendTo(activeChatId, { type, payload, senderId: peerService.getPeerId()!, senderNickname: activeAccount.nickname, messageId });
    const localMsg: ChatMessage = { id: messageId, senderId: peerService.getPeerId()!, senderName: activeAccount.nickname, time, isMe: true, type };
    if (type === 'CHAT') localMsg.text = payload;
    if (type === 'IMAGE') localMsg.imageUrl = payload;
    if (type === 'VOICE') localMsg.voiceUrl = payload;
    setConversations(prev => ({ ...prev, [activeChatId]: [...(prev[activeChatId] || []), localMsg] }));
    setChatMessage('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => sendMessage('VOICE', reader.result);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {}, 1000);
    } catch (err) { alert("Микрофон недоступен"); }
  };

  const stopAndSendRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  };

  const endCall = () => {
    if (currentCall) currentCall.close();
    if (incomingCall) incomingCall.close();
    setCurrentCall(null);
    setIncomingCall(null);
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
  };

  const startCall = async (video: boolean) => {
    if (!activeChatId) return;
    try {
      const constraints = {
        audio: appSettings.audioInputId ? { deviceId: appSettings.audioInputId } : true,
        video: video ? (appSettings.videoInputId ? { deviceId: appSettings.videoInputId } : true) : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      const call = peerService.callPeer(activeChatId, stream);
      if (call) {
        setCurrentCall(call);
        call.on('stream', (rStream) => setRemoteStream(rStream));
        call.on('close', endCall);
      }
    } catch (err) { alert("Не удалось начать звонок: " + err); }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
      incomingCall.answer(stream);
      setCurrentCall(incomingCall);
      setIncomingCall(null);
      incomingCall.on('stream', (rStream) => setRemoteStream(rStream));
      incomingCall.on('close', endCall);
    } catch (err) { alert("Не удалось ответить"); }
  };

  // --- Рендеринг ---
  if (!isAuthed || !isReady) return (
    <div className="h-screen w-full flex items-center justify-center p-6 bg-white dark:bg-black">
      <div className="w-full max-w-sm glass p-10 rounded-[3rem] text-center shadow-2xl animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-black dark:bg-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl relative overflow-hidden">
           {isRegistering && tempAvatar ? <img src={tempAvatar} className="w-full h-full object-cover" /> : <span className="text-white dark:text-black font-black text-4xl italic">M</span>}
        </div>
        
        {regStep === 1 ? (
          <div className="space-y-6">
            <h1 className="text-3xl font-black uppercase tracking-tighter">{isRegistering ? 'РЕГИСТРАЦИЯ' : 'ВХОД'}</h1>
            {isRegistering && (
                <button onClick={() => avatarInputRef.current?.click()} className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Выбрать аватар</button>
            )}
            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={e => {
                const f = e.target.files?.[0];
                if(f) { const r = new FileReader(); r.onload = (ev) => setTempAvatar(ev.target?.result as string); r.readAsDataURL(f); }
            }} />
            <input type="text" placeholder="НИКНЕЙМ" className="w-full p-5 bg-slate-50 dark:bg-zinc-900 rounded-2xl font-bold uppercase" value={authNickname} onChange={e => setAuthNickname(e.target.value)} />
            <input type="password" placeholder="ПАРОЛЬ" className="w-full p-5 bg-slate-50 dark:bg-zinc-900 rounded-2xl font-bold" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key==='Enter' && handleAuthSubmit()} />
            {searchError && <p className="text-red-500 text-[10px] font-black uppercase animate-pulse leading-tight">{searchError}</p>}
            <button onClick={handleAuthSubmit} className="w-full p-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                {isRegistering ? 'Создать MARTAM' : 'Войти'}
            </button>
            <div className="pt-4 flex flex-col gap-4">
                <button onClick={() => { setIsRegistering(!isRegistering); setSearchError(null); }} className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Регистрация'}
                </button>
                {accounts.length > 0 && !isRegistering && (
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                        {accounts.map((acc, i) => (
                            <button key={i} onClick={() => switchAccount(i)} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 overflow-hidden border border-border">
                                {acc.avatar ? <img src={acc.avatar} className="w-full h-full object-cover" /> : <span className="font-bold text-xs uppercase">{acc.nickname[0]}</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
          </div>
        ) : (
            <div className="space-y-8 py-4">
                {searchError ? (
                    <div className="space-y-6">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto">
                            <X size={32} />
                        </div>
                        <p className="text-xs font-black uppercase text-red-500 px-4 leading-normal">{searchError}</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={handleInitialize} className="flex items-center justify-center gap-2 p-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase text-[10px] tracking-widest">
                                <RefreshCw size={14} /> Повторить
                            </button>
                            <button onClick={() => { setIsAuthed(false); setRegStep(1); }} className="p-4 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">
                                Назад к входу
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <Loader2 className="w-16 h-16 animate-spin mx-auto text-black dark:text-white" />
                        <h2 className="text-xl font-black uppercase tracking-tighter">Синхронизация P2P...</h2>
                        <p className="text-[9px] font-black uppercase opacity-30 tracking-widest">Проверка доступности ID на сервере</p>
                    </>
                )}
            </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-white dark:bg-black">
      {/* --- Боковая панель --- */}
      <aside className={`w-full md:w-80 lg:w-[380px] border-r border-slate-100 dark:border-zinc-900 flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center"><span className="text-white dark:text-black font-black text-xl italic">M</span></div>
                <h1 className="text-2xl font-black tracking-tighter uppercase">MARTAM</h1>
            </div>
            <button onClick={() => setIsMenuOpen(true)} className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-xl active:scale-90 transition-all"><Menu size={20} /></button>
        </div>
        <div className="px-8 pb-4">
            <input type="text" placeholder="Поиск по ID..." className="w-full p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl text-sm font-bold uppercase" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSearch()} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 space-y-2 custom-scrollbar">
            {contacts.map(id => (
                <div key={id} onClick={() => setActiveChatId(id)} className={`p-4 rounded-[2rem] flex items-center gap-4 cursor-pointer transition-all ${activeChatId === id ? 'bg-black text-white dark:bg-white dark:text-black shadow-xl' : 'hover:bg-slate-50 dark:hover:bg-zinc-900'}`}>
                    <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-zinc-800 overflow-hidden relative border border-white/10">
                        {profiles[id]?.avatar ? <img src={profiles[id].avatar} className="w-full h-full object-cover" /> : <User className="m-auto mt-4 text-slate-400" />}
                        {profiles[id]?.online && <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-black shadow-lg" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-black text-sm uppercase truncate">{profiles[id]?.nickname || id}</h4>
                        <p className="text-[10px] opacity-60 truncate font-bold uppercase tracking-widest">{profiles[id]?.online ? 'Online' : 'P2P Secured'}</p>
                    </div>
                </div>
            ))}
        </div>
      </aside>

      {/* --- Основной чат --- */}
      <main className={`flex-1 flex flex-col relative ${!activeChatId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {activeChatId ? (
          <>
            <header className="h-24 border-b border-slate-100 dark:border-zinc-900 flex items-center justify-between px-8 glass z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => setActiveChatId(null)} className="md:hidden p-3 bg-slate-100 dark:bg-zinc-800 rounded-xl active:scale-90"><ChevronLeft /></button>
                    {/* Fixed: Removed non-existent setViewingProfileId call to resolve compilation error */}
                    <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                        {profiles[activeChatId]?.avatar ? <img src={profiles[activeChatId].avatar} className="w-full h-full object-cover" /> : <User className="m-auto mt-3 text-slate-400" />}
                    </div>
                    <div>
                        <h3 className="font-black text-lg uppercase tracking-tight">{profiles[activeChatId]?.nickname || activeChatId}</h3>
                        <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">{profiles[activeChatId]?.online ? 'В сети' : 'Офлайн'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => startCall(false)} className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl hover:scale-105 transition-all"><Phone size={20} /></button>
                    <button onClick={() => startCall(true)} className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl hover:scale-105 transition-all"><VideoIcon size={20} /></button>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                {conversations[activeChatId]?.map(msg => (
                    <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`message-bubble rounded-[1.8rem] ${msg.isMe ? 'msg-me rounded-br-none' : 'msg-them rounded-bl-none'}`}>
                            {msg.imageUrl && <img src={msg.imageUrl} className="rounded-xl mb-3 max-h-96 w-full object-contain" />}
                            {msg.voiceUrl && <div className="mb-2"><VoiceMessagePlayer url={msg.voiceUrl} isMe={msg.isMe} /></div>}
                            {msg.text && <p className="text-[15px] font-bold leading-relaxed">{msg.text}</p>}
                            <div className="flex justify-end gap-2 mt-2 opacity-50 text-[9px] font-black uppercase">
                                <span>{msg.time}</span>
                                {msg.isMe && <CheckCheck size={12} />}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <footer className="p-8">
                <div className="max-w-4xl mx-auto flex items-end gap-3 glass p-4 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-zinc-800">
                    <button onClick={() => fileInputRef.current?.click()} className="p-4 text-slate-400 hover:text-black transition-all"><Paperclip size={20}/></button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { const r = new FileReader(); r.onload = (ev) => sendMessage('IMAGE', ev.target?.result as string); r.readAsDataURL(f); }
                    }} />
                    <textarea placeholder="Написать..." className="flex-1 bg-transparent border-none focus:outline-none py-3 font-bold resize-none custom-scrollbar max-h-32" value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); if(chatMessage.trim()) sendMessage('CHAT', chatMessage); } }} />
                    <button onClick={isRecording ? stopAndSendRecording : (chatMessage.trim() ? () => sendMessage('CHAT', chatMessage) : startRecording)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-black dark:bg-white text-white dark:text-black shadow-lg'}`}>
                        {isRecording ? <span className="font-black italic text-lg">M</span> : (chatMessage.trim() ? <span className="font-black italic text-lg">M</span> : <Mic size={20} />)}
                    </button>
                </div>
            </footer>
          </>
        ) : (
          <div className="text-center opacity-10">
            <Lock size={80} className="mx-auto mb-6" />
            <h2 className="text-3xl font-black uppercase tracking-[0.5em]">MARTAM SECURE</h2>
          </div>
        )}
      </main>

      {/* --- Меню настроек --- */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex justify-end" onClick={() => setIsMenuOpen(false)}>
            <div className="w-full max-sm:w-[85%] max-w-sm bg-white dark:bg-zinc-950 p-8 md:p-12 flex flex-col animate-in slide-in-from-right duration-500 overflow-y-auto" onClick={e => e.stopPropagation()}>
                <header className="text-center mb-10">
                    <div className="w-24 h-24 rounded-premium mx-auto bg-slate-100 dark:bg-zinc-900 mb-6 overflow-hidden border-4 border-white shadow-xl">
                        {activeAccount?.avatar ? <img src={activeAccount.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-black uppercase">{activeAccount?.nickname[0]}</div>}
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">{activeAccount?.nickname}</h2>
                    <p className="text-[10px] font-black text-slate-400 tracking-widest mt-2 uppercase">ID: {peerService.getPeerId()}</p>
                </header>

                <div className="flex-1 space-y-10">
                    <SettingsSection title="Мульти-аккаунты (макс 3)" icon={Users}>
                        <div className="space-y-3">
                            {accounts.map((acc, i) => (
                                <div key={i} className={`flex items-center justify-between p-4 rounded-3xl border-2 transition-all ${currentAccountIndex === i ? 'border-black dark:border-white bg-slate-50 dark:bg-zinc-900' : 'border-transparent bg-slate-50/50 dark:bg-zinc-900/10'}`}>
                                    <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => switchAccount(i)}>
                                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                                            {acc.avatar ? <img src={acc.avatar} className="w-full h-full object-cover" /> : <span className="m-auto font-black uppercase">{acc.nickname[0]}</span>}
                                        </div>
                                        <span className="font-black text-sm uppercase">{acc.nickname}</span>
                                    </div>
                                    <button onClick={() => deleteAccount(i)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl"><Trash2 size={16} /></button>
                                </div>
                            ))}
                            {accounts.length < 3 && (
                                <button onClick={() => { logoutAndClear(); setIsRegistering(true); }} className="w-full p-4 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-3 text-slate-400 hover:text-black transition-all">
                                    <UserPlus size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">Добавить аккаунт</span>
                                </button>
                            )}
                        </div>
                    </SettingsSection>

                    <SettingsSection title="Периферия" icon={Volume2}>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-2">Микрофон</p>
                          <select 
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl text-[11px] font-bold outline-none"
                            value={appSettings.audioInputId}
                            onChange={e => setAppSettings(prev => ({...prev, audioInputId: e.target.value}))}
                          >
                            <option value="">По умолчанию</option>
                            {devices.filter(d => d.kind === 'audioinput').map(d => (
                              <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-2">Камера</p>
                          <select 
                            className="w-full p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl text-[11px] font-bold outline-none"
                            value={appSettings.videoInputId}
                            onChange={e => setAppSettings(prev => ({...prev, videoInputId: e.target.value}))}
                          >
                            <option value="">По умолчанию</option>
                            {devices.filter(d => d.kind === 'videoinput').map(d => (
                              <option key={d.deviceId} value={d.deviceId}>{d.label || `Cam ${d.deviceId.slice(0,5)}`}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </SettingsSection>

                    <SettingsSection title="Оформление" icon={Palette}>
                        <div className="flex gap-4">
                            <button onClick={() => setTheme('light')} className={`flex-1 p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 ${theme==='light' ? 'bg-black text-white border-black' : 'bg-slate-50 dark:bg-zinc-900 border-transparent text-slate-400'}`}>Светлая</button>
                            <button onClick={() => setTheme('dark')} className={`flex-1 p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 ${theme==='dark' ? 'bg-white text-black border-white' : 'bg-slate-50 dark:bg-zinc-900 border-transparent text-slate-400'}`}>Темная</button>
                        </div>
                    </SettingsSection>
                </div>

                <button onClick={logoutAndClear} className="w-full p-5 bg-red-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs mt-10 shadow-xl shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <LogOut size={18} /> Выход из системы
                </button>
            </div>
        </div>
      )}

      {/* --- Окно звонка --- */}
      {(currentCall || incomingCall) && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col p-4">
            <div className="w-full max-w-4xl mx-auto h-full rounded-[3.5rem] bg-zinc-950 relative overflow-hidden flex flex-col items-center justify-center border border-white/5 shadow-2xl">
                <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 backdrop-blur-3xl flex flex-col items-center justify-center text-white">
                    <div className="w-32 h-32 bg-white/5 rounded-[2.5rem] animate-pulse flex items-center justify-center mb-8 border border-white/10 overflow-hidden">
                        <User size={64} className="text-white/20" />
                    </div>
                    <h2 className="text-4xl font-black uppercase tracking-tighter">{(incomingCall || currentCall)?.peer?.replace('MARTAM_', '')}</h2>
                </div>
                <div className="absolute bottom-20 flex items-center gap-8 z-20">
                    {incomingCall && !currentCall ? (
                        <>
                            <button onClick={endCall} className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-white shadow-2xl active:scale-90 transition-all"><X size={32} /></button>
                            <button onClick={answerCall} className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center text-white animate-bounce shadow-2xl active:scale-90 transition-all"><Phone size={40} /></button>
                        </>
                    ) : (
                        <button onClick={endCall} className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center text-white shadow-2xl active:scale-90 transition-all"><X size={40} /></button>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
