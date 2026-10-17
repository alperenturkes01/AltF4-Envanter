// ==========================================
// ALTF4 ENVANTER SİSTEMİ - ANA UYGULAMA MANTIĞI (APP.JS)
// ==========================================

const App = {
  currentSection: "landing",
  currentSearchQuery: "",
  filters: {
    type: "all",
    durum: "all",
    oda: "all",
    dolap: "all",
    kutu: "all",
    kategori: "all",
    lowStockOnly: false,
    sortBy: "isim-asc"
  },
  editingItemId: null,
  activeItemForStatusUpdate: null,
  requestFilterStatus: "all",
  lastNotifiedRequestId: null,
  lastNotifiedAt: 0,
  viewMode: {
    kutuphane: "grid", // "grid" | "table"
    elektronik: "grid"
  },

  async init() {
    console.log("🚀 Altf4 Envanter Sistemi başlatılıyor...");

    // 1. Veritabanı ve Yerel Önbelleği Başlat
    await DatabaseService.init();

    // 2. Yetkilendirme Servisini Başlat
    AuthService.init();

    // 3. Tema Tercihini Uygula
    this.initTheme();

    // 4. Arayüz Dinleyicilerini Kur
    this.setupEventListeners();

    // 5. Veritabanı Değişikliklerini Dinle
    DatabaseService.onItemsChange((items) => {
      this.renderCurrentView();
      this.renderDashboardStats();
      this.renderLocationTree();
    });

    DatabaseService.onRequestsChange((requests) => {
      if (this.currentSection === "talepler") {
        this.renderRequestsView();
      }
      this.updateRequestsBadge(requests);
    });

    // 6. Auth Değişikliklerini Dinle
    AuthService.onAuthChange(({ user, role }) => {
      this.updateAuthUI(user, role);
      this.renderCurrentView();
    });

    // 7. Ağ Durumu Değişikliklerini Dinle
    window.addEventListener("app:network-status", (e) => {
      this.updateNetworkUI(e.detail.isOnline);
    });
    this.updateNetworkUI(navigator.onLine);

    // 8. Gerçek Zamanlı Yeni Talep Bildirimi (Admin & Aile)
    window.addEventListener("app:new-request", (e) => {
      this.handleNewRequestNotification(e.detail);
    });

    // 9. URL Hash yönlendirmesi
    this.handleRoute();
    window.addEventListener("hashchange", () => this.handleRoute());

    console.log("✅ Sistem hazır.");
  },

  // ================= TEMA (LIGHT / DARK) =================

  initTheme() {
    const savedTheme = localStorage.getItem(APP_CONFIG.storageKeyTheme);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  },

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem(APP_CONFIG.storageKeyTheme, isDark ? "dark" : "light");
    this.showToast(isDark ? "Koyu tema aktif edildi." : "Açık tema aktif edildi.", "info");
  },

  // ================= YÖNLENDİRME (ROUTING) VE GÜVENLİK BARİYERİ =================

  handleRoute() {
    let rawHash = window.location.hash.replace("#", "").trim();
    let hash = rawHash.toLowerCase();

    // 1. Yetki Kontrolü: Yalnızca Admin ve Beyaz Listedeki Aile Üyeleri envanter sayfalarını görebilir!
    // Yetkisiz kullanıcılar "Misafir" rolündedir ve YALNIZCA açılış sayfasına (landing) erişebilir.
    if (!AuthService.isAuthorized()) {
      if (hash && hash !== "landing") {
        if (AuthService.isLoggedIn()) {
          this.showUnauthorizedAlert();
        }
        hash = "landing";
        window.location.hash = "#landing";
      } else {
        hash = "landing";
      }
    } else {
      // Yetkili kullanıcı
      if (!hash) {
        hash = "dashboard";
      }
    }

    // Rota Takma Adları (Aliases) Çözümleme: #talep, #requests, #talep-yonetimi, #talep-olustur, vb.
    let shouldOpenNewRequestModal = false;
    if (hash === "talep" || hash === "requests" || hash === "talep-yonetimi") {
      hash = "talepler";
    } else if (hash === "talep-olustur" || hash === "talep-olusturma" || hash === "yeni-talep") {
      hash = "talepler";
      shouldOpenNewRequestModal = true;
    }

    // 2. Yönetici Paneli Koruması: Sadece altf4yapin@gmail.com
    if (hash === "yonetim" && !AuthService.isAdmin()) {
      this.showToast("Yönetim paneline sadece sistem yöneticisi (altf4yapin@gmail.com) erişebilir.", "warning");
      hash = "dashboard";
      window.location.hash = "#dashboard";
    }

    this.navigateTo(hash);

    if (shouldOpenNewRequestModal && AuthService.isAuthorized()) {
      setTimeout(() => {
        this.openNewRequestModal();
      }, 100);
    }
  },

  navigateTo(sectionId) {
    // Rota Takma Adları Çözümleme
    let shouldOpenNewRequestModal = false;
    if (sectionId === "talep" || sectionId === "requests" || sectionId === "talep-yonetimi") {
      sectionId = "talepler";
    } else if (sectionId === "talep-olustur" || sectionId === "talep-olusturma" || sectionId === "yeni-talep") {
      sectionId = "talepler";
      shouldOpenNewRequestModal = true;
    }

    // Güvenlik Kilidi: Eğer yetkisiz Misafir ise landing harici hiçbir sayfaya gidemez!
    if (sectionId !== "landing" && !AuthService.isAuthorized()) {
      this.showUnauthorizedAlert();
      sectionId = "landing";
      window.location.hash = "#landing";
    }

    this.currentSection = sectionId;

    // Tüm section'ları gizle
    const sections = ["landing", "dashboard", "kutuphane", "elektronik", "talepler", "yonetim"];
    sections.forEach((sec) => {
      const el = document.getElementById(`section-${sec}`);
      if (el) el.classList.add("hidden");

      // Menü buton aktiflikleri
      const navBtn = document.querySelectorAll(`[data-nav="${sec}"]`);
      navBtn.forEach(btn => {
        if (sec === sectionId) {
          btn.classList.add("text-sky-500", "dark:text-sky-400", "font-bold");
          btn.classList.remove("text-slate-600", "dark:text-slate-300");
        } else {
          btn.classList.remove("text-sky-500", "dark:text-sky-400", "font-bold");
          btn.classList.add("text-slate-600", "dark:text-slate-300");
        }
      });
    });

    // İstenen section'ı göster
    const targetSection = document.getElementById(`section-${sectionId}`);
    if (targetSection) {
      targetSection.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // İlgili görünümü render et
    if (sectionId === "dashboard") {
      this.renderDashboardStats();
      this.renderDashboardLists();
      this.renderLocationTree();
    } else if (sectionId === "kutuphane") {
      this.renderLibraryView();
    } else if (sectionId === "elektronik") {
      this.renderElectronicsView();
    } else if (sectionId === "talepler") {
      this.renderRequestsView();
    } else if (sectionId === "yonetim") {
      this.renderAdminView();
    }

    if (shouldOpenNewRequestModal && AuthService.isAuthorized()) {
      setTimeout(() => {
        this.openNewRequestModal();
      }, 100);
    }
  },

  showUnauthorizedAlert() {
    const unauthMessage = (APP_CONFIG.messages && APP_CONFIG.messages.unauthorized_access) || "Yetkiniz yoktur";
    this.showToast(unauthMessage, "error");
    const alertBox = document.getElementById("unauthorizedAccessAlert");
    if (alertBox) {
      alertBox.classList.remove("hidden");
      alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  },

  // ================= ARAYÜZ ETKİLEŞİMLERİ (EVENT LISTENERS) =================

  setupEventListeners() {
    // 1. Tema değiştirici
    const themeBtn = document.getElementById("btnToggleTheme");
    if (themeBtn) themeBtn.addEventListener("click", () => this.toggleTheme());

    // 2. Arama girdisi (Debounced Fuzzy Search)
    let searchTimeout;
    const globalSearchInput = document.getElementById("globalSearchInput");
    if (globalSearchInput) {
      globalSearchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.currentSearchQuery = e.target.value.trim();
          this.renderCurrentView();
        }, 150);
      });
    }

    // 3. Arama Temizle Butonu
    const clearSearchBtn = document.getElementById("btnClearSearch");
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", () => {
        if (globalSearchInput) globalSearchInput.value = "";
        this.currentSearchQuery = "";
        this.renderCurrentView();
      });
    }

    // 4. Gelişmiş Filtre Paneli Aç/Kapat
    const btnToggleFilter = document.getElementById("btnToggleFilter");
    const filterPanel = document.getElementById("advancedFilterPanel");
    if (btnToggleFilter && filterPanel) {
      btnToggleFilter.addEventListener("click", () => {
        filterPanel.classList.toggle("hidden");
      });
    }

    // 5. Filtre değişiklikleri
    const filterSelects = ["filterDurum", "filterOda", "filterDolap", "filterSortBy", "filterKategori"];
    filterSelects.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", (e) => {
          const key = id.replace("filter", "").toLowerCase();
          const mappedKey = key === "sortby" ? "sortBy" : key;
          this.filters[mappedKey] = e.target.value;
          this.renderCurrentView();
        });
      }
    });

    const filterLowStock = document.getElementById("filterLowStock");
    if (filterLowStock) {
      filterLowStock.addEventListener("change", (e) => {
        this.filters.lowStockOnly = e.target.checked;
        this.renderCurrentView();
      });
    }

    const btnResetFilters = document.getElementById("btnResetFilters");
    if (btnResetFilters) {
      btnResetFilters.addEventListener("click", () => {
        this.resetFilters();
      });
    }

    // 6. Barkod Tara Butonları
    const btnScanGlobal = document.getElementById("btnScanGlobal");
    if (btnScanGlobal) {
      btnScanGlobal.addEventListener("click", () => {
        BarcodeScannerService.startScan({ mode: "search" });
      });
    }

    const btnScanMobile = document.getElementById("btnScanMobile");
    if (btnScanMobile) {
      btnScanMobile.addEventListener("click", () => {
        BarcodeScannerService.startScan({ mode: "search" });
      });
    }

    const btnCloseScanner = document.getElementById("btnCloseScanner");
    if (btnCloseScanner) {
      btnCloseScanner.addEventListener("click", () => {
        BarcodeScannerService.stopScan();
      });
    }

    // 7. Yeni Eşya Ekleme Butonları
    const btnAddNewItem = document.getElementById("btnAddNewItem");
    if (btnAddNewItem) {
      btnAddNewItem.addEventListener("click", () => {
        this.openItemModal(null, this.currentSection === "elektronik" ? "elektronik" : "kutuphane");
      });
    }

    // 8. Eşya Formu Submit
    const itemForm = document.getElementById("itemForm");
    if (itemForm) {
      itemForm.addEventListener("submit", (e) => this.handleItemFormSubmit(e));
    }

    // 9. Durum Güncelleme Formu Submit (ZORUNLU NOT KONTROLÜ)
    const statusForm = document.getElementById("statusUpdateForm");
    if (statusForm) {
      statusForm.addEventListener("submit", (e) => this.handleStatusFormSubmit(e));
    }

    // 10. Konum Hiyerarşisi Dinleyicisi (Oda -> Dolap seçimi)
    const inputOda = document.getElementById("itemOda");
    if (inputOda) {
      inputOda.addEventListener("change", (e) => this.updateCabinetOptions(e.target.value));
    }

    // 11. Fotoğraf Yükleme ve Önizleme
    const photoInput = document.getElementById("itemPhotoFile");
    if (photoInput) {
      photoInput.addEventListener("change", (e) => this.handlePhotoUpload(e));
    }

    // 12. Modal Kapatma Düğmeleri
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const modalId = btn.getAttribute("data-close-modal");
        const modal = document.getElementById(modalId);
        if (modal) {
          modal.classList.add("hidden");
          modal.classList.remove("flex");
        }
      });
    });



    // 14. Dışa / İçe Aktarma Butonları
    const btnExportJSON = document.getElementById("btnExportJSON");
    if (btnExportJSON) btnExportJSON.addEventListener("click", () => DatabaseService.exportToJSON());

    const btnExportCSV = document.getElementById("btnExportCSV");
    if (btnExportCSV) btnExportCSV.addEventListener("click", () => DatabaseService.exportToCSV());

    const fileImportJSON = document.getElementById("fileImportJSON");
    if (fileImportJSON) {
      fileImportJSON.addEventListener("change", (e) => this.handleImportJSON(e));
    }

    const fileImportCSV = document.getElementById("fileImportCSV");
    if (fileImportCSV) {
      fileImportCSV.addEventListener("change", (e) => this.handleImportCSV(e));
    }

    // 15. Whitelist Ekleme Formu
    const whitelistForm = document.getElementById("whitelistForm");
    if (whitelistForm) {
      whitelistForm.addEventListener("submit", (e) => this.handleWhitelistAdd(e));
    }

    // 16. Firebase Yapılandırma Kaydetme
    const firebaseConfigForm = document.getElementById("firebaseConfigForm");
    if (firebaseConfigForm) {
      firebaseConfigForm.addEventListener("submit", (e) => this.handleFirebaseConfigSave(e));
    }

    // 17. Talep Yönetimi Formları
    const newRequestForm = document.getElementById("newRequestForm");
    if (newRequestForm) {
      newRequestForm.addEventListener("submit", (e) => this.handleNewRequestSubmit(e));
    }

    const requestActionForm = document.getElementById("requestActionForm");
    if (requestActionForm) {
      requestActionForm.addEventListener("submit", (e) => this.handleRequestActionSubmit(e));
    }

    // 18. Yönetici Yeni Talep Uyarı Banner Kapatma
    const btnCloseAlert = document.getElementById("btnCloseAdminRequestAlert");
    if (btnCloseAlert) {
      btnCloseAlert.addEventListener("click", () => {
        const banner = document.getElementById("adminNewRequestAlertBanner");
        if (banner) banner.classList.add("hidden");
      });
    }
  },

  // ================= ARAMA VE FİLTRELEME İŞLEMLERİ =================

  resetFilters() {
    this.filters = {
      type: "all",
      durum: "all",
      oda: "all",
      dolap: "all",
      kutu: "all",
      kategori: "all",
      lowStockOnly: false,
      sortBy: "isim-asc"
    };

    // Form elementlerini sıfırla
    const selects = ["filterDurum", "filterOda", "filterDolap", "filterSortBy", "filterKategori"];
    selects.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "all";
    });
    const lowStock = document.getElementById("filterLowStock");
    if (lowStock) lowStock.checked = false;
    const sortBy = document.getElementById("filterSortBy");
    if (sortBy) sortBy.value = "isim-asc";

    this.renderCurrentView();
    this.showToast("Filtreler sıfırlandı.", "info");
  },

  handleBarcodeSearch(scannedCode) {
    const input = document.getElementById("globalSearchInput");
    if (input) {
      input.value = scannedCode;
    }
    this.currentSearchQuery = scannedCode;

    // Eşyayı anında bulup detayını açmayı dene
    const allItems = DatabaseService.getItems();
    const exactMatch = allItems.find(it => it.barkod && it.barkod.trim().toLowerCase() === scannedCode.toLowerCase());

    if (exactMatch) {
      this.showToast(`🎯 Eşya bulundu: ${exactMatch.isim}`, "success");
      this.openItemDetailModal(exactMatch);
    } else {
      this.showToast(`🔍 Barkod ile arandı: ${scannedCode}`, "info");
      this.navigateTo("dashboard");
      this.renderCurrentView();
    }
  },

  // ================= RENDER MOTORU =================

  renderCurrentView() {
    if (this.currentSection === "dashboard") {
      this.renderDashboardStats();
      this.renderDashboardLists();
    } else if (this.currentSection === "kutuphane") {
      this.renderLibraryView();
    } else if (this.currentSection === "elektronik") {
      this.renderElectronicsView();
    } else if (this.currentSection === "talepler") {
      this.renderRequestsView();
    } else if (this.currentSection === "yonetim") {
      this.renderAdminView();
    }
  },

  // 1. DASHBOARD İSTATİSTİKLERİ
  renderDashboardStats() {
    const items = DatabaseService.getItems();

    const bookCount = items.filter((it) => it.type === "kutuphane").length;
    const electronicsCount = items.filter((it) => it.type === "elektronik").reduce((sum, it) => sum + (Number(it.adet) || 1), 0);
    const inUseCount = items.filter((it) => it.durum && it.durum !== "mevcut").length;
    const lowStockCount = items.filter((it) => (Number(it.adet) || 0) <= (Number(it.minStok) || 1)).length;

    const elBooks = document.getElementById("statBookCount");
    const elElec = document.getElementById("statElecCount");
    const elInUse = document.getElementById("statInUseCount");
    const elLowStock = document.getElementById("statLowStockCount");

    if (elBooks) elBooks.textContent = bookCount;
    if (elElec) elElec.textContent = electronicsCount;
    if (elInUse) elInUse.textContent = inUseCount;
    if (elLowStock) elLowStock.textContent = lowStockCount;
  },

  // 2. DASHBOARD LİSTELERİ ("Stokta Azalanlar" & "Kullanımda Olanlar")
  renderDashboardLists() {
    const allItems = DatabaseService.getItems();

    // Arama aktifse arama sonuçlarını da göster
    const searchResultsContainer = document.getElementById("dashboardSearchResults");
    const defaultWidgetsContainer = document.getElementById("dashboardDefaultWidgets");

    if (this.currentSearchQuery.length > 0) {
      if (searchResultsContainer) searchResultsContainer.classList.remove("hidden");
      if (defaultWidgetsContainer) defaultWidgetsContainer.classList.add("hidden");
      this.renderSearchResultsList();
      return;
    } else {
      if (searchResultsContainer) searchResultsContainer.classList.add("hidden");
      if (defaultWidgetsContainer) defaultWidgetsContainer.classList.remove("hidden");
    }

    // Stokta Azalanlar Listesi
    const lowStockItems = allItems.filter(
      (it) => (Number(it.adet) || 0) <= (Number(it.minStok) || 1)
    );
    const lowStockContainer = document.getElementById("dashboardLowStockList");
    if (lowStockContainer) {
      if (lowStockItems.length === 0) {
        lowStockContainer.innerHTML = `
          <div class="p-6 text-center text-slate-400 dark:text-slate-500">
            <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <p class="font-medium text-sm">Tüm stok seviyeleri yeterli!</p>
          </div>`;
      } else {
        lowStockContainer.innerHTML = lowStockItems
          .map((item) => this.renderLowStockCard(item))
          .join("");
      }
    }

    // Şu An Kullanımda / Ödünçte Olanlar Listesi
    const inUseItems = allItems.filter((it) => it.durum && it.durum !== "mevcut");
    const inUseContainer = document.getElementById("dashboardInUseList");
    if (inUseContainer) {
      if (inUseItems.length === 0) {
        inUseContainer.innerHTML = `
          <div class="p-6 text-center text-slate-400 dark:text-slate-500">
            <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"></path></svg>
            <p class="font-medium text-sm">Şu an kullanımda veya dışarıda eşya yok.</p>
          </div>`;
      } else {
        inUseContainer.innerHTML = inUseItems
          .map((item) => this.renderInUseCard(item))
          .join("");
      }
    }
  },

  // Arama sonuçları listesi (Dashboard için)
  renderSearchResultsList() {
    const allItems = DatabaseService.getItems();
    const results = FuzzySearchEngine.search(allItems, this.currentSearchQuery, this.filters);
    const container = document.getElementById("dashboardSearchResultsContent");
    const countBadge = document.getElementById("dashboardSearchCount");

    if (countBadge) countBadge.textContent = `${results.length} sonuç bulundu`;

    if (!container) return;
    if (results.length === 0) {
      container.innerHTML = `
        <div class="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p class="text-lg font-semibold text-slate-700 dark:text-slate-200">Aradığınız kriterlere uygun eşya bulunamadı.</p>
          <p class="text-sm text-slate-400 mt-1">Yazım hataları otomatik tolere edilmektedir. Farklı bir kelime deneyebilirsiniz.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${results.map((it) => this.renderItemCard(it)).join("")}
      </div>`;
  },

  // Notion / Obsidian Tarzı Hiyerarşik Konum Ağacı
  renderLocationTree() {
    const treeContainer = document.getElementById("locationHierarchyTree");
    if (!treeContainer) return;

    const items = DatabaseService.getItems();
    const tree = {};

    // Eşyaların konumlarına göre ağaç yapısını kur
    items.forEach((it) => {
      const room = it.oda || "Belirtilmemiş Oda";
      const cabinet = it.dolap || "Genel Raf";
      const box = it.kutu || "Genel Kutu";

      if (!tree[room]) tree[room] = { count: 0, cabinets: {} };
      tree[room].count++;

      if (!tree[room].cabinets[cabinet]) tree[room].cabinets[cabinet] = { count: 0, boxes: {} };
      tree[room].cabinets[cabinet].count++;

      if (!tree[room].cabinets[cabinet].boxes[box]) tree[room].cabinets[cabinet].boxes[box] = 0;
      tree[room].cabinets[cabinet].boxes[box]++;
    });

    let html = `<div class="space-y-2">`;

    Object.keys(tree).forEach((roomName) => {
      const roomData = tree[roomName];
      html += `
        <div class="border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-hidden bg-white/50 dark:bg-slate-800/50">
          <div class="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors" onclick="App.toggleTreeSection('room_${this.slugify(roomName)}')">
            <div class="flex items-center space-x-2.5">
              <span class="text-sky-500 font-bold">🏠</span>
              <span class="font-semibold text-slate-800 dark:text-slate-100 text-sm">${roomName}</span>
            </div>
            <div class="flex items-center space-x-2">
              <span class="text-xs px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-semibold">${roomData.count} eşya</span>
              <button onclick="event.stopPropagation(); App.filterByLocation('${roomName}', null, null)" class="text-xs text-slate-400 hover:text-sky-600 px-1 py-0.5" title="Sadece bu odayı filtrele">Filtrele</button>
            </div>
          </div>
          <div id="room_${this.slugify(roomName)}" class="pl-4 pr-2 pb-2 space-y-1.5 border-t border-slate-100 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-900/30">
      `;

      Object.keys(roomData.cabinets).forEach((cabinetName) => {
        const cabData = roomData.cabinets[cabinetName];
        html += `
          <div class="mt-1.5">
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/80 cursor-pointer text-xs" onclick="App.toggleTreeSection('cab_${this.slugify(roomName + cabinetName)}')">
              <div class="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
                <span class="text-emerald-500">📁</span>
                <span class="font-medium">${cabinetName}</span>
              </div>
              <div class="flex items-center space-x-1.5">
                <span class="text-[11px] text-slate-400 font-medium">${cabData.count} adet</span>
                <button onclick="event.stopPropagation(); App.filterByLocation('${roomName}', '${cabinetName}', null)" class="text-[11px] text-sky-600 dark:text-sky-400 hover:underline">Gör</button>
              </div>
            </div>
            <div id="cab_${this.slugify(roomName + cabinetName)}" class="pl-6 space-y-1 py-1">
        `;

        Object.keys(cabData.boxes).forEach((boxName) => {
          const boxCount = cabData.boxes[boxName];
          html += `
            <div class="flex items-center justify-between py-1 px-2 rounded hover:bg-sky-50 dark:hover:bg-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <span class="flex items-center space-x-1.5">
                <span class="text-amber-500">📦</span>
                <span>${boxName}</span>
              </span>
              <div class="flex items-center space-x-1.5">
                <span class="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded">${boxCount}</span>
                <button onclick="App.filterByLocation('${roomName}', '${cabinetName}', '${boxName}')" class="text-[10px] text-sky-600 hover:text-sky-700 font-semibold">Listele</button>
              </div>
            </div>
          `;
        });

        html += `</div></div>`;
      });

      html += `</div></div>`;
    });

    html += `</div>`;
    treeContainer.innerHTML = html;
  },

  toggleTreeSection(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.classList.toggle("hidden");
    }
  },

  filterByLocation(room, cabinet, box) {
    this.filters.oda = room || "all";
    this.filters.dolap = cabinet || "all";
    this.filters.kutu = box || "all";

    // Seçim kutularını senkronize et
    const filterOdaEl = document.getElementById("filterOda");
    if (filterOdaEl && room) filterOdaEl.value = room;

    const filterDolapEl = document.getElementById("filterDolap");
    if (filterDolapEl && cabinet) filterDolapEl.value = cabinet;

    this.showToast(`📍 Konum filtresi uygulandı: ${[room, cabinet, box].filter(Boolean).join(" > ")}`, "info");
    this.renderCurrentView();
  },

  // 3. KÜTÜPHANE GÖRÜNÜMÜ
  renderLibraryView() {
    const allItems = DatabaseService.getItems();
    const libraryFilters = { ...this.filters, type: "kutuphane" };
    const items = FuzzySearchEngine.search(allItems, this.currentSearchQuery, libraryFilters);

    const container = document.getElementById("libraryItemsContainer");
    const countEl = document.getElementById("libraryTotalCount");
    if (countEl) countEl.textContent = `${items.length} Kitap / Doküman`;

    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = this.renderEmptyState("Kütüphanede kayıtlı kitap bulunamadı.");
      return;
    }

    if (this.viewMode.kutuphane === "grid") {
      container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          ${items.map((it) => this.renderItemCard(it)).join("")}
        </div>`;
    } else {
      container.innerHTML = this.renderTableView(items);
    }
  },

  // 4. ELEKTRONİK TEÇHİZAT GÖRÜNÜMÜ
  renderElectronicsView() {
    const allItems = DatabaseService.getItems();
    const elecFilters = { ...this.filters, type: "elektronik" };
    const items = FuzzySearchEngine.search(allItems, this.currentSearchQuery, elecFilters);

    const container = document.getElementById("electronicsItemsContainer");
    const countEl = document.getElementById("electronicsTotalCount");
    if (countEl) countEl.textContent = `${items.length} Kalem Donanım`;

    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = this.renderEmptyState("Kayıtlı elektronik malzeme veya donanım bulunamadı.");
      return;
    }

    if (this.viewMode.elektronik === "grid") {
      container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          ${items.map((it) => this.renderItemCard(it)).join("")}
        </div>`;
    } else {
      container.innerHTML = this.renderTableView(items);
    }
  },

  // 5. YÖNETİM VE AYARLAR GÖRÜNÜMÜ (Admin Only)
  renderAdminView() {
    if (!AuthService.isAdmin()) {
      this.navigateTo("dashboard");
      return;
    }

    // Whitelist Tablosunu doldur
    const whitelist = DatabaseService.getWhitelist();
    const whitelistContainer = document.getElementById("adminWhitelistTable");
    if (whitelistContainer) {
      whitelistContainer.innerHTML = whitelist
        .map(
          (email) => `
        <tr class="border-b border-slate-100 dark:border-slate-800 text-sm">
          <td class="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
            ${email}
            ${email.toLowerCase() === APP_CONFIG.adminEmail ? '<span class="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">Yönetici (Admin)</span>' : '<span class="ml-2 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-semibold">Aile Üyesi</span>'}
          </td>
          <td class="py-3 px-4 text-right">
            ${
              email.toLowerCase() !== APP_CONFIG.adminEmail
                ? `<button onclick="App.handleRemoveWhitelist('${email}')" class="text-rose-500 hover:text-rose-700 text-xs font-semibold px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30">Kaldır</button>`
                : `<span class="text-xs text-slate-400">Sabit</span>`
            }
          </td>
        </tr>
      `
        )
        .join("");
    }

    // Mevcut Firebase Ayar durumunu göster ve form alanlarını doldur
    const activeConfig = DatabaseService.getSavedFirebaseConfig() || APP_CONFIG.firebaseConfig;
    const configStatus = document.getElementById("firebaseConnectionStatus");
    if (configStatus) {
      if (DatabaseService.isFirebaseActive) {
        configStatus.innerHTML = `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">✅ Firebase v13.0.0 Bulut Senkronizasyonu Aktif (${activeConfig ? activeConfig.projectId : "altf4-envanter"})</span>`;
      } else {
        configStatus.innerHTML = `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">⚠️ Çevrimdışı / Yerel Depo Modu (Firebase Yapılandırılmadı)</span>`;
      }
    }

    if (activeConfig) {
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = val || "";
      };
      setVal("fbApiKey", activeConfig.apiKey);
      setVal("fbAuthDomain", activeConfig.authDomain);
      setVal("fbProjectId", activeConfig.projectId);
      setVal("fbStorageBucket", activeConfig.storageBucket);
      setVal("fbMessagingSenderId", activeConfig.messagingSenderId);
      setVal("fbAppId", activeConfig.appId);
    }
  },

  // ================= 6. TALEP YÖNETİMİ GÖRÜNÜMÜ VE KONTROLCÜSÜ (REQUESTS) =================

  renderRequestsView() {
    const container = document.getElementById("requestsListContainer");
    if (!container) return;

    let requests = DatabaseService.getRequests();
    this.updateRequestsBadge(requests);

    // Filtreleme (all | bekliyor | onaylandi | reddedildi)
    if (this.requestFilterStatus && this.requestFilterStatus !== "all") {
      requests = requests.filter((r) => r.status === this.requestFilterStatus);
    }

    // Tarihe göre sırala (En yeni en üstte)
    requests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (requests.length === 0) {
      container.innerHTML = `
        <div class="p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-3xl">📭</div>
          <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm">Herhangi bir talep bulunamadı</h4>
          <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Bu filtre kriterine uyan bir kitap veya malzeme talebi bulunmuyor. Yeni bir talep oluşturmak için yukarıdaki '+ Yeni Talep Gönder' butonunu kullanabilirsiniz.</p>
        </div>
      `;
      return;
    }

    const isAdmin = AuthService.isAdmin();
    const currentEmail = AuthService.currentUser ? AuthService.currentUser.email : "";

    container.innerHTML = requests
      .map((req) => {
        const isLibrary = req.itemType === "kutuphane";
        const typeBadge = isLibrary
          ? `<span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300"><span>📖</span><span>Kitap / Doküman</span></span>`
          : `<span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"><span>⚡</span><span>Elektronik Komponent</span></span>`;

        let statusBadge = "";
        if (req.status === "onaylandi") {
          statusBadge = `<span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-sm"><span>✅</span><span>Onaylandı</span></span>`;
        } else if (req.status === "reddedildi") {
          statusBadge = `<span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-sm"><span>❌</span><span>Reddedildi</span></span>`;
        } else {
          statusBadge = `<span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-sm"><span>⏳</span><span>Beklemede</span></span>`;
        }

        const dateStr = req.createdAt
          ? new Date(req.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
          : "Tarih bilinmiyor";

        const authorOrModelHtml = req.authorOrModel || req.author || req.model
          ? `<div class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5"><span class="font-semibold text-slate-600 dark:text-slate-300">${isLibrary ? "Yazar" : "Model"}:</span> ${req.authorOrModel || req.author || req.model}</div>`
          : "";

        const adminNoteHtml = req.adminNote
          ? `
            <div class="mt-3 p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-800/60 text-xs">
              <div class="font-bold text-sky-900 dark:text-sky-200 flex items-center space-x-1 mb-0.5">
                <span>👑</span>
                <span>Yönetici Notu:</span>
              </div>
              <p class="text-sky-800 dark:text-sky-300">${req.adminNote}</p>
            </div>
          `
          : "";

        // Eylemler
        let actionsHtml = "";
        const isOwner = currentEmail && req.requesterEmail && currentEmail.toLowerCase() === req.requesterEmail.toLowerCase();

        if (isAdmin) {
          actionsHtml = `
            <div class="flex flex-wrap items-center gap-1.5 pt-2 sm:pt-0">
              ${
                req.status === "bekliyor"
                  ? `
                    <button onclick="App.openRequestActionModal('${req.id}', 'onaylandi')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center space-x-1 shadow-sm">
                      <span>✓</span>
                      <span>Onayla</span>
                    </button>
                    <button onclick="App.openRequestActionModal('${req.id}', 'reddedildi')" class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors flex items-center space-x-1 shadow-sm">
                      <span>✕</span>
                      <span>Reddet</span>
                    </button>
                  `
                  : `
                    <button onclick="App.openRequestActionModal('${req.id}', '${req.status === "onaylandi" ? "reddedildi" : "onaylandi"}')" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors">
                      Durumu Değiştir
                    </button>
                  `
              }
              ${
                req.status === "onaylandi"
                  ? `
                    <button onclick="App.convertRequestToItem('${req.id}')" class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-colors flex items-center space-x-1 shadow-sm">
                      <span>📦</span>
                      <span>Envantere Ekle</span>
                    </button>
                  `
                  : ""
              }
              <button onclick="App.confirmDeleteRequest('${req.id}')" class="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs transition-colors" title="Talebi Sil">
                🗑️
              </button>
            </div>
          `;
        } else if (isOwner && req.status === "bekliyor") {
          actionsHtml = `
            <div class="pt-2 sm:pt-0">
              <button onclick="App.confirmDeleteRequest('${req.id}')" class="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-semibold text-xs transition-colors">
                Talebi İptal Et
              </button>
            </div>
          `;
        }

        return `
          <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div class="space-y-1.5 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  ${typeBadge}
                  ${statusBadge}
                  <span class="text-[11px] text-slate-400 font-medium">🕒 ${dateStr}</span>
                </div>
                <h3 class="text-base font-extrabold text-slate-900 dark:text-white pt-1">${req.title}</h3>
                ${authorOrModelHtml}
                <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">${req.description}</p>
                <div class="pt-1 flex items-center space-x-1.5 text-[11px] text-slate-400">
                  <span>👤 Talep Eden:</span>
                  <span class="font-bold text-slate-700 dark:text-slate-300">${req.requesterName || "Aile Üyesi"}</span>
                  <span>(${req.requesterEmail || "-"})</span>
                </div>
                ${adminNoteHtml}
              </div>
              ${actionsHtml}
            </div>
          </div>
        `;
      })
      .join("");
  },

  updateRequestsBadge(requests = null) {
    const all = requests || DatabaseService.getRequests();
    const pendingCount = all.filter((r) => r.status === "bekliyor").length;

    // 1. Talepler sayfasındaki başlık rozeti (#requestsCountBadge)
    const badge = document.getElementById("requestsCountBadge");
    if (badge) {
      badge.textContent = `${all.length} talep (${pendingCount} bekleyen)`;
    }

    // 2. Masaüstü Navigasyon Rozeti (#navRequestBadge)
    const navBadge = document.getElementById("navRequestBadge");
    if (navBadge) {
      if (pendingCount > 0) {
        navBadge.textContent = pendingCount;
        navBadge.classList.remove("hidden");
        navBadge.classList.add("inline-flex");
      } else {
        navBadge.classList.add("hidden");
        navBadge.classList.remove("inline-flex");
      }
    }

    // 3. Mobil Alt Menü Rozeti (#mobileNavRequestBadge)
    const mobileBadge = document.getElementById("mobileNavRequestBadge");
    if (mobileBadge) {
      if (pendingCount > 0) {
        mobileBadge.textContent = pendingCount;
        mobileBadge.classList.remove("hidden");
        mobileBadge.classList.add("inline-block");
      } else {
        mobileBadge.classList.add("hidden");
        mobileBadge.classList.remove("inline-block");
      }
    }
  },

  handleNewRequestNotification(req) {
    if (!req) return;

    // Yinelenen bildirimleri önleme (1.5 saniye içinde aynı talep için tekrar tetiklenmesini engeller)
    const now = Date.now();
    if (this.lastNotifiedRequestId === req.id && (now - this.lastNotifiedAt) < 1500) {
      return;
    }
    this.lastNotifiedRequestId = req.id;
    this.lastNotifiedAt = now;

    // Toast bildirimi: APP_CONFIG.messages.new_request_notification ("Yeni bir talep oluşturuldu!")
    const baseMsg = (APP_CONFIG.messages && APP_CONFIG.messages.new_request_notification) || "Yeni bir talep oluşturuldu!";
    const reqTitle = req.title ? ` (${req.title})` : "";
    this.showToast(`${baseMsg}${reqTitle}`, "info");

    // Yönetici Ekranında Canlı Banner Gösterimi
    if (AuthService.isAdmin()) {
      const banner = document.getElementById("adminNewRequestAlertBanner");
      const bannerText = document.getElementById("adminNewRequestAlertText");
      if (banner && bannerText) {
        const requester = req.requesterName || req.requesterEmail || "Aile Üyesi";
        bannerText.textContent = `${requester}: "${req.title || 'Yeni Talep'}" - ${req.description || ''}`;
        banner.classList.remove("hidden");
      }
    }

    // Bildirim rozetlerini anında güncelle
    this.updateRequestsBadge();

    // Eğer şu an talepler sayfasındaysak listeyi de canlı olarak yeniden çiz
    if (this.currentSection === "talepler") {
      this.renderRequestsView();
    }
  },

  filterRequestsByStatus(status) {
    this.requestFilterStatus = status;

    const filterBtns = {
      all: document.getElementById("reqFilterAll"),
      bekliyor: document.getElementById("reqFilterPending"),
      onaylandi: document.getElementById("reqFilterApproved"),
      reddedildi: document.getElementById("reqFilterRejected")
    };

    Object.entries(filterBtns).forEach(([key, btn]) => {
      if (!btn) return;
      if (key === status) {
        btn.className = "px-3 py-1.5 rounded-xl font-bold bg-sky-500 text-white transition-colors shadow-sm";
      } else {
        btn.className = "px-3 py-1.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors";
      }
    });

    this.renderRequestsView();
  },

  openNewRequestModal() {
    if (!AuthService.isAuthorized()) {
      this.showToast("Talep göndermek için giriş yapmış veya yetkili olmalısınız.", "warning");
      return;
    }
    const form = document.getElementById("newRequestForm");
    if (form) form.reset();
    const modal = document.getElementById("newRequestModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  },

  async handleNewRequestSubmit(e) {
    e.preventDefault();
    if (!AuthService.isAuthorized()) {
      this.showToast("Talep göndermek için yetkili olmalısınız.", "warning");
      return;
    }

    const itemType = document.getElementById("requestItemType").value;
    const title = document.getElementById("requestTitle").value.trim();
    const authorOrModel = document.getElementById("requestAuthorOrModel").value.trim();
    const description = document.getElementById("requestDescription").value.trim();

    if (!title || !description) {
      this.showToast("Lütfen zorunlu alanları (*) doldurunuz.", "warning");
      return;
    }

    const currentUser = AuthService.currentUser;
    const reqData = {
      itemType,
      title,
      authorOrModel,
      description,
      requesterEmail: currentUser ? currentUser.email : "aile.altf4@gmail.com",
      requesterName: currentUser ? (currentUser.displayName || currentUser.email.split("@")[0]) : "Aile Üyesi",
      status: "bekliyor",
      adminNote: "",
      createdAt: new Date().toISOString()
    };

    try {
      await DatabaseService.addRequest(reqData);
      const modal = document.getElementById("newRequestModal");
      if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
      }
      document.getElementById("newRequestForm").reset();
      this.showToast("📬 Talebiniz başarıyla yöneticiye iletildi!", "success");
      this.renderRequestsView();
    } catch (err) {
      this.showToast("Talep gönderilirken hata oluştu: " + err.message, "error");
    }
  },

  openRequestActionModal(requestId, targetStatus) {
    if (!AuthService.isAdmin()) {
      this.showToast("Bu işlemi yalnızca Yönetici yapabilir.", "warning");
      return;
    }
    const req = DatabaseService.getRequestById(requestId);
    if (!req) return;

    document.getElementById("actionRequestId").value = requestId;
    document.getElementById("actionTargetStatus").value = targetStatus;

    const modalTitle = document.getElementById("requestActionModalTitle");
    const submitBtn = document.getElementById("btnSubmitRequestAction");
    const reqTitle = document.getElementById("actionRequestTitle");
    const requesterInfo = document.getElementById("actionRequesterInfo");
    const reqDesc = document.getElementById("actionRequestDescription");
    const noteInput = document.getElementById("actionAdminNote");

    if (modalTitle) {
      modalTitle.textContent = targetStatus === "onaylandi" ? "Talebi Onayla" : "Talebi Reddet";
    }

    if (submitBtn) {
      if (targetStatus === "onaylandi") {
        submitBtn.textContent = "✓ Onayla ve Kaydet";
        submitBtn.className = "px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors";
      } else {
        submitBtn.textContent = "✕ Reddet ve Kaydet";
        submitBtn.className = "px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors";
      }
    }

    if (reqTitle) reqTitle.textContent = req.title;
    if (requesterInfo) requesterInfo.textContent = `${req.requesterName || "Aile Üyesi"} (${req.requesterEmail || "-"})`;
    if (reqDesc) reqDesc.textContent = req.description || "";
    if (noteInput) noteInput.value = req.adminNote || "";

    const modal = document.getElementById("requestActionModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  },

  async handleRequestActionSubmit(e) {
    e.preventDefault();
    if (!AuthService.isAdmin()) {
      this.showToast("Bu işlemi yalnızca Yönetici yapabilir.", "warning");
      return;
    }

    const reqId = document.getElementById("actionRequestId").value;
    const targetStatus = document.getElementById("actionTargetStatus").value;
    const adminNote = document.getElementById("actionAdminNote").value.trim();

    try {
      await DatabaseService.updateRequestStatus(reqId, targetStatus, adminNote);
      const modal = document.getElementById("requestActionModal");
      if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
      }
      this.showToast(targetStatus === "onaylandi" ? "✅ Talep onaylandı!" : "❌ Talep reddedildi.", "success");
      this.renderRequestsView();
      this.updateRequestsBadge();
      const allPending = DatabaseService.getRequests().filter(r => r.status === "bekliyor");
      if (allPending.length === 0) {
        const banner = document.getElementById("adminNewRequestAlertBanner");
        if (banner) banner.classList.add("hidden");
      }
    } catch (err) {
      this.showToast("İşlem hatası: " + err.message, "error");
    }
  },

  convertRequestToItem(reqId) {
    if (!AuthService.canAddItem()) {
      this.showToast("Eşya ekleme yetkiniz bulunmuyor (Yalnızca Yönetici).", "warning");
      return;
    }
    const req = DatabaseService.getRequestById(reqId);
    if (!req) return;

    this.openItemModal(null, req.itemType || "kutuphane");
    const nameInput = document.getElementById("itemIsim");
    if (nameInput) nameInput.value = req.title || "";

    if (req.itemType === "kutuphane") {
      const yazarInput = document.getElementById("itemYazar");
      if (yazarInput) yazarInput.value = req.authorOrModel || req.author || "";
    } else {
      const modelInput = document.getElementById("itemModel");
      if (modelInput) modelInput.value = req.authorOrModel || req.model || "";
    }

    const ozelliklerInput = document.getElementById("itemOzellikler");
    if (ozelliklerInput) {
      ozelliklerInput.value = `[Talep Eden: ${req.requesterName || req.requesterEmail || "Aile Üyesi"}] ${req.description || ""}`;
    }

    this.showToast("📦 Talep detayları eşya formuna aktarıldı. Konum ve adet belirleyerek envantere ekleyebilirsiniz.", "info");
  },

  async confirmDeleteRequest(reqId) {
    const req = DatabaseService.getRequestById(reqId);
    if (!req) return;

    const currentEmail = AuthService.currentUser ? AuthService.currentUser.email : "";
    const isOwner = currentEmail && req.requesterEmail && currentEmail.toLowerCase() === req.requesterEmail.toLowerCase();

    if (!AuthService.isAdmin() && !isOwner) {
      this.showToast("Bu talebi silme veya iptal etme yetkiniz bulunmuyor.", "warning");
      return;
    }

    if (confirm(`'${req.title}' talebini silmek istediğinize emin misiniz?`)) {
      try {
        await DatabaseService.deleteRequest(reqId);
        this.showToast("Talep silindi.", "info");
        this.renderRequestsView();
      } catch (err) {
        this.showToast("Silinirken hata oluştu: " + err.message, "error");
      }
    }
  },

  // ================= KART VE BİLEŞEN ŞABLONLARI =================

  renderItemCard(item) {
    const isLibrary = item.type === "kutuphane";
    const statusObj = APP_CONFIG.statusOptions.find((s) => s.id === item.durum) || APP_CONFIG.statusOptions[0];
    const isLowStock = (Number(item.adet) || 0) <= (Number(item.minStok) || 1);
    const canEdit = AuthService.canEditItem();
    const canUpdateStatus = AuthService.canUpdateStatus();

    const statusBadgeClass = {
      emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      blue: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200 dark:border-sky-800",
      indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
      amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800"
    }[statusObj.color] || "bg-slate-100 text-slate-700";

    const defaultImg = isLibrary
      ? "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80"
      : "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=300&q=80";

    const photoSrc = item.fotograf || defaultImg;

    return `
      <div class="group relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between">
        <div>
          <!-- Resim ve Durum Rozeti -->
          <div class="relative h-44 w-full bg-slate-100 dark:bg-slate-900 overflow-hidden cursor-pointer" onclick="App.openItemDetailModalById('${item.id}')">
            <img src="${photoSrc}" alt="${item.isim}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" onerror="this.src='${defaultImg}'" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            
            <!-- Durum Rozeti -->
            <div class="absolute top-3 left-3">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-md shadow-sm ${statusBadgeClass}">
                ● ${statusObj.label}
              </span>
            </div>

            <!-- Stok Uyarı Rozeti -->
            <div class="absolute top-3 right-3">
              <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${
                isLowStock
                  ? 'bg-rose-500/90 text-white animate-pulse'
                  : 'bg-black/50 text-white backdrop-blur-md'
              }">
                ${item.adet} Adet
              </span>
            </div>

            <!-- Tür İkonu -->
            <div class="absolute bottom-2 left-3 text-white font-medium text-xs flex items-center space-x-1.5 drop-shadow">
              <span>${isLibrary ? "📖 Kitap" : "⚡ Elektronik"}</span>
              ${item.kategori ? `<span>• ${item.kategori}</span>` : ""}
            </div>
          </div>

          <!-- İçerik -->
          <div class="p-4 space-y-2">
            <h3 class="font-bold text-slate-800 dark:text-slate-100 text-base line-clamp-1 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer" onclick="App.openItemDetailModalById('${item.id}')">
              ${item.isim}
            </h3>

            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
              ${isLibrary ? (item.yazar ? `Yazar: ${item.yazar}` : "Yazar belirtilmemiş") : (item.model ? `Model: ${item.model}` : "Model belirtilmemiş")}
            </p>

            <!-- Hiyerarşik Konum Yolu (Obsidian/Notion tarzı) -->
            <div class="pt-1">
              <div class="text-[11px] bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 p-2 rounded-lg flex items-center space-x-1 overflow-hidden truncate">
                <span class="font-semibold text-sky-600 dark:text-sky-400">🏠 ${item.oda || "Oda Yok"}</span>
                <span class="text-slate-400">›</span>
                <span>📁 ${item.dolap || "Raf"}</span>
                <span class="text-slate-400">›</span>
                <span>📦 ${item.kutu || "Kutu"}</span>
              </div>
            </div>

            <!-- Durum Notu (Eğer varsa) -->
            ${
              item.durumNotu
                ? `
              <div class="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200/50 dark:border-amber-900/40 line-clamp-2">
                <span class="font-semibold">Not:</span> ${item.durumNotu}
              </div>`
                : ""
            }
          </div>
        </div>

        <!-- Alt İşlem Butonları -->
        <div class="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
          <!-- Hızlı Stok Düğmeleri (Admin) -->
          <div class="flex items-center space-x-1">
            ${
              canEdit
                ? `
              <button onclick="App.quickStockChange('${item.id}', -1)" class="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center">-</button>
              <span class="font-bold px-1 text-slate-700 dark:text-slate-300">${item.adet}</span>
              <button onclick="App.quickStockChange('${item.id}', 1)" class="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center">+</button>
            `
                : `<span class="text-slate-500 font-medium">Stok: <b>${item.adet}</b></span>`
            }
          </div>

          <!-- Aksiyonlar (Durum Değiştir / Düzenle) -->
          <div class="flex items-center space-x-1.5">
            ${
              canUpdateStatus
                ? `
              <button onclick="App.openStatusUpdateModal('${item.id}')" class="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300 font-semibold transition-colors">
                Durum Değiştir
              </button>
            `
                : ""
            }

            ${
              canEdit
                ? `
              <button onclick="App.openItemModal('${item.id}')" class="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded" title="Düzenle">
                ✏️
              </button>
              <button onclick="App.confirmDeleteItem('${item.id}')" class="p-1 text-rose-400 hover:text-rose-600 rounded" title="Sil">
                🗑️
              </button>
            `
                : ""
            }
          </div>
        </div>
      </div>
    `;
  },

  renderLowStockCard(item) {
    const canEdit = AuthService.canEditItem();
    return `
      <div class="flex items-center justify-between p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl hover:bg-rose-50 transition-colors">
        <div class="flex items-center space-x-3 overflow-hidden">
          <div class="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 flex items-center justify-center font-bold text-sm shrink-0">
            ⚠️
          </div>
          <div class="overflow-hidden">
            <h4 class="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">${item.isim}</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
              📍 ${item.oda} > ${item.dolap} | Min: ${item.minStok} Adet
            </p>
          </div>
        </div>
        <div class="flex items-center space-x-2 shrink-0">
          <span class="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs">
            ${item.adet} Adet Kaldı
          </span>
          ${
            canEdit
              ? `
            <button onclick="App.quickStockChange('${item.id}', 1)" class="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center text-sm shadow-sm" title="1 Adet Arttır">
              +1
            </button>
          `
              : ""
          }
        </div>
      </div>
    `;
  },

  renderInUseCard(item) {
    const statusObj = APP_CONFIG.statusOptions.find((s) => s.id === item.durum) || APP_CONFIG.statusOptions[1];
    const canUpdateStatus = AuthService.canUpdateStatus();

    return `
      <div class="p-3.5 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 rounded-xl space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2 overflow-hidden">
            <span class="text-xs px-2 py-0.5 rounded-full font-semibold bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300">
              ${statusObj.label}
            </span>
            <h4 class="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">${item.isim}</h4>
          </div>
          ${
            canUpdateStatus
              ? `
            <button onclick="App.returnItemToLocation('${item.id}')" class="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm" title="Eşyayı yerine geri koy">
              Teslim Alındı (Yerinde)
            </button>
          `
              : ""
          }
        </div>
        <div class="text-xs text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-800/70 p-2 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
          <p class="font-medium text-sky-700 dark:text-sky-400">📍 Nerede / Kimde: <span class="font-normal text-slate-800 dark:text-slate-200">${item.durumNotu || "Açıklama girilmemiş"}</span></p>
          ${item.sonGuncelleyen ? `<p class="text-[11px] text-slate-400 mt-0.5">Son İşlem Yapan: ${item.sonGuncelleyen}</p>` : ""}
        </div>
      </div>
    `;
  },

  renderTableView(items) {
    const canEdit = AuthService.canEditItem();
    const canUpdateStatus = AuthService.canUpdateStatus();

    return `
      <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
              <th class="py-3 px-4">İsim / Detay</th>
              <th class="py-3 px-4">Tür & Kategori</th>
              <th class="py-3 px-4">Hiyerarşik Konum</th>
              <th class="py-3 px-4 text-center">Adet</th>
              <th class="py-3 px-4">Durum & Not</th>
              <th class="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
            ${items
              .map((it) => {
                const statusObj = APP_CONFIG.statusOptions.find((s) => s.id === it.durum) || APP_CONFIG.statusOptions[0];
                return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td class="py-3 px-4">
                    <div class="font-bold text-slate-800 dark:text-slate-100 cursor-pointer hover:text-sky-600" onclick="App.openItemDetailModalById('${it.id}')">${it.isim}</div>
                    <div class="text-[11px] text-slate-400">${it.yazar || it.model || it.barkod || ""}</div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">${it.type === "kutuphane" ? "Kitap" : "Elektronik"}</span>
                    <div class="text-[10px] text-slate-400 mt-0.5">${it.kategori || "-"}</div>
                  </td>
                  <td class="py-3 px-4">
                    <div class="text-slate-700 dark:text-slate-300 font-medium">${it.oda} > ${it.dolap}</div>
                    <div class="text-[10px] text-slate-400">📦 ${it.kutu}</div>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <span class="font-bold ${Number(it.adet) <= Number(it.minStok) ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}">${it.adet}</span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300">
                      ${statusObj.label}
                    </span>
                    ${it.durumNotu ? `<div class="text-[11px] text-slate-500 truncate max-w-xs mt-0.5" title="${it.durumNotu}">${it.durumNotu}</div>` : ""}
                  </td>
                  <td class="py-3 px-4 text-right space-x-1">
                    ${
                      canUpdateStatus
                        ? `<button onclick="App.openStatusUpdateModal('${it.id}')" class="px-2 py-1 rounded bg-sky-50 dark:bg-sky-950 text-sky-600 font-semibold hover:bg-sky-100">Durum</button>`
                        : ""
                    }
                    ${
                      canEdit
                        ? `<button onclick="App.openItemModal('${it.id}')" class="p-1 text-slate-400 hover:text-slate-700">✏️</button>`
                        : ""
                    }
                  </td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  },

  renderEmptyState(message) {
    return `
      <div class="p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 my-4 shadow-sm">
        <div class="w-16 h-16 mx-auto mb-3 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-500 flex items-center justify-center text-2xl">
          🔍
        </div>
        <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">${message}</h3>
        <p class="text-xs text-slate-400 mt-1">Arama terimlerinizi temizleyin veya yeni bir eşya ekleyin.</p>
      </div>
    `;
  },

  // ================= MODALLAR VE FORM İŞLEMLERİ =================

  // 1. Yeni / Düzenleme Eşya Modalı
  openItemModal(itemId = null, defaultType = "kutuphane") {
    if (!AuthService.canAddItem()) {
      this.showToast("Eşya ekleme veya düzenleme yetkiniz bulunmuyor (Yalnızca Yönetici).", "warning");
      return;
    }

    this.editingItemId = itemId;
    const modal = document.getElementById("itemModal");
    const form = document.getElementById("itemForm");
    const titleEl = document.getElementById("itemModalTitle");

    form.reset();

    // Dinamik Kategori ve Konum seçeneklerini doldur
    this.populateLocationAndCategoryDropdowns();

    if (itemId) {
      const item = DatabaseService.getItemById(itemId);
      if (!item) return;

      titleEl.textContent = "Eşyayı Düzenle";
      document.getElementById("itemType").value = item.type || "kutuphane";
      document.getElementById("itemIsim").value = item.isim || "";
      document.getElementById("itemAdet").value = item.adet || 1;
      document.getElementById("itemMinStok").value = item.minStok || 1;
      document.getElementById("itemBarkod").value = item.barkod || "";
      document.getElementById("itemDurum").value = item.durum || "mevcut";
      document.getElementById("itemOzellikler").value = item.ozellikler || "";
      document.getElementById("itemPhotoUrl").value = item.fotograf || "";

      this.updateFormFieldsForType(item.type);

      if (item.type === "kutuphane") {
        document.getElementById("itemYazar").value = item.yazar || "";
      } else {
        document.getElementById("itemModel").value = item.model || "";
      }

      // Konumları seç
      document.getElementById("itemOda").value = item.oda || "Çalışma Odası";
      this.updateCabinetOptions(item.oda || "Çalışma Odası");
      document.getElementById("itemDolap").value = item.dolap || "";
      document.getElementById("itemKutu").value = item.kutu || "";
      document.getElementById("itemKategori").value = item.kategori || "";
    } else {
      titleEl.textContent = "Yeni Eşya / Malzeme Ekle";
      document.getElementById("itemType").value = defaultType;
      this.updateFormFieldsForType(defaultType);
      this.updateCabinetOptions("Çalışma Odası");
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  },

  updateFormFieldsForType(type) {
    const libraryFields = document.getElementById("formLibraryFields");
    const electronicFields = document.getElementById("formElectronicFields");
    const categorySelect = document.getElementById("itemKategori");

    if (type === "kutuphane") {
      if (libraryFields) libraryFields.classList.remove("hidden");
      if (electronicFields) electronicFields.classList.add("hidden");

      // Kütüphane kategorilerini yükle
      if (categorySelect) {
        categorySelect.innerHTML = APP_CONFIG.libraryCategories
          .map((c) => `<option value="${c}">${c}</option>`)
          .join("");
      }
    } else {
      if (libraryFields) libraryFields.classList.add("hidden");
      if (electronicFields) electronicFields.classList.remove("hidden");

      // Elektronik kategorilerini yükle
      if (categorySelect) {
        categorySelect.innerHTML = APP_CONFIG.electronicsCategories
          .map((c) => `<option value="${c}">${c}</option>`)
          .join("");
      }
    }
  },

  populateLocationAndCategoryDropdowns() {
    const odaSelect = document.getElementById("itemOda");
    if (odaSelect) {
      odaSelect.innerHTML = APP_CONFIG.defaultLocations.rooms
        .map((r) => `<option value="${r}">${r}</option>`)
        .join("");
    }
  },

  updateCabinetOptions(selectedRoom) {
    const dolapSelect = document.getElementById("itemDolap");
    if (!dolapSelect) return;

    const cabinets = APP_CONFIG.defaultLocations.cabinets.filter((c) => c.room === selectedRoom);
    dolapSelect.innerHTML = cabinets
      .map((c) => `<option value="${c.name}">${c.name}</option>`)
      .join("");

    if (cabinets.length > 0) {
      this.updateBoxOptions(cabinets[0].name);
    }
  },

  updateBoxOptions(selectedCabinet) {
    const kutuSelect = document.getElementById("itemKutu");
    if (!kutuSelect) return;

    const boxes = APP_CONFIG.defaultLocations.boxes.filter((b) => b.cabinet === selectedCabinet);
    if (boxes.length > 0) {
      kutuSelect.innerHTML = boxes.map((b) => `<option value="${b.name}">${b.name}</option>`).join("");
    } else {
      kutuSelect.innerHTML = `<option value="Genel Kutu">Genel Kutu</option><option value="Çekmece 1">Çekmece 1</option>`;
    }
  },

  async handleItemFormSubmit(e) {
    e.preventDefault();

    const type = document.getElementById("itemType").value;
    const isim = document.getElementById("itemIsim").value.trim();
    if (!isim) {
      this.showToast("Lütfen eşya ismini giriniz.", "warning");
      return;
    }

    const itemData = {
      type,
      isim,
      adet: parseInt(document.getElementById("itemAdet").value, 10) || 1,
      minStok: parseInt(document.getElementById("itemMinStok").value, 10) || 1,
      oda: document.getElementById("itemOda").value,
      dolap: document.getElementById("itemDolap").value,
      kutu: document.getElementById("itemKutu").value,
      kategori: document.getElementById("itemKategori").value,
      barkod: document.getElementById("itemBarkod").value.trim(),
      durum: document.getElementById("itemDurum").value,
      ozellikler: document.getElementById("itemOzellikler").value.trim(),
      fotograf: document.getElementById("itemPhotoUrl").value.trim()
    };

    if (type === "kutuphane") {
      itemData.yazar = document.getElementById("itemYazar").value.trim();
    } else {
      itemData.model = document.getElementById("itemModel").value.trim();
    }

    try {
      if (this.editingItemId) {
        await DatabaseService.updateItem(this.editingItemId, itemData);
        this.showToast("Eşya başarıyla güncellendi.", "success");
      } else {
        await DatabaseService.addItem(itemData);
        this.showToast("Yeni eşya envantere kaydedildi.", "success");
      }

      // Modalı kapat
      const modal = document.getElementById("itemModal");
      if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
      }
    } catch (err) {
      this.showToast("Kayıt sırasında hata: " + err.message, "error");
    }
  },

  // Fotoğraf Yükleme ve Canvas ile İstemci Tarafında Sıkıştırma (< 80KB WebP)
  handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 600;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // WebP formatında optimize et
        const dataUrl = canvas.toDataURL("image/webp", 0.75);
        document.getElementById("itemPhotoUrl").value = dataUrl;
        this.showToast("Fotoğraf optimize edildi ve eklendi.", "success");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  },

  // 2. Durum Güncelleme Modalı (ZORUNLU NOT KONTROLÜ)
  openStatusUpdateModal(itemId) {
    if (!AuthService.canUpdateStatus()) {
      this.showToast("Durum güncellemek için giriş yapmış bir aile üyesi olmalısınız.", "warning");
      return;
    }

    const item = DatabaseService.getItemById(itemId);
    if (!item) return;

    this.activeItemForStatusUpdate = item;

    const modal = document.getElementById("statusUpdateModal");
    document.getElementById("statusItemTitle").textContent = item.isim;
    document.getElementById("statusItemId").value = item.id;
    document.getElementById("statusSelect").value = item.durum || "kullanimda";
    document.getElementById("statusNoteInput").value = item.durumNotu || "";

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  },

  async handleStatusFormSubmit(e) {
    e.preventDefault();
    if (!this.activeItemForStatusUpdate) return;

    const newStatus = document.getElementById("statusSelect").value;
    const note = document.getElementById("statusNoteInput").value.trim();

    // Zorunlu Açıklama Kontrolü (Acceptance criteria)
    if (!note) {
      this.showToast("⚠️ Lütfen 'Nerede kullanılıyor / Kimde?' notunu doldurunuz!", "warning");
      document.getElementById("statusNoteInput").focus();
      return;
    }

    try {
      const userEmail = AuthService.currentUser ? AuthService.currentUser.email : "Aile Üyesi";
      await DatabaseService.updateStatus(this.activeItemForStatusUpdate.id, newStatus, note, userEmail);

      this.showToast("Eşya durumu ve konumu başarıyla güncellendi.", "success");

      const modal = document.getElementById("statusUpdateModal");
      if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
      }
    } catch (err) {
      this.showToast(err.message, "error");
    }
  },

  // Eşyayı tek tıkla yerine geri koyma
  async returnItemToLocation(itemId) {
    if (!AuthService.canUpdateStatus()) {
      this.showToast("Yetkiniz bulunmuyor.", "warning");
      return;
    }
    try {
      const userEmail = AuthService.currentUser ? AuthService.currentUser.email : "Aile Üyesi";
      await DatabaseService.updateStatus(itemId, "mevcut", "Kendi yerine geri teslim edildi.", userEmail);
      this.showToast("Eşya 'Mevcut' olarak yerine teslim alındı.", "success");
    } catch (err) {
      this.showToast(err.message, "error");
    }
  },

  // Hızlı Stok Güncelleme
  async quickStockChange(itemId, delta) {
    if (!AuthService.canEditItem()) {
      this.showToast("Stok değiştirme yetkiniz bulunmuyor.", "warning");
      return;
    }
    try {
      await DatabaseService.updateStock(itemId, delta);
    } catch (err) {
      this.showToast(err.message, "error");
    }
  },

  // Eşya Silme Onayı
  async confirmDeleteItem(itemId) {
    if (!AuthService.canDeleteItem()) {
      this.showToast("Silme yetkiniz bulunmuyor.", "warning");
      return;
    }
    const item = DatabaseService.getItemById(itemId);
    if (!item) return;

    if (confirm(`'${item.isim}' eşyasını silmek istediğinize emin misiniz?`)) {
      await DatabaseService.deleteItem(itemId);
      this.showToast("Eşya envanterden silindi.", "info");
    }
  },

  // 3. Eşya Detay Modalı (Tüm Bilgileri İnceleme)
  openItemDetailModalById(id) {
    const item = DatabaseService.getItemById(id);
    if (item) this.openItemDetailModal(item);
  },

  openItemDetailModal(item) {
    const modal = document.getElementById("itemDetailModal");
    if (!modal) return;

    const isLibrary = item.type === "kutuphane";
    const statusObj = APP_CONFIG.statusOptions.find((s) => s.id === item.durum) || APP_CONFIG.statusOptions[0];

    document.getElementById("detailModalTitle").textContent = item.isim;
    document.getElementById("detailModalType").textContent = isLibrary ? "Kitap / Doküman" : "Elektronik Malzeme";
    document.getElementById("detailModalStatus").textContent = statusObj.label;
    document.getElementById("detailModalLocation").textContent = `${item.oda} › ${item.dolap} › ${item.kutu}`;
    document.getElementById("detailModalStock").textContent = `${item.adet} Adet (Min: ${item.minStok})`;
    document.getElementById("detailModalBarcode").textContent = item.barkod || "Barkod Yok";
    document.getElementById("detailModalCategory").textContent = item.kategori || "-";
    document.getElementById("detailModalNote").textContent = item.durumNotu || "Özel not girilmemiş.";
    document.getElementById("detailModalSpecs").textContent = item.ozellikler || "-";

    const extraFieldTitle = document.getElementById("detailModalExtraTitle");
    const extraFieldValue = document.getElementById("detailModalExtraValue");
    if (isLibrary) {
      extraFieldTitle.textContent = "Yazar";
      extraFieldValue.textContent = item.yazar || "Belirtilmemiş";
    } else {
      extraFieldTitle.textContent = "Model";
      extraFieldValue.textContent = item.model || "Belirtilmemiş";
    }

    const img = document.getElementById("detailModalImage");
    if (img) {
      img.src = item.fotograf || (isLibrary
        ? "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80"
        : "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=300&q=80");
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  },

  // ================= ADMIN YÖNETİM İŞLEMLERİ =================

  async handleWhitelistAdd(e) {
    e.preventDefault();
    const input = document.getElementById("whitelistEmailInput");
    const email = input.value.trim();

    try {
      await DatabaseService.addWhitelistEmail(email);
      input.value = "";
      this.showToast(`'${email}' beyaz listeye eklendi.`, "success");
      this.renderAdminView();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  },

  async handleRemoveWhitelist(email) {
    if (confirm(`'${email}' adresini beyaz listeden çıkarmak istediğinize emin misiniz?`)) {
      try {
        await DatabaseService.removeWhitelistEmail(email);
        this.showToast(`'${email}' listeden kaldırıldı.`, "info");
        this.renderAdminView();
      } catch (err) {
        this.showToast(err.message, "error");
      }
    }
  },

  async handleFirebaseConfigSave(e) {
    e.preventDefault();
    const apiKey = document.getElementById("fbApiKey").value.trim();
    const authDomain = document.getElementById("fbAuthDomain").value.trim();
    const projectId = document.getElementById("fbProjectId").value.trim();
    const storageBucket = document.getElementById("fbStorageBucket").value.trim();
    const messagingSenderId = document.getElementById("fbMessagingSenderId").value.trim();
    const appId = document.getElementById("fbAppId").value.trim();

    const config = { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };

    DatabaseService.saveFirebaseConfig(config);
    const success = await DatabaseService.initFirebase(config);

    if (success) {
      this.showToast("✅ Firebase başarıyla bağlandı ve çevrimiçi senkronizasyon başladı!", "success");
    } else {
      this.showToast("⚠️ Yapılandırma kaydedildi ancak Firebase bağlantısı kurulamadı. Lütfen bilgileri kontrol edin.", "warning");
    }
    this.renderAdminView();
  },

  // JSON İçe Aktar
  async handleImportJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const count = await DatabaseService.importFromJSON(event.target.result);
        this.showToast(`✅ ${count} adet eşya başarıyla içe aktarıldı!`, "success");
      } catch (err) {
        this.showToast("İçe aktarma hatası: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  },

  // CSV İçe Aktar
  async handleImportCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const count = await DatabaseService.importFromCSV(event.target.result);
        this.showToast(`✅ ${count} adet eşya CSV'den aktarıldı!`, "success");
      } catch (err) {
        this.showToast("CSV İçe aktarma hatası: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  },

  // ================= AUTH VE ARAYÜZ SENKRONİZASYONU =================

  updateAuthUI(user, role) {
    const authContainer = document.getElementById("authStatusContainer");
    const mobileAuthContainer = document.getElementById("mobileAuthContainer");
    const authNavLinks = document.querySelectorAll("[data-auth-only]");
    const adminNavLinks = document.querySelectorAll("[data-admin-only]");
    const unauthAlert = document.getElementById("unauthorizedAccessAlert");
    const unauthEmail = document.getElementById("unauthorizedUserEmail");
    const btnLandingExplore = document.getElementById("btnLandingExplore");
    const unauthMessage = (APP_CONFIG.messages && APP_CONFIG.messages.unauthorized_access) || "Yetkiniz yoktur";

    // 1. Yetkili Kullanıcı Linklerinin Görünürlüğü (Ana Panel, Kütüphane, Elektronik, Barkod)
    const isAuthorized = AuthService.isAuthorized();
    authNavLinks.forEach((el) => {
      if (isAuthorized) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    });

    // 2. Admin Linklerinin Görünürlüğü (Yönetim Paneli)
    adminNavLinks.forEach((el) => {
      if (role === "admin") {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    });

    // 3. Yetkisiz "Misafir" Rolü Uyarı Kutusu Kontrolü
    if (AuthService.isUnauthorizedGoogleUser()) {
      if (unauthAlert) unauthAlert.classList.remove("hidden");
      if (unauthEmail) unauthEmail.textContent = user.email;
      if (btnLandingExplore) {
        btnLandingExplore.href = "javascript:void(0)";
        btnLandingExplore.innerHTML = "🚫 Yetkiniz Yoktur (Giriş Kısıtlı)";
        btnLandingExplore.onclick = (e) => {
          e.preventDefault();
          this.showUnauthorizedAlert();
        };
      }

      // Yetkisiz kullanıcı başka sayfadaysa derhal açılış ekranına çek
      if (this.currentSection !== "landing") {
        this.navigateTo("landing");
      }
    } else {
      if (unauthAlert) unauthAlert.classList.add("hidden");
      if (btnLandingExplore) {
        btnLandingExplore.href = "#dashboard";
        btnLandingExplore.innerHTML = "🚀 Envanteri Keşfet (Ana Panel)";
        btnLandingExplore.onclick = null;
      }
    }

    // 4. Kullanıcı rozeti ve Giriş/Çıkış butonları
    const renderUserBadge = () => {
      if (!user) {
        return `
          <button onclick="App.triggerLogin()" class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors flex items-center space-x-1.5 shadow-sm">
            <span>Giriş Yap</span>
          </button>
        `;
      }

      const roleBadge = {
        admin: '<span class="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">Admin</span>',
        family: '<span class="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">Aile</span>',
        unauthorized: '<span class="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-full font-bold" title="Yetkiniz yoktur">Misafir</span>'
      }[role] || '<span class="text-[10px] bg-slate-500 text-white px-2 py-0.5 rounded-full font-bold">Misafir</span>';

      return `
        <div class="flex items-center space-x-2">
          <div class="text-right hidden sm:block">
            <div class="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1 justify-end">
              <span>${user.displayName || user.email.split("@")[0]}</span>
              ${roleBadge}
            </div>
            <div class="text-[10px] text-slate-400 truncate max-w-[140px]">${user.email}</div>
          </div>
          <button onclick="AuthService.signOut()" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium" title="Çıkış Yap">
            🚪
          </button>
        </div>
      `;
    };

    if (authContainer) authContainer.innerHTML = renderUserBadge();
    if (mobileAuthContainer) mobileAuthContainer.innerHTML = renderUserBadge();
  },

  async triggerLogin() {
    try {
      await AuthService.signInWithGoogle();
      this.showToast("Giriş başarılı!", "success");
    } catch (err) {
      console.warn("Giriş işlemi:", err);
      this.showToast(err.message || "Giriş yapılamadı.", "warning");
    }
  },

  updateNetworkUI(isOnline) {
    const banner = document.getElementById("offlineIndicatorBanner");
    if (!banner) return;
    if (isOnline) {
      banner.classList.add("hidden");
    } else {
      banner.classList.remove("hidden");
      banner.innerHTML = `
        <span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping mr-2"></span>
        Çevrimdışı Mod - Yerel önbellek gösteriliyor. İnternet bağlandığında değişiklikler buluta eşitlenecektir.
      `;
    }
  },

  // ================= BİLDİRİM (TOAST) SİSTEMİ =================

  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    const colors = {
      success: "bg-emerald-600 text-white shadow-emerald-200 dark:shadow-none",
      warning: "bg-amber-500 text-white shadow-amber-200 dark:shadow-none",
      error: "bg-rose-600 text-white shadow-rose-200 dark:shadow-none",
      info: "bg-slate-800 dark:bg-slate-700 text-white shadow-slate-300 dark:shadow-none"
    }[type] || "bg-slate-800 text-white";

    toast.className = `transform transition-all duration-300 ease-out translate-y-2 opacity-0 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center space-x-2 pointer-events-auto ${colors}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    // Animasyon başlat
    requestAnimationFrame(() => {
      toast.classList.remove("translate-y-2", "opacity-0");
    });

    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-2");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  slugify(text) {
    return (text || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "_");
  }
};

window.App = App;

// DOM yüklendiğinde başlat
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});

