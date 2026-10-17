# Altf4 Envanter Sistemi 📚⚡

> **Ev Kütüphanesi, Elektronik Teçhizat ve Malzeme Talep Yönetim Sistemi**  
> *"Nerede bu eşya?" sorusuna saniyeler içinde yanıt vermek, stok seviyelerini kontrol etmek, aile üyelerinin kitap ve malzeme taleplerini yönetmek ve evdeki dağınıklığı ortadan kaldırmak için tasarlandı.*

---

## 🌟 Proje Özellikleri

- **🔐 Rol Tabanlı Güvenlik & Aile İçi Whitelist (Tam Otomatik)**:
  - **Sistem Yöneticisi (`altf4yapin@gmail.com`)**: Tam CRUD yetkisi (eşya ekleme, silme, düzenleme), malzeme taleplerini onaylama/reddetme, gerçek zamanlı bildirimleri izleme, toplu içe/dışa aktarma, Firebase ayarları ve beyaz liste yönetimi.
  - **Yetkili Aile Üyeleri**: Eşyaları ve konumlarını arama/görüntüleme, eşya durumu güncelleme (zorunlu konum notu ile) ve yeni kitap/malzeme talebi gönderme.
  - **Yetkisiz Kullanıcılar / Misafir (Guest)**: Beyaz listede olmayan Google hesapları otomatik olarak **"Misafir"** rolüne atanır, arayüzde **"Yetkiniz yoktur"** uyarısı alır ve açılış sayfası (Landing Page) haricindeki tüm envanter bölümlerine erişimleri tamamen kilitlenir.
  - **Sıfır Manuel Rol Seçici**: Arayüzde hiçbir sahte geliştirici rolü dropdown'ı veya demo hesap değiştirici sekmesi bulunmaz; tüm roller Google Authentication üzerinden arka planda belirlenir.
  - **Zorunlu Durum Notu**: Durum değişikliği yapan yetkili herkes `Nerede kullanılıyor / Kimde?` bilgisini girmek zorundadır.

- **📬 Gerçek Zamanlı Yönetici Bildirimleri (Real-time Notifications)**:
  - Aile üyeleri yeni bir kitap veya malzeme talebi gönderdiğinde, Firebase Firestore `onSnapshot` (`docChanges`) dinleyicisi değişikliği anında algılar.
  - **Sistem Toast Mesajı**: Yapılandırmada tanımlı `"Yeni bir talep oluşturuldu!"` mesajı ile anlık toast bildirimi patlatılır.
  - **Masaüstü & Mobil Navigasyon Sayaç Rozetleri**: Masaüstü üst menüdeki Talepler sekmesinde (`#navRequestBadge`) ve mobil alt menüdeki Talepler butonunda (`#mobileNavRequestBadge`) bekleyen talep sayısı canlı rozet olarak yanar.
  - **Yönetici Panosu Canlı Uyarı Bannerı**: Yönetici (`altf4yapin@gmail.com`) Ana Panel'e girdiğinde en üstte canlı uyarı bannerı (`#adminNewRequestAlertBanner`) gösterilir; talep onaylandığında veya reddedildiğinde otomatik olarak kapanır.

- **🧭 Talep Sayfası Görünürlük & Güçlü Rota Çözümleme (Routing Fix)**:
  - Sayfa yenilemelerinde veya doğrudan link erişimlerinde `#talepler` sayfasının boş/siyah ekran kalması problemi tamamen giderildi.
  - **Rota Takma Adları (Aliases)**: `#talep`, `#requests`, `#talep-yonetimi` doğrudan Talepler sayfasına yönlendirilir.
  - **Doğrudan Modal Açıcı Rotalar**: `#talep-olustur`, `#talep-olusturma`, `#yeni-talep` rotaları Talepler sayfasını açıp talep oluşturma modalını otomatik olarak kullanıcının önüne getirir.

