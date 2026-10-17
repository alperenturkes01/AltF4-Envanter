// ==========================================
// ALTF4 ENVANTER SİSTEMİ - KULLANICI YÖNETİMİ VE YETKİLENDİRME (AUTH)
// ==========================================

const AuthService = {
  currentUser: null,
  role: "guest", // "guest" | "unauthorized" | "family" | "admin"
  authListeners: [],

  init() {
    // 1. Varsa son oturumu yerel depodan al
    const savedUser = localStorage.getItem("altf4_current_user");
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
        this.recalculateRole();
      } catch (e) {
        this.currentUser = null;
        this.role = "guest";
      }
    }

    // 2. Firebase Auth dinleyicisi kur
    const setupAuthObserver = (user) => {
      if (user) {
        this.currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split("@")[0],
          photoURL: user.photoURL || null,
          isFirebaseUser: true
        };
      } else if (this.currentUser && this.currentUser.isFirebaseUser) {
        this.currentUser = null;
      }
      this.recalculateRole();
      this.saveSession();
      this.notifyChange();
    };

    if (window.Firebase13 && window.Firebase13.auth && window.Firebase13.onAuthStateChanged) {
      window.Firebase13.onAuthStateChanged(window.Firebase13.auth, setupAuthObserver);
    }
    window.addEventListener("firebase:v13:ready", (e) => {
      if (e.detail && e.detail.auth && e.detail.onAuthStateChanged) {
        e.detail.onAuthStateChanged(e.detail.auth, setupAuthObserver);
      }
    });

    if (window.firebase && firebase.auth) {
      try {
        firebase.auth().onAuthStateChanged(setupAuthObserver);
      } catch (err) {
        console.warn("Firebase Auth bağlanamadı:", err);
      }
    }

    // Whitelist değiştiğinde yetkiyi güncelle
    if (window.DatabaseService) {
      DatabaseService.onWhitelistChange(() => {
        this.recalculateRole();
        this.notifyChange();
      });
    }

    return this.currentUser;
  },

  // Rolün hesaplanması
  recalculateRole() {
    if (!this.currentUser || !this.currentUser.email) {
      this.role = "guest";
      return;
    }

    const email = this.currentUser.email.toLowerCase().trim();

    // 1. Admin Kontrolü (Kesin olarak altf4yapin@gmail.com)
    if (email === APP_CONFIG.adminEmail.toLowerCase()) {
      this.role = "admin";
      return;
    }

    // 2. Beyaz Liste (Whitelist) Kontrolü
    const whitelist = DatabaseService ? DatabaseService.getWhitelist() : APP_CONFIG.defaultWhitelist;
    const isWhitelisted = whitelist.some((wEmail) => wEmail.toLowerCase() === email);

    if (isWhitelisted) {
      this.role = "family";
    } else {
      // Yetkisiz kullanıcılar "Misafir" rolüne atanır
      this.role = "unauthorized"; // "Misafir"
    }
  },

  // Yetki Kontrol Fonksiyonları
  isAdmin() {
    return this.role === "admin";
  },

  isFamilyMember() {
    return this.role === "family";
  },

  // Sadece Admin ve Beyaz listedeki Aile Üyeleri yetkilidir (Envanter bölümlerini görebilir)
  isAuthorized() {
    return this.role === "admin" || this.role === "family";
  },

  // Oturum açmış ama beyaz listede olmayan "Misafir" kullanıcısı
  isUnauthorizedGoogleUser() {
    return this.currentUser !== null && !this.isAuthorized();
  },

  isLoggedIn() {
    return this.currentUser !== null;
  },

  canViewInventory() {
    return this.isAuthorized();
  },

  canEditItem() {
    return this.isAdmin();
  },

  canDeleteItem() {
    return this.isAdmin();
  },

  canAddItem() {
    return this.isAdmin();
  },

  canManageSettings() {
    return this.isAdmin();
  },

  canUpdateStatus() {
    // Hem Admin hem de Beyaz listedeki Aile Üyeleri durum güncelleyebilir
    return this.isAuthorized();
  },

  // Gerçek Google ile Giriş Yapma (Firebase)
  // Gerçek Google ile Giriş Yapma (Firebase 13.0.0 & Compat)
  async signInWithGoogle() {
    // 1. Firebase 13.0.0 Modular SDK
    if (window.Firebase13 && window.Firebase13.auth && window.Firebase13.signInWithPopup) {
      try {
        const result = await window.Firebase13.signInWithPopup(window.Firebase13.auth, window.Firebase13.googleProvider);
        const user = result.user;
        this.currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split("@")[0],
          photoURL: user.photoURL,
          isFirebaseUser: true
        };
        this.recalculateRole();
        this.saveSession();
        this.notifyChange();
        return this.currentUser;
      } catch (error) {
        console.error("Google Auth hatası (Firebase 13):", error);
        throw error;
      }
    }

    // 2. Firebase Compat SDK
    if (window.firebase && firebase.auth && DatabaseService.isFirebaseActive) {
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        this.currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split("@")[0],
          photoURL: user.photoURL,
          isFirebaseUser: true
        };
        this.recalculateRole();
        this.saveSession();
        this.notifyChange();
        return this.currentUser;
      } catch (error) {
        console.error("Google Auth hatası:", error);
        throw error;
      }
    } else {
      throw new Error("Google ile giriş başlatılamadı. Lütfen internet bağlantınızı kontrol ediniz.");
    }
  },

  // Çıkış Yapma
  async signOut() {
    if (window.Firebase13 && window.Firebase13.signOut && this.currentUser && this.currentUser.isFirebaseUser) {
      try {
        await window.Firebase13.signOut(window.Firebase13.auth);
      } catch (e) {
        console.warn("Firebase 13 signOut:", e);
      }
    } else if (window.firebase && firebase.auth && this.currentUser && this.currentUser.isFirebaseUser) {
      try {
        await firebase.auth().signOut();
      } catch (e) {
        console.warn("Signout hatası:", e);
      }
    }
    this.currentUser = null;
    this.role = "guest";
    localStorage.removeItem("altf4_current_user");
    this.notifyChange();
  },

  saveSession() {
    if (this.currentUser) {
      localStorage.setItem("altf4_current_user", JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem("altf4_current_user");
    }
  },

  onAuthChange(callback) {
    this.authListeners.push(callback);
    callback({ user: this.currentUser, role: this.role });
  },

  notifyChange() {
    for (const cb of this.authListeners) {
      try {
        cb({ user: this.currentUser, role: this.role });
      } catch (e) {
        console.error("Auth listener callback hatası:", e);
      }
    }
  }
};

window.AuthService = AuthService;

