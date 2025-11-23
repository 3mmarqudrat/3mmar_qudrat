
import React from 'react';
import { TestAttempt, User } from '../types';
import { ArrowRightIcon, CheckCircleIcon, ClockIcon, FileTextIcon, UserIcon, LogOutIcon, XCircleIcon, ZoomInIcon } from './Icons';

const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const UserMenu: React.FC<{ user: User; onLogout: () => void; }> = ({ user, onLogout }) => (
    <div className="flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-text-muted" />
            <span className="font-bold text-text">{user.username}</span>
        </div>
        <button onClick={onLogout} className="p-2 rounded-full hover:bg-red-900/50 transition-colors" aria-label="تسجيل الخروج">
            <LogOutIcon className="w-5 h-5 text-red-500"/>
        </button>
    </div>
);


export const SummaryView: React.FC<{ attempt: TestAttempt, onBack: () => void, onReview: (attempt: TestAttempt) => void, user: User, onLogout: () => void }> = ({ attempt, onBack, onReview, user, onLogout }) => {
    const { score, totalQuestions, durationSeconds, date, testName } = attempt;
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    
    const answeredCount = attempt.answers.length;
    const correctCount = score;
    const incorrectCount = answeredCount - correctCount;
    const unansweredCount = totalQuestions - answeredCount;

    return (
        <div className="bg-bg min-h-screen">
            <header className="bg-surface/80 backdrop-blur-lg p-4 sticky top-0 z-20 border-b" style={{borderColor: 'var(--color-border)'}}>
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex-1"></div>
                    <h1 className="flex-1 text-xl md:text-2xl font-bold text-text text-center truncate">نتيجة الاختبار</h1>
                    <div className="flex-1 flex justify-end">
                        <UserMenu user={user} onLogout={onLogout} />
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 md:p-8 flex items-center justify-center">
                <div className="bg-surface p-8 rounded-xl max-w-2xl w-full border border-border shadow-2xl shadow-primary/10">
                    <div className="text-center mb-6">
                        <h2 className="text-3xl font-bold mb-2">{testName}</h2>
                        <p className="text-text-muted">{new Date(date).toLocaleString('ar-SA', { dateStyle: 'long', timeStyle: 'short' })}</p>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center justify-around gap-8 my-8">
                        <div className="text-center">
                            <p className="text-6xl font-bold text-primary">{percentage}%</p>
                            <p className="text-text-muted mt-1">الدرجة</p>
                        </div>
                        <div className="w-px bg-border h-24 hidden md:block"></div>
                        <div className="text-center">
                             <p className="text-6xl font-bold">{score}<span className="text-3xl text-text-muted">/{totalQuestions}</span></p>
                             <p className="text-text-muted mt-1">الأسئلة الصحيحة</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8 text-center">
                        <div className="bg-zinc-900/50 p-4 rounded-lg">
                            <CheckCircleIcon className="w-8 h-8 mx-auto text-green-400 mb-2"/>
                            <p className="font-bold text-2xl">{correctCount}</p>
                            <p className="text-sm text-text-muted">صحيحة</p>
                        </div>
                         <div className="bg-zinc-900/50 p-4 rounded-lg">
                            <XCircleIcon className="w-8 h-8 mx-auto text-red-400 mb-2"/>
                            <p className="font-bold text-2xl">{incorrectCount}</p>
                            <p className="text-sm text-text-muted">خاطئة</p>
                        </div>
                         <div className="bg-zinc-900/50 p-4 rounded-lg">
                            <FileTextIcon className="w-8 h-8 mx-auto text-yellow-400 mb-2"/>
                            <p className="font-bold text-2xl">{unansweredCount}</p>
                            <p className="text-sm text-text-muted">متروكة</p>
                        </div>
                         <div className="bg-zinc-900/50 p-4 rounded-lg">
                            <ClockIcon className="w-8 h-8 mx-auto text-sky-400 mb-2"/>
                            <p className="font-bold text-2xl">{formatTime(durationSeconds)}</p>
                            <p className="text-sm text-text-muted">الوقت</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 mt-10">
                         <button 
                            onClick={() => onReview(attempt)} 
                            className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-1 hover:brightness-110"
                         >
                            <FileTextIcon className="w-5 h-5"/>
                            مراجعة الإجابات
                        </button>
                        <button 
                            onClick={onBack} 
                            className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-red-600 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-red-500/30 transform hover:-translate-y-1 hover:brightness-110"
                        >
                             <LogOutIcon className="w-5 h-5"/>
                             المغادرة
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};
