
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    User as FirebaseUser,
    updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, LoginRecord } from '../types';

export class RegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistrationError';
  }
}

// Map Firebase User to App User
const mapUser = (fbUser: FirebaseUser, additionalData?: any): User => ({
    uid: fbUser.uid,
    email: fbUser.email || '',
    username: additionalData?.username || fbUser.displayName || 'User',
    isDeveloper: additionalData?.isDeveloper || false,
    registrationDate: fbUser.metadata.creationTime,
    loginHistory: additionalData?.loginHistory || []
});

export const authService = {
    login: async (email: string, password: string): Promise<User> => {
        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
            
            // Track Login
            await updateDoc(doc(db, 'users', cred.user.uid), {
                loginHistory: arrayUnion({
                    loginTime: new Date().toISOString(),
                    logoutTime: null
                } as LoginRecord)
            });

            return mapUser(cred.user, userDoc.data());
        } catch (error: any) {
            console.error("Login Error:", error);
            throw new Error(error.code === 'auth/invalid-credential' ? 'بيانات الدخول غير صحيحة' : 'حدث خطأ في تسجيل الدخول');
        }
    },

    register: async (username: string, email: string, password: string, confirmPassword: string): Promise<User> => {
        if (!username.trim() || !email.trim() || !password || !confirmPassword) {
            throw new RegistrationError('جميع الحقول مطلوبة.');
        }
        if (password !== confirmPassword) {
             throw new RegistrationError('كلمتا المرور غير متطابقتين.');
        }
        if (password.length < 6) { 
            throw new RegistrationError('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.');
        }

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(cred.user, { displayName: username });
            
            const newUser = {
                username,
                email,
                isDeveloper: false,
                registrationDate: new Date().toISOString(),
                loginHistory: []
            };
            
            await setDoc(doc(db, 'users', cred.user.uid), newUser);
            return mapUser(cred.user, newUser);
        } catch (error: any) {
            console.error("Registration Error:", error);
            if (error.code === 'auth/email-already-in-use') {
                throw new RegistrationError('البريد الإلكتروني مسجل بالفعل.');
            }
            throw new RegistrationError('حدث خطأ أثناء إنشاء الحساب.');
        }
    },
    
    logout: async () => {
        await signOut(auth);
    },

    onAuthStateChanged: (callback: (user: User | null) => void) => {
        return onAuthStateChanged(auth, async (fbUser) => {
            if (fbUser) {
                 try {
                     const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
                     if (userDoc.exists()) {
                         callback(mapUser(fbUser, userDoc.data()));
                     } else {
                         // Fallback if user doc missing
                         callback(mapUser(fbUser, { username: fbUser.displayName }));
                     }
                 } catch (e) {
                     console.error("Error fetching user data", e);
                     callback(null);
                 }
            } else {
                callback(null);
            }
        });
    },
    
    // Fetch users from Firestore for Admin View
    getAllUsers: async (): Promise<{ key: string, user: User }[]> => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            return querySnapshot.docs.map(docSnap => ({
                key: docSnap.id,
                user: { uid: docSnap.id, ...docSnap.data() } as User
            }));
        } catch (e) {
            console.error("Error getting users", e);
            return [];
        }
    },

    // Delete user profile from Firestore
    deleteUser: async (userKey: string) => {
        try {
            await deleteDoc(doc(db, 'users', userKey));
        } catch(e) { 
            console.error("Error deleting user profile:", e); 
        }
    },
};
