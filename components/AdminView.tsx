
import React, { useState, useMemo, useEffect } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';
import { ArrowRightIcon, TrashIcon, EyeIcon, UserIcon, MailIcon, KeyIcon } from './Icons';

interface AdminViewProps {
    onBack: () => void;
    onPreviewUser: (userKey: string) => void;
    onDeleteUser: (userKey: string) => Promise<void>;
}

export const AdminView: React.FC<AdminViewProps> = ({ onBack, onPreviewUser, onDeleteUser }) => {
    const [users, setUsers] = useState<{ key: string, user: User }[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<{key: string, user: User} | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        authService.getAllUsers().then(setUsers);
    }, []);

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users.filter(u => !u.user.isDeveloper);
        return users.filter(u => 
            !u.user.isDeveloper && (
                u.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.user.email.toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [users, searchTerm]);

    const handleDelete = async (userKey: string) => {
        setIsDeleting(true);
        try {
            await onDeleteUser(userKey);
            // Refresh list
            const updatedUsers = await authService.getAllUsers();
            setUsers(updatedUsers);
            setShowDeleteConfirm(null);
        } catch (e) {
            console.error("Delete failed", e);
            alert("حدث خطأ أثناء الحذف");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="bg-bg min-h-screen">
             <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b border-border">
                <div className="container mx-auto flex items-center">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-700 transition-colors">
                        <ArrowRightIcon className="w-6 h-6 text-text-muted"/>
                    </button>
                    <h1 className="text-xl md:text-2xl font-bold text-text mx-auto">إدارة المستخدمين</h1>
                </div>
            </header>
            <main className="container mx-auto p-4">
                <div className="mb-6">
                    <input
                        type="text"
                        placeholder="ابحث عن مستخدم بالاسم أو البريد الإلكتروني..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-3 border rounded-md bg-zinc-700 text-slate-200 focus:ring-1 focus:border-primary focus-ring border-border"
                    />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredUsers.map(({ key, user }) => (
                         <div key={key} className="bg-surface rounded-lg border border-border p-4 flex flex-col justify-between">
                            <div className="space-y-3 mb-4">
                                <div className="flex items-center gap-3">
                                    <UserIcon className="w-5 h-5 text-primary" />
                                    <div>
                                        <p className="text-xs text-text-muted">اسم المستخدم</p>
                                        <p className="font-bold">{user.username}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <MailIcon className="w-5 h-5 text-primary" />
                                    <div>
                                        <p className="text-xs text-text-muted">البريد الإلكتروني</p>
                                        <p>{user.email}</p>
                                    </div>
                                </div>
                                 <div className="flex items-center gap-3">
                                    <KeyIcon className="w-5 h-5 text-primary" />
                                    <div>
                                        <p className="text-xs text-text-muted">كلمة المرور</p>
                                        <p className="font-mono">{user.password}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="border-t border-border pt-3">
                               <p className="text-xs text-text-muted mb-2">تاريخ التسجيل: {user.registrationDate ? new Date(user.registrationDate).toLocaleString('ar-SA') : 'N/A'}</p>
                               <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => onPreviewUser(key)} className="flex-grow flex items-center justify-center gap-2 p-2 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors" title="معاينة الحساب">
                                        <EyeIcon className="w-5 h-5"/>
                                        <span>معاينة</span>
                                    </button>
                                    <button onClick={() => setShowDeleteConfirm({key, user})} className="p-2 bg-red-900/40 text-red-400 rounded-md hover:bg-red-900/70 transition-colors" title="حذف الحساب">
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                               </div>
                            </div>
                        </div>
                    ))}
                </div>

                 {filteredUsers.length === 0 && (
                    <p className="text-center text-text-muted mt-8">لم يتم العثور على مستخدمين.</p>
                 )}
            </main>
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-surface rounded-lg p-8 m-4 max-w-sm w-full text-center shadow-2xl border border-border">
                        <h2 className="text-xl font-bold mb-4">تأكيد الحذف</h2>
                        <p className="text-text-muted mb-6">
                            هل أنت متأكد أنك تريد حذف حساب المستخدم <span className="font-bold text-text">{showDeleteConfirm.user.username}</span>؟ لا يمكن التراجع عن هذا الإجراء.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setShowDeleteConfirm(null)} className="px-6 py-2 bg-zinc-600 text-slate-200 rounded-md hover:bg-zinc-500 transition-colors font-semibold">إلغاء</button>
                            <button onClick={() => handleDelete(showDeleteConfirm.key)} disabled={isDeleting} className="px-6 py-2 text-white rounded-md bg-red-600 hover:bg-red-700 transition-colors font-semibold disabled:opacity-50">
                                {isDeleting ? 'جارٍ الحذف...' : 'حذف'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
