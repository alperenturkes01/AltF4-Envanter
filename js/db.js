// ==========================================
// ALTF4 ENVANTER SİSTEMİ - VERİTABANI VE OFFLINE SENKRONİZASYON
// ==========================================

const DatabaseService = {
  db: null,
  isFirebaseActive: false,
  isOnline: navigator.onLine,
  listeners: [],
  whitelistListeners: [],
  requestsListeners: [],
  itemsCache: [],
  whitelistCache: [],
  requestsCache: [],

  async init() {
    // 1. Çevrimiçi / Çevrimdışı tarayıcı olaylarını dinle
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.notifyNetworkChange(true);
    });
    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.notifyNetworkChange(false);
    });

    // 2. Önce yerel önbellekten (LocalStorage) yükle (Anında hızlı açılış & Offline kabul kriteri)
    this.loadFromLocalStorage();

    // 3. Kayıtlı Firebase Yapılandırması veya resmi Firebase 13 yapılandırması
    const config = this.getSavedFirebaseConfig() || APP_CONFIG.firebaseConfig;
    if (config && config.apiKey && config.projectId) {
      await this.initFirebase(config);
    } else {
      console.log("ℹ️ Firebase yapılandırması henüz girilmedi, Yerel Önbellek (Offline Mod) devrede.");
    }

    return this.itemsCache;
  },

  // Yerel depodan veri çekme
  loadFromLocalStorage() {
    try {
      const storedItems = localStorage.getItem(APP_CONFIG.storageKeyItems);
      if (storedItems) {
        this.itemsCache = JSON.parse(storedItems);
      } else {
        // İlk açılışta zengin örnek veriyi yükle
        this.itemsCache = [...APP_CONFIG.initialSampleData];
        this.saveToLocalStorage();
      }

      const storedWhitelist = localStorage.getItem(APP_CONFIG.storageKeyWhitelist);
      if (storedWhitelist) {
        this.whitelistCache = JSON.parse(storedWhitelist);
      } else {
        this.whitelistCache = [...APP_CONFIG.defaultWhitelist];
        this.saveWhitelistToLocalStorage();
      }

      const storedRequests = localStorage.getItem(APP_CONFIG.storageKeyRequests);
      if (storedRequests) {
        this.requestsCache = JSON.parse(storedRequests);
      } else {
        this.requestsCache = [...APP_CONFIG.initialSampleRequests];
        this.saveRequestsToLocalStorage();
      }
    } catch (e) {
      console.error("LocalStorage okuma hatası:", e);
      this.itemsCache = [...APP_CONFIG.initialSampleData];
      this.whitelistCache = [...APP_CONFIG.defaultWhitelist];
      this.requestsCache = [...APP_CONFIG.initialSampleRequests];
    }
  },

  saveRequestsToLocalStorage() {
    try {
      localStorage.setItem(APP_CONFIG.storageKeyRequests, JSON.stringify(this.requestsCache));
    } catch (e) {
      console.warn("Requests localStorage yazma hatası:", e);
    }
  },

  // Yerel depoya kaydetme
  saveToLocalStorage() {
    try {
      localStorage.setItem(APP_CONFIG.storageKeyItems, JSON.stringify(this.itemsCache));
    } catch (e) {
      console.warn("LocalStorage yazma hatası (Kota aşımı olabilir):", e);
    }
  },

  saveWhitelistToLocalStorage() {
    try {
      localStorage.setItem(APP_CONFIG.storageKeyWhitelist, JSON.stringify(this.whitelistCache));
    } catch (e) {
      console.warn("Whitelist yazma hatası:", e);
    }
  },

  // Firebase Yapılandırmasını kaydet / al
  getSavedFirebaseConfig() {
    try {
      const cfg = localStorage.getItem(APP_CONFIG.storageKeyConfig);
      return cfg ? JSON.parse(cfg) : null;
    } catch (e) {
      return null;
    }
  },

  saveFirebaseConfig(config) {
    localStorage.setItem(APP_CONFIG.storageKeyConfig, JSON.stringify(config));
  },

  // Firebase başlatma ve Firestore Offline Persistence etkinleştirme
  async initFirebase(config) {
    try {
      if (!window.firebase && !window.Firebase13) {
        console.warn("Firebase SDK henüz yüklenmemiş.");
        return false;
      }

      // 1. Firebase v13.0.0 Modülü
      if (window.Firebase13 && window.Firebase13.db) {
        this.db = window.Firebase13.db;
        this.isFirebaseActive = true;
      }

      // 2. Firebase Compat (v13.0.0)
      if (window.firebase) {
        let app;
        if (!firebase.apps.length) {
          app = firebase.initializeApp(config);
        } else {
          app = firebase.app();
        }

        this.db = firebase.firestore();

        // Firebase Offline Persistence (IndexedDB Önbelleği)
        try {
          await this.db.enablePersistence({ synchronizeTabs: true });
          console.log("✅ Firestore Offline Persistence (v13.0.0) başarıyla etkinleştirildi.");
        } catch (err) {
          if (err.code === "failed-precondition") {
            console.warn("Çoklu sekme açık olduğu için persistence sadece birinde aktif.");
          } else if (err.code === "unimplemented") {
            console.warn("Tarayıcı IndexedDb persistence desteklemiyor.");
          }
        }
      }

      this.isFirebaseActive = true;
      this.setupRealtimeListeners();
      return true;
    } catch (err) {
      console.error("Firebase bağlantı hatası:", err);
      this.isFirebaseActive = false;
      return false;
    }
  },

  // Firestore Realtime dinleyicileri
  setupRealtimeListeners() {
    if (!this.db) return;

    // 1. Items koleksiyonunu dinle
    this.db.collection("items").onSnapshot(
      (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });

        if (items.length > 0) {
          this.itemsCache = items;
          this.saveToLocalStorage();
          this.notifyItemsChange();
        } else if (this.itemsCache.length > 0) {
          // Eğer Firestore boşsa yereldeki verileri ilk kez yükle
          this.syncLocalToFirestore();
        }
      },
      (error) => {
        console.warn("Firestore dinleme hatası (Offline mod devrede):", error.message);
      }
    );

    // 2. Whitelist koleksiyonunu dinle
    this.db.collection("settings").doc("whitelist").onSnapshot(
      (doc) => {
        if (doc.exists && doc.data().emails) {
          this.whitelistCache = doc.data().emails;
          this.saveWhitelistToLocalStorage();
          this.notifyWhitelistChange();
        }
      },
      (error) => {
        console.warn("Whitelist dinleme hatası:", error.message);
      }
    );

    // 3. Requests (Talepler) koleksiyonunu dinle (Gerçek Zamanlı Admin Bildirimi)
    let isInitialRequestsSnapshot = true;
    this.db.collection("requests").onSnapshot(
      (snapshot) => {
        const reqs = [];
        snapshot.forEach((doc) => {
          reqs.push({ id: doc.id, ...doc.data() });
        });

        // Gerçek zamanlı yeni talep bildirimi: ilk snapshot sonrası eklenen talepler bildirim fırlatır
        if (!isInitialRequestsSnapshot && snapshot.docChanges) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const newReq = { id: change.doc.id, ...change.doc.data() };
              console.log("📬 Yeni gerçek zamanlı talep algılandı:", newReq);
              window.dispatchEvent(new CustomEvent("app:new-request", { detail: newReq }));
            }
          });
        }
        isInitialRequestsSnapshot = false;

        if (reqs.length > 0) {
          this.requestsCache = reqs;
          this.saveRequestsToLocalStorage();
          this.notifyRequestsChange();
        }
      },
      (error) => {
        console.warn("Requests dinleme hatası:", error.message);
      }
    );
  },

  // Yereldeki verileri Firestore'a aktarma
  async syncLocalToFirestore() {
    if (!this.db || !this.isFirebaseActive) return;
    try {
      const batch = this.db.batch();
      for (const item of this.itemsCache) {
        const docRef = this.db.collection("items").doc(item.id);
        batch.set(docRef, item, { merge: true });
      }
      const whitelistDoc = this.db.collection("settings").doc("whitelist");
      batch.set(whitelistDoc, { emails: this.whitelistCache }, { merge: true });
      await batch.commit();
      console.log("☁️ Yerel veriler Firestore bulutuna başarıyla eşitlendi.");
    } catch (e) {
      console.warn("Buluta eşitleme hatası:", e);
    }
  },

  // ================= CRUD İŞLEMLERİ =================

  getItems() {
    return [...this.itemsCache];
  },

  getItemById(id) {
    return this.itemsCache.find((it) => it.id === id);
  },

  async addItem(itemData) {
    const newItem = {
      ...itemData,
      id: itemData.id || "item_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      createdAt: itemData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Önce yerel önbelleğe yaz
    this.itemsCache.unshift(newItem);
    this.saveToLocalStorage();
    this.notifyItemsChange();

    // Firebase aktifse buluta yaz
    if (this.db && this.isFirebaseActive) {
      try {
        await this.db.collection("items").doc(newItem.id).set(newItem);
      } catch (err) {
        console.warn("Buluta eklenirken hata oluştu (çevrimdışı kuyruğa alındı):", err);
      }
    }

    return newItem;
  },

  async updateItem(id, updates) {
    const index = this.itemsCache.findIndex((it) => it.id === id);
    if (index === -1) return null;

    const updatedItem = {
      ...this.itemsCache[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.itemsCache[index] = updatedItem;
    this.saveToLocalStorage();
    this.notifyItemsChange();

    if (this.db && this.isFirebaseActive) {
      try {
        await this.db.collection("items").doc(id).set(updatedItem, { merge: true });
      } catch (err) {
        console.warn("Bulut güncelleme hatası:", err);
      }
    }

    return updatedItem;
  },

  async deleteItem(id) {
    this.itemsCache = this.itemsCache.filter((it) => it.id !== id);
    this.saveToLocalStorage();
    this.notifyItemsChange();

    if (this.db && this.isFirebaseActive) {
      try {
        await this.db.collection("items").doc(id).delete();
      } catch (err) {
        console.warn("Buluttan silme hatası:", err);
      }
    }
    return true;
  },

  // Durum Güncelleme (Aile Üyeleri veya Admin) - Zorunlu Not İçerir!
  async updateStatus(id, newStatus, statusNote, updatedBy = "Bilinmeyen Kullanıcı") {
    if (!statusNote || !statusNote.trim()) {
      throw new Error("Durum değişikliği için 'Nerede kullanılıyor / Kimde?' notu zorunludur!");
    }

    const noteHistoryEntry = {
      status: newStatus,
      note: statusNote.trim(),
      by: updatedBy,
      date: new Date().toISOString()
    };

    const item = this.getItemById(id);
    const history = item && item.statusHistory ? [...item.statusHistory] : [];
    history.unshift(noteHistoryEntry);

    return await this.updateItem(id, {
      durum: newStatus,
      durumNotu: statusNote.trim(),
      sonGuncelleyen: updatedBy,
      statusHistory: history
    });
  },

  // Hızlı Stok Artırma / Azaltma
  async updateStock(id, delta) {
    const item = this.getItemById(id);
    if (!item) return null;

    const currentAdet = Number(item.adet) || 0;
    const newAdet = Math.max(0, currentAdet + delta);

    return await this.updateItem(id, { adet: newAdet });
  },

  // ================= WHITELIST (BEYAZ LİSTE) YÖNETİMİ =================

  getWhitelist() {
    return [...this.whitelistCache];
  },

  async addWhitelistEmail(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Geçerli bir e-posta adresi giriniz.");
    }
    if (this.whitelistCache.includes(cleanEmail)) {
      return false; // Zaten listede
    }

    this.whitelistCache.push(cleanEmail);
    this.saveWhitelistToLocalStorage();
    this.notifyWhitelistChange();

    if (this.db && this.isFirebaseActive) {
      try {
        await this.db.collection("settings").doc("whitelist").set({ emails: this.whitelistCache }, { merge: true });
      } catch (err) {
        console.warn("Whitelist bulut kayıt hatası:", err);
      }
    }
    return true;
  },

  async removeWhitelistEmail(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (cleanEmail === APP_CONFIG.adminEmail) {
      throw new Error("Yönetici (Admin) e-postası beyaz listeden silinemez!");
    }

    this.whitelistCache = this.whitelistCache.filter((e) => e !== cleanEmail);
    this.saveWhitelistToLocalStorage();
    this.notifyWhitelistChange();

    if (this.db && this.isFirebaseActive) {
      try {
        await this.db.collection("settings").doc("whitelist").set({ emails: this.whitelistCache }, { merge: true });
      } catch (err) {
        console.warn("Whitelist bulut silme hatası:", err);
      }
    }
    return true;
  },

  // ================= TALEP YÖNETİMİ (MATERIAL & BOOK REQUESTS) =================

  getRequests() {
    return [...this.requestsCache];
  },

  getRequestById(id) {
    return this.requestsCache.find(r => r.id === id);
  },

  async addRequest(reqData) {
    const newReq = {
      ...reqData,
      id: reqData.id || "req_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      status: reqData.status || "bekliyor",
      adminNote: reqData.adminNote || "",
      createdAt: reqData.createdAt || new Date().toISOString()
    };
    this.requestsCache.unshift(newReq);
    this.saveRequestsToLocalStorage();
    this.notifyRequestsChange();

    // Yerel olarak anında bildirim fırlat (özellikle offline veya aynı oturumda test edilirken)
    window.dispatchEvent(new CustomEvent("app:new-request", { detail: newReq }));

    if (this.db && this.isFirebaseActive) {
      try {
        await this.db.collection("requests").doc(newReq.id).set(newReq);
      } catch (err) {
        console.warn("Buluta talep yazma hatası:", err);
      }
    }
    return newReq;
  },

  async updateRequestStatus(id, newStatus, adminNote = "") {
    const index = this.requestsCache.findIndex(r => r.id === id);
    if (index === -1) return null;

    const updated = {
      ...this.requestsCache[index],
      status: newStatus,
      adminNote: adminNote !== undefined ? adminNote : this.requestsCache[index].adminNote,
      updatedAt: new Date().toISOString()
    };
    this.requestsCache[index] = updated;
    this.saveRequestsToLocalStorage();
    this.notifyRequestsChange();

    if (this.db && this.isFirebaseActive) {
      try {
        await this.db.collection("requests").doc(id).set(updated, { merge: true });
      } catch (err) {
        console.warn("Bulutta talep güncelleme hatası:", err);
      }
    }
    return updated;
  },

  async deleteRequest(id) {
    this.requestsCache = this.requestsCache.filter(r => r.id !== id);
    this.saveRequestsToLocalStorage();
    this.notifyRequestsChange();

    if (this.db && this.isFirebaseActive) {
      try {
        await this.db.collection("requests").doc(id).delete();
      } catch (err) {
        console.warn("Buluttan talep silme hatası:", err);
      }
    }
    return true;
  },

  onRequestsChange(callback) {
    this.requestsListeners.push(callback);
    callback(this.requestsCache);
  },

  notifyRequestsChange() {
    for (const cb of this.requestsListeners) {
      try {
        cb(this.requestsCache);
      } catch (e) {
        console.error("Requests listener hatası:", e);
      }
    }
  },

  // ================= İÇE / DIŞA AKTARMA (BULK IMPORT / EXPORT) =================

  exportToJSON() {
    const data = {
      version: APP_CONFIG.version,
      exportedAt: new Date().toISOString(),
      items: this.itemsCache,
      whitelist: this.whitelistCache,
      requests: this.requestsCache
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `altf4_envanter_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportToCSV() {
    if (this.itemsCache.length === 0) return;
    const headers = [
      "ID", "Tür", "İsim", "Yazar/Model", "Adet", "MinStok",
      "Oda", "Dolap/Raf", "Kutu/Çekmece", "Barkod", "Durum", "DurumNotu", "Kategori", "Özellikler"
    ];

    const rows = this.itemsCache.map(item => [
      `"${item.id || ''}"`,
      `"${item.type || ''}"`,
      `"${(item.isim || '').replace(/"/g, '""')}"`,
      `"${((item.type === 'kutuphane' ? item.yazar : item.model) || '').replace(/"/g, '""')}"`,
      item.adet || 0,
      item.minStok || 1,
      `"${(item.oda || '').replace(/"/g, '""')}"`,
      `"${(item.dolap || '').replace(/"/g, '""')}"`,
      `"${(item.kutu || '').replace(/"/g, '""')}"`,
      `"${(item.barkod || '').replace(/"/g, '""')}"`,
      `"${(item.durum || '').replace(/"/g, '""')}"`,
      `"${(item.durumNotu || '').replace(/"/g, '""')}"`,
      `"${(item.kategori || '').replace(/"/g, '""')}"`,
      `"${(item.ozellikler || '').replace(/"/g, '""')}"`
    ]);

    // Türkçe karakterlerin Excel'de düzgün açılması için UTF-8 BOM ekliyoruz (\uFEFF)
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `altf4_envanter_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async importFromJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      let newItems = [];
      if (Array.isArray(parsed)) {
        newItems = parsed;
      } else if (parsed && Array.isArray(parsed.items)) {
        newItems = parsed.items;
      } else {
        throw new Error("Geçerli bir JSON envanter listesi bulunamadı.");
      }

      // Verileri doğrula ve id kontrolü yap
      let addedCount = 0;
      for (const raw of newItems) {
        if (!raw.isim) continue;
        const item = {
          id: raw.id || "item_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
          type: raw.type === "elektronik" ? "elektronik" : "kutuphane",
          isim: raw.isim,
          yazar: raw.yazar || "",
          model: raw.model || "",
          adet: Number(raw.adet) || 1,
          minStok: Number(raw.minStok) || 1,
          oda: raw.oda || "Çalışma Odası",
          dolap: raw.dolap || "Ana Kitaplık - Raf 1",
          kutu: raw.kutu || "Genel Kutu",
          barkod: raw.barkod || "",
          durum: raw.durum || "mevcut",
          durumNotu: raw.durumNotu || "İçe aktarıldı.",
          kategori: raw.kategori || "Genel",
          ozellikler: raw.ozellikler || "",
          fotograf: raw.fotograf || "",
          createdAt: raw.createdAt || new Date().toISOString()
        };

        // Mevcut varsa güncelle, yoksa ekle
        const existingIdx = this.itemsCache.findIndex(i => i.id === item.id);
        if (existingIdx >= 0) {
          this.itemsCache[existingIdx] = item;
        } else {
          this.itemsCache.push(item);
        }
        addedCount++;
      }

      this.saveToLocalStorage();
      this.notifyItemsChange();

      if (this.db && this.isFirebaseActive) {
        await this.syncLocalToFirestore();
      }

      return addedCount;
    } catch (err) {
      throw new Error("JSON İçe aktarma hatası: " + err.message);
    }
  },

  // Basit CSV parser
  async importFromCSV(csvString) {
    try {
      const lines = csvString.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) throw new Error("CSV dosyası boş veya başlık satırı eksik.");

      const parseCSVLine = (text) => {
        const re = /(?:\"([^\"]*(?:\"\"[^\"]*)*)\")|([^,]+)/g;
        const result = [];
        let match;
        while ((match = re.exec(text))) {
          let val = match[1] !== undefined ? match[1].replace(/\"\"/g, '"') : match[2];
          result.push((val || "").trim());
        }
        return result;
      };

      const header = lines[0].toLowerCase();
      let count = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (!cols || cols.length < 3) continue;

        // Varsayılan format: ID, Tür, İsim, Yazar/Model, Adet, MinStok, Oda, Dolap, Kutu, Barkod, Durum, DurumNotu, Kategori, Özellikler
        const type = (cols[1] || "").toLowerCase().includes("elek") ? "elektronik" : "kutuphane";
        const isim = cols[2];
        if (!isim) continue;

        const newItem = {
          id: cols[0] && cols[0].length > 4 ? cols[0] : "item_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
          type,
          isim,
          yazar: type === "kutuphane" ? cols[3] || "" : "",
          model: type === "elektronik" ? cols[3] || "" : "",
          adet: parseInt(cols[4], 10) || 1,
          minStok: parseInt(cols[5], 10) || 1,
          oda: cols[6] || "Çalışma Odası",
          dolap: cols[7] || "Ana Kitaplık - Raf 1",
          kutu: cols[8] || "Genel Kutu",
          barkod: cols[9] || "",
          durum: cols[10] || "mevcut",
          durumNotu: cols[11] || "CSV ile aktarıldı",
          kategori: cols[12] || "Genel",
          ozellikler: cols[13] || "",
          createdAt: new Date().toISOString()
        };

        const existingIdx = this.itemsCache.findIndex(it => it.id === newItem.id);
        if (existingIdx >= 0) {
          this.itemsCache[existingIdx] = newItem;
        } else {
          this.itemsCache.push(newItem);
        }
        count++;
      }

      this.saveToLocalStorage();
      this.notifyItemsChange();

      if (this.db && this.isFirebaseActive) {
        await this.syncLocalToFirestore();
      }

      return count;
    } catch (err) {
      throw new Error("CSV İçe aktarma hatası: " + err.message);
    }
  },

  // Reset / Örnek Verilere Dönüş
  resetToSampleData() {
    this.itemsCache = [...APP_CONFIG.initialSampleData];
    this.whitelistCache = [...APP_CONFIG.defaultWhitelist];
    this.requestsCache = [...APP_CONFIG.initialSampleRequests];
    this.saveToLocalStorage();
    this.saveWhitelistToLocalStorage();
    this.saveRequestsToLocalStorage();
    this.notifyItemsChange();
    this.notifyWhitelistChange();
    this.notifyRequestsChange();
  },

  // ================= DİNLEYİCİLER / EVENTS =================

  onItemsChange(callback) {
    this.listeners.push(callback);
    // İlk çağrıda mevcut veriyi gönder
    callback(this.itemsCache);
  },

  notifyItemsChange() {
    for (const cb of this.listeners) {
      try {
        cb(this.itemsCache);
      } catch (e) {
        console.error("Dinleyici hatası:", e);
      }
    }
  },

  onWhitelistChange(callback) {
    this.whitelistListeners.push(callback);
    callback(this.whitelistCache);
  },

  notifyWhitelistChange() {
    for (const cb of this.whitelistListeners) {
      try {
        cb(this.whitelistCache);
      } catch (e) {
        console.error("Whitelist dinleyici hatası:", e);
      }
    }
  },

  notifyNetworkChange(isOnline) {
    window.dispatchEvent(new CustomEvent("app:network-status", { detail: { isOnline } }));
  }
};

window.DatabaseService = DatabaseService;

