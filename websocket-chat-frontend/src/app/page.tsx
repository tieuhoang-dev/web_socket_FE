'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FiImage, FiSend, FiDownload } from 'react-icons/fi';
import { Menu } from '@headlessui/react';
import { FiMoreVertical } from 'react-icons/fi';
import { FiPlay, FiPause } from "react-icons/fi";


type Message = {
  id?: string | number;
  from: string;
  to: string;
  content: string;
  type: string;
  tempId?: string; // Chỉ dùng trong FE, không gửi đi
};

type Contact = {
  username: string;
  avatar?: string;
  last_message?: string;
  last_message_at?: number;
  unread_count?: number;
};
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const API_BASE = 'http://localhost:8080';

export default function ChatBoxPage() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [toUser, setToUser] = useState('');
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const currentUser = typeof window !== 'undefined' ? localStorage.getItem('username') || '' : '';
  const [contacts, setContacts] = useState<Contact[]>([]);
  const contactsPageRef = useRef(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const searchDebounceRef = useRef<number | null>(null);
  const listToShow = searchResults.length > 0 ? searchResults : contacts;
  const toUserRef = useRef(toUser);
  useEffect(() => {
    toUserRef.current = toUser;
  }, [toUser]);

  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (!token) {
      window.location.href = '/';
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;

    const connect = () => {
      socket = new WebSocket(`${API_BASE.replace(/^http/, 'ws')}/ws?token=${token}`);
      setWs(socket);

      socket.onopen = () => {
        reconnectAttempts = 0;
        console.log('[WS] Connected');
        contactsPageRef.current = 0;
        socket?.send(JSON.stringify({
          type: 'load_contacts',
          page: contactsPageRef.current,
          page_size: 20
        }));
        socket?.send(JSON.stringify({ type: 'ping' }));

        pingInterval = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const cu = currentUserRef.current;
          const tu = toUserRef.current;

          if (['text', 'image', 'video', 'voice', 'audio', 'file'].includes(msg.type)) {
            const preview = msg.type === 'text' ? msg.content : `[${msg.type}]`;
            const now = Date.now();

            if (msg.from === cu && msg.tempId) {
              // Replace tempId
              setMessages(prev => {
                const withoutDup = prev.filter(m => m.id !== msg.id);
                return withoutDup.map(m =>
                  m.id === msg.tempId ? { ...m, id: msg.id } : m
                );
              });

              // Update contact nếu không phải gửi cho chính mình
              if (msg.to !== cu) {
                setContacts(prev => {
                  const idx = prev.findIndex(c => c.username === msg.to);
                  let updated = [...prev];
                  if (idx >= 0) {
                    const updatedContact = {
                      ...updated[idx],
                      last_message: preview,
                      last_message_at: now,
                    };
                    updated.splice(idx, 1);
                    updated.unshift(updatedContact);
                  } else {
                    updated.unshift({
                      username: msg.to,
                      avatar: DEFAULT_AVATAR,
                      last_message: preview,
                      last_message_at: now,
                      unread_count: 0
                    });
                  }
                  return updated;
                });
              }

              return; // Quan trọng: không cho chạy tiếp
            } else {
              // 💡 Xử lý tin từ người khác
              const belongsToCurrentConversation =
                (msg.from === tu && msg.to === cu) || (msg.from === cu && msg.to === tu);

              if (belongsToCurrentConversation) {
                setMessages(prev => [...prev, { ...msg, id: msg.id || uuidv4() }]);
              }

              // Update contact cho người gửi tin
              setContacts(prev => {
                const idx = prev.findIndex(c => c.username === msg.from);
                let updated = [...prev];
                if (idx >= 0) {
                  const updatedContact = {
                    ...updated[idx],
                    last_message: preview,
                    last_message_at: now,
                    avatar: msg.avatar || updated[idx].avatar,
                    unread_count: (tu !== msg.from)
                      ? ((updated[idx] as any).unread_count || 0) + 1
                      : 0
                  };
                  updated.splice(idx, 1);
                  updated.unshift(updatedContact);
                } else {
                  updated.unshift({
                    username: msg.from,
                    avatar: msg.avatar || DEFAULT_AVATAR,
                    last_message: preview,
                    last_message_at: now,
                    unread_count: (tu !== msg.from) ? 1 : 0
                  });
                }
                return updated;
              });
            }
          }
          if (msg.type === 'contacts') {
            const normalized = (msg.contacts || []).map((c: any) => ({
              username: c.username || c.Username || '',
              avatar: c.avatar || c.Avatar || DEFAULT_AVATAR,
              last_message: c.last_message,
              last_message_at: c.last_message_at,
              unread_count: c.unread_count || 0
            })).filter((c: any) => c.username);

            setContacts(prev => {
              const map = new Map<string, Contact>();
              prev.forEach(p => map.set(p.username, { ...p }));
              normalized.forEach((n: any) => {
                const exist = map.get(n.username);
                if (exist) map.set(n.username, { ...exist, ...n });
                else map.set(n.username, n);
              });
              return Array.from(map.values()).sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0));
            });

            return;
          }

          if (msg.type === 'history') {
            const history = (msg.messages || []).map((m: any) => ({ ...m, id: m.id || uuidv4() }));
            setMessages(history);
            return;
          }

          if (msg.type === 'message_deleted') {
            const idsToDelete: number[] = msg.message_ids || [];
            setMessages(prev => prev.map(m => idsToDelete.includes(Number(m.id)) ? { ...m, type: 'deleted', content: '' } : m));
            return;
          }

          if (msg.type === 'typing') {
            if (msg.from && msg.from !== currentUserRef.current) {
              setTypingUser(msg.from);
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
            }
            return;
          }

          if (msg.type === 'search_results') {
            const normalized: Contact[] = (msg.contacts || []).map((c: any) => ({
              username: c.username || c.Username || '',
              avatar: c.avatar || c.Avatar || DEFAULT_AVATAR,
            })).filter((c: Contact) => c.username);
            setSearchResults(normalized);
            return;
          }

        } catch (err) {
          console.error('Lỗi parse JSON từ WebSocket:', err, e.data);
        }
      };


      socket.onclose = () => {
        console.warn('[WS] Disconnected');
        cleanup();
        tryReconnect();
      };

      socket.onerror = (err) => {
        console.error('[WS] Error:', err);
        socket?.close();
      };
    };

    const tryReconnect = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('[WS] Đã vượt quá số lần thử kết nối lại');
        return;
      }

      const delay = Math.min(5000 * (reconnectAttempts + 1), 30000);
      console.log(`[WS] Thử kết nối lại sau ${delay / 1000}s...`);

      reconnectTimeout = setTimeout(() => {
        reconnectAttempts++;
        connect();
      }, delay);
    };

    const cleanup = () => {
      pingInterval && clearInterval(pingInterval);
      reconnectTimeout && clearTimeout(reconnectTimeout);
      pingInterval = null;
      reconnectTimeout = null;
      socket = null;
      setWs(null);
    };

    connect();

    return () => {
      cleanup();
      socket?.close();
    };
  }, [token]);


  useEffect(() => {
    if (ws && ws.readyState === WebSocket.OPEN && toUser) {
      ws.send(JSON.stringify({ type: 'load_history', with: toUser }));
    }
  }, [toUser, ws]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !toUser || input.trim() === '') return;

    if (toUser === currentUser) {
      alert("Không thể gửi tin nhắn cho chính mình");
      return;
    }

    const tempId = uuidv4();

    const messageToSend = {
      tempId, // chỉ gửi tempId, không gửi id
      type: 'text',
      from: currentUser,
      to: toUser,
      content: input.trim(),
    };

    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(messageToSend));
      }

      // Hiển thị ngay tin nhắn với id tạm (để render trong UI)
      setMessages(prev => [
        ...prev,
        {
          id: tempId, // id tạm chỉ dùng trong FE
          type: 'text',
          from: currentUser,
          to: toUser,
          content: input.trim(),
        }
      ]);

      setInput('');
    } catch (err) {
      alert('Lỗi khi gửi tin nhắn: ' + ((err as any)?.message || 'Không thể gửi tin nhắn'));
    }
  };




  const uploadFile = async (file: File, type: 'image' | 'video' | 'file' | 'voice') => {
    const formData = new FormData();
    formData.append(type, file);

    const res = await fetch(`${API_BASE}/upload/${type}`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (res.ok && data.url) {
      const message: Message = {
        tempId: uuidv4(),
        type,
        from: currentUser,
        to: toUser,
        content: data.url,
      };
      setMessages(prev => [
        ...prev,
        { ...message, id: message.tempId }
      ]);
      setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      }, 300);
    }
    else {
      alert(`Tải ${type} thất bại!`);
    }
  };

  const handleMixedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !ws || !toUser) return;

    if (file.type.startsWith('image/')) {
      uploadFile(file, 'image');
      return;
    }
    if (file.type.startsWith('video/')) {
      uploadFile(file, 'video');
      return;
    }
    if (file.type.startsWith('audio/') || file.name.endsWith('.webm')) {
      const fixedFile = new File([file], file.name, { type: 'audio/webm' });
      uploadFile(fixedFile, 'voice');
      return;
    }
    if (
      file.type === 'application/pdf' ||
      file.type === 'application/msword' ||
      file.type.includes('officedocument')
    ) {
      uploadFile(file, 'file');
      return;
    }
    alert('Loại file không được hỗ trợ!');
  };


  const handleAudioRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });

          const formData = new FormData();
          formData.append('audio', file);

          const res = await fetch(`${API_BASE}/upload/audio`, {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();
          if (res.ok && data.url) {
            const message: Message = {
              tempId: uuidv4(),
              type: 'voice',
              from: currentUser,
              to: toUser,
              content: data.url,
            };
            setMessages(prev => [
              ...prev,
              { ...message, id: message.tempId }
            ]);
            setTimeout(() => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
              }
            }, 300);

          } else {
            alert('Tải file ghi âm thất bại!');
          }
        };

        mediaRecorder.start();
        setRecording(true);
      } catch (err) {
        alert('Không thể ghi âm: ' + (err as any)?.message);
      }
    }
  };

  const getFileName = (path: string) => {
    const parts = path.split('/');
    return decodeURIComponent(parts[parts.length - 1] || 'file');
  };

  const getFileIcon = (path: string) => {
    const name = path.toLowerCase();
    if (name.endsWith('.pdf')) return '📄';
    if (name.endsWith('.doc') || name.endsWith('.docx')) return '📝';
    if (name.endsWith('.xls') || name.endsWith('.xlsx')) return '📊';
    if (name.endsWith('.ppt') || name.endsWith('.pptx')) return '📈';
    if (name.endsWith('.zip') || name.endsWith('.rar')) return '🗜️';
    return '📎';
  };
  const TypingIndicator = ({
    avatar,
    isSelf
  }: {
    avatar: string;
    isSelf: boolean;
  }) => {
    return (
      <div className={`flex items-end mb-3 ${isSelf ? 'justify-end' : 'justify-start'}`}>
        {!isSelf && <img src={avatar} className="w-8 h-8 rounded-full mr-1" />}
        <div
          className={`rounded-2xl px-3 py-2 flex items-center ${isSelf ? 'bg-blue-600' : 'bg-gray-200'
            }`}
        >
          <span className="flex space-x-1">
            <span
              className={`w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s] ${isSelf ? 'bg-white' : 'bg-gray-500'
                }`}
            ></span>
            <span
              className={`w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s] ${isSelf ? 'bg-white' : 'bg-gray-500'
                }`}
            ></span>
            <span
              className={`w-2 h-2 rounded-full animate-bounce ${isSelf ? 'bg-white' : 'bg-gray-500'
                }`}
            ></span>
          </span>
        </div>
        {isSelf && <img src={avatar} className="w-8 h-8 rounded-full ml-2" />}
      </div>
    );
  };
  const handleRecallMessage = (messageId: number, toUser: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'delete_message',
      message_ids: [messageId],
      to: toUser,
    }));
  };
  const sendSearch = (q: string) => {
    const qTrim = q.trim();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (qTrim === '') {
      setSearchResults([]);
      return;
    }
    ws.send(JSON.stringify({ type: 'search_contacts', content: qTrim }));
  };
  const handleSearchChange = (v: string) => {
    setSearchQuery(v);
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      sendSearch(v);
    }, 300);
    if (v.trim() === '') setSearchResults([]);
  };
  const handleSelectUser = (username: string) => {
    setToUser(username);
    setMessages([]);
    setSearchQuery('');
    setSearchResults([]);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'load_history', with: username }));
    }
  };

  function VoiceMessage({ src }: { src: string }) {
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState("0:00");
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = () => {
      if (!audioRef.current) return;
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.currentTime = 0;
        setCurrentTime("0:00");
        audioRef.current.play();
      }
      setPlaying(!playing);
    };

    const formatTime = (time: number) => {
      const mins = Math.floor(time / 60);
      const secs = Math.floor(time % 60).toString().padStart(2, "0");
      return `${mins}:${secs}`;
    };

    return (
      <div className="flex items-center gap-3 bg-gray-100 px-3 py-2 rounded-lg">
        <button
          onClick={togglePlay}
          className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600"
        >
          {playing ? <FiPause /> : <FiPlay />}
        </button>

        {/* waveform giả lập */}
        <div className="flex items-center gap-0.5 flex-1">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-gray-600 rounded"
              style={{
                height: `${Math.random() * 14 + 6}px`,
              }}
            />
          ))}
        </div>

        {/* Chỉ hiển thị thời gian đã phát */}
        <span className="ml-auto text-sm text-gray-600">{currentTime}</span>

        <audio
          ref={audioRef}
          src={src}
          preload="auto"
          onTimeUpdate={(e) => {
            setCurrentTime(formatTime((e.target as HTMLAudioElement).currentTime));
          }}
          onEnded={() => {
            setPlaying(false);
            setCurrentTime("0:00");
          }}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
      </div>
    );
  }


  return (
    <div className="flex h-screen">

      <div
        className="w-1/4 border-r p-4 bg-white overflow-y-auto"
        onScroll={(e) => {
          const target = e.currentTarget;
          if (searchQuery.trim() !== '') return; // không load khi đang search
          if (target.scrollTop + target.clientHeight >= target.scrollHeight - 10) {
            contactsPageRef.current++;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'load_contacts', page: contactsPageRef.current, page_size: 20 }));
            }
          }
        }}
      >
        <div className="mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendSearch(searchQuery); if (e.key === 'Escape') { setSearchQuery(''); setSearchResults([]); } }}
            placeholder="Tìm người (gõ tên rồi Enter hoặc chờ)..."
            className="w-full p-2 border rounded"
          />
        </div>
        {listToShow.map((contact, idx) => (
          <div
            key={contact.username}
            onClick={() => handleSelectUser(contact.username)}
            className={`flex items-center p-2 mb-2 rounded cursor-pointer ${toUser === contact.username ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
          >
            <img src={contact.avatar || DEFAULT_AVATAR} className="w-10 h-10 rounded-full mr-3" />
            <span>{contact.username}</span>
          </div>
        ))}
      </div>


      <div className="flex-1 flex flex-col bg-gray-50 p-4">
        <h2 className="text-lg font-semibold mb-2">{toUser ? `Đang chat với ${toUser}` : 'Chọn người để bắt đầu'}</h2>



        <div className="flex-1 overflow-y-auto bg-white border rounded p-4 shadow-inner mb-4">
          {messages.map((m) => {
            const isSelf = m.from === currentUser;
            const avatar = contacts.find((c) => c.username === m.from)?.avatar || DEFAULT_AVATAR;
            return (

              <div
                key={m.tempId ? `temp-${m.tempId}` : `id-${m.id}`}
                className={`flex items-end mb-3 ${isSelf ? 'justify-end' : 'justify-start'}`}
              >
                {!isSelf && (
                  <img src={avatar} className="w-8 h-8 rounded-full mr-1" />
                )}
                {isSelf && m.type !== 'deleted' && (
                  <Menu as="div" className="relative ml-1">
                    <Menu.Button className="p-1 rounded-full hover:bg-gray-200">
                      <FiMoreVertical />
                    </Menu.Button>
                    <Menu.Items className="absolute right-0 mt-2 w-40 origin-top-right bg-white border border-gray-200 rounded-md shadow-lg z-50">
                      <div className="p-1">
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={() => handleRecallMessage(Number(m.id), m.to)}
                              className={`${active ? 'bg-red-500 text-white' : 'text-red-600'} group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                            >
                              Thu hồi tin nhắn
                            </button>
                          )}
                        </Menu.Item>
                      </div>
                    </Menu.Items>
                  </Menu>
                )}
                <div className="relative flex items-center">
                  {/* Nội dung tin nhắn */}
                  {m.type === 'image' ? (
                    <img src={`${API_BASE}${m.content}`} className="max-w-xs rounded" />
                  ) : m.type === 'video' ? (
                    <video controls className="max-w-xs rounded">
                      <source src={`${API_BASE}${m.content}`} type="video/mp4" />
                    </video>
                  ) : (m.type === 'voice' || m.type === 'audio') ? (
                    <VoiceMessage src={`${API_BASE}${m.content}`} />
                  ) : m.type === 'file' ? (
                    <div className="flex flex-col max-w-xs p-3 rounded-lg border bg-white shadow-sm">
                      {m.content.toLowerCase().endsWith('.pdf') ? (
                        <iframe
                          src={`${API_BASE}${m.content}`}
                          className="w-full h-64 border rounded"
                          title="Xem PDF"
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 text-3xl">
                            {getFileIcon(m.content)}
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-medium text-sm text-gray-800 truncate">
                              {getFileName(m.content)}
                            </span>
                            <a
                              href={`${API_BASE}${m.content}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 text-xl hover:text-blue-800 mt-1"
                              title="Tải xuống"
                            >
                              <FiDownload />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : m.type === 'deleted' ? (
                    <div
                      className={`max-w-xs p-2 text-sm border rounded-md italic text-gray-400`}
                    >
                      Tin nhắn đã bị thu hồi
                    </div>
                  ) : (
                    <div
                      className={`max-w-xs p-2 text-sm border rounded-md ${isSelf ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'
                        }`}
                    >
                      {m.content}
                    </div>
                  )}


                </div>


                {isSelf && (
                  <img src={avatar} className="w-8 h-8 rounded-full ml-2" />
                )}
              </div>
            );
          })}

          {typingUser === toUser && (
            <TypingIndicator
              avatar={
                contacts.find((c) => c.username === typingUser)?.avatar ||
                DEFAULT_AVATAR
              }
              isSelf={false}
            />
          )}

          <div ref={messageEndRef} />
        </div>



        <div className="flex items-center gap-3">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);

              // Gửi typing nếu đủ điều kiện
              const now = Date.now();
              if (
                ws &&
                ws.readyState === WebSocket.OPEN &&
                toUser &&
                now - lastTypingSentRef.current > 2000
              ) {
                ws.send(JSON.stringify({ type: 'typing', with: toUser }));
                lastTypingSentRef.current = now;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="flex-1 p-2 border rounded resize-none focus:outline-none"
            placeholder="Nhập tin nhắn..."
          />


          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white border hover:bg-blue-100">
                <FiImage className="text-blue-600 w-5 h-5" />
              </div>
              <input type="file" accept="image/*,video/*" onChange={handleMixedUpload} className="hidden" />
            </label>

            <label className="cursor-pointer">
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white border hover:bg-green-100">📎</div>
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={handleMixedUpload} className="hidden" />
            </label>
          </div>

          <button
            onClick={handleAudioRecord}
            title={recording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
            className={`px-3 py-2 rounded-full border shadow transition-all duration-200 ${recording ? 'bg-red-600 text-white' : 'bg-white hover:bg-gray-100'}`}
          >
            {recording ? '⏹' : '🎙'}
          </button>

          <button onClick={sendMessage} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-1">
            <FiSend /> Gửi
          </button>
        </div>
      </div>
    </div>
  );
}
