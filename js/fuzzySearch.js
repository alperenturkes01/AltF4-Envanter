// ==========================================
// ALTF4 ENVANTER SİSTEMİ - BULANIK ARAMA (FUZZY SEARCH)
// ==========================================

const FuzzySearchEngine = {
  // Türkçe karakter ve küçük harf normalize fonksiyonu
  normalize(text) {
    if (!text) return "";
    return text
      .toString()
      .trim()
      .replace(/İ/g, "i")
      .replace(/I/g, "i")
      .replace(/ı/g, "i")
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9\s]/g, " "); // Özel karakterleri boşluğa çevir
  },

  // Levenshtein Mesafesi Hesaplama
  levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // Yer değiştirme
            matrix[i][j - 1] + 1,     // Ekleme
            matrix[i - 1][j] + 1      // Silme
          );
        }
      }
    }

    return matrix[b.length][a.length];
  },

  // İki kelime arasındaki benzerlik skoru (0.0 - 1.0)
  wordSimilarity(queryWord, targetWord) {
    if (targetWord === queryWord) return 1.0;
    if (targetWord.includes(queryWord)) {
      // Kelime query'yi tam içeriyorsa yüksek puan
      return 0.85 + (queryWord.length / targetWord.length) * 0.15;
    }
    if (queryWord.includes(targetWord) && targetWord.length >= 3) {
      return 0.75;
    }

    // Harf hatası toleransı (Levenshtein)
    const dist = this.levenshtein(queryWord, targetWord);
    const maxLen = Math.max(queryWord.length, targetWord.length);
    if (maxLen <= 2) return dist === 0 ? 1.0 : 0.0;
    
    // Küçük yazım hataları: 1-2 harf hatasını kabul et
    const allowedErrors = maxLen <= 4 ? 1 : maxLen <= 8 ? 2 : 3;
    if (dist <= allowedErrors) {
      return Math.max(0, 1 - (dist / maxLen));
    }

    return 0;
  },

  // Bir metin içinde sorgu kelimelerinin eşleşme skoru
  scoreText(queryNorm, targetText, weight = 1.0) {
    if (!targetText) return 0;
    const targetNorm = this.normalize(targetText);
    if (!targetNorm) return 0;

    // Tam substring eşleşmesi en yüksek skoru alır
    if (targetNorm.includes(queryNorm)) {
      return 100 * weight;
    }

    const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 0);
    const targetWords = targetNorm.split(/\s+/).filter(w => w.length > 0);

    if (queryWords.length === 0 || targetWords.length === 0) return 0;

    let totalScore = 0;

    for (const qWord of queryWords) {
      let maxWordScore = 0;
      for (const tWord of targetWords) {
        const sim = this.wordSimilarity(qWord, tWord);
        if (sim > maxWordScore) {
          maxWordScore = sim;
        }
      }
      totalScore += maxWordScore;
    }

    const avgScore = (totalScore / queryWords.length) * 80 * weight;
    return avgScore;
  },

  // Eşya arama fonksiyonu (Fuzzy & Advanced Filter)
  search(items, query, filters = {}) {
    if (!items || !Array.isArray(items)) return [];

    let filtered = [...items];

    // 1. Kategori / Tür Filtresi (kutuphane | elektronik)
    if (filters.type && filters.type !== "all") {
      filtered = filtered.filter(item => item.type === filters.type);
    }

    // 2. Durum Filtresi (mevcut, kullanimda, okunmakta, yanimda)
    if (filters.durum && filters.durum !== "all") {
      filtered = filtered.filter(item => item.durum === filters.durum);
    }

    // 3. Konum Filtreleri (Oda, Dolap, Kutu)
    if (filters.oda && filters.oda !== "all") {
      filtered = filtered.filter(item => item.oda === filters.oda);
    }
    if (filters.dolap && filters.dolap !== "all") {
      filtered = filtered.filter(item => item.dolap === filters.dolap);
    }
    if (filters.kutu && filters.kutu !== "all") {
      filtered = filtered.filter(item => item.kutu === filters.kutu);
    }

    // 4. Kritik / Düşük Stok Filtresi
    if (filters.lowStockOnly) {
      filtered = filtered.filter(item => {
        const adet = Number(item.adet) || 0;
        const minStok = Number(item.minStok) || 1;
        return adet <= minStok;
      });
    }

    // 5. Belirli kategori filtresi (elektronik veya kütüphane alt kategorisi)
    if (filters.kategori && filters.kategori !== "all") {
      filtered = filtered.filter(item => item.kategori === filters.kategori);
    }

    // Eğer arama sorgusu boşsa, filtrelenmiş listeyi sıralayıp döndür
    const cleanQuery = this.normalize(query);
    if (!cleanQuery) {
      return this.sortResults(filtered, filters.sortBy);
    }

    // 6. Bulanık (Fuzzy) Skorlama
    const scoredItems = [];

    for (const item of filtered) {
      let score = 0;

      // Barkod direkt eşleşmesi (Anında en tepeye)
      if (item.barkod && this.normalize(item.barkod).includes(cleanQuery)) {
        score += 300;
      }

      // İsim / Başlık (Yüksek Ağırlık: 2.0)
      score += this.scoreText(cleanQuery, item.isim, 2.0);

      // Yazar / Model (Ağırlık: 1.5)
      if (item.yazar) score += this.scoreText(cleanQuery, item.yazar, 1.5);
      if (item.model) score += this.scoreText(cleanQuery, item.model, 1.5);

      // Kategori (Ağırlık: 1.2)
      if (item.kategori) score += this.scoreText(cleanQuery, item.kategori, 1.2);

      // Özellikler / Açıklama (Ağırlık: 1.0)
      if (item.ozellikler) score += this.scoreText(cleanQuery, item.ozellikler, 1.0);

      // Konum Bilgisi (Oda / Dolap / Kutu) (Ağırlık: 1.1)
      const locationCombo = `${item.oda || ""} ${item.dolap || ""} ${item.kutu || ""}`;
      score += this.scoreText(cleanQuery, locationCombo, 1.1);

      // Durum Notu (Ağırlık: 0.8)
      if (item.durumNotu) score += this.scoreText(cleanQuery, item.durumNotu, 0.8);

      // Belirli bir benzerlik eşiğini aşanları ekle (Tolerans eşiği: 25)
      if (score >= 25) {
        scoredItems.push({ item, score });
      }
    }

    // Puana göre azalan sırada sırala
    scoredItems.sort((a, b) => b.score - a.score);

    return scoredItems.map(si => si.item);
  },

  // Sıralama fonksiyonu
  sortResults(items, sortBy = "isim-asc") {
    const list = [...items];
    switch (sortBy) {
      case "isim-desc":
        return list.sort((a, b) => (b.isim || "").localeCompare(a.isim || "", "tr"));
      case "adet-asc":
        return list.sort((a, b) => (Number(a.adet) || 0) - (Number(b.adet) || 0));
      case "adet-desc":
        return list.sort((a, b) => (Number(b.adet) || 0) - (Number(a.adet) || 0));
      case "tarih-desc":
        return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      case "isim-asc":
      default:
        return list.sort((a, b) => (a.isim || "").localeCompare(b.isim || "", "tr"));
    }
  }
};

window.FuzzySearchEngine = FuzzySearchEngine;

