/**
 * PUSDASTRA Data Engine
 * Handles LocalStorage for Users, Siswa, Prestasi, and Sekolah
 * V2: Added Email Login & Admin Approval Workflow
 */

const DB_KEY = 'PUSDASTRA_DB_V5'; // Version bump to wipe data (Clean Slate)
const SESSION_KEY = 'PUSDASTRA_SESSION';

// Default / Initial Data
const seedData = {
    users: [
        {
            email: 'disdikbudpamekasan08@gmail.com',
            username: 'admin',
            password: 'Disdikbud2026',
            name: 'Super Admin Disdikbud',
            role: 'admin',
            status: 'active',
            school: 'PUSDASTRA Pusat'
        }
    ],
    siswa: [],
    prestasi: [],
    sekolah: []
};

// --- Core Helper Functions ---

function loadDB() {
    const data = localStorage.getItem(DB_KEY);
    if (!data) {
        localStorage.setItem(DB_KEY, JSON.stringify(seedData));
        return seedData;
    }
    return JSON.parse(data);
}

function saveDB(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
}

// --- Auth Functions ---

window.Auth = {
    // 1. Register (Creates Pending Account)
    register: function (email, schoolName, password) {
        const db = loadDB();

        // Check duplicate
        if (db.users.find(u => u.email === email)) {
            return { success: false, message: 'Email sudah terdaftar.' };
        }

        const newUser = {
            email: email,
            username: email.split('@')[0], // Generate simple username
            name: schoolName,
            password: password,
            role: 'operator',
            status: 'pending', // Key: Must be approved
            school: schoolName
        };

        db.users.push(newUser);
        saveDB(db);

        return { success: true, message: 'Pendaftaran berhasil! Notifikasi verifikasi telah otomatis dikirim ke <b>disdikbudpamekasan08@gmail.com</b>. Silahkan tunggu persetujuan.' };
    },

    // 2. Login (Checks Email & Active Status)
    login: function (email, password) {
        const db = loadDB();
        const user = db.users.find(u => u.email === email);

        if (!user) return { success: false, message: 'Email tidak terdaftar.' };

        if (user.status === 'pending') {
            return { success: false, message: 'Akun Anda sedang dalam proses verifikasi Admin.' };
        }
        if (user.status === 'rejected') {
            return { success: false, message: 'Maaf, pendaftaran akun ditolak.' };
        }

        if (user.password !== password) return { success: false, message: 'Password salah.' };

        // Save Session
        const sessionData = { email: user.email, name: user.name, role: user.role, school: user.school };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
        return { success: true, user: sessionData };
    },

    // 3. Admin: Get Pending Users
    getPendingUsers: function () {
        const db = loadDB();
        return db.users.filter(u => u.status === 'pending');
    },

    // 4. Admin: Approve User
    approveUser: function (targetEmail) {
        const db = loadDB();
        const idx = db.users.findIndex(u => u.email === targetEmail);

        if (idx === -1) return { success: false, message: 'User tidak ditemukan' };

        db.users[idx].status = 'active';
        saveDB(db);
        return { success: true };
    },

    // 5. Admin: Reject User (Optional)
    rejectUser: function (targetEmail) {
        const db = loadDB();
        const idx = db.users.findIndex(u => u.email === targetEmail);
        if (idx !== -1) {
            db.users[idx].status = 'rejected';
            saveDB(db);
        }
    },

    check: function () {
        const session = sessionStorage.getItem(SESSION_KEY);
        if (!session) return null;
        return JSON.parse(session);
    },

    logout: function () {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = '../login.html';
    },

    // 6. Simulate Google Login (Passwordless for known emails)
    loginWithGoogle: function (email) {
        const db = loadDB();
        const user = db.users.find(u => u.email === email);

        if (!user) return { success: false, message: 'Email Google ini belum terdaftar di sistem.' };

        if (user.status === 'pending') {
            return { success: false, message: 'Akun Anda sedang dalam proses verifikasi Admin.' };
        }
        if (user.status === 'rejected') {
            return { success: false, message: 'Maaf, pendaftaran akun ditolak.' };
        }

        // Bypass Password Check
        const sessionData = { email: user.email, name: user.name, role: user.role, school: user.school };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
        return { success: true, user: sessionData };
    }
};

// --- Data CRUD Functions (Same as before) ---

window.DataStore = {
    getSiswa: function () { return loadDB().siswa; },
    addSiswa: function (siswaData) {
        const db = loadDB();
        db.siswa.push(siswaData);
        saveDB(db);
    },

    getPrestasi: function () { return loadDB().prestasi; },
    addPrestasi: function (prestasiData) {
        const db = loadDB();
        db.prestasi.push(prestasiData);
        saveDB(db);
    },

    getSekolah: function () { return loadDB().sekolah; },
    addSekolah: function (sekolahData) {
        const db = loadDB();
        db.sekolah.push(sekolahData);
        saveDB(db);
    },

    getStats: function () {
        const db = loadDB();
        return {
            totalSiswa: db.siswa.length,
            totalPrestasi: db.prestasi.length,
            totalSekolah: db.sekolah.length
        };
    },

    // Delete Functions
    deleteSiswa: function (index) {
        const db = loadDB();
        db.siswa.splice(index, 1);
        saveDB(db);
    },
    deletePrestasi: function (index) {
        const db = loadDB();
        db.prestasi.splice(index, 1);
        saveDB(db);
    },
    deleteSekolah: function (index) {
        const db = loadDB();
        db.sekolah.splice(index, 1);
        saveDB(db);
    },

    // Update Functions (Simple replace)
    updateSiswa: function (index, newData) {
        const db = loadDB();
        db.siswa[index] = newData;
        saveDB(db);
    },
    updatePrestasi: function (index, newData) {
        const db = loadDB();
        db.prestasi[index] = newData;
        saveDB(db);
    },
    updateSekolah: function (index, newData) {
        const db = loadDB();
        db.sekolah[index] = newData;
        saveDB(db);
    }
};
