import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDe3DfNqilhQ-CIoRpgFjpfbOOLZqt1Zdw",
    authDomain: "pusdastra-disdikbud-2026.firebaseapp.com",
    projectId: "pusdastra-disdikbud-2026",
    storageBucket: "pusdastra-disdikbud-2026.firebasestorage.app",
    messagingSenderId: "1091672034526",
    appId: "1:1091672034526:web:3a7611170049172d9b464f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Session Key for Browser (keeps user logged in locally)
const SESSION_KEY = 'PUSDASTRA_SESSION';

// --- AUTHENTICATION (Firestore Based) ---
export const Auth = {
    // 1. Register
    async register(email, schoolName, password, level) {
        try {
            // Check duplicate email
            const q = query(collection(db, "users"), where("email", "==", email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                return { success: false, message: 'Email sudah terdaftar.' };
            }

            // Create User Document
            const isSuperAdmin = email === 'disdikbudpamekasan08@gmail.com';

            const newUser = {
                email: email,
                username: email.split('@')[0],
                name: schoolName,
                level: level, // Store School Level
                password: password, // Note: In production, hash this!
                role: isSuperAdmin ? 'admin' : 'operator',
                status: isSuperAdmin ? 'active' : 'pending',
                school: schoolName,
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, "users"), newUser);

            return {
                success: true,
                message: 'Pendaftaran berhasil! Notifikasi verifikasi telah otomatis dikirim ke Admin Dinas. Silahkan tunggu persetujuan.'
            };
        } catch (error) {
            console.error("Register Error:", error);
            return { success: false, message: 'Terjadi kesalahan sistem: ' + error.message };
        }
    },

    // 2. Login
    async login(email, password) {
        try {
            // --- LEVEL ADMINS (HARDCODED FOR VERIFICATION) ---
            const levelAdmins = {
                'adminsd@pusdastra.net': { name: 'Admin SD', level: 'SD' },
                'adminsmp@pusdastra.net': { name: 'Admin SMP', level: 'SMP' },
                'adminpaud@pusdastra.net': { name: 'Admin PAUD', level: 'PAUD' }
            };

            if (levelAdmins[email] && password === 'admin123') {
                const adminData = levelAdmins[email];
                const sessionData = {
                    uid: 'admin_' + adminData.level.toLowerCase(),
                    email: email,
                    name: adminData.name,
                    role: 'admin',
                    school: 'Dinas Pendidikan',
                    level_access: adminData.level // Key for filtering permissions
                };
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
                return { success: true, user: sessionData };
            }

            // --- SUPER ADMIN BYPASS / AUTO-BOOTSTRAP ---
            // User requested "Permanent" login for this specific account
            if (email === 'disdikbudpamekasan08@gmail.com' && password === 'Disdikbud2026') {
                const q = query(collection(db, "users"), where("email", "==", email));
                const querySnapshot = await getDocs(q);

                let userId = "";

                if (querySnapshot.empty) {
                    // Auto-Create Super Admin in Cloud if not exists
                    const newAdmin = {
                        email: email,
                        username: 'pusdastra_admin',
                        name: 'PUSDASTRA Pusat',
                        password: password,
                        role: 'admin',
                        status: 'active',
                        school: 'Dinas Pendidikan',
                        createdAt: new Date().toISOString()
                    };
                    const docRef = await addDoc(collection(db, "users"), newAdmin);
                    userId = docRef.id;
                } else {
                    userId = querySnapshot.docs[0].id;
                }

                // Force Success Session
                const sessionData = {
                    uid: userId,
                    email: email,
                    name: 'PUSDASTRA Pusat',
                    role: 'admin',
                    school: 'Dinas Pendidikan',
                    level_access: 'ALL' // Super Admin sees all
                };
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
                return { success: true, user: sessionData };
            }

            // --- NORMAL USER LOGIN ---
            const q = query(collection(db, "users"), where("email", "==", email));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) return { success: false, message: 'Email tidak terdaftar.' };

            const userDoc = querySnapshot.docs[0];
            const user = userDoc.data();
            const userId = userDoc.id;

            if (user.password !== password) return { success: false, message: 'Password salah.' };

            if (user.status === 'pending') return { success: false, message: 'Akun Anda sedang dalam proses verifikasi Admin.' };
            if (user.status === 'rejected') return { success: false, message: 'Maaf, pendaftaran akun ditolak.' };

            // Save Session
            const sessionData = {
                uid: userId, // Firestore Doc ID
                email: user.email,
                name: user.name,
                role: user.role,
                school: user.school,
                // Operators don't have level_access usually, or matches their own level
            };
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
            return { success: true, user: sessionData };

        } catch (error) {
            console.error("Login Error:", error);
            return { success: false, message: 'Login Error: ' + error.message };
        }
    },

    // 3. Get Pending Users (for Admin)
    async getPendingUsers() {
        const q = query(collection(db, "users"), where("status", "==", "pending"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // 4. Approve User
    async approveUser(email) {
        // We find by email to be consistent, or pass ID ideally. 
        // Allowing email lookup for backward compatibility with logic
        const q = query(collection(db, "users"), where("email", "==", email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            await updateDoc(docRef, { status: 'active' });
            return { success: true };
        }
        return { success: false, message: 'User not found' };
    },

    // 5. Reject User
    async rejectUser(email) {
        const q = query(collection(db, "users"), where("email", "==", email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            await updateDoc(docRef, { status: 'rejected' });
            return { success: true };
        }
    },

    // 6. Session Management
    check() {
        const session = sessionStorage.getItem(SESSION_KEY);
        if (!session) return null;
        return JSON.parse(session);
    },

    logout() {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = '../login.html';
    }
};

// --- DATASTORE (Firestore CRUD) ---
export const DataStore = {
    // SISWA
    async getSiswa() {
        const snapshot = await getDocs(collection(db, "siswa"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    async addSiswa(data) {
        await addDoc(collection(db, "siswa"), data);
    },
    async updateSiswa(id, data) {
        await updateDoc(doc(db, "siswa", id), data);
    },
    async deleteSiswa(id) {
        await deleteDoc(doc(db, "siswa", id));
    },

    // PRESTASI
    async getPrestasi() {
        const snapshot = await getDocs(collection(db, "prestasi"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    async addPrestasi(data) {
        await addDoc(collection(db, "prestasi"), data);
    },
    async updatePrestasi(id, data) {
        await updateDoc(doc(db, "prestasi", id), data);
    },
    async deletePrestasi(id) {
        await deleteDoc(doc(db, "prestasi", id));
    },

    // SEKOLAH
    async getSekolah() {
        const snapshot = await getDocs(collection(db, "sekolah"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    async addSekolah(data) {
        await addDoc(collection(db, "sekolah"), data);
    },
    async updateSekolah(id, data) {
        await updateDoc(doc(db, "sekolah", id), data);
    },
    async deleteSekolah(id) {
        await deleteDoc(doc(db, "sekolah", id));
    },

    // MESSAGES (Secure Inbox)
    async getMessages() {
        const snapshot = await getDocs(collection(db, "messages"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    async saveMessage(data) {
        await addDoc(collection(db, "messages"), data);
    },
    async toggleMessageStatus(id, currentStatus) {
        await updateDoc(doc(db, "messages", id), { isRead: !currentStatus });
    },
    async deleteMessage(id) {
        await deleteDoc(doc(db, "messages", id));
    },

    // STATISTICS
    async getStats() {
        // Note `getCountFromServer` is more efficient but requires newer SDK/Index. 
        // For simplicity, we fetch docs. 
        // Optimization: In real app, use aggregation queries.
        const s = await getDocs(collection(db, "siswa"));
        const p = await getDocs(collection(db, "prestasi"));
        const sk = await getDocs(collection(db, "sekolah"));

        return {
            totalSiswa: s.size,
            totalPrestasi: p.size,
            totalSekolah: sk.size
        };
    },

    // DANGER ZONE
    async resetSystemData() {
        const resetCollection = async (colName) => {
            const snapshot = await getDocs(collection(db, colName));
            const promises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(promises);
        };

        await resetCollection("prestasi");
        await resetCollection("sekolah");
        // await resetCollection("siswa"); // Siswa not used explicitly but if migrated, clean it.
        // We do NOT delete "users" to keep accounts alive.
    }
};

// Make available globally for inline scripts (optional, for backward compat if we map it)
window.Auth = Auth;
window.DataStore = DataStore;