- **🛠️ Çözülen Kritik Arayüz Hataları (UI/UX Bug Fixes)**:
  1. **Barkod / Kamera Tarayıcı Z-Index Çakışması**: Eşya ekleme formundayken kamera açıldığında tarayıcının form arkasında kalma sorunu, `#scannerModal` için en üst katman önceliği (`z-index: 9999 !important`) tanımlanarak giderildi.
  2. **Form Taşıntı (Overflow) ve Ekrandan Taşma Sorunu**: Küçük ekranlarda veya mobil tarayıcılarda uzun formların ekran altına taşarak kaydetme butonlarının kaybolması engellendi. Tüm modallar `max-height: 90vh !important` flex konteyner mimarisine (`.modal-container`) geçirilerek üst/alt butonlar sabitlendi ve form gövdesi içten kaydırılabilir (`.modal-body-scrollable`) hale getirildi.

- **📍 Hiyerarşik Konum Haritalaması**:
  - Notion / Obsidian tarzı katlanabilir klasör ağacı görünümü: `Oda > Dolap / Raf > Çekmece / Kutu`.
  - Her bir parçanın veya kitabın yerini nokta atışı bulma ve tek tıkla o konumu filtreleme.

- **🔍 Toleranslı Bulanık Arama (Fuzzy Search)**:
  - Türkçe karakter desteği (`ç, ğ, ı, ö, ş, ü`) ve küçük yazım hatalarını tolere eden Levenshtein & benzerlik algoritması (Örn: `ardunyo` -> `Arduino`, `orvel` -> `George Orwell`, `resitor` -> `Direnç`).

- **📷 Barkod ve QR Kod Tarayıcı**:
  - Mobil cihazın veya web kamerasının arka kamerasını kullanarak kitap ISBN barkodlarını ve elektronik komponent QR kodlarını anında okuma (`html5-qrcode`).
  - İki mod: **Hızlı Arama Modu** ve **Forma Barkod Ekle Modu**.

- **📶 Kesintisiz Çevrimdışı Çalışma (Offline First)**:
  - Firebase Firestore v13.0.0 IndexedDB Persistence (`persistentMultipleTabManager()`) ve LocalStorage çift katmanlı önbelleği sayesinde internet kopsa dahi tüm envanter ve talepler eksiksiz çalışır.

- **📊 Stok Takibi ve Hızlı Sayaç**:
  - Kritik stok uyarıları (`adet <= minStok`).
  - Hızlı `+` ve `-` butonları ile komponent sayısını anında güncelleme.

- **📦 Toplu İçe ve Dışa Aktarma (Bulk Import/Export)**:
  - Excel ile tam uyumlu Türkçe karakterli CSV (UTF-8 BOM) ve JSON formatında yedek alma ve geri yükleme.

- **📱 %100 Mobil Uyumlu ve PWA Desteği**:
  - Masaüstünde geniş dashboard ve ağaç gezgini; mobilde alt navigasyon çubuğu ve tek parmakla erişilebilir FAB kamera butonu.

- **🎨 Canlı ve Dinamik Tasarım**:
  - Yumuşak mavi ve pastel yeşil tonları, cam (glassmorphism) efektleri, Açık ve Koyu (Matte Dark) tema desteği.

---

## 📂 Dosya ve Dizin Yapısı

```text
Kütüphane Sistemi/
│
├── index.html              # Tek sayfa (SPA) ana HTML dosyası, bölümler ve modallar
├── manifest.json           # Progressive Web App (PWA) manifest dosyası
├── sw.js                   # Çevrimdışı önbellek Service Worker dosyası
├── firestore.rules         # Items, Requests ve Settings koleksiyonları için güvenlik kuralları
├── README.md               # Detaylı dokümantasyon ve yayınlama rehberi
│
├── css/
│   └── styles.css          # Z-index katman kuralları, modal kaydırma stilleri ve lazer animasyonları
│
├── js/
│   ├── firebase-init.js    # Firebase v13.0.0 modül başlatıcısı ve IndexedDB önbellekleme
│   ├── config.js           # Varsayılan konumlar, bildirim mesajları, örnek veriler ve Firebase config
│   ├── fuzzySearch.js      # Toleranslı Türkçe bulanık arama algoritması
│   ├── db.js               # Firestore v13.0.0 & LocalStorage senkronizasyon ve gerçek zamanlı dinleme servisi
│   ├── auth.js             # Google Auth ve Whitelist yetki kontrol servisi
│   ├── scanner.js          # HTML5-QRCode kamera entegrasyonu ve sesli geri bildirim
│   └── app.js              # Arayüz denetleyicisi, rota yönetimi, canlı bildirimler ve filtreler
│
└── assets/
    └── icon.svg            # PWA vektör sistem ikonu
```

