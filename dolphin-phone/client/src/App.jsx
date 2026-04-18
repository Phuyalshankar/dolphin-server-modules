import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DolphinProvider, useDolphin } from './contexts/DolphinContext';
import { Phone, PhoneOff, Video, MessageCircle, Activity, Settings, Clock, Send, X, ArrowUpRight, ArrowDownLeft, PhoneMissed } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebRTC } from './hooks/useWebRTC';
import { useAudioTones } from './hooks/useAudioTones';

// ─────────────────────────────────────────────
// Login Screen
// ─────────────────────────────────────────────
const Login = () => {
  const { connect } = useDolphin();
  const { playNotifyTone } = useAudioTones();
  const [deviceId, setDeviceId] = useState('Room-101');
  const [name, setName] = useState('John Doe');
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    // Initialize audio on user gesture
    playNotifyTone(); 
    await connect(deviceId, name);
    setLoading(false);
  };

  return (
    <div className="flex h-screen items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel w-full max-w-md p-10 rounded-3xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 rounded-full mb-4"><Phone size={40} className="text-primary" /></div>
          <h1 className="text-3xl font-bold">Dolphin Phone</h1>
          <p className="text-white/50 mt-2">Premium Intercom System</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Unit ID (Device ID)</label>
            <input type="text" value={deviceId} onChange={e => setDeviceId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="e.g. Room-101" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Display Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="e.g. Nurse Station" />
          </div>
          <button onClick={handleConnect} disabled={loading}
            className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? 'Connecting...' : 'Initialize Device'} <Activity size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Sidebar Item
// ─────────────────────────────────────────────
const SidebarItem = ({ icon: Icon, active, label, onClick, badge }) => (
  <div onClick={onClick} className={`relative p-4 cursor-pointer transition-all flex flex-col items-center gap-1 ${active ? 'text-primary bg-primary/10 md:border-r-4 border-b-4 md:border-b-0 border-primary' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
    <Icon size={24} />
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    {badge > 0 && <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">{badge > 9 ? '9+' : badge}</span>}
  </div>
);

// ─────────────────────────────────────────────
// User Card
// ─────────────────────────────────────────────
const UserCard = ({ device, onCall, onChat }) => (
  <motion.div whileHover={{ scale: 1.01 }} className="glass-card p-4 rounded-2xl flex items-center justify-between">
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-11 h-11 flex-shrink-0 rounded-full bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center font-bold text-base">{device.name[0]}</div>
      <div className="min-w-0">
        <h4 className="font-bold truncate">{device.name}</h4>
        <p className="text-xs text-white/50 truncate">{device.deviceId}</p>
      </div>
    </div>
    <div className="flex gap-2 flex-shrink-0">
      <button onClick={() => onChat(device)} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"><MessageCircle size={15} /></button>
      <button onClick={() => onCall(device, 'audio')} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"><Phone size={15} /></button>
      <button onClick={() => onCall(device, 'video')} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"><Video size={15} /></button>
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────
// Chat Panel
// ─────────────────────────────────────────────
const ChatPanel = ({ client, user, peer, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  
  if (!user || !peer) return null; // Guard moved below hooks
  const chatKey = [user.deviceId, peer.deviceId].sort().join('__chat__');

  // Load from localStorage + server history
  useEffect(() => {
    if (!user || !peer) return;
    const fetchHistory = async () => {
      try {
        const saved = JSON.parse(localStorage.getItem(`chat_${chatKey}`) || '[]');
        setMessages(saved);

        // Also fetch from server to get missed messages
        const res = await fetch(`http://${window.location.hostname}:5001/history/messages?from=${user.deviceId}&to=${peer.deviceId}`);
        const data = await res.json();
        
        if (data.success && data.data) {
          // Merge and deduplicate by timestamp or content (simple merge for now)
          const serverMsgs = data.data.map(m => ({
            from: m.from,
            text: m.content, // Map content -> text
            ts: new Date(m.timestamp).getTime()
          }));
          
          setMessages(prev => {
            const combined = [...prev, ...serverMsgs];
            // Sort by timestamp
            combined.sort((a,b) => (a.ts || 0) - (b.ts || 0));
            // Very simple deduplication by text+ts
            const unique = [];
            const seen = new Set();
            for (const m of combined) {
              const key = `${m.from}_${m.text}_${m.ts}`;
              if (!seen.has(key)) {
                unique.push(m);
                seen.add(key);
              }
            }
            localStorage.setItem(`chat_${chatKey}`, JSON.stringify(unique));
            return unique;
          });
        }
      } catch (err) {
        console.error('[ChatPanel] History fetch failed:', err);
      }
    };
    fetchHistory();
  }, [chatKey, user.deviceId, peer.deviceId]);

  // Listen for incoming CHAT signals
  const { playNotifyTone } = useAudioTones();
  useEffect(() => {
    if (!client) return;
    const handler = (payload) => {
      console.log('[ChatPanel] Signal received:', payload.type, 'from:', payload.from);
      if (payload.type === 'CHAT' && payload.from === peer.deviceId) {
        setMessages(prev => {
          return [...prev, { from: payload.from, text: payload.text, ts: Date.now() }];
        });
        playNotifyTone();
      }
    };
    client.onSignal(handler);
    return () => client.offSignal(handler);
  }, [client, peer.deviceId, chatKey, playNotifyTone]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = () => {
    if (!text.trim()) return;
    client.publish(`phone/signaling/${peer.deviceId}`, {
      type: 'CHAT',
      from: user.deviceId,
      to: peer.deviceId,
      text: text.trim()
    });
    setMessages(prev => {
      const next = [...prev, { from: user.deviceId, text: text.trim(), ts: Date.now() }];
      localStorage.setItem(`chat_${chatKey}`, JSON.stringify(next));
      return next;
    });
    setText('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center font-bold">{peer.name[0]}</div>
          <div>
            <p className="font-bold">{peer.name}</p>
            <p className="text-xs text-white/40">{peer.deviceId}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-all"><X size={20} /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 min-h-0">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-white/30 text-sm py-12">No messages yet. Say hi! 👋</div>
        )}
        {messages.map((msg, index) => (
          <div key={msg.ts || index} className={`flex ${msg.from === user.deviceId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${msg.from === user.deviceId ? 'bg-primary text-white rounded-br-sm' : 'bg-white/10 text-white rounded-bl-sm'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-white/10 flex-shrink-0">
        <input
          type="text" value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm min-w-0"
        />
        <button onClick={sendMessage} className="p-3 rounded-xl bg-primary hover:bg-primary/80 text-white transition-all flex-shrink-0"><Send size={18} /></button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Call History Item
// ─────────────────────────────────────────────
const CallHistoryItem = ({ item, myDeviceId }) => {
  const isOutgoing = item.from === myDeviceId;
  const isMissed = item.status === 'missed';
  const peer = isOutgoing ? item.to : item.from;

  return (
    <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${isMissed ? 'bg-red-500/20' : isOutgoing ? 'bg-primary/20' : 'bg-green-500/20'}`}>
        {isMissed ? <PhoneMissed size={16} className="text-red-400" /> : isOutgoing ? <ArrowUpRight size={16} className="text-primary" /> : <ArrowDownLeft size={16} className="text-green-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm truncate ${isMissed ? 'text-red-400' : 'text-white'}`}>{peer}</p>
        <p className="text-[10px] text-white/40">{new Date(item.timestamp).toLocaleString()}</p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
          isMissed ? 'bg-red-500/20 text-red-400' :
          item.status === 'completed' ? 'bg-green-500/20 text-green-400' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>{item.status.toUpperCase()}</span>
        {item.type === 'video' && <span className="text-[9px] text-white/30">📹 Video</span>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────
const Dashboard = () => {
  const { user, devices, fetchDevices, client, incomingCall, setIncomingCall, activeCall, setActiveCall } = useDolphin();
  const [view, setView] = useState('dialer');
  const [history, setHistory] = useState([]);
  const [chatPeer, setChatPeer] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [unreadChats, setUnreadChats] = useState({});        // { deviceId: count }
  const [chatNotifFrom, setChatNotifFrom] = useState(null);  // quick chat badge popup

  // ── Unread badge count ───────────────────────
  const totalUnread = Object.values(unreadChats || {}).reduce((a, b) => a + b, 0);

  // ── Call Timer ──────────────────────────────
  useEffect(() => {
    let timer;
    if (activeCall?.connected) {
      timer = setInterval(() => setCallDuration(p => p + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [activeCall?.connected]);

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // ── History fetch ────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!user?.deviceId) return;
    try {
      const res = await fetch(`http://${window.location.hostname}:5001/history/calls?deviceId=${user?.deviceId}`);
      const data = await res.json();
      if (data.success) setHistory(data.data);
    } catch {}
  }, [user?.deviceId, window.location.hostname]);

  // ── Audio ────────────────────────────────────
  const { playRingtone, playDialtone, playNotifyTone, stopTone } = useAudioTones();

  // ── WebRTC ───────────────────────────────────
  const { localStream, remoteStream, makeOffer, handleOffer, handleAnswer, handleIceCandidate, cleanup: cleanupRTC } = useWebRTC(client, user);
   const localVideoRef = useRef(null);
   const remoteVideoRef = useRef(null);
   const remoteAudioRef = useRef(null);
 
   useEffect(() => { if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream; }, [localStream, activeCall]);
   useEffect(() => {
     if (remoteVideoRef.current && remoteStream) {
       remoteVideoRef.current.srcObject = remoteStream;
       remoteVideoRef.current.play().catch(e => console.warn('[App] Remote video play blocked:', e));
     }
   }, [remoteStream, activeCall]);
 
useEffect(() => {
      console.log('[App] remoteStream effect running', { remoteStream: !!remoteStream, hasAudio: remoteStream?.getAudioTracks().length, hasVideo: remoteStream?.getVideoTracks().length, connected: activeCall?.connected });
      if (remoteAudioRef.current && remoteStream) {
        const audioTracks = remoteStream.getAudioTracks();
        const videoTracks = remoteStream.getVideoTracks();
        console.log(`[App] Attaching remote stream. Audio: ${audioTracks.length}, Video: ${videoTracks.length}`);
        
        if (remoteAudioRef.current.srcObject !== remoteStream) {
          console.log('[App] Setting srcObject to remoteStream');
          remoteAudioRef.current.srcObject = remoteStream;
        }
        
        remoteAudioRef.current.play()
          .then(() => console.log('[App] Remote audio playing successfully'))
          .catch(e => console.warn('[App] Remote audio play blocked or failed:', e));
      }
    }, [remoteStream, activeCall?.connected]);

  // ── Ring ─────────────────────────────────────
  useEffect(() => {
    if (incomingCall) playRingtone(); else stopTone();
  }, [incomingCall, playRingtone, stopTone]);

  // ── Global signal handler (chat notifications + WebRTC) ──
  useEffect(() => {
    if (!client) return;

    // Chat notification handler (global - always active)
    const chatHandler = (payload) => {
      // Only log chat for clean console
      if (payload.type === 'CHAT') {
        console.log('[Global Chat] Signal: CHAT from:', payload.from);
        if (payload.from && user?.deviceId) {
          // ALWAYS Persist to localStorage for when ChatPanel is not mounted
          const chatKey = [user?.deviceId, payload.from].sort().join('__chat__');
          const saved = JSON.parse(localStorage.getItem(`chat_${chatKey}`) || '[]');
          const next = [...saved, { from: payload.from, text: payload.text, ts: Date.now() }];
          localStorage.setItem(`chat_${chatKey}`, JSON.stringify(next));

          // If not currently viewing this chat, increment unread and play tone
          if (!(view === 'chat' && chatPeer?.deviceId === payload.from)) {
            console.log('[Global Chat] Showing notification and playing tone');
            setUnreadChats(prev => ({ ...prev, [payload.from]: (prev[payload.from] || 0) + 1 }));
            setChatNotifFrom(payload.from);
            playNotifyTone();
            setTimeout(() => setChatNotifFrom(null), 3000);
          }
        }
      }
    };
    client.onSignal(chatHandler);
    return () => client.offSignal(chatHandler);
  }, [client, view, chatPeer, user?.deviceId, playNotifyTone]);

  // ── WebRTC signaling (separate effect) ───────
  useEffect(() => {
    if (!client) return;
    const handler = async (payload) => {
      if (payload.type === 'ACCEPT') {
        stopTone();
        setActiveCall(prev => prev ? { ...prev, connected: true } : null);
        if (activeCall?.isOutbound) {
          const offer = await makeOffer(payload.from, activeCall.data?.video);
          client.publish(`phone/signaling/${payload.from}`, {
            type: 'OFFER', from: user.deviceId, to: payload.from,
            data: { offer, video: activeCall.data?.video }
          });
        }
      } else if (payload.type === 'END') {
        stopTone(); setActiveCall(null); setIncomingCall(null); cleanupRTC();
      } else if (payload.type === 'OFFER') {
        stopTone();
        const answer = await handleOffer(payload.data.offer, payload.from, payload.data?.video);
        setActiveCall(prev => prev ? { ...prev, connected: true, data: { ...(prev.data||{}), ...payload.data } } : null);
        client.publish(`phone/signaling/${payload.from}`, {
          type: 'ANSWER', from: user.deviceId, to: payload.from, data: { answer }
        });
      } else if (payload.type === 'ANSWER') {
        await handleAnswer(payload.data.answer);
      } else if (payload.type === 'ICE' || payload.type === 'ICE_CANDIDATE') {
        await handleIceCandidate(payload.data.candidate || payload.data);
      }
    };
    client.onSignal(handler);
    return () => client.offSignal(handler);
  }, [client, activeCall, user?.deviceId, makeOffer, handleOffer, handleAnswer, handleIceCandidate, stopTone, cleanupRTC]);

  // ── Polling ──────────────────────────────────
  useEffect(() => {
    fetchDevices();
    if (view === 'history') fetchHistory();
    const interval = setInterval(() => {
      fetchDevices();
      if (view === 'history') fetchHistory();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchDevices, fetchHistory, view]);

  // ── Call Actions ─────────────────────────────
  const handleCall = (device, type) => {
    const isVideo = type === 'video';
    client.publish(`phone/signaling/${device.deviceId}`, {
      type: 'INVITE', from: user.deviceId, to: device.deviceId, data: { video: isVideo }
    });
    playDialtone();
    setActiveCall({ from: user.deviceId, to: device.deviceId, data: { video: isVideo }, isOutbound: true, connected: false });
    // Warm up audio element on user click
    if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
  };

  const acceptCall = () => {
    stopTone();
    client.publish(`phone/signaling/${incomingCall.from}`, {
      type: 'ACCEPT', from: user.deviceId, to: incomingCall.from
    });
    setActiveCall({ ...incomingCall, isOutbound: false, connected: false });
    setIncomingCall(null);
    // Warm up audio element on user click
    if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
  };

  const rejectCall = () => {
    stopTone();
    client.publish(`phone/signaling/${incomingCall.from}`, {
      type: 'REJECT', from: user.deviceId, to: incomingCall.from
    });
    setIncomingCall(null);
  };

  const endCall = () => {
    const target = activeCall?.isOutbound ? activeCall.to : activeCall?.from;
    if (target) client.publish(`phone/signaling/${target}`, { type: 'END', from: user.deviceId, to: target });
    setActiveCall(null); setIncomingCall(null); stopTone(); cleanupRTC();
  };

  const openChat = (device) => {
    setChatPeer(device);
    setView('chat');
    // Clear unread for this device
    setUnreadChats(prev => { const n = { ...prev }; delete n[device.deviceId]; return n; });
  };

  // ── Device list for chat view ─────────────────
  const otherDevices = devices.filter(d => d.deviceId !== user.deviceId);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="flex flex-col-reverse md:flex-row h-[100dvh] overflow-hidden text-white">

      {/* ── Sidebar ── */}
      <div className="w-full md:w-20 glass-panel flex flex-row md:flex-col pt-2 md:pt-8 justify-around md:justify-start z-40 pb-2 md:pb-0 flex-shrink-0">
        <SidebarItem icon={Phone} active={view === 'dialer'} label="Dialer" onClick={() => setView('dialer')} />
        <SidebarItem icon={Clock} active={view === 'history'} label="Calls" onClick={() => { setView('history'); fetchHistory(); }} />
        <SidebarItem icon={MessageCircle} active={view === 'chat'} label="Chat" onClick={() => setView('chat')} badge={totalUnread} />
        <div className="md:mt-auto md:pb-8 flex justify-center items-center">
          <SidebarItem icon={Settings} label="Settings" />
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col p-3 md:p-8 relative overflow-hidden min-h-0">
        {/* Header */}
        <header className="flex justify-between items-center mb-4 md:mb-8 flex-shrink-0">
          <div>
            <h1 className="text-xl md:text-3xl font-bold">
              {view === 'chat' && chatPeer ? `Chat · ${chatPeer.name}` : view === 'history' ? 'Call History' : `Good Evening, ${user.name}`}
            </h1>
            <p className="text-white/50 text-xs md:text-sm">{user.deviceId} • Online</p>
          </div>
          <div className="p-2 md:p-3 rounded-2xl glass-panel bg-primary/20 border-primary/30">
            <Activity size={18} className="text-primary" />
          </div>
        </header>

        {/* ── Views ── */}

        {/* DIALER VIEW */}
        {view === 'dialer' && (
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0 pb-2">
            {otherDevices.length === 0
              ? <p className="text-white/30 text-sm text-center py-12">No other devices online.</p>
              : otherDevices.map(d => <UserCard key={d.deviceId} device={d} onCall={handleCall} onChat={openChat} />)
            }
          </div>
        )}

        {/* HISTORY VIEW */}
        {view === 'history' && (
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0 pb-2">
            {history.length === 0
              ? <p className="text-white/30 text-sm text-center py-12">No call history yet.</p>
              : history.map(item => <CallHistoryItem key={item._id} item={item} myDeviceId={user.deviceId} />)
            }
          </div>
        )}

        {/* CHAT VIEW */}
        {view === 'chat' && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {chatPeer ? (
              <ChatPanel client={client} user={user} peer={chatPeer} onClose={() => { setChatPeer(null); }} />
            ) : (
              /* Contact picker for chat */
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-2 min-h-0">
                <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Select a contact to chat</p>
                {otherDevices.map(d => (
                  <motion.div
                    key={d.deviceId}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => openChat(d)}
                    className="glass-card p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/5"
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center font-bold text-base relative">
                      {d.name[0]}
                      {unreadChats[d.deviceId] > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                          {unreadChats[d.deviceId]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{d.name}</p>
                      <p className="text-xs text-white/40 truncate">{d.deviceId}</p>
                    </div>
                    <MessageCircle size={18} className="text-white/40" />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Chat notification toast ── */}
        <AnimatePresence>
          {chatNotifFrom && view !== 'chat' && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 right-4 glass-panel px-4 py-3 rounded-2xl z-40 flex items-center gap-3 shadow-xl border border-primary/20"
            >
              <div className="relative">
                <MessageCircle size={18} className="text-primary flex-shrink-0" />
                {unreadChats[chatNotifFrom] > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[8px] flex items-center justify-center font-bold">
                    {unreadChats[chatNotifFrom]}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium">
                <strong>{chatNotifFrom}</strong> ({unreadChats[chatNotifFrom]} new)
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Incoming Call Toast ── */}
        <AnimatePresence>
          {incomingCall && (
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 100 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 100 }}
              className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 glass-panel p-5 rounded-[2rem] flex items-center gap-5 z-50 shadow-2xl border-primary/50 w-[92vw] md:w-auto max-w-sm md:max-w-none"
            >
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center font-bold text-2xl animate-pulse flex-shrink-0">
                {incomingCall.from[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-primary font-bold text-xs uppercase tracking-widest">
                  {incomingCall.data?.video ? '📹 Incoming Video Call' : '📞 Incoming Call'}
                </p>
                <h2 className="text-lg font-bold truncate">{incomingCall.from}</h2>
              </div>
              <div className="flex gap-3 flex-shrink-0">
                <button onClick={acceptCall} className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center hover:scale-110 transition-all shadow-lg shadow-green-500/30">
                  <Phone size={20} />
                </button>
                <button onClick={rejectCall} className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center hover:scale-110 transition-all shadow-lg shadow-red-500/30">
                  <PhoneOff size={20} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Active Call Overlay ── */}
        <AnimatePresence>
          {activeCall && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] glass-panel backdrop-blur-3xl flex flex-col items-center justify-center overflow-hidden"
            >
              {/* Timer */}
              {activeCall.connected && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 z-50">
                  <span className="text-primary font-bold text-sm tracking-widest">{formatTime(callDuration)}</span>
                </div>
              )}

              {/* Status label */}
              {!activeCall.connected && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 text-white/50 animate-pulse text-sm tracking-widest z-50">
                  {activeCall.isOutbound ? `Calling ${activeCall.to}...` : 'Connecting...'}
                </div>
              )}

              {/* Video elements only when connected */}
              {activeCall.connected && activeCall.data?.video && (
                <div className="absolute inset-0 -z-10 bg-black">
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <video ref={localVideoRef} autoPlay playsInline muted
                    className="absolute bottom-28 right-3 md:bottom-10 md:right-8 w-24 h-36 md:w-44 md:h-60 object-cover rounded-2xl shadow-2xl border-2 border-white/20 z-[65]" />
                </div>
              )}

              {/* Avatar (audio / waiting) */}
              {(!activeCall.data?.video || !activeCall.connected || !remoteStream?.getVideoTracks().some(t => t.enabled)) && (
                <div className="text-center z-10 px-8">
                  <div className="text-primary font-bold text-xs uppercase tracking-[0.3em] mb-6">
                    {activeCall.connected ? 'In Conversation' : activeCall.isOutbound ? 'Ringing...' : 'Connecting...'}
                  </div>
                  <div className="w-36 h-36 md:w-48 md:h-48 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-6xl font-bold shadow-2xl mb-8 mx-auto relative">
                    {!activeCall.connected && <div className="absolute inset-0 rounded-full border-4 border-primary/50 animate-ping" />}
                    {(activeCall.isOutbound ? activeCall.to : activeCall.from)?.[0]?.toUpperCase()}
                  </div>
                  <h1 className="text-4xl font-bold mb-2">{activeCall.isOutbound ? activeCall.to : activeCall.from}</h1>
                  <p className="text-white/50 text-sm">Secure End-to-End Encryption</p>
                  
                  {/* Hardware Status */}
                  {!localStream && activeCall.connected && (
                    <div className="mt-4 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                      <p className="text-yellow-500 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                        <Activity size={12} /> Listening Mode (No Mic)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* End button */}
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[70]">
                <button onClick={endCall} className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-500 shadow-xl shadow-red-500/30 flex items-center justify-center hover:scale-105 transition-all">
                  <PhoneOff size={28} className="text-white" />
                </button>
                <p className="text-center text-white/50 text-xs mt-2 uppercase tracking-widest">End</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <audio 
        ref={remoteAudioRef} 
        autoPlay 
        playsInline 
        muted={false} 
        style={{ display: 'none' }} 
      />
    </div>
  );
};

// ─────────────────────────────────────────────
// App Root
// ─────────────────────────────────────────────
const AppContent = () => {
  const { isConnected, user } = useDolphin();
  return (isConnected && user) ? <Dashboard /> : <Login />;
};

const App = () => (
  <DolphinProvider>
    <div className="min-h-screen">
      <AppContent />
    </div>
  </DolphinProvider>
);

export default App;
