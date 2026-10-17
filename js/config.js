// ==========================================
// ALTF4 ENVANTER SİSTEMİ - YAPILANDIRMA VE SABİTLER
// ==========================================

const APP_CONFIG = {
  appName: "Altf4 Envanter Sistemi",
  adminEmail: "altf4yapin@gmail.com",
  version: "1.0.0",
  storageKeyItems: "altf4_inventory_items",
  storageKeyRequests: "altf4_inventory_requests",
  storageKeyWhitelist: "altf4_whitelist_emails",
  storageKeyConfig: "altf4_firebase_config",
  storageKeyTheme: "altf4_theme_preference",
  
  // Firebase SDK v13.0.0 Resmi Yapılandırması
  firebaseConfig: {
    apiKey: 'AIzaSyAplESbQCk2YTCbQzi7UyOvPIYNQJvY9L8',
    authDomain: 'altf4-envanter.firebaseapp.com',
    projectId: 'altf4-envanter',
    storageBucket: 'altf4-envanter.firebasestorage.app',
    messagingSenderId: '928059638634',
    appId: '1:928059638634:web:8da6fb168fc5ad352a9b13'
  },
  
  // Sistem Mesajları
  messages: {
    unauthorized_access: "Yetkiniz yoktur",
    new_request_notification: "Yeni bir talep oluşturuldu!"
  },
  
  // Talep Durumu Seçenekleri (Bekliyor / Onaylandı / Reddedildi)
  requestStatusOptions: [
    { id: "bekliyor", label: "Bekliyor", color: "amber", icon: "clock" },
    { id: "onaylandi", label: "Onaylandı", color: "emerald", icon: "check" },
    { id: "reddedildi", label: "Reddedildi", color: "rose", icon: "x" }
  ],

  // Varsayılan Durum Seçenekleri
  statusOptions: [
    { id: "mevcut", label: "Mevcut (Yerinde)", color: "emerald", icon: "check-circle" },
    { id: "kullanimda", label: "Kullanımda", color: "blue", icon: "zap" },
    { id: "okunmakta", label: "Okunmakta", color: "indigo", icon: "book-open" },
    { id: "yanimda", label: "Yanımda (Şehir Dışı)", color: "amber", icon: "briefcase" }
  ],

  // Elektronik Kategorileri
  electronicsCategories: [
    "Geliştirme Kartları (Arduino/ESP/Pi)",
    "Sensörler & Modüller",
    "Pasif Komponentler (Direnç/Kondansatör)",
    "Entegreler & Yarı İletkenler",
    "Güç & Batarya",
    "Kablolar & Konnektörler",
    "Alet & Lehim Ekipmanları",
    "Ölçü Aletleri",
    "Diğer Donanımlar"
  ],

  // Kütüphane Kategorileri / Türleri
  libraryCategories: [
    "Bilgisayar & Yazılım",
    "Mühendislik & Fen",
    "Roman & Edebiyat",
    "Tarih & Felsefe",
    "Kişisel Gelişim",
    "Çizgi Roman & Manga",
    "Belge & Dokümantasyon"
  ],

  // Hiyerarşik Konum Örnekleri (Oda > Dolap/Raf > Çekmece/Kutu)
  defaultLocations: {
    rooms: ["Çalışma Odası", "Salon", "Yatak Odası", "Atölye / Kiler"],
    cabinets: [
      { room: "Çalışma Odası", name: "Ana Kitaplık - Raf 1" },
      { room: "Çalışma Odası", name: "Ana Kitaplık - Raf 2" },
      { room: "Çalışma Odası", name: "Elektronik Dolabı" },
      { room: "Çalışma Odası", name: "Çalışma Masası Üstü" },
      { room: "Salon", name: "Vitrin Kitaplık" },
      { room: "Atölye / Kiler", name: "Metal Raf Ünitesi" },
      { room: "Yatak Odası", name: "Komodin Rafı" }
    ],
    boxes: [
      { cabinet: "Elektronik Dolabı", name: "Kutu #1 (Arduino & Kartlar)" },
      { cabinet: "Elektronik Dolabı", name: "Kutu #2 (Sensörler & Modüller)" },
      { cabinet: "Elektronik Dolabı", name: "Kutu #3 (Direnç & Pasifler)" },
      { cabinet: "Elektronik Dolabı", name: "Çekmece 1 (Kablolar & Problar)" },
      { cabinet: "Metal Raf Ünitesi", name: "Büyük Alet Çantası" },
      { cabinet: "Ana Kitaplık - Raf 1", name: "Yazılım Kitapları Bölümü" },
      { cabinet: "Ana Kitaplık - Raf 2", name: "Edebiyat Bölümü" }
    ]
  },

  // Başlangıç Aile Üyeleri Beyaz Listesi (Whitelist)
  defaultWhitelist: [
    "altf4yapin@gmail.com",
    "aile.altf4@gmail.com"
  ],

  // Başlangıç Örnek Envanter Verileri (Kütüphane & Elektronik)
  initialSampleData: [
    {
      id: "book-1",
      type: "kutuphane",
      isim: "Temiz Kod (Clean Code)",
      yazar: "Robert C. Martin",
      adet: 1,
      minStok: 1,
      oda: "Çalışma Odası",
      dolap: "Ana Kitaplık - Raf 1",
      kutu: "Yazılım Kitapları Bölümü",
      barkod: "9786054941179",
      durum: "mevcut",
      durumNotu: "Kütüphanede, rafta yerinde.",
      kategori: "Bilgisayar & Yazılım",
      fotograf: "https://images.unsplash.com/photo-1532012164546-f432f2e37930?auto=format&fit=crop&w=300&q=80",
      ozellikler: "Türkçe Çeviri, 464 Sayfa, Kodlama prensipleri",
      createdAt: new Date().toISOString()
    },
    {
      id: "book-2",
      type: "kutuphane",
      isim: "1984",
      yazar: "George Orwell",
      adet: 1,
      minStok: 1,
      oda: "Çalışma Odası",
      dolap: "Ana Kitaplık - Raf 2",
      kutu: "Edebiyat Bölümü",
      barkod: "9789750718533",
      durum: "okunmakta",
      durumNotu: "Salonda sehpa üzerinde okunuyor.",
      kategori: "Roman & Edebiyat",
      fotograf: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80",
      ozellikler: "Can Yayınları, Distopya Klasiği",
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: "book-3",
      type: "kutuphane",
      isim: "Designing Data-Intensive Applications",
      yazar: "Martin Kleppmann",
      adet: 1,
      minStok: 1,
      oda: "Çalışma Odası",
      dolap: "Ana Kitaplık - Raf 1",
      kutu: "Yazılım Kitapları Bölümü",
      barkod: "9781449373320",
      durum: "yanimda",
      durumNotu: "Sırt çantamda, ofise götürüldü.",
      kategori: "Bilgisayar & Yazılım",
      fotograf: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80",
      ozellikler: "O'Reilly Media, Dağıtık Sistemler Rehberi",
      createdAt: new Date(Date.now() - 172800000).toISOString()
    },
    {
      id: "elec-1",
      type: "elektronik",
      isim: "ESP32 NodeMCU Wi-Fi + Bluetooth Modülü",
      model: "ESP-WROOM-32 (30 Pin)",
      adet: 2,
      minStok: 3, // Düşük stok uyarısı verecek
      oda: "Çalışma Odası",
      dolap: "Elektronik Dolabı",
      kutu: "Kutu #1 (Arduino & Kartlar)",
      barkod: "ELC-ESP32-001",
      durum: "mevcut",
      durumNotu: "Antistatik poşet içinde kutuda.",
      kategori: "Geliştirme Kartları (Arduino/ESP/Pi)",
      fotograf: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=300&q=80",
      ozellikler: "Çift Çekirdek 240MHz, Dahili BLE 4.2 ve WiFi, CP2102",
      createdAt: new Date().toISOString()
    },
    {
      id: "elec-2",
      type: "elektronik",
      isim: "Arduino Uno R3 Klon",
      model: "CH340G Entegreli",
      adet: 4,
      minStok: 2,
      oda: "Çalışma Odası",
      dolap: "Elektronik Dolabı",
      kutu: "Kutu #1 (Arduino & Kartlar)",
      barkod: "ELC-ARD-002",
      durum: "mevcut",
      durumNotu: "Yerinde, çalışır vaziyette.",
      kategori: "Geliştirme Kartları (Arduino/ESP/Pi)",
      fotograf: "https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=300&q=80",
      ozellikler: "ATmega328P, USB Tip-B Kablo ile",
      createdAt: new Date(Date.now() - 259200000).toISOString()
    },
    {
      id: "elec-3",
      type: "elektronik",
      isim: "BME280 Sıcaklık, Nem ve Basınç Sensörü",
      model: "GY-BME280 I2C/SPI",
      adet: 1,
      minStok: 2, // Düşük stok uyarısı
      oda: "Çalışma Odası",
      dolap: "Elektronik Dolabı",
      kutu: "Kutu #2 (Sensörler & Modüller)",
      barkod: "ELC-BME-003",
      durum: "kullanimda",
      durumNotu: "Masaüstü hava istasyonu prototip devresinde takılı.",
      kategori: "Sensörler & Modüller",
      fotograf: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=300&q=80",
      ozellikler: "3.3V giriş, hassas barometrik basınç ve higrometre",
      createdAt: new Date(Date.now() - 345600000).toISOString()
    },
    {
      id: "elec-4",
      type: "elektronik",
      isim: "Dijital Multimetre (Otomatik Kademeli)",
      model: "Aneng AN8008 True-RMS",
      adet: 1,
      minStok: 1,
      oda: "Atölye / Kiler",
      dolap: "Metal Raf Ünitesi",
      kutu: "Büyük Alet Çantası",
      barkod: "ELC-DMM-004",
      durum: "mevcut",
      durumNotu: "Taşıma kılıfında, propları yanında.",
      kategori: "Ölçü Aletleri",
      fotograf: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=300&q=80",
      ozellikler: "9999 Count, Kare dalga çıkışı, NCV temassız voltaj kontrolü",
      createdAt: new Date(Date.now() - 432000000).toISOString()
    },
    {
      id: "elec-5",
      type: "elektronik",
      isim: "1/4W %1 Metal Film Direnç Seti (600 Adet)",
      model: "30 Farklı Değer x 20 Adet",
      adet: 1,
      minStok: 1,
      oda: "Çalışma Odası",
      dolap: "Elektronik Dolabı",
      kutu: "Kutu #3 (Direnç & Pasifler)",
      barkod: "ELC-RES-005",
      durum: "mevcut",
      durumNotu: "Etiketli şeritler halinde organizer kutuda.",
      kategori: "Pasif Komponentler (Direnç/Kondansatör)",
      fotograf: "https://images.unsplash.com/photo-1608755728617-aefab37d45f6?auto=format&fit=crop&w=300&q=80",
      ozellikler: "10 Ohm - 1 MegaOhm arası, tolerans %1",
      createdAt: new Date(Date.now() - 518400000).toISOString()
    }
  ],

  // Başlangıç Örnek Malzeme ve Kitap Talepleri
  initialSampleRequests: [
    {
      id: "req-1",
      requesterEmail: "aile.altf4@gmail.com",
      requesterName: "Aile Üyesi",
      itemType: "elektronik",
      title: "Raspberry Pi Pico W",
      description: "Mutfak hava durumu panosu projesi için Wi-Fi destekli mikrodenetleyici kartı gerekiyor.",
      status: "bekliyor",
      adminNote: "",
      createdAt: new Date().toISOString()
    },
    {
      id: "req-2",
      requesterEmail: "aile.altf4@gmail.com",
      requesterName: "Aile Üyesi",
      itemType: "kutuphane",
      title: "Atomik Alışkanlıklar",
      author: "James Clear",
      description: "Kişisel gelişim ve üretkenlik için kütüphanemize ekleyebilir miyiz?",
      status: "onaylandi",
      adminNote: "Sipariş verildi, kargoya verildiğinde eklenecek.",
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ]
};

// Global export
window.APP_CONFIG = APP_CONFIG;