---

## 🗄️ Veritabanı Şeması (Schema)

### 1. Envanter Öğeleri (`items` Koleksiyonu)

| Alan | Tür | Açıklama | Kategori |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Benzersiz kayıt ID'si | Tümü |
| `type` | `string` | `"kutuphane"` veya `"elektronik"` | Tümü |
| `isim` | `string` | Kitap adı veya malzeme başlığı | Tümü |
| `yazar` | `string` | Kitabın yazarı | Kütüphane |
| `model` | `string` | Model / Çip / Parça Kodu (Örn: `ESP-WROOM-32`) | Elektronik |
| `adet` | `number` | Mevcut fiziksel stok miktarı | Tümü |
| `minStok` | `number` | Uyarı verilecek minimum stok eşiği | Tümü |
| `oda` | `string` | Konum hiyerarşisi 1. seviye (Örn: `Çalışma Odası`) | Tümü |
| `dolap` | `string` | Konum hiyerarşisi 2. seviye (Örn: `Elektronik Dolabı`) | Tümü |
| `kutu` | `string` | Konum hiyerarşisi 3. seviye (Örn: `Kutu #1`) | Tümü |
| `barkod` | `string` | ISBN numarası veya özel malzeme barkodu | Tümü |
| `durum` | `string` | `"mevcut"`, `"kullanimda"`, `"okunmakta"`, `"yanimda"` | Tümü |
| `durumNotu` | `string` | **Zorunlu:** Eşyanın nerede ve kimde olduğu açıklaması | Tümü |
| `kategori` | `string` | Alt kategori (Örn: `Sensörler & Modüller`, `Roman`) | Tümü |
| `ozellikler` | `string` | Teknik özellikler, notlar, yayınevi bilgileri | Tümü |
| `fotograf` | `string` | Görsel URL'si veya sıkıştırılmış Base64 | Tümü |
| `sonGuncelleyen` | `string` | Son işlem yapan kullanıcının e-postası | Tümü |
| `statusHistory` | `array` | Önceki durum değişiklikleri ve notların tarihçesi | Tümü |
| `createdAt` | `string` | Oluşturulma ISO 8601 zaman damgası | Tümü |

### 2. Malzeme ve Kitap Talepleri (`requests` Koleksiyonu)

| Alan | Tür | Açıklama |
| :--- | :--- | :--- |
| `id` | `string` | Benzersiz talep ID'si |
| `itemType` | `string` | `"kutuphane"` veya `"elektronik"` |
| `title` | `string` | İstenen kitap veya malzemenin adı |
| `authorOrModel`| `string` | Yazar adı veya donanım model kodu (opsiyonel) |
| `description` | `string` | Talep açıklaması / neden lazım olduğu |
| `requesterEmail` | `string` | Talep eden aile üyesinin e-posta adresi |
| `requesterName` | `string` | Talep eden aile üyesinin adı/soyadı |
| `status` | `string` | `"bekliyor"`, `"onaylandi"`, `"reddedildi"` |
| `adminNote` | `string` | Yöneticinin eklediği onay veya ret gerekçesi |
| `createdAt` | `string` | Talep oluşturulma ISO 8601 zaman damgası |
| `updatedAt` | `string` | Durum güncellenme zaman damgası |

---

## 💻 Yerel Olarak Test Etme

Uygulama herhangi bir derleme aracı (`npm`, `webpack`, `vite` vb.) gerektirmez (Zero Build Setup). Modern tarayıcılarda doğrudan çalışır:

### Seçenek 1: Python ile Yerel Sunucu Başlatma
Proje dizininde terminali açıp şu komutu verin:
```bash
python -m http.server 8000
```
Ardından tarayıcınızdan `http://localhost:8000` adresine gidin.

### Seçenek 2: VS Code Live Server
1. VS Code içinde `index.html` dosyasına sağ tıklayın.
2. **"Open with Live Server"** seçeneğini seçin.

