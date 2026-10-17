// ==========================================
// ALTF4 ENVANTER SİSTEMİ - BARKOD VE QR KOD TARAYICI
// ==========================================

const BarcodeScannerService = {
  html5QrCode: null,
  isScanning: false,
  currentMode: "search", // "search" | "input"
  targetInputElementId: null,
  onScanSuccessCallback: null,

  // Sesli uyarı (Bip sesi - Web Audio API)
  playBeep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // Ses engellendiyse sessizce geç
    }
  },

  // Tarayıcı Modalını Aç
  async startScan({ mode = "search", targetInputId = null, onResult = null }) {
    this.currentMode = mode;
    this.targetInputElementId = targetInputId;
    this.onScanSuccessCallback = onResult;

    const modal = document.getElementById("scannerModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    const feedbackText = document.getElementById("scannerFeedback");
    if (feedbackText) {
      feedbackText.textContent =
        mode === "search"
          ? "Barkod veya QR kodu kameraya gösterin (Otomatik aranacak)..."
          : "Barkodu okutarak forma aktarın...";
    }

    try {
      // Html5Qrcode kütüphanesi yüklü mü kontrol et
      if (!window.Html5Qrcode) {
        throw new Error("Tarayıcı kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol edin.");
      }

      if (this.html5QrCode) {
        await this.stopScan();
      }

      this.html5QrCode = new Html5Qrcode("scannerPreview");
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await this.html5QrCode.start(
        { facingMode: "environment" }, // Arka kamera
        config,
        (decodedText, decodedResult) => {
          this.handleDecodedText(decodedText, decodedResult);
        },
        (errorMessage) => {
          // Tarama devam ederken her karede okuyamadığında hata basar, loglamaya gerek yok
        }
      );

      this.isScanning = true;
    } catch (err) {
      console.warn("Kamera başlatma hatası:", err);
      if (feedbackText) {
        feedbackText.innerHTML = `<span class="text-rose-500 font-medium">Kamera erişimi sağlanamadı. Yetki verilmemiş olabilir veya HTTPS gereklidir.</span>`;
      }
    }
  },

  // Barkod / QR Kod başarıyla okunduğunda
  async handleDecodedText(decodedText, decodedResult) {
    if (!this.isScanning) return;
    this.isScanning = false;
    this.playBeep();

    // Titreşim (mobil cihazlar)
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    await this.stopScan();

    const cleanCode = decodedText.trim();

    if (this.currentMode === "input" && this.targetInputElementId) {
      const input = document.getElementById(this.targetInputElementId);
      if (input) {
        input.value = cleanCode;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (window.App && App.showToast) {
        App.showToast(`Barkod okundu: ${cleanCode}`, "success");
      }
    } else if (this.currentMode === "search") {
      if (window.App && App.handleBarcodeSearch) {
        App.handleBarcodeSearch(cleanCode);
      }
    }

    if (this.onScanSuccessCallback) {
      this.onScanSuccessCallback(cleanCode, decodedResult);
    }
  },

  // Taramayı durdur ve modalı kapat
  async stopScan() {
    if (this.html5QrCode && this.isScanning) {
      try {
        await this.html5QrCode.stop();
      } catch (e) {
        console.warn("Kamera durdurma hatası:", e);
      }
    }
    this.isScanning = false;
    this.html5QrCode = null;

    const modal = document.getElementById("scannerModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  }
};

window.BarcodeScannerService = BarcodeScannerService;

