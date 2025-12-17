
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

const App: React.FC = () => {
  // Account & UI States
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

  // Recording Logic
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  
  // Call Controls
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

  // Device handling
  useEffect(() => {
    const updateDevices = () => {
        navigator.mediaDevices.enumerateDevices().then(d => {
            setDevices(d);
            const firstAudio = d.find(i => i.kind === 'audioinput');
            const firstOutput = d.find(i => i.kind === 'audiooutput');
            if (firstAudio && !selectedAudioId) setSelectedAudioId(firstAudio.deviceId);
            if (firstOutput && !selectedOutputId) setSelectedOutputId(firstOutput.deviceId);
        }).catch(err => console.log('Device enum failed:', err));
    };
    updateDevices();
    navigator.mediaDevices.addEventListener('devicechange', updateDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', updateDevices);
  }, [selectedAudioId, selectedOutputId]);

  // Theme Sync
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('mm_theme', theme);
  }, [theme]);

  // Initialization trigger
  useEffect(() => {
    if (regStep === 3 && !isReady) {
      handleInitialize();
    }
  }, [regStep, isReady]);

  // Sync state to local storage
  useEffect(() => {
    if (isAuthed) {
        localStorage.setItem('mm_convs', JSON.stringify(conversations));
        localStorage.setItem('mm_contacts', JSON.stringify(contacts));
        localStorage.setItem('mm_profiles', JSON.stringify(profiles));
        localStorage.setItem('mm_nick', nickname);
        localStorage.setItem('mm_pass', storedPassword || password);
        localStorage.setItem('mm_avatar', avatar);
    }
  }, [conversations, contacts, profiles, nickname, password, avatar, isAuthed, storedPassword]);

  useEffect(() => {
    if (activeChatId) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversations, activeChatId]);

  // HEARTBEAT mechanism to keep P2P connections alive
  useEffect(() => {
    if (!isReady) return;
    const interval = setInterval(() => {
      contacts.forEach(id => {
        peerService.sendTo(id, {
          type: 'HEARTBEAT',
          payload: null,
          senderId: peerService.getPeerId()!,
          senderNickname: nickname
        });
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [isReady, contacts, nickname]);

  const handleInitialize = async () => {
    const cleanNick = nickname.trim().toUpperCase();
    if (!cleanNick) return;
    try {
      const initPromise = peerService.init(cleanNick);
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));
      await Promise.race([initPromise, timeout]);
      setIsReady(true);
    } catch (err: any) { 
      console.error("Initialization error:", err);
      setSearchError(err.message === "Ник занят" ? "Никнейм уже занят" : "Ошибка сети. Обновите MARTAM.");
      setRegStep(1);
    }
  };

  const handleAuth = () => {
    const p = password.trim();
    if (storedPassword) {
        if (p === storedPassword) {
            setIsAuthed(true);
            setRegStep(3);
        } else {
            setSearchError("Пароль не совпадает");
        }
    } else {
        if (p.length >= 4) {
            setIsAuthed(true);
            setRegStep(2);
        } else {
            setSearchError("Минимум 4 символа");
        }
    }
  };

  const sendMyProfile = useCallback((targetId: string) => {
    if (!isReady) return;
    const currentAvatar = localStorage.getItem('mm_avatar') || '';
    peerService.sendTo(targetId, {
      type: 'SYNC_PROFILE',
      payload: { avatar: currentAvatar },
      senderId: peerService.getPeerId()!,
      senderNickname: nickname
    });
  }, [isReady, nickname]);

  const sendTypingStatus = (status: boolean) => {
    if (!activeChatId || !isReady) return;
    peerService.sendTo(activeChatId, {
      type: 'TYPING',
      payload: status,
      senderId: peerService.getPeerId()!,
      senderNickname: nickname
    });
  };

  const handleMessage = useCallback((msg: NetworkMessage) => {
    if (msg.type === 'HEARTBEAT') return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (msg.type === 'TYPING') {
      setTypingIds(prev => {
        const next = new Set(prev);
        if (msg.payload) next.add(msg.senderId);
        else next.delete(msg.senderId);
        return next;
      });
      return;
    }

    if (msg.type === 'SYNC_PROFILE') {
      setProfiles(prev => ({
        ...prev,
        [msg.senderId]: {
          nickname: msg.senderNickname,
          avatar: msg.payload.avatar,
          joinedAt: prev[msg.senderId]?.joinedAt || Date.now(),
          online: true
        }
      }));
      if (!contacts.includes(msg.senderId)) setContacts(prev => [...prev, msg.senderId]);
      return;
    }
    
    if (profiles[msg.senderId]?.blocked) return;

    const newMessage: ChatMessage = {
      id: msg.messageId || Math.random().toString(),
      senderId: msg.senderId,
      senderName: msg.senderNickname,
      time,
      isMe: false,
      isRead: false,
      type: msg.type
    };

    if (msg.type === 'CHAT') newMessage.text = msg.payload;
    if (msg.type === 'IMAGE') newMessage.imageUrl = msg.payload;
    if (msg.type === 'VOICE') newMessage.voiceUrl = msg.payload;
    if (msg.type === 'CALL_LOG') newMessage.callDuration = msg.payload;

    setConversations(prev => ({
      ...prev,
      [msg.senderId]: [...(prev[msg.senderId] || []), newMessage]
    }));
    
    if (!contacts.includes(msg.senderId)) setContacts(prev => [...prev, msg.senderId]);
  }, [profiles, contacts]);

  useEffect(() => {
    if (!isReady) return;
    peerService.onMessage(handleMessage);
    peerService.onConnection(id => {
      console.log('Connected with:', id);
      sendMyProfile(id);
      setProfiles(prev => ({ ...prev, [id]: { ...prev[id], online: true } }));
      if (!contacts.includes(id)) setContacts(prev => [...prev, id]);
    });
    peerService.onDisconnect(id => {
      setProfiles(prev => ({ ...prev, [id]: { ...prev[id], online: false } }));
    });
    peerService.onCall(call => {
        console.log('Receiving call from:', call.peer);
        setIncomingCall(call);
    });
  }, [isReady, handleMessage, sendMyProfile, contacts]);

  const handleSearch = async () => {
    const target = searchQuery.trim().toUpperCase();
    if (!target || target === peerService.getPeerId()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      peerService.connectToPeer(target);
      setTimeout(() => {
        setIsSearching(false);
        sendMyProfile(target);
        if (!contacts.includes(target)) setContacts(prev => [...prev, target]);
        setActiveChatId(target);
        setSearchQuery('');
        if (!profiles[target]) setProfiles(prev => ({ ...prev, [target]: { nickname: target, joinedAt: Date.now(), online: true } }));
      }, 1500);
    } catch (err) {
      setIsSearching(false);
      setSearchError("ID не в сети или не существует");
    }
  };

  const sendMessage = (type: any, payload: any) => {
    if (!activeChatId || profiles[activeChatId]?.blocked) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = Math.random().toString();
    
    const networkMsg: NetworkMessage = { type, payload, senderId: peerService.getPeerId()!, senderNickname: nickname, messageId };
    peerService.sendTo(activeChatId, networkMsg);
    
    const localMsg: ChatMessage = { id: messageId, senderId: peerService.getPeerId()!, senderName: nickname, time, isMe: true, isRead: false, type };
    if (type === 'CHAT') localMsg.text = payload;
    if (type === 'IMAGE') localMsg.imageUrl = payload;
    if (type === 'VOICE') localMsg.voiceUrl = payload;
    if (type === 'CALL_LOG') localMsg.callDuration = payload;

    setConversations(prev => ({ ...prev, [activeChatId]: [...(prev[activeChatId] || []), localMsg] }));
    setChatMessage('');
    sendTypingStatus(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
            const reader = new FileReader();
            reader.onload = (e) => sendMessage('VOICE', e.target?.result);
            reader.readAsDataURL(blob);
        }
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      recorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (e) { 
        console.error("Recording error:", e);
        alert("Микрофон заблокирован или недоступен"); 
    }
  };

  const stopAndSendRecording = () => {
    if (recorderRef.current && isRecording) {
        recorderRef.current.stop();
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingTime(0);
    }
  };

  const cancelRecording = () => {
    if (recorderRef.current && isRecording) {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingTime(0);
    }
  };

  const handleTyping = (val: string) => {
    setChatMessage(val);
    if (!typingTimeoutRef.current) {
        sendTypingStatus(true);
    } else {
        window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
        sendTypingStatus(false);
        typingTimeoutRef.current = null;
    }, 2000);
  };

  const VoiceMessagePlayer = ({ url, isMe }: { url: string, isMe: boolean }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);

    const togglePlay = async () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (!audioContextRef.current) {
            try {
                const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
                const context = new AudioContextClass();
                const source = context.createMediaElementSource(audio);
                const gainNode = context.createGain();
                
                // ЭКСТРЕМАЛЬНОЕ УСИЛЕНИЕ ЗВУКА: 10.0 (1000% громкости)
                gainNode.gain.value = 10.0; 
                
                source.connect(gainNode);
                gainNode.connect(context.destination);
                
                audioContextRef.current = context;
                gainNodeRef.current = gainNode;
            } catch (e) {
                console.warn("Audio boost failed", e);
            }
        }

        if (audio.paused) {
            if (audioContextRef.current?.state === 'suspended') {
                await audioContextRef.current.resume();
            }
            audio.play().catch(err => console.error("Playback failed", err));
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

    const bars = [30, 60, 40, 80, 50, 70, 35, 65, 45, 75, 30, 50, 60, 40, 80, 50, 70, 35, 65, 45];

    return (
      <div className={`flex items-center gap-3 p-3 min-w-[260px] rounded-3xl relative overflow-hidden ${isMe ? 'bg-white/10' : 'bg-slate-200/40 dark:bg-zinc-800/80 border border-border'}`}>
        <button onClick={togglePlay} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md z-10 ${isMe ? 'bg-white text-black' : 'bg-black text-white'}`}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-0.5" />}
        </button>
        <div className="flex-1 flex flex-col gap-1.5 z-10">
            <div className="flex gap-[3.5px] items-center h-5">
                {bars.map((h, i) => (
                    <div 
                        key={i} 
                        className={`w-[2.5px] rounded-full transition-all duration-300 ${isMe ? (progress > (i/bars.length)*100 ? 'bg-white' : 'bg-white/30') : (progress > (i/bars.length)*100 ? 'bg-black dark:bg-white' : 'bg-black/10 dark:bg-white/10')}`} 
                        style={{ height: `${h}%` }} 
                    />
                ))}
            </div>
            <div className="flex justify-between items-center px-0.5">
                <span className={`text-[7px] font-black uppercase tracking-[0.2em] opacity-40 flex items-center gap-1 ${isMe ? 'text-white' : 'text-black dark:text-white'}`}>
                   {isPlaying ? 'MAX VOLUME' : 'VOICE BOOSTED'} <Volume2 className="w-2.5 h-2.5" />
                </span>
            </div>
        </div>
        <audio ref={audioRef} src={url} crossOrigin="anonymous" className="hidden" />
      </div>
    );
  };

  const startCall = async (video: boolean) => {
    if (!activeChatId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: video ? { facingMode: 'user' } : false 
      });
      setLocalStream(stream);
      const call = peerService.callPeer(activeChatId, stream);
      if (call) {
        setCallStartTime(Date.now());
        call.on('stream', (remote: MediaStream) => setRemoteStream(remote));
        call.on('close', finalizeCall);
        call.on('error', (err: any) => {
            console.error("Call error:", err);
            finalizeCall();
        });
        setCurrentCall(call);
        setCallSettings({ isMicMuted: false, isCamOff: !video });
      }
    } catch (err) { 
        console.error("Start call failed:", err);
        alert("Ошибка вызова: Проверьте разрешения камеры/микрофона"); 
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: true 
      });
      setLocalStream(stream);
      incomingCall.answer(stream);
      setCallStartTime(Date.now());
      incomingCall.on('stream', (remote: MediaStream) => {
          console.log('Remote stream received');
          setRemoteStream(remote);
      });
      incomingCall.on('close', finalizeCall);
      incomingCall.on('error', (err: any) => {
          console.error("Answer call error:", err);
          finalizeCall();
      });
      setCurrentCall(incomingCall);
      setIncomingCall(null);
    } catch (err) { 
        console.error("Answer call failed:", err);
        alert("Ошибка принятия вызова: Разрешите доступ к медиа"); 
    }
  };

  const finalizeCall = () => {
    if (callStartTime) {
      const durationSec = Math.floor((Date.now() - callStartTime) / 1000);
      sendMessage('CALL_LOG', `${Math.floor(durationSec / 60)}:${(durationSec % 60).toString().padStart(2, '0')}`);
    }
    endCall();
  };

  const endCall = () => {
    if (currentCall) {
        try { currentCall.close(); } catch(e) {}
    }
    if (incomingCall) {
        try { incomingCall.close(); } catch(e) {}
    }
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCurrentCall(null);
    setIncomingCall(null);
    setCallStartTime(null);
  };

  const toggleMic = () => {
    const newState = !callSettings.isMicMuted;
    setCallSettings(p => ({ ...p, isMicMuted: newState }));
    if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = !newState);
  };

  const toggleCam = () => {
    const newState = !callSettings.isCamOff;
    setCallSettings(p => ({ ...p, isCamOff: newState }));
    if (localStream) localStream.getVideoTracks().forEach(t => t.enabled = !newState);
  };

  const SettingsSection = ({ title, icon: Icon, children }: any) => (
    <div className="space-y-4">
        <div className="flex items-center gap-2.5 px-1.5">
            <div className="p-1.5 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                <Icon className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</span>
        </div>
        <div className="glass rounded-[2rem] p-5 space-y-4 bg-slate-50/40 dark:bg-zinc-900/40 border border-slate-100 dark:border-zinc-800 shadow-sm transition-all hover:border-slate-200 dark:hover:border-zinc-700">
            {children}
        </div>
    </div>
  );

  const Logo = ({ size = "text-2xl" }: { size?: string }) => (
    <div className="flex items-center gap-3 select-none">
        <div className={`aspect-square w-10 flex items-center justify-center bg-black dark:bg-white rounded-xl shadow-lg`}>
            <span className="text-white dark:text-black font-black text-xl italic leading-none">M</span>
        </div>
        <h1 className={`${size} font-black tracking-tighter uppercase`}>MARTAM</h1>
    </div>
  );

  if (!isReady || !isAuthed) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-4 bg-white dark:bg-black transition-colors overflow-hidden">
        <div className="w-full max-w-sm glass p-10 rounded-[3rem] shadow-2xl text-center relative z-10">
            {regStep === 1 && (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex flex-col items-center">
                        <div className="w-24 h-24 bg-black dark:bg-white rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl">
                           <span className="text-white dark:text-black font-black text-4xl italic">M</span>
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter">MARTAM</h1>
                    </div>
                    
                    <div className="space-y-4 text-left">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest ml-2 opacity-50 block mb-1.5">Никнейм</label>
                            <input 
                                type="text" 
                                placeholder="ALEX"
                                disabled={!!storedPassword}
                                className={`w-full py-4 px-6 font-bold placeholder:text-slate-300 focus:bg-slate-50 dark:focus:bg-zinc-900 transition-all rounded-2xl border border-border ${storedPassword ? 'opacity-40' : ''}`}
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest ml-2 opacity-50 block mb-1.5">Пароль</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    placeholder="••••••"
                                    className="w-full py-4 px-6 font-bold focus:bg-slate-50 dark:focus:bg-zinc-900 transition-all rounded-2xl border border-border"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAuth()}
                                />
                                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 p-2">
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        {searchError && (
                            <div className="flex items-center gap-2 justify-center text-red-500 animate-in fade-in">
                                <ShieldAlert className="w-4 h-4" />
                                <p className="text-[10px] font-black uppercase">{searchError}</p>
                            </div>
                        )}
                    </div>
                    <button onClick={handleAuth} className="w-full py-4.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                        {storedPassword ? "Продолжить" : "Создать MARTAM"}
                    </button>
                </div>
            )}
            {regStep === 2 && (
                <div className="space-y-10 animate-in fade-in slide-in-from-right duration-500">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black tracking-tight">Ваш профиль</h2>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Персонализация аккаунта</p>
                    </div>
                    <div 
                        className="w-40 h-40 rounded-[2.5rem] bg-slate-100 dark:bg-zinc-900 flex items-center justify-center cursor-pointer mx-auto group overflow-hidden relative border-4 border-white dark:border-zinc-800 shadow-2xl"
                        onClick={() => avatarInputRef.current?.click()}
                    >
                        {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <Camera className="w-10 h-10 text-slate-400" />}
                        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => {
                             const f = e.target.files?.[0];
                             if(f) {
                                const r = new FileReader();
                                r.onload = (ev) => {
                                    const data = ev.target?.result as string;
                                    setAvatar(data);
                                    localStorage.setItem('mm_avatar', data);
                                };
                                r.readAsDataURL(f);
                             }
                        }} />
                    </div>
                    <button onClick={() => setRegStep(3)} className="w-full py-5 rounded-[2rem] bg-black dark:bg-white text-white dark:text-black font-black text-lg shadow-xl active:scale-95 transition-all">Начать общение</button>
                </div>
            )}
            {regStep === 3 && (
                <div className="py-12 flex flex-col items-center space-y-8 animate-pulse">
                    <Loader2 className="w-16 h-16 animate-spin text-black dark:text-white" />
                    <div className="text-center">
                        <p className="text-black dark:text-white font-black text-[12px] tracking-[0.4em] uppercase mb-1">Инициализация</p>
                        <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">P2P TUNNELING SECURED</p>
                    </div>
                </div>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden relative transition-colors bg-white dark:bg-black">
      <div className="flex-1 flex relative z-10 h-full">
        <aside className={`w-full md:w-80 lg:w-[380px] bg-white dark:bg-black border-r border-slate-100 dark:border-zinc-900 flex flex-col flex-shrink-0 transition-all ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-8 pb-4 flex flex-col gap-8">
                <div className="flex items-center justify-between">
                    <Logo />
                    <button onClick={() => setIsMenuOpen(true)} className="w-12 h-12 rounded-2xl flex items-center justify-center btn-modern shadow-sm active:scale-90">
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
                <div className="relative group">
                    <Search className={`absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${isSearching ? 'animate-spin' : ''}`} />
                    <input 
                        type="text" 
                        placeholder="Поиск по ID..."
                        className="w-full rounded-[1.5rem] py-4 pl-14 pr-6 text-sm font-bold outline-none shadow-sm border border-transparent focus:border-border transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-12 space-y-2 mt-4">
                {contacts.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-20 text-center px-10">
                        <Globe className="w-12 h-12 mb-4" />
                        <p className="text-xs font-black uppercase tracking-[0.2em]">Введите ID друга в поиске выше</p>
                    </div>
                )}
                {contacts.map(id => {
                    const last = conversations[id]?.slice(-1)[0];
                    const prof = profiles[id];
                    const isTyping = typingIds.has(id);
                    return (
                        <div 
                            key={id} 
                            onClick={() => { setActiveChatId(id); sendMyProfile(id); }}
                            className={`p-4 rounded-[1.8rem] flex items-center gap-4 cursor-pointer transition-all border border-transparent ${activeChatId === id ? 'bg-black dark:bg-white text-white dark:text-black shadow-2xl border-white/10' : 'hover:bg-slate-50 dark:hover:bg-zinc-900'}`}
                        >
                            <div 
                                className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-200 dark:bg-zinc-800 flex-shrink-0 flex items-center justify-center relative border border-white dark:border-zinc-700 transition-transform active:scale-90"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingProfileId(id);
                                }}
                            >
                                {prof?.avatar ? <img src={prof.avatar} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-slate-400" />}
                                {prof?.online && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-white dark:border-black shadow-lg" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="font-black truncate text-sm uppercase tracking-tight">{prof?.nickname || id}</span>
                                    {last && <span className="text-[10px] opacity-40 font-bold tracking-tighter">{last.time}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className={`text-xs truncate font-bold ${activeChatId === id ? 'opacity-70' : 'text-slate-400'}`}>
                                      {isTyping ? <span className="text-green-500 animate-pulse italic">печатает...</span> : (last ? (last.type === 'CHAT' ? last.text : last.type === 'VOICE' ? 'Голосовое сообщение' : 'Медиа') : 'Начать секретный чат')}
                                  </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>

        <main className={`flex-1 flex flex-col bg-white dark:bg-black relative ${!activeChatId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
            {!activeChatId ? (
                <div className="text-center p-12 max-w-sm flex flex-col items-center animate-in fade-in zoom-in duration-1000">
                    <div className="w-24 h-24 bg-slate-50 dark:bg-zinc-900 rounded-premium flex items-center justify-center mb-10 border border-slate-200 dark:border-zinc-800 shadow-sm relative">
                        <Lock className="w-10 h-10 text-slate-300" />
                        <div className="absolute -bottom-2 -right-2 bg-green-500 p-2 rounded-xl shadow-lg border-2 border-white dark:border-black">
                            <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-black mb-3 tracking-tighter uppercase">БЕЗОПАСНАЯ ЗОНА</h2>
                    <p className="text-slate-400 text-[10px] font-black opacity-60 uppercase tracking-[0.3em]">End-to-End P2P Encrypted</p>
                </div>
            ) : (
                <>
                    <header className="h-24 border-b border-slate-100 dark:border-zinc-900 flex items-center justify-between px-6 md:px-10 z-20 glass">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setActiveChatId(null)} className="md:hidden p-3 bg-slate-100 dark:bg-zinc-800 rounded-2xl active:scale-90 transition-all"><ChevronLeft className="w-6 h-6" /></button>
                            <div 
                                className="w-14 h-14 rounded-2xl overflow-hidden cursor-pointer bg-slate-200 dark:bg-zinc-800 flex items-center justify-center border border-white dark:border-zinc-700 shadow-md transition-transform hover:scale-105 active:scale-95" 
                                onClick={() => setViewingProfileId(activeChatId)}
                            >
                                {profiles[activeChatId]?.avatar ? <img src={profiles[activeChatId].avatar} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-slate-400" />}
                            </div>
                            <div className="cursor-pointer group" onClick={() => setViewingProfileId(activeChatId)}>
                                <h3 className="font-black text-lg tracking-tight uppercase leading-none mb-1 group-hover:opacity-70 transition-opacity">{profiles[activeChatId]?.nickname || activeChatId}</h3>
                                <div className="flex items-center gap-2 leading-none">
                                    <div className={`w-2 h-2 rounded-full ${profiles[activeChatId]?.online ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-300 dark:bg-zinc-800'}`} />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                      {typingIds.has(activeChatId) ? <span className="text-green-500 italic animate-pulse">печатает...</span> : (profiles[activeChatId]?.online ? 'В СЕТИ' : 'ОФФЛАЙН')}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => startCall(false)} className="w-12 h-12 rounded-2xl flex items-center justify-center btn-modern shadow-sm active:scale-90"><Phone className="w-5 h-5" /></button>
                            <button onClick={() => startCall(true)} className="w-12 h-12 rounded-2xl flex items-center justify-center btn-modern shadow-sm active:scale-90"><VideoIcon className="w-5 h-5" /></button>
                            <button onClick={() => setViewingProfileId(activeChatId)} className="w-12 h-12 rounded-2xl flex items-center justify-center btn-modern shadow-sm active:scale-90"><MoreHorizontal className="w-5 h-5" /></button>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-8 custom-scrollbar bg-slate-50/20 dark:bg-black">
                        {conversations[activeChatId]?.map(msg => (
                            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`message-bubble rounded-[2rem] shadow-sm ${msg.isMe ? 'msg-me rounded-br-none self-end' : 'msg-them rounded-bl-none self-start'}`}>
                                    {msg.type === 'IMAGE' && (
                                        <div className="rounded-2xl overflow-hidden mb-3 border border-white/10 shadow-lg">
                                            <img src={msg.imageUrl} className="max-h-[500px] w-full object-contain bg-black/5" />
                                        </div>
                                    )}
                                    {msg.type === 'VOICE' && <VoiceMessagePlayer url={msg.voiceUrl!} isMe={msg.isMe} />}
                                    {msg.type === 'CALL_LOG' && (
                                        <div className="flex items-center gap-3 py-1 opacity-70 text-[11px] font-black uppercase tracking-widest">
                                            <div className="p-2 bg-white/10 rounded-xl"><Phone className="w-4 h-4" /></div>
                                            Звонок • {msg.callDuration}
                                        </div>
                                    )}
                                    {msg.text && <p className="text-[15.5px] font-bold leading-relaxed whitespace-pre-wrap tracking-tight break-words">{msg.text}</p>}
                                    <div className="flex items-center justify-end gap-2 mt-2 opacity-50">
                                        <span className={`text-[9px] font-black`}>{msg.time}</span>
                                        {msg.isMe && <CheckCheck className={`w-3.5 h-3.5 ${msg.isRead ? 'text-blue-500' : ''}`} />}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <footer className="p-6 md:p-10 z-20">
                        <div className={`max-w-4xl mx-auto flex items-end gap-3 glass p-4 rounded-[2.5rem] shadow-2xl border-2 transition-all duration-300 ${isRecording ? 'border-red-500 bg-red-50/20 dark:bg-red-950/20 scale-[1.02]' : 'border-slate-100 dark:border-zinc-800'}`}>
                            {isRecording ? (
                                <div className="flex-1 flex items-center justify-between px-6 py-2">
                                    <div className="flex items-center gap-4">
                                        <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                                        <span className="font-black text-red-500 uppercase tracking-[0.2em] text-sm">ЗАПИСЬ: {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
                                    </div>
                                    <button onClick={cancelRecording} className="text-red-500 hover:bg-red-500/10 p-3 rounded-full transition-colors active:scale-90"><Trash2 className="w-6 h-6" /></button>
                                </div>
                            ) : (
                                <>
                                    <button onClick={() => fileInputRef.current?.click()} className="p-4 rounded-full text-slate-400 hover:text-black dark:hover:text-white transition-all active:scale-90"><Paperclip className="w-6 h-6" /></button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if(f) {
                                            const r = new FileReader();
                                            r.onload = (ev) => sendMessage('IMAGE', ev.target?.result);
                                            r.readAsDataURL(f);
                                        }
                                    }} />
                                    <textarea 
                                        rows={1} 
                                        placeholder="Написать сообщение..." 
                                        className="flex-1 bg-transparent border-none focus:outline-none py-3 text-[15.5px] font-bold resize-none max-h-48 custom-scrollbar placeholder:text-slate-300 dark:placeholder:text-zinc-700" 
                                        value={chatMessage} 
                                        onChange={e => handleTyping(e.target.value)} 
                                        onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); if(chatMessage.trim()) sendMessage('CHAT', chatMessage); } }} 
                                    />
                                </>
                            )}
                            
                            {chatMessage.trim() ? (
                                <button onClick={() => sendMessage('CHAT', chatMessage)} className="p-4 bg-black dark:bg-white text-white dark:text-black rounded-3xl shadow-xl hover:scale-105 active:scale-90 transition-all flex items-center justify-center">
                                    <span className="font-black text-xl italic translate-y-[-1px]">M</span>
                                </button>
                            ) : (
                                <button onClick={isRecording ? stopAndSendRecording : startRecording} className={`p-4 rounded-3xl transition-all shadow-xl active:scale-90 flex items-center justify-center ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-black dark:bg-white text-white dark:text-black hover:scale-105'}`}>
                                    {isRecording ? <span className="font-black text-xl italic translate-y-[-1px]">M</span> : <Mic className="w-6 h-6" />}
                                </button>
                            )}
                        </div>
                    </footer>
                </>
            )}
        </main>
      </div>

      <div className={`fixed inset-0 z-[150] transition-all duration-500 flex items-center justify-center p-6 ${viewingProfileId ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        <div className="absolute inset-0 bg-black/40 dark:bg-black/90 backdrop-blur-md" onClick={() => setViewingProfileId(null)} />
        <div className={`w-full max-w-sm glass rounded-premium overflow-hidden transition-all duration-500 scale-in-95 ${viewingProfileId ? 'scale-100' : 'scale-90'}`}>
            <div className="relative h-48 bg-slate-100 dark:bg-zinc-900 overflow-hidden">
                {profiles[viewingProfileId || '']?.avatar && <img src={profiles[viewingProfileId || '']?.avatar} className="w-full h-full object-cover blur-2xl opacity-30 scale-110" />}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-24 h-24 rounded-premium bg-white dark:bg-black border-4 border-white dark:border-zinc-800 shadow-2xl overflow-hidden relative transition-transform hover:scale-110">
                        {profiles[viewingProfileId || '']?.avatar ? <img src={profiles[viewingProfileId || '']?.avatar} className="w-full h-full object-cover" /> : <User className="w-10 h-10 absolute inset-0 m-auto text-slate-300" />}
                    </div>
                </div>
                <button onClick={() => setViewingProfileId(null)} className="absolute top-6 right-6 p-3 bg-black/10 dark:bg-white/10 rounded-2xl hover:bg-black/20 dark:hover:bg-white/20 transition-all active:scale-90">
                    <X className="w-5 h-5 text-white" />
                </button>
            </div>
            <div className="p-10 text-center space-y-6">
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-1">{profiles[viewingProfileId || '']?.nickname || viewingProfileId}</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">P2P SECURE IDENTITY</p>
                </div>

                <div className="glass rounded-3xl p-4 bg-slate-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">PUBLIC ID</span>
                        <Share2 className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="p-3 bg-white dark:bg-black rounded-2xl border border-border text-center font-black text-sm tracking-widest break-all select-all">
                        {viewingProfileId}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                    <button className="flex items-center justify-center gap-2 p-4 glass rounded-3xl hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all active:scale-95" onClick={() => startCall(false)}>
                        <Phone className="w-4 h-4 text-green-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Вызов</span>
                    </button>
                    <button className="flex items-center justify-center gap-2 p-4 glass rounded-3xl hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all active:scale-95" onClick={() => startCall(true)}>
                        <VideoIcon className="w-4 h-4 text-blue-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Видео</span>
                    </button>
                </div>

                <button 
                  className="w-full p-5 bg-red-500/10 text-red-500 rounded-3xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                  onClick={() => {
                      if(viewingProfileId) {
                          setProfiles(prev => ({...prev, [viewingProfileId]: {...prev[viewingProfileId], blocked: !prev[viewingProfileId].blocked}}));
                          setViewingProfileId(null);
                      }
                  }}
                >
                    <Ban className="w-4 h-4" /> {profiles[viewingProfileId || '']?.blocked ? 'Разблокировать' : 'Заблокировать'}
                </button>
            </div>
        </div>
      </div>

      <div className={`fixed inset-0 z-[200] transition-all duration-500 ${isMenuOpen ? 'visible' : 'invisible'}`}>
        <div className={`absolute inset-0 bg-black/30 dark:bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsMenuOpen(false)} />
        <div className={`absolute left-0 top-0 bottom-0 w-full max-w-sm glass flex flex-col transition-transform duration-500 ease-out border-r border-slate-100 dark:border-zinc-900 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <header className="p-12 pb-8 flex flex-col items-center border-b border-slate-100 dark:border-zinc-800/50">
                <div 
                  className="w-28 h-28 rounded-premium bg-slate-100 dark:bg-zinc-900 relative group cursor-pointer overflow-hidden mb-6 shadow-2xl border-4 border-white dark:border-zinc-800 transition-transform active:scale-95" 
                  onClick={() => settingsAvatarInputRef.current?.click()}
                >
                    {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-slate-300 dark:text-zinc-700 uppercase">{nickname[0]}</div>}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera className="w-8 h-8 text-white" /></div>
                </div>
                <input type="file" ref={settingsAvatarInputRef} className="hidden" accept="image/*" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if(f) {
                        const r = new FileReader();
                        r.onload = (ev) => {
                            const dataUrl = ev.target?.result as string;
                            setAvatar(dataUrl);
                            localStorage.setItem('mm_avatar', dataUrl);
                            contacts.forEach(id => sendMyProfile(id));
                        };
                        r.readAsDataURL(f);
                    }
                }} />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">{nickname}</h2>
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-zinc-600 uppercase select-all">MY ID: {peerService.getPeerId()}</span>
                </div>
            </header>
            
            <div className="flex-1 p-8 pt-6 space-y-10 overflow-y-auto custom-scrollbar">
                <SettingsSection title="Стиль и темы" icon={Palette}>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setTheme('light')} className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border-2 ${theme === 'light' ? 'bg-black text-white border-black shadow-lg scale-105' : 'bg-white dark:bg-zinc-800/50 border-transparent text-slate-400'}`}>
                            <Sun className="w-5 h-5" /> <span className="text-[10px] font-black uppercase tracking-widest">Светлая</span>
                        </button>
                        <button onClick={() => setTheme('dark')} className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border-2 ${theme === 'dark' ? 'bg-white text-black border-white shadow-lg scale-105' : 'bg-white dark:bg-zinc-800 border-transparent text-slate-400'}`}>
                            <Moon className="w-5 h-5" /> <span className="text-[10px] font-black uppercase tracking-widest">Темная</span>
                        </button>
                    </div>
                </SettingsSection>

                <SettingsSection title="Оборудование" icon={Cpu}>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-slate-400 px-1 ml-1 flex items-center gap-1.5"><Mic className="w-3 h-3" /> Микрофон</label>
                            <select value={selectedAudioId} onChange={e => setSelectedAudioId(e.target.value)}>
                                {devices.filter(d => d.kind === 'audioinput').map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Стандартный микрофон'}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-slate-400 px-1 ml-1 flex items-center gap-1.5"><Volume2 className="w-3 h-3" /> Вывод звука</label>
                            <select value={selectedOutputId} onChange={e => setSelectedOutputId(e.target.value)}>
                                {devices.filter(d => d.kind === 'audiooutput').map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Стандартные динамики'}</option>)}
                            </select>
                        </div>
                    </div>
                </SettingsSection>
            </div>

            <div className="p-8 pb-12 space-y-4">
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full flex items-center justify-center gap-3 p-5 bg-red-600 text-white rounded-[2rem] font-black text-xs shadow-xl shadow-red-600/20 uppercase tracking-[0.2em] active:scale-95 transition-all">
                    <LogOut className="w-5 h-5" /> Выход и сброс
                </button>
            </div>
        </div>
      </div>

      {(currentCall || incomingCall) && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col text-white p-4">
            <div className="max-w-4xl mx-auto w-full h-full glass rounded-premium overflow-hidden flex flex-col relative border border-white/5 bg-zinc-950 shadow-2xl">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                {localStream && !callSettings.isCamOff && (
                    <video ref={localVideoRef} autoPlay muted playsInline className="absolute top-8 right-8 w-32 md:w-56 h-48 md:h-72 object-cover rounded-[2.5rem] border-2 border-white/10 shadow-2xl z-10" />
                )}
                {!remoteStream && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-2xl">
                        <div className="w-28 h-28 rounded-premium bg-white/5 animate-pulse flex items-center justify-center text-5xl font-black mb-8 border border-white/5 uppercase">
                            {(incomingCall?.peer || currentCall?.peer)?.[0]}
                        </div>
                        <h2 className="text-3xl font-black mb-2 uppercase">{(incomingCall?.peer || currentCall?.peer)}</h2>
                        <div className="flex items-center gap-3 text-white/20 text-[10px] font-black uppercase tracking-[0.4em]"><ShieldCheck className="w-5 h-5" /> TUNNEL SECURED</div>
                    </div>
                )}
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-5 glass p-5 rounded-premium border border-white/10 bg-white/5 backdrop-blur-3xl shadow-2xl">
                    {incomingCall && !currentCall ? (
                        <>
                            <button onClick={endCall} className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center"><X className="w-8 h-8 text-white" /></button>
                            <button onClick={answerCall} className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center animate-bounce"><Phone className="w-10 h-10 text-white" /></button>
                        </>
                    ) : (
                        <>
                            <button onClick={toggleMic} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${callSettings.isMicMuted ? 'bg-red-500/40 text-red-500' : 'bg-white/10'}`}>{callSettings.isMicMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}</button>
                            <button onClick={finalizeCall} className="w-22 h-22 bg-red-600 rounded-full flex items-center justify-center shadow-2xl"><X className="w-12 h-12 text-white" /></button>
                            <button onClick={toggleCam} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${callSettings.isCamOff ? 'bg-red-500/40 text-red-500' : 'bg-white/10'}`}>{callSettings.isCamOff ? <VideoOff className="w-5 h-5 text-white" /> : <VideoIcon className="w-5 h-5 text-white" />}</button>
                        </>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
