# 🚀 Yayınlama Rehberi (Web ve Mobil)

Oyununuz standart web teknolojileriyle (HTML, CSS, JS) oluşturulduğu için, onu ücretsiz olarak internete yükleyebilir ve telefonunuzda tıpkı bir uygulama gibi oynayabilirsiniz.

## 📱 Mobil: Uygulama Olarak Yükleme (PWA)
1. **Yükleyin**: Dosyaları bir web sunucusuna yükleyin (aşağıdaki seçeneklere bakın).
2. **Açın**: Telefonunuzun tarayıcısından (iOS için Safari, Android için Chrome) oyunun URL'sini açın.
3. **Android**: Üç nokta menüsüne dokunun ve **"Uygulamayı Yükle"** veya **"Ana Ekrana Ekle"** seçeneğini seçin.
4. **iOS**: **Paylaş** düğmesine dokunun ve **"Ana Ekrana Ekle"** seçeneğini seçin.
5. Oyun artık ana ekranınızda kendi simgesiyle görünecek ve tam ekran modunda çalışacaktır!

---

## 🌐 Web: Ücretsiz Yayınlama Seçenekleri

### Seçenek 1: GitHub Pages (Önerilen)
1. GitHub'da yeni bir depo (repository) oluşturun.
2. `platform-oyunu` klasöründeki tüm dosyaları yükleyin.
3. **Settings > Pages** sekmesine gidin.
4. Kaynak olarak `main` branch'ini ve `/root` klasörünü seçip **Save** deyin.
5. Oyununuz `https://kullaniciadiniz.github.io/depo-adi/` adresinde yayına girecektir.

### Seçenek 2: Vercel (En Hızlısı)
1. [Vercel](https://vercel.com/) sitesine gidin veya CLI aracını indirin.
2. Klasörünüzü Vercel dashboard'una sürükleyip bırakın.
3. Size anında canlı bir URL verecektir.

---

## 🛠️ Performans ve İpuçları
- **Çevrimdışı Oynama**: Service Worker (`sw.js`) sayesinde, oyun bir kez yüklendikten sonra internet bağlantınız olmasa bile çalışmaya devam edecektir.
- **Tam Ekran**: Mobil cihazlarda `manifest.json` dosyası sayesinde adres çubuğu gizlenir ve konsol benzeri bir deneyim sunulur.

İyi oyunlar!
