'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

type UserPreview = {
    username: string;
    avatar: string;
    lastLogin: string;
};

const API_BASE = 'http://localhost:8080';

export default function SetAvatarPage() {
    const router = useRouter();
    const username = localStorage.getItem('username') || 'User';

    const [avatar, setAvatar] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAvatar(e.target.files[0]);
            setPreview(URL.createObjectURL(e.target.files[0]));
        }
    };

    const handleUpload = async () => {
        if (!avatar) {
            alert('Vui lòng chọn ảnh hoặc bỏ qua để tạo avatar mặc định.');
            return;
        }
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('avatar', avatar);

            const res = await fetch(`${API_BASE}/api/avatar`, {
                method: 'POST',
                body: formData,
                headers: {
                    Authorization: 'Bearer ' + localStorage.getItem('token'),
                },
            });

            const data = await res.json();
            if (res.ok) {
                updateRecentUser(data.avatar_url);
                router.push('/');
            } else {
                alert(data.error || 'Upload thất bại');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = () => {
        const bgColor = `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
        const initial = username[0].toUpperCase();
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '64px sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, canvas.width / 2, canvas.height / 2);
        const dataUrl = canvas.toDataURL();

        updateRecentUser(dataUrl);
        setTimeout(() => {
            router.push("/");
        }, 1000);
    };

    const updateRecentUser = (avatarUrl: string) => {
        const raw = localStorage.getItem('recent_users');
        let list: UserPreview[] = raw ? JSON.parse(raw) : [];
        list = list.filter((u) => u.username !== username);
        list.unshift({ username, avatar: avatarUrl, lastLogin: new Date().toISOString() });
        localStorage.setItem('recent_users', JSON.stringify(list.slice(0, 6)));
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-sm space-y-4 text-center">
                <h1 className="text-xl font-bold">Cập nhật Avatar</h1>

                <input type="file" accept="image/*" onChange={handleFileChange} className="mx-auto" />
                {preview && (
                    <img
                        src={preview}
                        alt="Preview"
                        className="mt-2 w-24 h-24 object-cover rounded-full mx-auto"
                    />
                )}

                <button
                    onClick={handleUpload}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 mt-2"
                >
                    {loading ? 'Đang upload...' : 'Xác nhận'}
                </button>

                <button
                    onClick={handleSkip}
                    disabled={loading}
                    className="w-full bg-gray-400 text-white p-2 rounded-lg hover:bg-gray-500 mt-2"
                >
                    Bỏ qua
                </button>
            </div>
        </div>
    );
}
