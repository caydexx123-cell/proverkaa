
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { peerService } from './services/peerService.ts';
import { NetworkMessage, ChatMessage, PlayerProfile, AppSettings } from './types.ts';
import { 
  Search, Menu, MoreVertical, Send, Paperclip, 
  CheckCheck, Settings, LogOut, X, Phone, Video,
  ArrowLeft, Camera, Sun, Moon, 
  Mic, MicOff, Video as VideoIcon, VideoOff, 
  Clock, Play, Pause, Lock, ChevronLeft, User, Sparkles, ShieldCheck, Ban, Loader2, AlertCircle, Plus, MessageCircle, Volume2, Monitor, Headphones, Speaker, Eye, EyeOff, ShieldAlert
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
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  
  // Call Controls
  const [callSettings, setCallSettings] = useState<AppSettings>({ isMicMuted: false, isCamOff: false });
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Audio/Video Devices
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [selectedOutputId, setSelectedOutputId] = useState('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const settingsAvatarInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Device handling
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(d => {
      setDevices(d);
      const firstAudio = d.find(i => i.kind === 'audioinput');
      const firstVideo = d.find(i => i.kind === 'videoinput');
      const firstOutput = d.find(i => i.kind === 'audiooutput');
      if (firstAudio) setSelectedAudioId(firstAudio.deviceId);
      if (firstVideo) setSelectedVideoId(firstVideo.deviceId);
      if (firstOutput) setSelectedOutputId(firstOutput.deviceId);
    });
  }, []);

  // Update SinkId for Audio Output
  useEffect(() => {
    if (remoteVideoRef.current && (remoteVideoRef.current as any).setSinkId && selectedOutputId) {
      (remoteVideoRef.current as any).setSinkId(selectedOutputId).catch(console.error);
    }
  }, [selectedOutputId, remoteStream]);

  // Video streams sync
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream, currentCall, incomingCall]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream, currentCall, incomingCall]);

  // Advanced 3D Background
  useEffect(() => {
    const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const group = new THREE.Group();
    const geo = new THREE.SphereGeometry(1, 64, 64);
    const mat = new THREE.MeshPhongMaterial({ 
      color: theme === 'dark' ? 0x27272a : 0x0f172a, 
      transparent: true, 
      opacity: 0.1,
      shininess: 100
    });

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.1));

    for (let i = 0; i < 4; i++) {
        const sphere = new THREE.Mesh(geo, mat);
        sphere.position.set(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * -15);
        sphere.scale.setScalar(Math.random() * 6 + 3);
        group.add(sphere);
    }
    
    scene.add(group);
    camera.position.z = 10;

    const animate = () => {
      requestAnimationFrame(animate);
      group.rotation.y += 0.0001;
      group.rotation.x += 0.0001;
      group.children.forEach((c, idx) => {
          c.position.y += Math.sin(Date.now() * 0.0005 + idx) * 0.003;
      });
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [theme]);

  // Peer initialization
  useEffect(() => {
    if (nickname && isAuthed && regStep === 3 && !isReady) handleInitialize();
  }, [regStep, nickname, isAuthed, isReady]);

  useEffect(() => {
    if (isAuthed) {
        localStorage.setItem('mm_convs', JSON.stringify(conversations));
        localStorage.setItem('mm_contacts', JSON.stringify(contacts));
        localStorage.setItem('mm_profiles', JSON.stringify(profiles));
        localStorage.setItem('mm_theme', theme);
        localStorage.setItem('mm_nick', nickname);
        localStorage.setItem('mm_pass', storedPassword || password);
        localStorage.setItem('mm_avatar', avatar);
    }
  }, [conversations, contacts, profiles, theme, nickname, password, avatar, isAuthed, storedPassword]);

  useEffect(() => {
    document.body.className = `${theme}-theme`;
  }, [theme]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeChatId]);

  const handleInitialize = async () => {
    const cleanNick = (nickname || '').trim();
    if (!cleanNick) return;
    try {
      await peerService.init(cleanNick);
      setIsReady(true);
    } catch (err: any) { 
      setRegStep(1);
    }
  };

  const handleAuth = () => {
    setSearchError(null);
    if (storedPassword) {
        if (password === storedPassword) {
            setIsAuthed(true);
            setRegStep(3);
        } else {
            setSearchError("Неверный пароль");
        }
    } else {
        if (password.length >= 4) {
            setIsAuthed(true);
            setRegStep(2);
        } else {
            setSearchError("Пароль слишком короткий (мин. 4)");
        }
    }
  };

  const handleMessage = useCallback((msg: NetworkMessage) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (msg.type === 'HEARTBEAT') {
      setProfiles(prev => ({ ...prev, [msg.senderId]: { ...prev[msg.senderId], online: true } }));
      return;
    }

    if (msg.type === 'READ_RECEIPT') {
      const chatId = msg.senderId;
      setConversations(prev => ({
        ...prev,
        [chatId]: prev[chatId]?.map(m => m.id === msg.payload ? { ...m, isRead: true } : m)
      }));
      return;
    }

    if (msg.type === 'SYNC_PROFILE') {
      setProfiles(prev => ({ ...prev, [msg.senderId]: { ...prev[msg.senderId], avatar: msg.payload.avatar, nickname: msg.senderNickname, online: true } }));
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

    setConversations(prev => ({ ...prev, [msg.senderId]: [...(prev[msg.senderId] || []), newMessage] }));
    if (!contacts.includes(msg.senderId)) setContacts(prev => [...prev, msg.senderId]);
    setProfiles(prev => ({ ...prev, [msg.senderId]: { ...prev[msg.senderId], online: true } }));
  }, [profiles, contacts]);

  useEffect(() => {
    if (!isReady) return;
    peerService.onMessage(handleMessage);
    peerService.onConnection(id => {
      peerService.sendTo(id, { type: 'SYNC_PROFILE', payload: { avatar }, senderId: peerService.getPeerId()!, senderNickname: nickname });
      setProfiles(prev => ({ ...prev, [id]: { ...prev[id], online: true } }));
    });
    peerService.onDisconnect(id => {
      setProfiles(prev => ({ ...prev, [id]: { ...prev[id], online: false } }));
    });
    peerService.onCall(call => setIncomingCall(call));
  }, [isReady, handleMessage, avatar, nickname]);

  const handleSearch = async () => {
    const target = searchQuery.trim().toUpperCase();
    if (!target || target === peerService.getPeerId()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      peerService.connectToPeer(target);
      setTimeout(() => {
        setIsSearching(false);
        if (!contacts.includes(target)) setContacts(prev => [...prev, target]);
        setActiveChatId(target);
        setSearchQuery('');
        if (!profiles[target]) setProfiles(prev => ({ ...prev, [target]: { nickname: target, joinedAt: Date.now(), online: true } }));
      }, 600);
    } catch (err) {
      setIsSearching(false);
      setSearchError("ID не найден");
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
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        const reader = new FileReader();
        reader.onload = (e) => sendMessage('VOICE', e.target?.result);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setIsRecording(true);
    } catch (e) { alert("Ошибка микрофона"); }
  };

  const stopRecording = () => {
    recorder?.stop();
    setIsRecording(false);
  };

  const VoiceMessagePlayer = ({ url }: { url: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const togglePlay = () => {
      if (!audioRef.current) return;
      if (isPlaying) { audioRef.current.pause(); } 
      else { audioRef.current.play().catch(console.error); }
      setIsPlaying(!isPlaying);
    };

    return (
      <div className="flex items-center gap-3 p-1 min-w-[170px]">
        <button onClick={togglePlay} className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-white/10 hover:bg-white/20">
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-0.5" />}
        </button>
        <div className="flex-1 h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-black/30 dark:bg-white/30" style={{ width: isPlaying ? '100%' : '15%', transition: isPlaying ? 'width 10s' : 'none' }} />
        </div>
        <audio ref={audioRef} src={url} onEnded={() => setIsPlaying(false)} className="hidden" />
      </div>
    );
  };

  const startCall = async (video: boolean) => {
    if (!activeChatId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { deviceId: selectedAudioId ? { exact: selectedAudioId } : undefined }, 
        video: video ? { deviceId: selectedVideoId ? { exact: selectedVideoId } : undefined } : false 
      });
      setLocalStream(stream);
      const call = peerService.callPeer(activeChatId, stream);
      if (call) {
        setCallStartTime(Date.now());
        call.on('stream', (remote: MediaStream) => setRemoteStream(remote));
        call.on('close', () => finalizeCall());
        setCurrentCall(call);
        setCallSettings({ isMicMuted: false, isCamOff: !video });
      }
    } catch (err) { alert("Ошибка вызова"); }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
      incomingCall.answer(stream);
      setCallStartTime(Date.now());
      incomingCall.on('stream', (remote: MediaStream) => setRemoteStream(remote));
      incomingCall.on('close', () => finalizeCall());
      setCurrentCall(incomingCall);
      setIncomingCall(null);
    } catch (err) { alert("Ошибка ответа"); }
  };

  const finalizeCall = () => {
    if (callStartTime) {
      const durationSec = Math.floor((Date.now() - callStartTime) / 1000);
      const min = Math.floor(durationSec / 60);
      const sec = durationSec % 60;
      sendMessage('CALL_LOG', `${min}:${sec.toString().padStart(2, '0')}`);
    }
    endCall();
  };

  const endCall = () => {
    if (currentCall) { try { currentCall.close(); } catch(e) {} }
    if (incomingCall) { try { incomingCall.close(); } catch(e) {} }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); }
    setLocalStream(null);
    setRemoteStream(null);
    setCurrentCall(null);
    setIncomingCall(null);
    setCallStartTime(null);
    setCallSettings({ isMicMuted: false, isCamOff: false });
  };

  const toggleMic = () => {
    if (localStream) {
      const track = localStream.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setCallSettings(prev => ({ ...prev, isMicMuted: !track.enabled }));
      }
    }
  };

  const toggleCam = () => {
    if (localStream) {
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setCallSettings(prev => ({ ...prev, isCamOff: !track.enabled }));
      }
    }
  };

  // Auth/Reg view
  if (!isReady || !isAuthed) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6 bg-slate-100 dark:bg-zinc-950 relative overflow-hidden transition-colors duration-500">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-500/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-rose-500/10 blur-[150px] rounded-full" />
        
        <div className="w-full max-w-sm glass p-10 rounded-[56px] premium-shadow animate-in fade-in zoom-in duration-500 text-center relative z-10">
            {regStep === 1 && (
                <div className="space-y-8">
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-900 dark:bg-white rounded-[24px] flex items-center justify-center mb-6 shadow-2xl">
                            <MessageCircle className="w-8 h-8 text-white dark:text-black" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">MARTAM</h1>
                        <p className="text-slate-500 dark:text-zinc-500 text-xs mt-1 font-bold tracking-widest uppercase">
                            {storedPassword ? "Добро пожаловать" : "Приватный доступ"}
                        </p>
                    </div>
                    
                    <div className="space-y-4">
                        <input 
                            type="text" 
                            placeholder="Ваш ник"
                            disabled={!!storedPassword}
                            className={`w-full rounded-2xl py-4 px-6 text-slate-900 dark:text-white font-black placeholder:text-slate-400 focus:bg-white dark:focus:bg-zinc-800 transition-all ${!!storedPassword ? 'opacity-40 cursor-not-allowed border-dashed' : ''}`}
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                        />
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="Пароль"
                                className="w-full rounded-2xl py-4 px-6 text-slate-900 dark:text-white font-black placeholder:text-slate-400 focus:bg-white dark:focus:bg-zinc-800 transition-all pr-14"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                            />
                            <button 
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        
                        {!storedPassword && (
                            <div className="flex items-center justify-center gap-2 py-3 px-4 bg-orange-600 rounded-2xl border border-orange-700 shadow-lg shadow-orange-500/20 animate-pulse">
                                <ShieldAlert className="w-5 h-5 text-white" />
                                <span className="text-xs font-black text-white uppercase tracking-widest">Запоминай данные!!</span>
                            </div>
                        )}

                        {searchError && <p className="text-xs font-black text-red-500 animate-shake uppercase">{searchError}</p>}
                    </div>

                    <button 
                        disabled={nickname.trim().length < 2 || password.length < 4}
                        onClick={handleAuth}
                        className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black font-black text-lg hover:brightness-125 active:scale-[0.98] disabled:opacity-10 transition-all shadow-xl"
                    >
                        {storedPassword ? "Войти" : "Создать"}
                    </button>
                </div>
            )}

            {regStep === 2 && (
                <div className="space-y-10">
                    <div className="space-y-2 text-center">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Фото профиля</h2>
                        <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest">Персонализация</p>
                    </div>
                    
                    <div 
                        className="w-32 h-32 rounded-[40px] bg-slate-200 dark:bg-zinc-800 flex items-center justify-center cursor-pointer mx-auto group hover:bg-slate-300 dark:hover:bg-zinc-700 transition-all overflow-hidden relative border-2 border-white dark:border-zinc-700 shadow-xl"
                        onClick={() => avatarInputRef.current?.click()}
                    >
                        {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <Camera className="w-7 h-7 text-slate-400 dark:text-zinc-600" />}
                        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => {
                             const f = e.target.files?.[0];
                             if(f) {
                                const r = new FileReader();
                                r.onload = (ev) => setAvatar(ev.target?.result as string);
                                r.readAsDataURL(f);
                             }
                        }} />
                    </div>
                    
                    <div className="flex flex-col gap-3">
                        <button onClick={() => setRegStep(3)} className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black font-black hover:brightness-110 shadow-lg">Продолжить</button>
                        <button onClick={() => { setAvatar(''); setRegStep(3); }} className="text-slate-400 dark:text-zinc-500 font-black text-xs hover:text-slate-800 transition-colors py-2 uppercase tracking-widest">Пропустить</button>
                    </div>
                </div>
            )}

            {regStep === 3 && (
                <div className="py-12 flex flex-col items-center space-y-4">
                    <Loader2 className="w-12 h-12 text-slate-900 dark:text-white animate-spin" />
                    <p className="text-slate-500 dark:text-zinc-500 font-black text-xs tracking-widest uppercase">Шифрование...</p>
                </div>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden relative">
      <div className="flex-1 flex relative z-10">
        <aside className={`w-full md:w-80 lg:w-[380px] nav-sidebar border-r border-slate-200 dark:border-zinc-800 flex flex-col flex-shrink-0 transition-all ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-8 flex flex-col gap-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-black text-black dark:text-white tracking-tighter">MARTAM</h1>
                    <button onClick={() => setIsMenuOpen(true)} className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all btn-modern shadow-sm">
                        <Menu className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
                    </button>
                </div>
                <div className="relative group">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors ${isSearching ? 'animate-spin' : ''}`} />
                    <input 
                        type="text" 
                        placeholder="Поиск ID..."
                        className="w-full rounded-2xl py-3.5 pl-12 pr-5 text-sm font-black outline-none shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-12 space-y-1">
                <div className="px-2 pb-5"><span className="text-[10px] font-black text-slate-300 dark:text-zinc-700 uppercase tracking-widest">Диалоги</span></div>
                {contacts.length === 0 && (
                    <div className="text-center py-20 opacity-20"><MessageCircle className="w-12 h-12 mx-auto mb-4" /><p className="text-xs font-black uppercase tracking-widest leading-none">Нет активных чатов</p></div>
                )}
                {contacts.map(id => {
                    const last = conversations[id]?.slice(-1)[0];
                    const prof = profiles[id];
                    return (
                        <div 
                            key={id} 
                            onClick={() => setActiveChatId(id)}
                            className={`p-4 rounded-3xl flex items-center gap-4 cursor-pointer transition-all ${activeChatId === id ? 'bg-black dark:bg-white text-white dark:text-black shadow-xl' : 'hover:bg-slate-50 dark:hover:bg-zinc-900'}`}
                        >
                            <div className="w-14 h-14 rounded-[22px] overflow-hidden bg-slate-100 dark:bg-zinc-800 flex-shrink-0 flex items-center justify-center relative border border-white dark:border-zinc-700">
                                {prof?.avatar ? <img src={prof.avatar} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-slate-300 dark:text-zinc-600" />}
                                {prof?.online && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-white dark:border-zinc-900" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-black truncate text-sm uppercase tracking-tight">{id}</span>
                                    {last && <span className={`text-[9px] opacity-40 font-bold`}>{last.time}</span>}
                                </div>
                                <p className={`text-xs truncate ${activeChatId === id ? 'opacity-70 font-bold' : 'text-slate-400 dark:text-zinc-500 font-bold'}`}>
                                    {last ? (last.type === 'CHAT' ? last.text : last.type === 'CALL_LOG' ? 'Звонок' : 'Файл') : 'Начать'}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>

        <main className={`flex-1 flex flex-col relative transition-all ${!activeChatId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
            {!activeChatId ? (
                <div className="text-center p-12 max-w-sm flex flex-col items-center animate-in fade-in duration-1000">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-900 rounded-[32px] flex items-center justify-center mb-10 border border-slate-200 dark:border-zinc-800">
                        <Lock className="w-8 h-8 text-slate-200 dark:text-zinc-700" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3 tracking-tighter uppercase">Защищенная зона</h2>
                    <p className="text-slate-400 dark:text-zinc-500 text-sm font-bold leading-relaxed uppercase tracking-wider opacity-60">P2P Шифрование активно</p>
                </div>
            ) : (
                <>
                    <header className="h-24 glass flex items-center justify-between px-10 z-20">
                        <div className="flex items-center gap-5">
                            <button onClick={() => setActiveChatId(null)} className="md:hidden p-3 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-2xl transition-all"><ChevronLeft className="w-6 h-6" /></button>
                            <div className="w-14 h-14 rounded-[22px] overflow-hidden cursor-pointer bg-slate-100 dark:bg-zinc-800 flex items-center justify-center border border-white dark:border-zinc-700" onClick={() => setSelectedProfileId(activeChatId)}>
                                {profiles[activeChatId]?.avatar ? <img src={profiles[activeChatId].avatar} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-slate-300 dark:text-zinc-600" />}
                            </div>
                            <div className="cursor-pointer" onClick={() => setSelectedProfileId(activeChatId)}>
                                <h3 className="font-black text-slate-900 dark:text-white text-lg tracking-tight leading-none mb-1.5 uppercase">{activeChatId}</h3>
                                <div className="flex items-center gap-2 leading-none">
                                    <div className={`w-2 h-2 rounded-full ${profiles[activeChatId]?.online ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300 dark:bg-zinc-800'}`} />
                                    <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none">{profiles[activeChatId]?.online ? 'В сети' : 'Оффлайн'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => startCall(false)} className="w-12 h-12 glass flex items-center justify-center rounded-2xl text-black dark:text-white hover:opacity-70 transition-all shadow-sm"><Phone className="w-5 h-5" /></button>
                            <button onClick={() => startCall(true)} className="w-12 h-12 glass flex items-center justify-center rounded-2xl text-black dark:text-white hover:opacity-70 transition-all shadow-sm"><VideoIcon className="w-5 h-5" /></button>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-8 custom-scrollbar">
                        {conversations[activeChatId]?.map(msg => (
                            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`message-bubble p-5 ${msg.isMe ? 'msg-me rounded-[28px] rounded-br-none shadow-xl' : 'msg-them rounded-[28px] rounded-bl-none shadow-sm'}`}>
                                    {msg.type === 'IMAGE' && <img src={msg.imageUrl} className="rounded-2xl mb-4 max-h-96 w-full object-contain cursor-zoom-in" />}
                                    {msg.type === 'VOICE' && <VoiceMessagePlayer url={msg.voiceUrl!} />}
                                    {msg.type === 'CALL_LOG' && <div className="flex items-center gap-3 py-1 opacity-70 text-[11px] font-black uppercase tracking-widest"><Clock className="w-4 h-4" /> Длительность: {msg.callDuration}</div>}
                                    {msg.text && <p className="text-[15.5px] font-black leading-relaxed whitespace-pre-wrap tracking-tight">{msg.text}</p>}
                                    <div className="flex items-center justify-end gap-2 mt-2.5">
                                        <span className={`text-[9px] font-black opacity-30`}>{msg.time}</span>
                                        {msg.isMe && <CheckCheck className={`w-4 h-4 ${msg.isRead ? 'text-indigo-400' : 'opacity-20'}`} />}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <footer className="p-10">
                        <div className="max-w-4xl mx-auto flex items-end gap-3 glass p-2.5 rounded-[32px] premium-shadow border border-white dark:border-zinc-800">
                            <button onClick={() => fileInputRef.current?.click()} className="p-4 rounded-full text-slate-400 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-all"><Paperclip className="w-6 h-6" /></button>
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
                                placeholder="Сообщение..." 
                                className="flex-1 bg-transparent border-none focus:outline-none py-4 text-[15px] font-black resize-none max-h-48 custom-scrollbar placeholder:text-slate-300 dark:placeholder:text-zinc-700" 
                                value={chatMessage} 
                                onChange={e => setChatMessage(e.target.value)} 
                                onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); if(chatMessage.trim()) sendMessage('CHAT', chatMessage); } }} 
                            />
                            {chatMessage.trim() ? (
                                <button onClick={() => sendMessage('CHAT', chatMessage)} className="p-4 bg-black dark:bg-white text-white dark:text-black rounded-[24px] shadow-lg active:scale-95 transition-all"><Send className="w-6 h-6" /></button>
                            ) : (
                                <button onMouseDown={startRecording} onMouseUp={stopRecording} className={`p-4 rounded-[24px] transition-all ${isRecording ? 'bg-orange-500 text-white animate-pulse' : 'text-slate-300 dark:text-zinc-700 hover:text-black dark:hover:text-white'}`}><Mic className="w-6 h-6" /></button>
                            )}
                        </div>
                    </footer>
                </>
            )}
        </main>
      </div>

      {/* Main Settings Menu */}
      <div className={`fixed inset-0 z-[110] transition-all duration-500 ${isMenuOpen ? 'visible' : 'invisible'}`}>
        <div className={`absolute inset-0 bg-black/10 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-500 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsMenuOpen(false)} />
        <div className={`absolute left-0 top-0 bottom-0 w-full max-w-sm glass flex flex-col transition-transform duration-500 ease-out border-r border-slate-200 dark:border-zinc-800 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-12 flex flex-col items-center border-b border-slate-100 dark:border-zinc-800/50">
                <div 
                  className="w-24 h-24 rounded-[40px] bg-slate-100 dark:bg-zinc-800 relative group cursor-pointer overflow-hidden mb-6 shadow-xl border-2 border-white dark:border-zinc-700" 
                  onClick={() => settingsAvatarInputRef.current?.click()}
                >
                    {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-slate-300 dark:text-zinc-700">{nickname[0]}</div>}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera className="w-7 h-7 text-white" /></div>
                </div>
                <input type="file" ref={settingsAvatarInputRef} className="hidden" accept="image/*" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if(f) {
                        const r = new FileReader();
                        r.onload = (ev) => {
                          const dataUrl = ev.target?.result as string;
                          setAvatar(dataUrl);
                          contacts.forEach(id => {
                            peerService.sendTo(id, { type: 'SYNC_PROFILE', payload: { avatar: dataUrl }, senderId: peerService.getPeerId()!, senderNickname: nickname });
                          });
                        };
                        r.readAsDataURL(f);
                    }
                }} />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-none mb-2 uppercase tracking-tighter">{nickname}</h2>
                <p className="text-[10px] font-black tracking-[0.2em] text-slate-400 dark:text-zinc-600 uppercase">ВАШ ID: {peerService.getPeerId()}</p>
            </div>
            
            <div className="flex-1 p-10 space-y-12 overflow-y-auto custom-scrollbar">
                <div className="space-y-5">
                    <span className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em] pl-1">Тема оформления</span>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setTheme('light')} className={`p-5 rounded-3xl flex flex-col items-center gap-3 transition-all border ${theme === 'light' ? 'bg-black text-white shadow-xl' : 'bg-white border-slate-200 text-slate-400 dark:bg-zinc-900 dark:border-zinc-800'}`}>
                            <Sun className="w-6 h-6" /> <span className="text-xs font-black uppercase">Light</span>
                        </button>
                        <button onClick={() => setTheme('dark')} className={`p-5 rounded-3xl flex flex-col items-center gap-3 transition-all border ${theme === 'dark' ? 'bg-white text-black shadow-xl' : 'bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 text-slate-400'}`}>
                            <Moon className="w-6 h-6" /> <span className="text-xs font-black uppercase">Dark</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    <span className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em] pl-1">Устройства</span>
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-slate-300 dark:text-zinc-700 pl-1"><Mic className="w-4 h-4" /> <span className="text-[10px] font-black uppercase">Микрофон</span></div>
                            <select 
                                value={selectedAudioId}
                                onChange={e => setSelectedAudioId(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 text-xs font-black outline-none"
                            >
                                {devices.filter(d => d.kind === 'audioinput').map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Input Device'}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-slate-300 dark:text-zinc-700 pl-1"><Speaker className="w-4 h-4" /> <span className="text-[10px] font-black uppercase">Вывод звука</span></div>
                            <select 
                                value={selectedOutputId}
                                onChange={e => setSelectedOutputId(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 text-xs font-black outline-none"
                            >
                                {devices.filter(d => d.kind === 'audiooutput').map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Output Device'}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-10">
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full flex items-center justify-center gap-4 p-5 bg-red-600 text-white rounded-3xl font-black text-xs hover:brightness-125 transition-all shadow-xl shadow-red-500/20 uppercase tracking-widest">
                    <LogOut className="w-5 h-5" /> Сброс
                </button>
            </div>
        </div>
      </div>

      {(currentCall || incomingCall) && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col text-white animate-in slide-in-from-bottom duration-500 p-6">
            <div className="max-w-5xl mx-auto w-full h-full glass rounded-[56px] overflow-hidden flex flex-col relative border border-white/10 bg-zinc-950 shadow-2xl">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                {!remoteStream && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-3xl">
                        <div className="w-28 h-28 rounded-[44px] bg-white/5 animate-pulse flex items-center justify-center text-6xl font-black mb-12 border border-white/10">
                            {(incomingCall?.peer || currentCall?.peer)?.[0]}
                        </div>
                        <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase">{(incomingCall?.peer || currentCall?.peer)}</h2>
                        <div className="flex items-center gap-3 text-white/30 text-[10px] font-black uppercase tracking-[0.4em]"><ShieldCheck className="w-5 h-5" /> Direct Channel Active</div>
                    </div>
                )}
                {localStream && (
                    <div className={`absolute top-10 right-10 w-44 md:w-64 h-64 md:h-88 bg-black rounded-[44px] overflow-hidden border-2 border-white/10 shadow-3xl transition-all ${callSettings.isCamOff ? 'opacity-0 scale-90 translate-y-6' : 'opacity-100 scale-100'}`}>
                        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    </div>
                )}
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-8 glass p-6 rounded-[56px] border border-white/10 bg-white/5 backdrop-blur-3xl">
                    {incomingCall && !currentCall ? (
                        <>
                            <button onClick={endCall} className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"><X className="w-10 h-10 text-white" /></button>
                            <button onClick={answerCall} className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center shadow-2xl animate-bounce transition-all"><Phone className="w-12 h-12 text-white" /></button>
                        </>
                    ) : (
                        <>
                            <button onClick={toggleMic} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${callSettings.isMicMuted ? 'bg-red-500/40 text-red-500' : 'bg-white/10 hover:bg-white/20'}`}>{callSettings.isMicMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}</button>
                            <button onClick={finalizeCall} className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"><X className="w-12 h-12 text-white" /></button>
                            <button onClick={toggleCam} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${callSettings.isCamOff ? 'bg-red-500/40 text-red-500' : 'bg-white/10 hover:bg-white/20'}`}>{callSettings.isCamOff ? <VideoOff className="w-6 h-6 text-white" /> : <VideoIcon className="w-6 h-6 text-white" />}</button>
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
