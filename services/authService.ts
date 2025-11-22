
import { User, LoginRecord } from '../types';

// Custom error for registration-specific issues
export class RegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistrationError';
  }
}

const USERS_KEY = 'qudratUsers';
const CURRENT_USER_KEY = 'currentUser';

// Users are now stored with a composite key "email|username"
const _getUsers = (): { [compositeKey: string]: User } => {
    try {
        const users = localStorage.getItem(USERS_KEY);
        return users ? JSON.parse(users) : {};
    } catch (e) {
        return {};
    }
};

const saveUsers = (users: { [compositeKey: string]: User }) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
};


export const authService = {
    login: (identifier: string, password: string): User | null => {
        // Handle developer login
        if (identifier.trim() === '' && password === '...') {
            const users = _getUsers();
            const devUser = Object.values(users).find(u => u.isDeveloper);
            if (devUser) return devUser; // Login successful
        }
        
        const users = _getUsers();
        const allUsers = Object.values(users);
        
        const candidateUsers = allUsers.filter(
            u => !u.isDeveloper && (u.email === identifier || u.username === identifier)
        );

        const user = candidateUsers.find(u => u.password === password);

        return user || null;
    },

    loginAsDev: (): User => {
        const users = _getUsers();
        let devUser = Object.values(users).find(u => u.isDeveloper);
        
        if (!devUser) {
             devUser = {
                email: 'dev@local.host',
                username: 'مطور',
                password: '...',
                isDeveloper: true,
                registrationDate: new Date().toISOString(),
                loginHistory: []
             };
             const compositeKey = `${devUser.email}|${devUser.username}`;
             users[compositeKey] = devUser;
             saveUsers(users);
        }
        return devUser;
    },

    register: (username: string, email: string, password: string, confirmPassword: string) => {
        const users = _getUsers();
        const allUsers = Object.values(users);

        // Developer Registration
        if (username.trim() === '' && email.trim() !== '' && password === '...' && confirmPassword === '....') {
            const devEmailInUse = allUsers.some(u => u.email === email && u.isDeveloper);
            if(devEmailInUse) {
                throw new RegistrationError('حساب مطور بهذا البريد الإلكتروني موجود بالفعل.');
            }
            const newDevUser: User = { 
                email, 
                username: 'مطور', // Developer username
                password: '...', // Store the login password
                isDeveloper: true,
                registrationDate: new Date().toISOString(),
                loginHistory: []
            };
            const compositeKey = `${email}|${newDevUser.username}`; // Use a unique username
            users[compositeKey] = newDevUser;
            saveUsers(users);
            return;
        }

        // Regular User Registration
        if (!username.trim() || !email.trim() || !password || !confirmPassword) {
            throw new RegistrationError('جميع الحقول مطلوبة.');
        }
        if (password !== confirmPassword) {
             throw new RegistrationError('كلمتا المرور غير متطابقتين.');
        }
        if (password.length < 3) { // Simplified for testing
            throw new RegistrationError('يجب أن تتكون كلمة المرور من 3 أحرف على الأقل.');
        }
        if (email === 'guest@local.session' || email === 'temp-dev@local.session') {
            throw new RegistrationError('هذا البريد الإلكتروني محجوز.');
        }

        const emailInUse = allUsers.some(u => u.email === email && !u.isDeveloper);
        if (emailInUse) {
            throw new RegistrationError('هذا البريد الإلكتروني مسجل بالفعل لمستخدم آخر.');
        }

        const usernameInUse = allUsers.some(u => u.username === username && !u.isDeveloper);
        if (usernameInUse) {
            throw new RegistrationError('اسم المستخدم هذا مستخدم بالفعل.');
        }
        
        const newUser: User = { 
            email, 
            username, 
            password,
            isDeveloper: false,
            registrationDate: new Date().toISOString(),
            loginHistory: []
        };
        const compositeKey = `${email}|${username}`;
        users[compositeKey] = newUser;
        saveUsers(users);
    },
    
    trackLogin: (userKey: string) => {
        const users = _getUsers();
        if (users[userKey]) {
            if (!users[userKey].loginHistory) {
                users[userKey].loginHistory = [];
            }
            const newRecord: LoginRecord = {
                loginTime: new Date().toISOString(),
                logoutTime: null,
            };
            users[userKey].loginHistory!.push(newRecord);
            saveUsers(users);
        }
    },

    trackLogout: (userKey: string) => {
        const users = _getUsers();
        if (users[userKey] && users[userKey].loginHistory) {
            const history = users[userKey].loginHistory!;
            const lastActiveSession = history.slice().reverse().find(session => session.logoutTime === null);
            if (lastActiveSession) {
                lastActiveSession.logoutTime = new Date().toISOString();
                saveUsers(users);
            }
        }
    },

    logout: () => {
        localStorage.removeItem(CURRENT_USER_KEY);
    },

    getCurrentUser: (): string | null => {
        return localStorage.getItem(CURRENT_USER_KEY);
    },

    setCurrentUser: (compositeKey: string) => {
        localStorage.setItem(CURRENT_USER_KEY, compositeKey);
    },

    getUser: (compositeKey: string): User | null => {
        if (!compositeKey) return null;
        if (compositeKey.startsWith('guest|')) {
            return {
                email: 'guest@local.session',
                username: 'زائر',
                password: '',
                isDeveloper: false,
            };
        }
        const users = _getUsers();
        return users[compositeKey] || null;
    },
    
    getAllUsers: (): { key: string, user: User }[] => {
        const users = _getUsers();
        return Object.entries(users).map(([key, user]) => ({ key, user }));
    },

    isDevUser: (compositeKey: string | null): boolean => {
        if (!compositeKey) return false;
        const user = authService.getUser(compositeKey);
        return !!user?.isDeveloper;
    },

    deleteUser: (userKey: string) => {
        const users = _getUsers();
        if (users[userKey]) {
            delete users[userKey];
            saveUsers(users);
        }
    },
};
