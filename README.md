# DigiPet

Masaüstünde yaşayan bir pet. Tarayıcıda açılmaz. İlk kurulumda hayvanını seçersin; sonra menü çubuğu (macOS) veya sistem tepsisi (Windows / Linux) üzerindeki **DigiPet** simgesinden değiştirirsin.

Kuş, kartal ve hayalet **uçar**. Kedi, köpek, tavşan, kaplumbağa ve fil **zıplar**. Öne gelince büyür, arkaya gidince küçülür.

macOS’ta pet, açtığın **gerçek uygulama pencerelerinin** üst kenarına tırmanır (Finder, Cursor, Preview, Safari…). Linux ve Windows’ta pet masaüstünde dolaşır; native pencere listesi yalnızca macOS’tadır.

## Paketler nerede?

Kurulum dosyaları git deposunda **yok**. `.gitignore` içinde `release/` durur; her paketleme makinede yeniden üretilir.

Paketledikten sonra dosyalar proje kökündeki **`release/`** klasöründedir:

| Platform | Dosya | Ne işe yarar |
|---|---|---|
| macOS | `DigiPet-1.0.0-mac-x64.dmg` | Applications’a sürükle-bırak kurulum |
| macOS | `DigiPet-1.0.0-mac.zip` | `.app` arşivi |
| Windows | `DigiPet Setup 1.0.0.exe` | NSIS kurucu; masaüstü + Start Menu kısayolu |
| Windows | `DigiPet-1.0.0-win.zip` | Kurucusuz klasör (içinde `DigiPet.exe`) |
| Linux | `DigiPet-1.0.0.AppImage` | Çalıştırılabilir tek dosya |
| Linux | `digipet_1.0.0_amd64.deb` | Debian / Ubuntu paketi |

Sürüm numarası `package.json` içindeki `version` alanından gelir (şu an `1.0.0`). Mimari, paketleyen bilgisayara göre değişir; bu Mac Intel (x64) üzerinde üretilmiş örnek isimlerdir.

