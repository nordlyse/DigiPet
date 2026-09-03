# DigiPet

Masaüstünde yaşayan bir pet. Tarayıcı açmaz. İlk kurulumda hayvanını seçersin; sonra menü çubuğundaki 🐾 ile değiştirirsin. Pet, açtığın **gerçek uygulama pencerelerinin** üst kenarına tırmanır (Finder, Cursor, Preview, Safari…).

Kuş, kartal ve hayalet **uçar**. Kedi, köpek, tavşan, kaplumbağa ve fil **zıplar**. Öne gelince büyür, arkaya gidince küçülür.

## Çalıştırma

```bash
npm install
npm run desktop
```

İlk açılışta hayvan seçimi gelir. “Başla” deyince seçim kapanır, pet masaüstünde kalır. Tıklamalar pet’in olmadığı yerde alttaki uygulamalara geçer.

Hayvan değiştirmek için menü çubuğundaki 🐾 simgesine tıkla.

## macOS

Gerçek pencere konumları `CGWindowList` ile okunur. Tam pencere **isimleri** için Sistem Ayarları → Gizlilik → Ekran kaydı izni gerekebilir; konumlar izinsiz de çalışır.

## Lisans

MIT. Three.js, Vite, Electron: MIT. TypeScript: Apache-2.0.
