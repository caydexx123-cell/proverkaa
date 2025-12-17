
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { peerService } from './services/peerService.ts';
import { NetworkMessage, ChatMessage, PlayerProfile, AppSettings } from './types.ts';
import { 
  Search, Menu, MoreVertical, Send, Paperclip, Smile, 
  CheckCheck, User, Settings, LogOut, Trash2, X, Phone, Video,
  ArrowLeft, Camera, Image as ImageIcon, Sun, Moon, Palette,
  Loader2, AlertCircle, ShieldCheck, Gift, Snowflake,
  Volume2, Mic, Headphones, ShieldAlert, Ban, Info
} from 'lucide-react';

const App: React.FC = () => {
  // Persistence
  const [nickname, setNickname] = useState(() => localStorage.getItem('nexus_nick') || '');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('nexus_avatar') || '');
  const [isReady, setIsReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light' | 'custom' | 'newyear'>(() => (localStorage.getItem('nexus_theme') as any) || 'dark');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('nexus_accent') || '#2b5278');
  
  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>(() => {
    const saved = localStorage.getItem('nexus_convs');
    return saved ? JSON.parse(saved) : {};
  });
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>(() => {
    const saved = localStorage.getItem('nexus_profiles');
    return saved ? JSON.parse(saved) : {};
  });
  const [contacts, setContacts] = useState<string[]>(() => {
    const saved = localStorage.getItem('nexus_contacts');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [error, setError] = useState('');

  // Call & Device States
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const s = localStorage.getItem('nexus_settings');
    return s ? JSON.parse(s) : {};
  });
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 3D Background Initialization
  useEffect(() => {
    const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const geometry = new THREE.SphereGeometry(2, 32, 32);
    const material = new THREE.MeshNormalMaterial({ wireframe: true });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    camera.position.z = 5;

    const animate = () => {
      requestAnimationFrame(animate);
      sphere.rotation.x += 0.005;
      sphere.rotation.y += 0.005;
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
  }, []);

  // Fetch Devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(setDevices);
  }, []);

  // Auto-Login
  useEffect(() => {
    if (nickname && !isReady) handleInitialize();
  }, []);

  useEffect(() => {
    localStorage.setItem('nexus_convs', JSON.stringify(conversations));
    localStorage.setItem('nexus_contacts', JSON.stringify(contacts));
    localStorage.setItem('nexus_profiles', JSON.stringify(profiles));
    localStorage.setItem('nexus_settings', JSON.stringify(settings));
    localStorage.setItem('nexus_avatar', avatar);
  }, [conversations, contacts, profiles, settings, avatar]);

  useEffect(() => {
    document.body.className = `${theme}-theme`;
    if (theme === 'custom') document.documentElement.style.setProperty('--tg-active', accentColor);
    localStorage.setItem('nexus_theme', theme);
  }, [theme, accentColor]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeChatId]);

  // Hook to handle video stream attachment
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream, currentCall, incomingCall]);

  const addMessage = (peerId: string, msg: ChatMessage) => {
    if (profiles[peerId]?.blocked) return;
    setConversations(prev => ({ ...prev, [peerId]: [...(prev[peerId] || []), msg] }));
    setContacts(prev => prev.includes(peerId) ? prev : [...prev, peerId]);
    if (!profiles[peerId]) {
      setProfiles(prev => ({ ...prev, [peerId]: { nickname: peerId, joinedAt: Date.now() } }));
    }
  };

  const handleInitialize = async () => {
    const cleanNick = (nickname || '').trim().toUpperCase();
    if (!cleanNick) return;
    try {
      await peerService.init(cleanNick);
      setIsReady(true);
      setError('');
    } catch (err: any) { setError("Ник занят или ошибка сети"); }
  };

  const handleSearch = async () => {
    const target = searchQuery.trim().toUpperCase();
    if (!target || target === peerService.getPeerId()) return;
    setIsSearching(true);
    try {
      peerService.connectToPeer(target);
      setTimeout(() => {
        setIsSearching(false);
        setContacts(prev => prev.includes(target) ? prev : [...prev, target]);
        setActiveChatId(target);
        setSearchQuery('');
        if (!profiles[target]) setProfiles(prev => ({ ...prev, [target]: { nickname: target, joinedAt: Date.now() } }));
      }, 1000);
    } catch (err) { setIsSearching(false); setError("Не в сети"); }
  };

  const handleMessage = useCallback((msg: NetworkMessage) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (msg.type === 'SYNC_PROFILE') {
      setProfiles(prev => ({ ...prev, [msg.senderId]: { ...prev[msg.senderId], avatar: msg.payload.avatar, nickname: msg.senderNickname } }));
      return;
    }
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
  }, [profiles]);

  useEffect(() => {
    if (!isReady) return;
    peerService.onMessage(handleMessage);
    peerService.onConnection(id => {
      setContacts(prev => prev.includes(id) ? prev : [...prev, id]);
      peerService.sendTo(id, { type: 'SYNC_PROFILE', payload: { avatar }, senderId: peerService.getPeerId()!, senderNickname: nickname });
    });
    peerService.onCall(call => setIncomingCall(call));
  }, [isReady, handleMessage, avatar]);

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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result as string;
      setAvatar(b64);
      contacts.forEach(c => peerService.sendTo(c, { type: 'SYNC_PROFILE', payload: { avatar: b64 }, senderId: peerService.getPeerId()!, senderNickname: nickname }));
    };
    reader.readAsDataURL(file);
  };

  // Fix: Added handleFileUpload function
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result as string;
      sendMessage(undefined, b64);
    };
    reader.readAsDataURL(file);
  };

  // Fix: Added logout function
  const logout = () => {
    localStorage.removeItem('nexus_nick');
    localStorage.removeItem('nexus_avatar');
    window.location.reload();
  };

  const startCall = async (video: boolean) => {
    if (!activeChatId) return;
    try {
      const constraints = {
        audio: settings.audioInputId ? { deviceId: { exact: settings.audioInputId } } : true,
        video: video ? (settings.videoInputId ? { deviceId: { exact: settings.videoInputId }, width: 1280, height: 720 } : { width: 1280, height: 720 }) : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      const call = peerService.callPeer(activeChatId, stream);
      if (call) {
        setupCallHandlers(call);
        setCurrentCall(call);
      }
    } catch (err) { alert("Ошибка медиа"); }
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
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
    });
    call.on('close', endCall);
    call.on('error', endCall);
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

  const toggleBlock = (id: string) => {
    setProfiles(prev => ({ ...prev, [id]: { ...prev[id], blocked: !prev[id]?.blocked } }));
  };

  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center p-6 bg-[#0e1621]">
        <div className="w-full max-w-sm bg-[#17212b] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl glass">
          <div className="flex flex-col items-center mb-10">
            <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
              <Send className="w-12 h-12 text-white -rotate-12" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Nexus</h1>
            <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest font-bold opacity-60">Next Gen P2P</p>
          </div>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Твой ник"
              className="w-full bg-[#242f3d] border-none rounded-2xl px-6 py-5 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 text-center font-bold"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInitialize()}
            />
            <button onClick={handleInitialize} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95">ВОЙТИ</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-tg-bg relative">
      <div className="chat-bg-pattern"></div>
      {theme === 'newyear' && Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="snowflake" style={{ left: `${Math.random()*100}%`, animationDelay: `${Math.random()*5}s` }}>❄</div>
      ))}

      {/* Profile Modal */}
      {selectedProfileId && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedProfileId(null)} />
           <div className="w-full max-w-sm bg-tg-sidebar rounded-[2.5rem] p-8 relative overflow-hidden glass border border-white/10 shadow-2xl animate-in zoom-in duration-300">
              <div className="flex flex-col items-center text-center">
                 <div className="w-32 h-32 rounded-[2rem] bg-tg-active mb-6 shadow-xl overflow-hidden border-4 border-white/10">
                    {profiles[selectedProfileId]?.avatar ? <img src={profiles[selectedProfileId].avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-5xl font-black text-white">{selectedProfileId[0]}</div>}
                 </div>
                 <h2 className="text-3xl font-black mb-1">{selectedProfileId}</h2>
                 <p className="text-tg-gray text-xs uppercase font-bold tracking-widest mb-6">P2P NODE</p>
                 <div className="w-full bg-white/5 rounded-2xl p-4 text-sm space-y-3 mb-6">
                    <div className="flex justify-between"><span>Статус:</span><span className="text-green-500 font-bold">Online</span></div>
                    <div className="flex justify-between"><span>Добавлен:</span><span>{new Date(profiles[selectedProfileId]?.joinedAt || Date.now()).toLocaleDateString()}</span></div>
                 </div>
                 <div className="flex gap-4 w-full">
                    <button onClick={() => toggleBlock(selectedProfileId)} className={`flex-1 p-4 rounded-xl flex items-center justify-center gap-2 font-bold ${profiles[selectedProfileId]?.blocked ? 'bg-red-500 text-white' : 'bg-white/5'}`}>
                       <Ban className="w-4 h-4" /> {profiles[selectedProfileId]?.blocked ? 'Разблокировать' : 'Заблокировать'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* App Drawer */}
      <div className={`fixed inset-0 z-[110] transition-all duration-500 ${isMenuOpen ? 'visible' : 'invisible'}`}>
        <div className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-500 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsMenuOpen(false)} />
        <div className={`absolute left-0 top-0 bottom-0 w-80 bg-tg-sidebar flex flex-col transition-transform duration-500 ease-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
           <div className="p-8 bg-tg-active flex flex-col items-center gap-4 relative overflow-hidden">
              <div className="w-24 h-24 rounded-[2rem] bg-white/10 backdrop-blur-md relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                 {avatar ? <img src={avatar} className="w-full h-full object-cover rounded-[2rem]" /> : <div className="w-full h-full flex items-center justify-center text-4xl font-black text-white">{nickname[0]}</div>}
                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] flex items-center justify-center"><Camera className="text-white w-8 h-8" /></div>
                 <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
              </div>
              <div className="text-center">
                 <p className="text-xl font-black text-white">{nickname}</p>
                 <p className="text-[10px] text-white/40 font-mono">NODE ID: {peerService.getPeerId()}</p>
              </div>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="w-full flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl transition-all"><Settings className="w-5 h-5" /> Настройки звука/видео</button>
              {isSettingsOpen && (
                <div className="p-4 bg-white/5 rounded-2xl space-y-4 animate-in slide-in-from-top">
                   <div>
                      <label className="text-[10px] uppercase font-bold opacity-40 block mb-2">Микрофон</label>
                      <select className="w-full bg-tg-input p-3 rounded-xl text-sm outline-none" value={settings.audioInputId} onChange={e => setSettings({...settings, audioInputId: e.target.value})}>
                         {devices.filter(d => d.kind === 'audioinput').map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Стандарт'}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="text-[10px] uppercase font-bold opacity-40 block mb-2">Камера</label>
                      <select className="w-full bg-tg-input p-3 rounded-xl text-sm outline-none" value={settings.videoInputId} onChange={e => setSettings({...settings, videoInputId: e.target.value})}>
                         {devices.filter(d => d.kind === 'videoinput').map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Стандарт'}</option>)}
                      </select>
                   </div>
                </div>
              )}
              <div className="pt-4 mt-2 border-t border-white/5">
                 <p className="text-[10px] font-black uppercase text-tg-gray mb-3 px-4">Темы</p>
                 <div className="grid grid-cols-4 gap-2 px-2">
                    <button onClick={() => setTheme('dark')} className={`p-3 rounded-xl flex justify-center ${theme === 'dark' ? 'bg-tg-active shadow-lg' : 'bg-tg-input'}`}><Moon className="w-5 h-5" /></button>
                    <button onClick={() => setTheme('light')} className={`p-3 rounded-xl flex justify-center ${theme === 'light' ? 'bg-tg-active shadow-lg' : 'bg-tg-input'}`}><Sun className="w-5 h-5" /></button>
                    <button onClick={() => setTheme('newyear')} className={`p-3 rounded-xl flex justify-center ${theme === 'newyear' ? 'bg-red-600 shadow-lg' : 'bg-tg-input'}`}><Gift className="w-5 h-5" /></button>
                    <button onClick={() => setTheme('custom')} className={`p-3 rounded-xl flex justify-center ${theme === 'custom' ? 'bg-tg-active shadow-lg' : 'bg-tg-input'}`}><Palette className="w-5 h-5" /></button>
                 </div>
              </div>
           </div>
           <div className="p-4 border-t border-white/5"><button onClick={logout} className="w-full flex items-center gap-4 p-4 text-red-500 hover:bg-red-500/10 rounded-2xl font-bold transition-all"><LogOut className="w-5 h-5" /> Выход</button></div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative z-10">
        <aside className={`w-full md:w-80 lg:w-[400px] bg-tg-sidebar border-r border-white/5 flex flex-col flex-shrink-0 ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
           <div className="p-5 flex items-center gap-4">
              <button onClick={() => setIsMenuOpen(true)} className="p-2 hover:bg-white/5 rounded-xl"><Menu className="text-tg-gray w-6 h-6" /></button>
              <div className="flex-1 relative">
                 <Search className={`absolute left-4 top-3.5 w-4 h-4 ${isSearching ? 'text-blue-500 animate-spin' : 'text-tg-gray'}`} />
                 <input type="text" placeholder="Поиск..." className="w-full bg-tg-input rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none border-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
              </div>
           </div>
           <div className="flex-1 overflow-y-auto custom-scrollbar px-3">
              {contacts.map(id => {
                const last = conversations[id]?.slice(-1)[0];
                const prof = profiles[id];
                return (
                  <div key={id} onClick={() => setActiveChatId(id)} className={`p-4 mb-1 rounded-[1.5rem] flex items-center gap-4 cursor-pointer transition-all ${activeChatId === id ? 'bg-tg-active shadow-xl text-white' : 'hover:bg-white/5'}`}>
                     <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/5 flex-shrink-0">
                        {prof?.avatar ? <img src={prof.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-xl">{id[0]}</div>}
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1"><span className="font-bold truncate">{id}</span><span className="text-[9px] font-bold opacity-40">ONLINE</span></div>
                        <p className={`text-xs truncate ${activeChatId === id ? 'opacity-80' : 'opacity-40'}`}>{last ? (last.text || '📷 Фото') : 'Нажми чтобы начать'}</p>
                     </div>
                  </div>
                );
              })}
           </div>
        </aside>

        <main className={`flex-1 flex flex-col bg-tg-bg relative ${!activeChatId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
           {!activeChatId ? (
             <div className="text-center p-12 glass rounded-[3rem] border border-white/5 max-w-sm scale-90 md:scale-100">
                <div className="w-32 h-32 bg-tg-sidebar rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl border border-white/5"><Send className="w-12 h-12 opacity-20" /></div>
                <h2 className="text-2xl font-black mb-3">NeXuS_ Premium</h2>
                <p className="text-sm opacity-40">Полностью зашифрованное P2P соединение. Данные не хранятся на серверах.</p>
             </div>
           ) : (
             <>
               <header className="h-20 bg-tg-sidebar/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-20">
                  <div className="flex items-center gap-4">
                     <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 text-tg-gray"><ArrowLeft className="w-6 h-6" /></button>
                     <div className="w-12 h-12 rounded-xl overflow-hidden cursor-pointer" onClick={() => setSelectedProfileId(activeChatId)}>
                        {profiles[activeChatId]?.avatar ? <img src={profiles[activeChatId].avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-tg-active flex items-center justify-center font-black text-white">{activeChatId[0]}</div>}
                     </div>
                     <div onClick={() => setSelectedProfileId(activeChatId)} className="cursor-pointer">
                        <h3 className="font-black text-lg leading-none mb-1">{activeChatId}</h3>
                        <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /><span className="text-[10px] text-green-500 font-black tracking-widest uppercase">ONLINE</span></div>
                     </div>
                  </div>
                  <div className="flex items-center gap-1 md:gap-3">
                     <button onClick={() => startCall(false)} className="p-3 text-tg-gray hover:text-white"><Phone className="w-5 h-5" /></button>
                     <button onClick={() => startCall(true)} className="p-3 text-tg-gray hover:text-white"><Video className="w-5 h-5" /></button>
                     <button className="p-3 text-tg-gray hover:text-white"><MoreVertical className="w-5 h-5" /></button>
                  </div>
               </header>

               <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 custom-scrollbar">
                  {conversations[activeChatId]?.map(msg => (
                    <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                       <div className={`message-bubble relative p-4 shadow-xl ${msg.isMe ? 'bg-tg-active text-white rounded-[1.5rem] rounded-br-none' : 'bg-tg-sidebar rounded-[1.5rem] rounded-bl-none'}`}>
                          {msg.imageUrl && <img src={msg.imageUrl} className="rounded-xl mb-3 max-h-96 w-full object-contain" />}
                          {msg.text && <p className="text-[15px] leading-relaxed font-medium whitespace-pre-wrap">{msg.text}</p>}
                          <div className="flex items-center justify-end gap-1.5 mt-2 opacity-50">
                             <span className="text-[9px] font-black">{msg.time}</span>
                             {msg.isMe && <CheckCheck className="w-3.5 h-3.5" />}
                          </div>
                       </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
               </div>

               <footer className="p-4"><div className="max-w-4xl mx-auto flex items-end gap-3 glass p-3 rounded-[2rem] border border-white/10 shadow-2xl">
                  <button onClick={() => fileInputRef.current?.click()} className="p-3.5 text-tg-gray hover:text-white"><Paperclip className="w-6 h-6" /></button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                  <textarea rows={1} placeholder="Сообщение..." className="flex-1 bg-transparent border-none focus:outline-none py-3.5 text-[15px] resize-none max-h-48 custom-scrollbar font-medium" value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatMessage); } }} />
                  <button onClick={() => sendMessage(chatMessage)} className={`p-4 rounded-2xl transition-all ${chatMessage.trim() ? 'bg-tg-active text-white scale-100' : 'bg-white/5 opacity-20 scale-90 pointer-events-none'}`}><Send className="w-6 h-6 -rotate-12" /></button>
               </div></footer>
             </>
           )}
        </main>
      </div>

      {/* Call UI */}
      {(currentCall || incomingCall) && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col text-white animate-in slide-in-from-bottom duration-500">
           <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              {incomingCall && !currentCall ? (
                <div className="space-y-12">
                   <div className="w-48 h-48 rounded-[3.5rem] bg-tg-active flex items-center justify-center text-6xl font-black shadow-2xl animate-pulse overflow-hidden">
                      {profiles[incomingCall.peer]?.avatar ? <img src={profiles[incomingCall.peer].avatar} className="w-full h-full object-cover" /> : incomingCall.peer[0]}
                   </div>
                   <div><h2 className="text-4xl font-black tracking-tight mb-4">{incomingCall.peer}</h2><p className="text-blue-400 font-black uppercase tracking-[0.4em] text-xs">P2P CALL INCOMING</p></div>
                   <div className="flex gap-10">
                      <button onClick={endCall} className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-2xl active:scale-90"><X className="w-10 h-10" /></button>
                      <button onClick={answerCall} className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center shadow-2xl active:scale-90 animate-bounce"><Phone className="w-10 h-10" /></button>
                   </div>
                </div>
              ) : (
                <div className="w-full h-full max-w-6xl mx-auto flex flex-col bg-slate-900 rounded-[3rem] overflow-hidden relative shadow-3xl">
                   <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                   <div className="absolute top-10 left-10 p-6 glass rounded-3xl border border-white/10">
                      <h3 className="text-2xl font-black">{currentCall?.peer || incomingCall?.peer}</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mt-1">SECURED P2P LIVE</p>
                   </div>
                   <div className="absolute bottom-12 right-12 w-48 h-72 bg-black rounded-3xl overflow-hidden border-4 border-white/20 shadow-2xl ring-10 ring-black/50">
                      <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                   </div>
                   <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 glass p-5 rounded-[3rem] border border-white/10">
                      <button className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center transition-all hover:bg-white/20"><Mic className="w-8 h-8" /></button>
                      <button onClick={endCall} className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all hover:bg-red-700"><X className="w-12 h-12" /></button>
                      <button className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center transition-all hover:bg-white/20"><Video className="w-8 h-8" /></button>
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
