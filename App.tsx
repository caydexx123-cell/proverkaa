
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { peerService } from './services/peerService.ts';
import { NetworkMessage, ChatMessage, PlayerProfile, AppSettings } from './types.ts';
import { 
  Search, Menu, Paperclip, 
  CheckCheck, LogOut, X, Phone, Video,
  Camera, Sun, Moon, 
  Mic, MicOff, Video as VideoIcon, VideoOff, 
  Clock, Play, Pause, Lock, ChevronLeft, User, ShieldCheck, Loader2, ShieldAlert, Trash2,
  Eye, EyeOff, MoreHorizontal, Ban, Share2, Globe, Cpu, Palette, Info, Volume2
} from 'lucide-react';

// Добавлен вспомогательный компонент для секций настроек
const SettingsSection: React.FC<{ title: string, icon: any, children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3 text-slate-400">
      <Icon size={18} />
      <h3 className="text-xs font-black uppercase tracking-widest">{title}</h3>
    </div>
    {children}
  </div>
);

const App: React.FC = () => {
  const [nickname, setNickname] = useState(() => localStorage.getItem('mm_nick') || '');
  const [password, setPassword] = useState('');
  const [storedPassword] = useState(() => localStorage.getItem('mm_pass') || '');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('mm_avatar') || '');
  const [regStep, setRegStep] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('mm_theme') as any) || 'light');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>(() => {
    const saved = localStorage.getItem('mm_convs');
    return saved ? JSON.parse(saved) : {};
  });
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>(() => {
    const saved = localStorage.getItem('mm_profiles');
    return saved ? JSON.parse(saved) : {};
  });
  const [contacts, setContacts] = useState<string[]>(() => {
    const saved = localStorage.getItem('mm_contacts');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [typingIds, setTypingIds] = useState<Set<string>>(new Set());

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  
  const [callSettings, setCallSettings] = useState<AppSettings>({ isMicMuted: false, isCamOff: false });
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState('');
  const [selectedOutputId, setSelectedOutputId] = useState('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const settingsAvatarInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(d => {
        setDevices(d);
        const a = d.find(i => i.kind === 'audioinput');
        if (a) setSelectedAudioId(a.deviceId);
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('mm_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (regStep === 3 && !isReady) handleInitialize();
  }, [regStep, isReady]);

  useEffect(() => {
    if (isAuthed) {
        localStorage.setItem('mm_convs', JSON.stringify(conversations));
        localStorage.setItem('mm_contacts', JSON.stringify(contacts));
        localStorage.setItem('mm_profiles', JSON.stringify(profiles));
        localStorage.setItem('mm_nick', nickname);
        localStorage.setItem('mm_pass', storedPassword || password);
        localStorage.setItem('mm_avatar', avatar);
    }
  }, [conversations, contacts, profiles, nickname, isAuthed]);

  useEffect(() => {
    if (activeChatId) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeChatId]);

  useEffect(() => {
    if (!isReady) return;
    const interval = setInterval(() => {
      contacts.forEach(id => peerService.sendTo(id, { type: 'HEARTBEAT', payload: null, senderId: peerService.getPeerId()!, senderNickname: nickname }));
    }, 10000);
    return () => clearInterval(interval);
  }, [isReady, contacts, nickname]);

  // Эффект для обновления srcObject при изменении удаленного потока
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleInitialize = async () => {
    const cleanNick = nickname.trim().toUpperCase();
    if (!cleanNick) return;
    try {
      await peerService.init(cleanNick);
      setIsReady(true);
    } catch (err: any) { 
      setSearchError("Ошибка инициализации");
      setRegStep(1);
    }
  };

  const handleAuth = () => {
    if (storedPassword ? password === storedPassword : password.length >= 4) {
      setIsAuthed(true);
      setRegStep(storedPassword ? 3 : 2);
    } else setSearchError(storedPassword ? "Неверный пароль" : "Минимум 4 символа");
  };

  const sendMyProfile = useCallback((targetId: string) => {
    if (!isReady) return;
    peerService.sendTo(targetId, { type: 'SYNC_PROFILE', payload: { avatar: localStorage.getItem('mm_avatar') || '' }, senderId: peerService.getPeerId()!, senderNickname: nickname });
  }, [isReady, nickname]);

  const handleMessage = useCallback((msg: NetworkMessage) => {
    if (msg.type === 'HEARTBEAT') return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (msg.type === 'SYNC_PROFILE') {
      setProfiles(prev => ({ ...prev, [msg.senderId]: { nickname: msg.senderNickname, avatar: msg.payload.avatar, joinedAt: Date.now(), online: true } }));
      if (!contacts.includes(msg.senderId)) setContacts(prev => [...new Set([...prev, msg.senderId])]);
      return;
    }

    if (msg.type === 'TYPING') {
        setTypingIds(prev => { const n = new Set(prev); if(msg.payload) n.add(msg.senderId); else n.delete(msg.senderId); return n; });
        return;
    }

    if (profiles[msg.senderId]?.blocked) return;

    const newMessage: ChatMessage = { id: msg.messageId || Math.random().toString(), senderId: msg.senderId, senderName: msg.senderNickname, time, isMe: false, type: msg.type };
    if (msg.type === 'CHAT') newMessage.text = msg.payload;
    if (msg.type === 'IMAGE') newMessage.imageUrl = msg.payload;
    if (msg.type === 'VOICE') newMessage.voiceUrl = msg.payload;
    if (msg.type === 'CALL_LOG') newMessage.callDuration = msg.payload;

    setConversations(prev => ({ ...prev, [msg.senderId]: [...(prev[msg.senderId] || []), newMessage] }));
    if (!contacts.includes(msg.senderId)) setContacts(prev => [...new Set([...prev, msg.senderId])]);
  }, [profiles, contacts]);

  useEffect(() => {
    if (!isReady) return;
    peerService.onMessage(handleMessage);
    peerService.onConnection(id => { sendMyProfile(id); setProfiles(prev => ({ ...prev, [id]: { ...prev[id], online: true } })); });
    peerService.onDisconnect(id => setProfiles(prev => ({ ...prev, [id]: { ...prev[id], online: false } })));
    peerService.onCall(call => setIncomingCall(call));
  }, [isReady, handleMessage, sendMyProfile]);

  const handleSearch = async () => {
    const target = searchQuery.trim().toUpperCase();
    if (!target || target === peerService.getPeerId()) return;
    setIsSearching(true);
    peerService.connectToPeer(target);
    setTimeout(() => {
      setIsSearching(false);
      sendMyProfile(target);
      if (!contacts.includes(target)) setContacts(prev => [...new Set([...prev, target])]);
      setActiveChatId(target);
      setSearchQuery('');
    }, 1500);
  };

  const sendMessage = (type: any, payload: any) => {
    if (!activeChatId) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = Math.random().toString();
    peerService.sendTo(activeChatId, { type, payload, senderId: peerService.getPeerId()!, senderNickname: nickname, messageId });
    const localMsg: ChatMessage = { id: messageId, senderId: peerService.getPeerId()!, senderName: nickname, time, isMe: true, type };
    if (type === 'CHAT') localMsg.text = payload;
    if (type === 'IMAGE') localMsg.imageUrl = payload;
    if (type === 'VOICE') localMsg.voiceUrl = payload;
    if (type === 'CALL_LOG') localMsg.callDuration = payload;
    setConversations(prev => ({ ...prev, [activeChatId]: [...(prev[activeChatId] || []), localMsg] }));
    setChatMessage('');
  };

  // Добавлена функция начала записи голосового сообщения
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          sendMessage('VOICE', reader.result);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
    }
  };

  // Добавлена функция остановки записи голосового сообщения
  const stopAndSendRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const VoiceMessagePlayer = ({ url, isMe }: { url: string, isMe: boolean }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);

    const togglePlay = async () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) {
            const context = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
            const source = context.createMediaElementSource(audio);
            const gainNode = context.createGain();
            gainNode.gain.value = 10.0;
            source.connect(gainNode);
            gainNode.connect(context.destination);
            audio.play();
            setIsPlaying(true);
        } else {
            audio.pause();
            setIsPlaying(false);
        }
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const update = () => setProgress((audio.currentTime / audio.duration) * 100 || 0);
        audio.addEventListener('timeupdate', update);
        audio.addEventListener('ended', () => setIsPlaying(false));
        return () => audio.removeEventListener('timeupdate', update);
    }, []);

    return (
      <div className={`flex items-center gap-3 p-3 min-w-[240px] rounded-3xl ${isMe ? 'bg-white/10' : 'bg-slate-200/40 dark:bg-zinc-800/80'}`}>
        <button onClick={togglePlay} className="w-10 h-10 rounded-full flex items-center justify-center bg-black dark:bg-white text-white dark:text-black">
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-current transition-all" style={{ width: `${progress}%` }} />
        </div>
        <audio ref={audioRef} src={url} className="hidden" />
      </div>
    );
  };

  const startCall = async (video: boolean) => {
    if (!activeChatId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user' } : false });
      setLocalStream(stream);
      const call = peerService.callPeer(activeChatId, stream);
      if (call) {
        setCallStartTime(Date.now());
        call.on('stream', (remote: MediaStream) => setRemoteStream(remote));
        call.on('close', endCall);
        setCurrentCall(call);
        setCallSettings({ isMicMuted: false, isCamOff: !video });
      }
    } catch (err) { alert("Ошибка доступа к камере/микрофону"); }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
      incomingCall.answer(stream);
      setCallStartTime(Date.now());
      incomingCall.on('stream', (remote: MediaStream) => setRemoteStream(remote));
      incomingCall.on('close', endCall);
      setCurrentCall(incomingCall);
      setIncomingCall(null);
    } catch (err) { alert("Ошибка ответа"); }
  };

  const endCall = () => {
    if (currentCall) currentCall.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setCurrentCall(null);
    setIncomingCall(null);
  };

  if (!isReady || !isAuthed) return (
    <div className="h-screen w-full flex items-center justify-center p-6 bg-white dark:bg-black">
      <div className="w-full max-w-sm glass p-10 rounded-[3rem] text-center shadow-2xl">
        <div className="w-24 h-24 bg-black dark:bg-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl">
           <span className="text-white dark:text-black font-black text-4xl italic">M</span>
        </div>
        {regStep === 1 ? (
          <div className="space-y-6">
            <h1 className="text-3xl font-black">MARTAM</h1>
            <input type="text" placeholder="Никнейм" className="w-full p-5 bg-slate-50 dark:bg-zinc-900 rounded-2xl font-bold" value={nickname} onChange={e => setNickname(e.target.value)} />
            <input type="password" placeholder="Пароль" className="w-full p-5 bg-slate-50 dark:bg-zinc-900 rounded-2xl font-bold" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==='Enter' && handleAuth()} />
            {searchError && <p className="text-red-500 text-xs font-black uppercase">{searchError}</p>}
            <button onClick={handleAuth} className="w-full p-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black">ВОЙТИ</button>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-black">ПРОФИЛЬ</h2>
            <div className="w-32 h-32 bg-slate-100 dark:bg-zinc-900 rounded-[2.5rem] mx-auto overflow-hidden flex items-center justify-center cursor-pointer border-4 border-white" onClick={() => avatarInputRef.current?.click()}>
              {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <Camera className="text-slate-400" />}
            </div>
            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={e => {
              const f = e.target.files?.[0];
              if(f) { const r = new FileReader(); r.onload = (ev) => setAvatar(ev.target?.result as string); r.readAsDataURL(f); }
            }} />
            <button onClick={() => setRegStep(3)} className="w-full p-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase">ГОТОВО</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-white dark:bg-black">
      <aside className={`w-full md:w-80 lg:w-[380px] border-r border-slate-100 dark:border-zinc-900 flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center"><span className="text-white dark:text-black font-black text-xl italic">M</span></div>
                <h1 className="text-2xl font-black tracking-tighter">MARTAM</h1>
            </div>
            <button onClick={() => setIsMenuOpen(true)} className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-xl"><Menu size={20} /></button>
        </div>
        <div className="px-8 pb-4"><input type="text" placeholder="Поиск по ID..." className="w-full p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl text-sm font-bold" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSearch()} /></div>
        <div className="flex-1 overflow-y-auto px-6 space-y-2">
            {contacts.map(id => (
                <div key={id} onClick={() => setActiveChatId(id)} className={`p-4 rounded-[2rem] flex items-center gap-4 cursor-pointer transition-all ${activeChatId === id ? 'bg-black text-white dark:bg-white dark:text-black shadow-xl' : 'hover:bg-slate-50 dark:hover:bg-zinc-900'}`}>
                    <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-zinc-800 overflow-hidden relative border border-white/10">
                        {profiles[id]?.avatar ? <img src={profiles[id].avatar} className="w-full h-full object-cover" /> : <User className="m-auto mt-4 text-slate-400" />}
                        {profiles[id]?.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-black" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-black text-sm uppercase truncate">{profiles[id]?.nickname || id}</h4>
                        <p className="text-[10px] opacity-60 truncate font-bold">P2P TUNNEL SECURED</p>
                    </div>
                </div>
            ))}
        </div>
      </aside>

      <main className={`flex-1 flex flex-col relative ${!activeChatId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {activeChatId ? (
          <>
            <header className="h-24 border-b border-slate-100 dark:border-zinc-900 flex items-center justify-between px-8 glass z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => setActiveChatId(null)} className="md:hidden p-3 bg-slate-100 dark:bg-zinc-800 rounded-xl"><ChevronLeft /></button>
                    <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-zinc-800 overflow-hidden cursor-pointer" onClick={() => setViewingProfileId(activeChatId)}>
                        {profiles[activeChatId]?.avatar ? <img src={profiles[activeChatId].avatar} className="w-full h-full object-cover" /> : <User className="m-auto mt-3 text-slate-400" />}
                    </div>
                    <div>
                        <h3 className="font-black text-lg uppercase leading-none mb-1">{profiles[activeChatId]?.nickname || activeChatId}</h3>
                        <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">{profiles[activeChatId]?.online ? 'В сети' : 'Офлайн'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => startCall(false)} className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl"><Phone size={20} /></button>
                    <button onClick={() => startCall(true)} className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl"><VideoIcon size={20} /></button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar bg-slate-50/10 dark:bg-black/50">
                {conversations[activeChatId]?.map(msg => (
                    <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`message-bubble rounded-[1.8rem] ${msg.isMe ? 'msg-me rounded-br-none' : 'msg-them rounded-bl-none'}`}>
                            {msg.type === 'IMAGE' && <img src={msg.imageUrl} className="rounded-xl mb-3 max-h-96" />}
                            {msg.type === 'VOICE' && <VoiceMessagePlayer url={msg.voiceUrl!} isMe={msg.isMe} />}
                            {msg.text && <p className="text-[15px] font-bold leading-relaxed">{msg.text}</p>}
                            <div className="flex justify-end gap-2 mt-2 opacity-40 text-[9px] font-black uppercase">
                                <span>{msg.time}</span>
                                {msg.isMe && <CheckCheck size={12} />}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <footer className="p-8">
                <div className="max-w-4xl mx-auto flex items-center gap-3 glass p-4 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-zinc-800">
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400"><Paperclip /></button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => {
                        const f = e.target.files?.[0];
                        if(f) { const r = new FileReader(); r.onload = (ev) => sendMessage('IMAGE', ev.target?.result); r.readAsDataURL(f); }
                    }} />
                    <textarea placeholder="Сообщение..." className="flex-1 bg-transparent border-none focus:outline-none py-2 font-bold resize-none custom-scrollbar" value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); if(chatMessage.trim()) sendMessage('CHAT', chatMessage); } }} />
                    {chatMessage.trim() ? (
                        <button onClick={() => sendMessage('CHAT', chatMessage)} className="w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center font-black italic">M</button>
                    ) : (
                        <button onClick={isRecording ? stopAndSendRecording : startRecording} className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-black dark:bg-white text-white dark:text-black'}`}>
                            {isRecording ? <span className="font-black italic">M</span> : <Mic />}
                        </button>
                    )}
                </div>
            </footer>
          </>
        ) : (
          <div className="text-center opacity-20">
            <Lock size={64} className="mx-auto mb-6" />
            <h2 className="text-2xl font-black uppercase tracking-widest">Безопасная зона</h2>
          </div>
        )}
      </main>

      {isMenuOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex justify-end" onClick={() => setIsMenuOpen(false)}>
            <div className="w-full max-w-sm bg-white dark:bg-zinc-950 p-12 flex flex-col animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
                <header className="text-center mb-10">
                    <div className="w-24 h-24 rounded-[2.5rem] mx-auto bg-slate-100 dark:bg-zinc-900 mb-4 overflow-hidden">
                        {avatar && <img src={avatar} className="w-full h-full object-cover" />}
                    </div>
                    <h2 className="text-2xl font-black uppercase">{nickname}</h2>
                    <p className="text-[10px] font-black text-slate-400 tracking-widest mt-2 uppercase">ID: {peerService.getPeerId()}</p>
                </header>
                <div className="flex-1 space-y-8">
                    <SettingsSection title="Тема" icon={Palette}>
                        <div className="flex gap-4">
                            <button onClick={() => setTheme('light')} className={`flex-1 p-4 rounded-2xl font-black uppercase text-[10px] ${theme==='light' ? 'bg-black text-white' : 'bg-slate-100 dark:bg-zinc-900'}`}>Светлая</button>
                            <button onClick={() => setTheme('dark')} className={`flex-1 p-4 rounded-2xl font-black uppercase text-[10px] ${theme==='dark' ? 'bg-white text-black' : 'bg-slate-100 dark:bg-zinc-900'}`}>Темная</button>
                        </div>
                    </SettingsSection>
                </div>
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full p-5 bg-red-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs">Выход и сброс</button>
            </div>
        </div>
      )}

      {(currentCall || incomingCall) && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col p-4">
            <div className="w-full max-w-4xl mx-auto h-full rounded-[3rem] bg-zinc-900 relative overflow-hidden flex flex-col items-center justify-center">
                <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl flex flex-col items-center justify-center text-white">
                    <div className="w-32 h-32 bg-white/10 rounded-full animate-pulse flex items-center justify-center mb-8"><User size={48} /></div>
                    <h2 className="text-4xl font-black uppercase">{(incomingCall || currentCall)?.peer}</h2>
                </div>
                <div className="absolute bottom-16 flex items-center gap-6 z-20">
                    {incomingCall && !currentCall ? (
                        <>
                            <button onClick={endCall} className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-white shadow-2xl"><X size={32} /></button>
                            <button onClick={answerCall} className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center text-white animate-bounce shadow-2xl"><Phone size={32} /></button>
                        </>
                    ) : (
                        <button onClick={endCall} className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-white shadow-2xl"><X size={32} /></button>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
