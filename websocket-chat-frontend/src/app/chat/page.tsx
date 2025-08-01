'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FiImage, FiSend, FiDownload } from 'react-icons/fi';

type Message = {
    id: string;
    from: string;
    to: string;
    content: string;
    type: string;
};

type Contact = {
    username: string;
    avatar?: string;
};

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const API_BASE = 'http://192.168.1.3:8080';

export default function ChatPage() {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [token, setToken] = useState('');
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [toUser, setToUser] = useState('');
    const [input, setInput] = useState('');
    const [recording, setRecording] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const messageEndRef = useRef<HTMLDivElement>(null);

    const currentUser = login;

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!token) return;

        const socket = new WebSocket(`${API_BASE.replace(/^http/, 'ws')}/ws?token=${token}`);
        setWs(socket);

        socket.onopen = () => {
            socket.send(JSON.stringify({ type: 'load_contacts' }));
        };

        socket.onmessage = (e) => {
            const msg = JSON.parse(e.data);

            if (['text', 'image', 'video', 'voice', 'file'].includes(msg.type)) {
                const messageWithId = { ...msg, id: msg.id || uuidv4() };
                setMessages((prev) => [...prev, messageWithId]);
            }

            if (msg.type === 'contacts') {
                const normalized = msg.contacts.map((c: any) => ({
                    username: c.Username,
                    avatar: DEFAULT_AVATAR,
                }));
                setContacts(normalized);
            }

            if (msg.type === 'history') {
                const history = msg.messages.map((m: any) => ({
                    ...m,
                    id: m.id || uuidv4(),
                }));
                setMessages(history);
            }
        };

        socket.onclose = () => {
            setWs(null);
        };

        return () => socket.close();
    }, [token]);

    useEffect(() => {
        if (ws && toUser) {
            ws.send(JSON.stringify({ type: 'load_history', with: toUser }));
        }
    }, [toUser, ws]);

    const handleLogin = async () => {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password }),
        });
        const data = await res.json();
        if (res.ok) setToken(data.token);
        else alert(data.error || 'Đăng nhập thất bại');
    };

    const handleRegister = async () => {
        const res = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: login, password, email }),
        });
        const data = await res.json();
        if (res.ok) {
            alert('Đăng ký thành công. Hãy đăng nhập!');
            setMode('login');
        } else alert(data.error || 'Đăng ký thất bại');
    };

    const sendMessage = () => {
        if (!ws || !toUser || input.trim() === '') return;
        const message: Message = {
            id: uuidv4(),
            type: 'text',
            from: currentUser,
            to: toUser,
            content: input.trim(),
        };
        ws.send(JSON.stringify(message));
        setMessages((prev) => [...prev, message]);
        setInput('');
    };

    const uploadFile = async (file: File, type: 'image' | 'video' | 'file') => {
        const formData = new FormData();
        formData.append(type, file); // ví dụ: file

        const res = await fetch(`${API_BASE}/upload/${type}`, {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();
        if (res.ok && data.url) {
            const message: Message = {
                id: uuidv4(),
                type,
                from: currentUser,
                to: toUser,
                content: data.url,
            };
            ws?.send(JSON.stringify(message));
            setMessages((prev) => [...prev, message]);
        } else {
            alert(`Tải ${type} thất bại!`);
        }
    };


    const handleMixedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !ws || !toUser) return;

        if (file.type.startsWith('image/')) uploadFile(file, 'image');
        else if (file.type.startsWith('video/')) uploadFile(file, 'video');
        else if (
            file.type === 'application/pdf' ||
            file.type === 'application/msword' ||
            file.type.includes('officedocument') // includes docx, xlsx, pptx
        ) {
            uploadFile(file, 'file'); // 👈 thêm loại mới: file
        } else {
            alert('Loại file không được hỗ trợ!');
        }
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
                    formData.append('audio', file); // ✅ đúng key backend

                    const res = await fetch(`${API_BASE}/upload/audio`, {
                        method: 'POST',
                        body: formData,
                    });

                    const data = await res.json();
                    if (res.ok && data.url) {
                        const message: Message = {
                            id: uuidv4(),
                            type: 'voice',
                            from: currentUser,
                            to: toUser,
                            content: data.url,
                        };
                        ws?.send(JSON.stringify(message));
                        setMessages((prev) => [...prev, message]);
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

    if (!token) {
        return (
            <div className="max-w-md mx-auto p-6">
                <h2 className="text-xl font-bold mb-4">{mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</h2>
                <input className="border w-full p-2 mb-2 rounded" placeholder="Tên đăng nhập" value={login} onChange={(e) => setLogin(e.target.value)} />
                {mode === 'register' && <input className="border w-full p-2 mb-2 rounded" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />}
                <input className="border w-full p-2 mb-4 rounded" type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button onClick={mode === 'login' ? handleLogin : handleRegister} className="bg-blue-600 text-white w-full p-2 rounded mb-2">
                    {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
                </button>
                <p className="text-sm text-center">
                    {mode === 'login' ? (
                        <>Chưa có tài khoản? <span className="text-blue-600 cursor-pointer" onClick={() => setMode('register')}>Đăng ký</span></>
                    ) : (
                        <>Đã có tài khoản? <span className="text-blue-600 cursor-pointer" onClick={() => setMode('login')}>Đăng nhập</span></>
                    )}
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-screen">
            <div className="w-1/4 border-r p-4 bg-white overflow-y-auto">
                <h3 className="font-bold text-lg mb-4">Danh sách bạn bè</h3>
                {contacts.map((contact) => (
                    <div
                        key={contact.username}
                        onClick={() => setToUser(contact.username)}
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
                            <div key={m.id} className={`flex items-end mb-3 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                                {!isSelf && <img src={avatar} className="w-8 h-8 rounded-full mr-1" />}

                                {

                                    m.type === 'image' ? (
                                        <img src={`${API_BASE}${m.content}`} className="max-w-xs rounded" />
                                    ) : m.type === 'video' ? (
                                        <video controls className="max-w-xs rounded">
                                            <source src={`${API_BASE}${m.content}`} type="video/mp4" />
                                        </video>
                                    ) : m.type === 'voice' ? (
                                        <audio controls className="w-full max-w-xs">
                                            <source src={`${API_BASE}${m.content}`} type="audio/webm" />
                                        </audio>
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
                                    )
                                        :
                                        (
                                            <div className={`max-w-xs p-2 text-sm border rounded-md ${isSelf ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}>
                                                {m.content}
                                            </div>
                                        )
                                }

                                {isSelf && <img src={avatar} className="w-8 h-8 rounded-full ml-2" />}

                            </div>

                        );
                    })}
                    <div ref={messageEndRef} />
                </div>

                <div className="flex items-center gap-3">
                    <textarea
                        rows={2}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        className="flex-1 p-2 border rounded resize-none focus:outline-none"
                        placeholder="Nhập tin nhắn..."
                    />

                    <div className="flex items-center gap-2">
                        {/* Nút ảnh/video */}
                        <label className="cursor-pointer">
                            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white border hover:bg-blue-100">
                                <FiImage className="text-blue-600 w-5 h-5" />
                            </div>
                            <input type="file" accept="image/*,video/*" onChange={handleMixedUpload} className="hidden" />
                        </label>

                        {/* Nút file (pdf, doc...) */}
                        <label className="cursor-pointer">
                            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white border hover:bg-green-100">
                                📎
                            </div>
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