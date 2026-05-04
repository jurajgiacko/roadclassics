# Road Classics: The Climb

Webová arkádová cyklistická hra pre seriál **Road Classics × Enervit**. Vanilla JS + HTML5 Canvas, hosted na Vercel.

> Tagline: *Monumenty, co tě zvednou ze sedla.*

Plný design + scope: [`CLAUDE.md`](./CLAUDE.md).

---

## Lokálny dev

Žiadny build krok — všetko sa servuje staticky z priečinka `public/`.

```bash
# raz, pri prvej inštalácii
npm install

# spusti lokálny server na http://localhost:3000
npm run dev
```

`npm run dev` používa `npx serve public -l 3000`. Ak nechceš inštalovať `serve`, postačí čokoľvek čo servuje statiku z `public/`:

```bash
# alternatívy
python3 -m http.server 3000 --directory public
npx http-server public -p 3000
```

Otvor `http://localhost:3000/` (vstupná obrazovka) alebo `http://localhost:3000/game.html?monument=palava` (hra).

## Štruktúra

```
public/
├── index.html             # vstupná obrazovka
├── game.html              # canvas game
├── leaderboard.html       # placeholder (fáza 2)
├── css/styles.css
├── js/
│   ├── analytics.js       # GA4 wrapper
│   ├── main.js            # entry-screen interakcie
│   └── game/
│       ├── engine.js      # game loop + render
│       ├── input.js       # spacebar + touch
│       ├── monument.js    # JSON loader, gradient API, profil SVG
│       └── ui.js          # HUD bindings (timer, energy, kadencia)
├── monuments/
│   └── palava.json        # MVP trať (segmenty, pickupy, taktiky)
└── assets/logos/          # SVG logá Road Classics + Enervit
```

## Deploy na Vercel

1. **Pripoj repo** v Vercel dashboarde → *Add New Project* → `jurajgiacko/roadclassics`.
2. Framework preset: **Other**.
3. Output directory: `public` (Vercel si to prečíta z `vercel.json`).
4. Build command: žiadny.
5. **Custom domain:** v Vercel projekte `Settings → Domains` pridaj `roadclassics.enervit.online` a v DNS zóne enervit.online vytvor `CNAME → cname.vercel-dns.com`.

Alternatívne z CLI:

```bash
npx vercel        # preview
npx vercel --prod # produkcia
```

### GA4 measurement ID

Pred deployom:
- Edituj `public/index.html` a `public/game.html`, alebo
- Inject globálnu premennú `window.__GA_MEASUREMENT_ID__ = 'G-XXXXXXX'` skôr ako sa načíta `analytics.js`.

Bez ID sa eventy logujú do `console.debug` (handy pre dev).

## Roadmap

| Session | Obsah |
|---|---|
| **1 — done** | Setup, vstupná obrazovka, skeleton hernej obrazovky, Pálava JSON |
| 2 | Player module (cadence + energy + zóny + BONK) |
| 3 | Pickupy + tactical decisions + gradient logic v engine |
| 4 | Finišová obrazovka, share PNG, leaderboard (Vercel KV) |
| 5 | Polish, Lighthouse audit, deploy, QR test |

Pozri [`CLAUDE.md`](./CLAUDE.md) pre kompletné špecifikácie každej fázy.

## Licencie a brand

Logá Road Classics a Enervit sú použité s vedomím partnerstva, nie sú voľné na ďalšiu distribúciu. Fonty `Inter` a `Fraunces` z Google Fonts (open source).