Kaynak kod: [github.com/nordlyse/DigiPet](https://github.com/nordlyse/DigiPet)

## Kullanıcı olarak kurmak

### macOS

1. `release/DigiPet-1.0.0-mac-x64.dmg` dosyasını aç.
2. **DigiPet** uygulamasını **Applications** klasörüne sürükle.
3. İlk açılışta Gatekeeper “tanınmayan geliştirici” diyebilir: **Sistem Ayarları → Gizlilik ve Güvenlik → Yine de Aç**, veya uygulamaya sağ tık → Aç.
4. Hayvan seç, **Başla**.

Paket imzasızdır (Developer ID yok). Pencere **isimleri** için Ekran kaydı izni gerekebilir; konumlar izinsiz de çalışır.

### Windows

1. `DigiPet Setup 1.0.0.exe` çalıştır, kurulum sihirbazını bitir.
2. Masaüstünde ve Başlat menüsünde **DigiPet** kısayolu oluşur.
3. Alternatif: `DigiPet-1.0.0-win.zip` dosyasını açıp `DigiPet.exe` çalıştır.

SmartScreen uyarı verebilir; yerel derleme olduğu için imza yoktur.

### Linux

- **AppImage:** `chmod +x DigiPet-1.0.0.AppImage && ./DigiPet-1.0.0.AppImage`
- **deb:** `sudo dpkg -i digipet_1.0.0_amd64.deb` (gerekirse `sudo apt -f install`)

Tepsi simgesi için masaüstü ortamının system tray desteği açık olmalı.

## Çıkış

Uygulama tepsi / menü çubuğunda durur; sohbet penceresini kapatmak uygulamayı kapatmaz.

- Menü çubuğu veya tepsideki **DigiPet** simgesine tık / sağ tık → **Quit**
- macOS: Dock’taki DigiPet → Quit, veya **Cmd+Q**
- Windows / Linux: sohbet penceresi açıkken menü **DigiPet → Quit**, veya **Ctrl+Q**

## Geliştirici olarak çalıştırmak

Kaynaktan denemek (paketleme gerekmez):

```bash
git clone https://github.com/nordlyse/DigiPet.git
cd DigiPet
npm install
npm run desktop
```

Bu komut Vite’ı (`http://localhost:5173`) ve Electron’u açar. Ürün tarayıcı sayfası değildir; `npm run desktop` kullan.

## Paketleri yeniden üretmek

Proje kökünde:

```bash
npm install
npm run dist
```

Bu sıra şunu yapar:

1. TypeScript kontrolü + Vite production build (`dist/`)
2. macOS’ta `native/list-windows` derlemesi (`clang`)
3. Windows ICO üretimi (`sips` + `scripts/make-ico.mjs`)
4. electron-builder ile macOS, Linux ve Windows paketleri (`release/`)

Tek platform:

```bash
npm run dist:mac     # DMG + zip
npm run dist:linux   # AppImage + deb
npm run dist:win     # NSIS kurucu + zip (x64)
```

Ayar dosyası: `electron-builder.yml`. Çıktı klasörü: `release/`.

### Gerekli yazılımlar

**Herkes (geliştirme ve paketleme):**

| Yazılım | Sürüm | Neden |
|---|---|---|
| [Node.js](https://nodejs.org/) | 20.x (18+ çoğu işi görür) | `npm`, Vite, Electron |
| npm | Node ile gelir | bağımlılıklar |

`npm install` şunları `node_modules` içine indirir; ayrıca sisteme kurmana gerek yok: Electron 33, electron-builder 25, Vite 6, TypeScript, Three.js, wllama.

**macOS’ta Mac paketi + Windows ICO için (bu makine):**

| Yazılım | Neden |
|---|---|
| Xcode Command Line Tools | `clang` (pencere yardımcısı), `hdiutil` (DMG), `sips` (ICO) |

Kurulum:

```bash
xcode-select --install
```

**Linux paketini Mac/Windows’tan üretmek:** electron-builder ilk seferde kendi `fpm` / AppImage araçlarını indirir. İnternet gerekir.

**Windows NSIS kurucusunu Mac’ten üretmek:** electron-builder kendi Wine kopyasını indirir. Ayrı Wine kurmana gerek yok. Paketleme sırasında ~100 MB Electron binary’leri GitHub’dan iner (`~/Library/Caches/electron` ve `electron-builder`).

**Windows makinede paketlemek:** Node 20 + npm yeterli; `npm run dist:win`. ICO için `scripts/make-ico.mjs` `sips` kullanır (yalnızca macOS). `build/icon.ico` repoda varsa Windows’ta `sips` olmadan da NSIS üretilir.

**Linux makinede paketlemek:** Node 20 + npm; `npm run dist:linux`. AppImage için FUSE gerekebilir.

### İlk paketlemede indirmeler

İlk `npm run dist` şunları indirir (sonrakiler önbellekten gelir):

- Electron runtime (mac / linux / win, her biri ~100 MB)
- AppImage, NSIS, Wine, fpm yardımcıları (gerekirse)

### Sık karşılaşılan notlar

- `release/` git’e girmez; paylaşmak için dosyaları GitHub Releases’e veya başka bir yere kopyala.
- macOS paketi imzasızdır; notarize yok.
- `npm run dist` bulunduğun OS’tan **üç** platformu da hedefleyebilir (electron-builder çapraz derleme). NSIS için Mac’te Wine otomatik iner.
- Pencere tırmanan native yardımcı yalnızca **macOS** paketinin `Contents/Resources/native/list-windows` içine konur.

## Sohbet (yerel AI)

Pet’e **çift tık** veya tepsi menüsünden **Pet ile konuş**.

- Çalışma zamanı: [wllama](https://github.com/ngxson/wllama) (MIT) — llama.cpp WASM
- Model: [SmolLM2-135M-Instruct Q4_K_M](https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF) (Apache-2.0, ~105 MB)
- İlk mesajda model Hugging Face’ten bir kez iner, sonra çevrimdışı çalışır

Aynı GGUF Raspberry Pi ve benzeri edge cihazlarda `llama-cli` ile de koşar. ESP32 sınıfı mikrokontrolcülerde LLM çalışmaz.

## Lisans

MIT. Three.js, Vite, Electron, [llama.cpp](https://github.com/ggerganov/llama.cpp), [wllama](https://github.com/ngxson/wllama): MIT. TypeScript ve SmolLM2: Apache-2.0.

## Author

|         |                                                     |
| ------- | --------------------------------------------------- |
| First name | Jakob                                               |
| Last name  | Lyse                                                |
| GitHub     | [nordlyse](https://github.com/nordlyse)             |
| Email      | [jakob.lyse@gmail.com](mailto:jakob.lyse@gmail.com) |
