'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiBase } from '@/app/config';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

type UserPreview = {
    username: string;
    avatar: string;
    lastLogin: string;
};

export default function LoginPage() {
    const router = useRouter();
    const [apiBase, setApiBase] = useState('http://localhost:8080');
    useEffect(() => {
        getApiBase().then(setApiBase);
    }, []);
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [recentUsers, setRecentUsers] = useState<UserPreview[]>([]);

    useEffect(() => {
        const raw = localStorage.getItem('recent_users');
        if (raw) {
            const parsed = JSON.parse(raw) as UserPreview[];
            const sorted = parsed.sort(
                (a, b) => new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()
            );
            setRecentUsers(sorted);
        }
    }, []);

    const saveUserToRecent = (username: string, avatarUrl?: string) => {
        const raw = localStorage.getItem('recent_users');
        let list: UserPreview[] = raw ? JSON.parse(raw) : [];

        list = list.filter((u) => u.username !== username);

        const avatar =
            avatarUrl && avatarUrl.startsWith('/static/')
                ? `${apiBase}${avatarUrl}`
                : avatarUrl || DEFAULT_AVATAR;

        list.unshift({
            username,
            avatar,
            lastLogin: new Date().toISOString(),
        });

        const sliced = list.slice(0, 6);
        localStorage.setItem('recent_users', JSON.stringify(sliced));
        setRecentUsers(sliced);
    };

    const removeUser = (username: string) => {
        const updated = recentUsers.filter((u) => u.username !== username);
        setRecentUsers(updated);
        localStorage.setItem('recent_users', JSON.stringify(updated));
    };

    const handleLogin = async () => {
        try {
            const res = await fetch(`${apiBase}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, password }),
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', login);
                localStorage.setItem('userID', data.user_id);
                localStorage.setItem(
                    "avatar",
                    data.avatar_url && data.avatar_url.startsWith("/static/")
                        ? `${apiBase}${data.avatar_url}`
                        : data.avatar_url || DEFAULT_AVATAR
                );
                if (!data.avatar_url || !data.avatar_url.startsWith('/static/')) {
                    router.push('/set_avatar');
                    return;
                }
                saveUserToRecent(login, data.avatar_url);
                setTimeout(() => {
                    router.push("/");
                }, 1000);
            } else {
                alert(data.error || 'Đăng nhập thất bại');
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi kết nối server');
        }
    };

    const handleRegister = async () => {
        try {
            const res = await fetch(`${apiBase}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: login, password, email }),
            });

            const data = await res.json();
            if (res.ok) {
                alert('Đăng ký thành công! Hãy đăng nhập.');
                setMode('login');
            } else {
                alert(data.error || 'Đăng ký thất bại');
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi kết nối server');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
            <div className="flex w-full max-w-6xl gap-12">
                {/* Gần đây */}
                <div className="flex-1 bg-white rounded-lg p-8 shadow-md flex flex-col justify-center min-h-[360px]">
                    <h1 className="text-2xl font-semibold mb-6">Đăng nhập gần đây</h1>
                    <p className="text-gray-600 mb-4">Nhấp vào ảnh của bạn hoặc thêm tài khoản.</p>
                    <div className="grid grid-cols-3 gap-1 relative">
                        {recentUsers.map((user) => (
                            <div
                                key={user.username}
                                className="w-32 h-40 bg-white rounded-lg shadow flex flex-col items-center justify-center cursor-pointer hover:shadow-lg transition-all duration-200 relative"
                                onClick={() => {
                                    setLogin(user.username);
                                    setMode('login');
                                }}
                            >
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeUser(user.username);
                                    }}
                                    className="absolute top-1 right-1 text-sm text-gray-500 hover:text-red-500"
                                >
                                    ×
                                </div>
                                <img
                                    src={user.avatar || DEFAULT_AVATAR}
                                    className="w-16 h-16 mx-auto rounded-full mb-2"
                                />
                                <div>{user.username}</div>
                            </div>
                        ))}

                        {/* Thêm tài khoản */}
                        <div
                            className="w-32 h-40 bg-white rounded-lg shadow flex flex-col items-center justify-center cursor-pointer hover:shadow-lg transition-all duration-200"
                            onClick={() => setMode('register')}
                        >
                            <div className="text-3xl text-blue-600 font-bold">+</div>
                            <div className="text-sm text-blue-600 mt-1">Thêm tài khoản</div>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <div className="w-[400px] bg-white rounded-lg shadow-md p-6">
                    {mode === 'login' ? (
                        <>
                            <input
                                type="text"
                                placeholder="Tên đăng nhập"
                                value={login}
                                onChange={(e) => setLogin(e.target.value)}
                                className="w-full border rounded p-3 mb-3"
                            />
                            <input
                                type="password"
                                placeholder="Mật khẩu"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border rounded p-3 mb-3"
                            />
                            <button
                                onClick={handleLogin}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded font-semibold mb-3"
                            >
                                Đăng nhập
                            </button>
                            <div className="text-center text-sm text-blue-600 cursor-pointer hover:underline mb-4">
                                Quên mật khẩu?
                            </div>
                            <hr className="my-4" />
                            <button
                                onClick={() => setMode('register')}
                                className="w-full bg-green-600 hover:bg-green-700 text-white p-3 rounded font-semibold"
                            >
                                Tạo tài khoản mới
                            </button>
                        </>
                    ) : (
                        <>
                            <input
                                type="text"
                                placeholder="Tên đăng nhập"
                                value={login}
                                onChange={(e) => setLogin(e.target.value)}
                                className="w-full border rounded p-3 mb-3"
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full border rounded p-3 mb-3"
                            />
                            <input
                                type="password"
                                placeholder="Mật khẩu"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border rounded p-3 mb-3"
                            />
                            <button
                                onClick={handleRegister}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded font-semibold mb-4"
                            >
                                Đăng ký
                            </button>
                            <div className="text-center text-sm text-blue-600 cursor-pointer hover:underline">
                                Đã có tài khoản?{' '}
                                <span onClick={() => setMode('login')}>Đăng nhập</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}