### 🔐 Otomatik Rol Algılama (Backend Rol Yönetimi)
Sistemde herhangi bir manuel rol seçici açılır kutu veya demo hesap değiştirme sekmesi bulunmaz; tüm roller Google Authentication üzerinden arka planda otomatik olarak belirlenir:
- 👑 **Admin**: Kullanıcı `altf4yapin@gmail.com` adresiyle giriş yaptığında sistem yöneticisi olarak tanınır (Tam CRUD, whitelist ve yönetim yetkisi).
- 👨‍👩‍👧 **Aile Üyesi**: Giriş yapan e-posta beyaz listede (`whitelist`) yer alıyorsa eşyaları arama, zorunlu açıklama ile durum güncelleme ve yeni talep iletme yetkileri tanımlanır.
- 🚫 **Misafir (Yetkisiz Google Hesabı)**: Beyaz listede bulunmayan herhangi bir Google hesabı sisteme girdiğinde otomatik olarak "Misafir" rolüne alınır, arayüzde *"Yetkiniz yoktur"* uyarısı gösterilir ve açılış sayfası dışındaki tüm bölümlere erişimi engellenir.
- 🚪 **Oturum Açılmamış Durum**: Yalnızca tanıtım ekranı ve "Giriş Yap" butonu görüntülenir.

---

## 🚀 GitHub Pages ile Yayınlama Rehberi

Uygulamanızı ücretsiz ve herkese açık bir şekilde GitHub Pages üzerinde barındırmak için aşağıdaki adımları izleyin:

### 1. Git Deposunu Başlatın ve GitHub'a Yükleyin
Proje klasörünüzde terminal açarak şu komutları çalıştırın:
```bash
git init
git add .
git commit -m "Altf4 Envanter Sistemi: Gercek Zamanli Bildirimler ve Rota Duzeltmeleri"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/altf4-envanter.git
git push -u origin main
```

### 2. GitHub Pages'i Etkinleştirin
1. GitHub deponuzun sayfasına gidin (`https://github.com/KULLANICI_ADINIZ/altf4-envanter`).
2. Üst menüden **Settings** (Ayarlar) sekmesine tıklayın.
3. Sol menüden **Pages** bölümünü seçin.
4. **Build and deployment** başlığı altında:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` ve `/ (root)` seçin.
5. **Save** butonuna tıklayın.
6. Yaklaşık 1 dakika içinde siteniz `https://KULLANICI_ADINIZ.github.io/altf4-envanter/` adresinde canlıya geçecektir!

---

## ☁️ Firebase v13.0.0 Resmi Yapılandırması ve Senkronizasyon

Uygulama, doğrudan Firebase JavaScript SDK **v13.0.0** ve çevrimdışı IndexedDB persistence mimarisiyle entegre edilmiştir.

### Projede Tanımlı Resmi Yapılandırma:
```javascript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
const firebaseConfig = {
  apiKey: 'AIzaSyAplESbQCk2YTCbQzi7UyOvPIYNQJvY9L8',
  authDomain: 'altf4-envanter.firebaseapp.com',
  projectId: 'altf4-envanter',
  storageBucket: 'altf4-envanter.firebasestorage.app',
  messagingSenderId: '928059638634',
  appId: '1:928059638634:web:8da6fb168fc5ad352a9b13'
};
const app = initializeApp(firebaseConfig);
```

### Canlıya Aldıktan Sonra Yetkilendirme Adımları:
1. [Firebase Console](https://console.firebase.google.com/) üzerinde `altf4-envanter` projesine gidin.
2. **Authentication** > **Sign-in method** bölümünde **Google** sağlayıcısının açık olduğundan emin olun.
3. **Firestore Database** bölümünde projedeki `firestore.rules` dosyasının kurallarını **Publish** edin.
4. Google Auth'un GitHub Pages alan adınızda çalışabilmesi için:
   - Firebase Console > Authentication > Settings > **Authorized Domains** listesine `KULLANICI_ADINIZ.github.io` adresini ekleyin.
5. Sitedeki **Yönetim** sekmesine girdiğinizde Firebase bilgileri hazır olarak görüntülenecek ve çevrimdışı önbellekleme ile senkronizasyon otomatik sürdürülecektir.

Tebrikler! Altf4 Envanter Sisteminiz artık aileniz için tam donanımlı olarak yayında! 🎉
