# DigiPet

Masaüstünde yaşayan bir pet. Tarayıcı açmaz. İlk kurulumda hayvanını seçersin; sonra menü çubuğundaki **DigiPet** yazısıyla değiştirirsin. Pet, açtığın **gerçek uygulama pencerelerinin** üst kenarına tırmanır (Finder, Cursor, Preview, Safari…).

Kuş, kartal ve hayalet **uçar**. Kedi, köpek, tavşan, kaplumbağa ve fil **zıplar**. Öne gelince büyür, arkaya gidince küçülür.

## Çalıştırma

```bash
npm install
npm run desktop
```

İlk açılışta hayvan seçimi gelir. “Başla” deyince seçim kapanır, pet masaüstünde kalır. Tıklamalar pet’in olmadığı yerde alttaki uygulamalara geçer.

Hayvan değiştirmek için menü çubuğundaki **DigiPet** yazısına tıkla.

Pet’e **çift tık** veya menüden **Pet ile konuş**: yerel **llama.cpp** (MIT) ile **SmolLM2-135M-Instruct** (Apache-2.0, Q4_K_M ~105 MB) cevap verir. İlk sohbette model bir kez iner, sonra çevrimdışı çalışır. Aynı GGUF Raspberry Pi ve benzeri edge / IoT kartlarda `llama-cli` ile de koşar.

## macOS

Gerçek pencere konumları `CGWindowList` ile okunur. Tam pencere **isimleri** için Sistem Ayarları → Gizlilik → Ekran kaydı izni gerekebilir; konumlar izinsiz de çalışır.

## Lisans

MIT. Three.js, Vite, Electron, [llama.cpp](https://github.com/ggerganov/llama.cpp) WASM bağlayıcısı [wllama](https://github.com/ngxson/wllama): MIT. TypeScript ve [SmolLM2](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct): Apache-2.0.
