# Road Classics: The Climb

Webová arkádová cyklistická hra pre seriál **Road Classics** v co-brandingu s **Enervit**. Hráč prekonáva ikonické české monumenty (Pálava, Vysočina, Ještěd) tak, že trafí správny pacing, manažuje energiu a využíva Enervit produkty na trati.

> Tagline: **„Monumenty, co tě zvednou ze sedla."**

---

## 1. Vízia + cieľ

- **Lead-gen + brand engagement nástroj** pre Road Classics 2026 sezónu sponzorovaný Enervitom.
- Distribúcia cez QR kódy na evente, social ads, newsletter, partnerské stránky.
- Cieľová doba hrania: **2–4 minúty per pokus**, replayability cez leaderboard a 3 monumenty.
- Cieľová platforma: **mobile-first web**, pristupné cez ľubovoľný prehliadač bez inštalácie.
- Doména: **roadclassics.enervit.online** (zatiaľ TBD, hostujeme na Vercel).

## 2. Scope (MVP — fáza 1)

**MVP = Pálava monument**, plne hrateľný, bez backend leaderboardu.

V scope:
- Vstupná obrazovka (3 monumenty, 1 aktívny)
- Hrateľná Pálava trať s gameplay loopom (cadence + energy + pickupy + tactical decisions)
- Finišová obrazovka so štýlom jazdy + zdielateľný PNG
- GA4 analytics

Mimo scope MVP (fáza 2+):
- Klínovec/Vysočina + Ještěd trate
- Online leaderboard (Vercel KV alebo Supabase)
- Účty / login
- Multiplayer alebo head-to-head
- Lokalizácia mimo CS/SK

## 3. Tech stack

| Vrstva | Voľba | Prečo |
|---|---|---|
| Hosting | **Vercel** (static) | Zero-config, edge CDN, preview deploys, custom domain. |
| Frontend | **Vanilla JS + HTML5 Canvas** | Žiadny build step, malý bundle, full control nad render loopom. |
| Štýly | **CSS3 + custom properties** | Bez frameworku, veľmi mobile-first responzívne. |
| Fonty | **Inter** + **Fraunces** (Google Fonts) | Free alternatívy k brand fontom Sharp Grotesk + VC Henrietta. |
| Analytics | **GA4** (gtag.js) | Bezplatné, dostatočné pre KPI. |
| Leaderboard (fáza 2) | Vercel KV / Upstash Redis | Serverless, lacné, žiadny vlastný backend. |

**Rozhodnutie:** žiadny build krok pre MVP. Súbory sa servujú ako-sú, Vercel ich pošle s automatickou kompresiou. Ak neskôr potrebujeme TypeScript / Vite, prejdeme.

## 4. Brand identita

### 4.1 Road Classics farby (z roadclassics.cz CSS)

| Token | Hex | Použitie |
|---|---|---|
| `--rc-primary` | `#450521` | Wine burgundy — primárna brand farba, hlavičky, CTA |
| `--rc-cream` | `#e4cb9d` | Sekundárna — accenty, borders, hover stavy |
| `--rc-bg-light` | `#faf7f0` | Pozadie sekcií, karty |
| `--rc-energy` | `#e53747` | Akčné CTA, "Štart", energy bar critical |

### 4.2 Enervit farby

| Token | Hex | Použitie |
|---|---|---|
| `--en-red` | `#e30613` | Enervit red — partner badge, pickupy |
| `--en-white` | `#ffffff` | Enervit logo varianta |

### 4.3 Funkčné farby

| Token | Hex | Použitie |
|---|---|---|
| `--ok` | `#198754` | Cadence v ideálnom pásme, úspech |
| `--warn` | `#ffc107` | Cadence stredné pásmo, energy 25–50 |
| `--crit` | `#dc3545` | Anaerob, BONK, energy <25 |
| `--ink` | `#212529` | Body text |
| `--muted` | `#6c757d` | Secondary text |

### 4.4 Typografia

- **Headings:** `Fraunces` (700/900) — high-contrast serif, evokuje monument/heritage feel.
- **Body / UI:** `Inter` (400/600) — neutrálny moderný sans.
- Fallback stack: `system-ui, -apple-system, sans-serif`.

### 4.5 Logá (`/public/assets/logos/`)

- `rc_logo_horizontal_sb.svg` — Road Classics horizontálne (cream na tmavom)
- `rc_logo_vertical_sb.svg` — Road Classics vertikálne
- `rc_logo_symbol_db.svg` — RC monogram (burgundy)
- `enervit_logo.svg` — Enervit oficiálne (white)

## 5. Trate (zdroj: roadclassics.cz)

### 5.1 Pálava (MVP) — 16. máj 2026, Valtice

| Variant | Distance | Elevation | Time limit | Min pace |
|---|---|---|---|---|
| Long | 125 km | 1 450 m | 5h 25min | 22.5 km/h |
| Short | 64 km | 800 m | 3h 5min | 19.5 km/h |

**Trasa:** Valtice → Lednice → Mikulov → Novomlýnské nádrže → Bořetice → Bulhary → Reistna (kolonáda).

**Key climbs / segmenty:**
- **Děvín** — najvyšší vrchol Pálavy (550 m n.m.), strmé stúpanie
- **Tesarova past** — technický úsek
- **Reistna** — finálne stúpanie ku kolonáde

**In-game zjednodušenie:** trať škálujeme na **~3 min playtime**, segmenty zachovávame pomerovo. Pozri `monuments/palava.json`.

### 5.2 Vysočina (fáza 2) — 18. júl 2026, Nové Město na Moravě

- Long: 102 km / 1 750 m | Short: 62 km / 1 000 m
- Trasa: Vysočina Arena → Jimramov → Tři Studně → Herálec → pod Devět skal → Milovy → Arena

### 5.3 Ještěd (fáza 2) — 19. september 2026, Liberec

- Long: 106 km / 2 200 m | Short: 49 km / 1 000 m
- Trasa: Liberec → Jizerské hory → Oldřichov v Hájích → Mníšek → Kryštofovo Údolí → Ještěd

> **Pôvodne plánovaný „Klínovec"** v scope nie je v 2026 sezóne — nahradili ho Vysočinou. Aktualizoval som scope.

## 6. Gameplay loop

### 6.1 Core mechanika — Cadence

Hráč drží **medzerník** (desktop) alebo **tap-and-hold** (mobile):
- držaním sa zvyšuje **cadence** (RPM)
- pustením klesá

Pásma:
- **<70 RPM** — nedotáčaš, rýchlosť klesá, energia šetrná
- **70–80 RPM** — žltozelená, OK tempo
- **80–95 RPM** — **ideál**, zelená, najefektívnejší pomer rýchlosť/spotreba
- **95–110 RPM** — žltá, vyššia spotreba
- **>110 RPM** — **anaerob**, červená, 1.5× rýchlosť ale 3× spotreba energie

### 6.2 Energy systém

- Štart **100/100**.
- Klesá lineárne podľa cadence + multipliera podľa gradientu.
- Stúpa pri pickupoch (gel +20, bar +35, drink +25).
- Pri **0** = **BONK**: spomalenie na 50 % po dobu 2 s + overlay „BONK".

Vizuálne pásma:
- `>50` zelená, `25–50` žltá, `<25` červená (animovaný pulz).

### 6.3 Pickupy (Enervit produkty)

Spawn na fixných km podľa preset poľa pre každú trať.

| Typ | Effect | Kedy ho dať |
|---|---|---|
| `gel` (Liquid Gel) | +20 energy, +5 % rýchlosť 10 s | Pred krátkym prudkým stúpaním |
| `bar` (Power Sport Bar) | +35 energy, žiadny rýchlostný bonus | Pred dlhým úsekom |
| `drink` (Sport Drink) | +25 energy, +10 % rýchlosť 5 s | Po vrchole, regeneračná |

Vizuál: ikona produktu + text bublinka 2 s nad cyklistom pri zbere.

### 6.4 Tactical decisions

Trigger v **33 %** a **66 %** trate. Pause game, modal s 3 voľbami + 3 s countdown. Default = „drž tempo".

Príklady (Pálava 33 % — pri Mikulove):
- **Atak na Děvín** — 2× spotreba energie 30 s, +bonus k času
- **Drž tempo** — bez efektu (default)
- **Doplň** — automaticky použiť pickup z inventára

Voľby sú logované pre klasifikáciu **štýlu jazdy** v finishi:
- `attacker` (>50 % útokov)
- `tempař` (>50 % drž tempo)
- `taktik` (mix s viac doplňovaní)

### 6.5 Profil tratu

Mini-mapa hore zobrazuje výškový profil + aktuálnu pozíciu hráča. Gradient v aktívnom segmente:
- Zjazd (negat. gradient): +rýchlosť, -spotreba
- Rovinka: baseline
- Stúpanie: -rýchlosť, +spotreba (multiplier 1.5×–3× podľa %)

### 6.6 Finiš

Po dosiahnutí 100 % trate: stop game, modal s:
- Finálny **čas**
- **Štýl jazdy** (attacker/tempař/taktik)
- **Zostatok energie**
- **Rank** (zatiaľ lokálny — fáza 2: globálny leaderboard)
- CTA: **Share PNG**, **Hraj znova**, **Späť na monumenty**

PNG generuje cez `canvas.toBlob()` + Web Share API (mobile) alebo download (desktop).

## 7. Štruktúra projektu

```
/
├── CLAUDE.md                   ← tento súbor
├── README.md                   ← ako rozbehnúť, ako deploynúť
├── package.json                ← iba dev dependencies (vercel CLI optional)
├── vercel.json                 ← konfigurácia hostingu, headers, redirects
├── .gitignore
└── public/                     ← všetko čo Vercel servuje
    ├── index.html              ← vstupná obrazovka
    ├── game.html               ← herná obrazovka
    ├── leaderboard.html        ← TBD fáza 2
    ├── css/
    │   └── styles.css
    ├── js/
    │   ├── main.js             ← logika vstupnej obrazovky
    │   ├── leaderboard.js      ← TBD
    │   ├── analytics.js        ← GA4 wrapper
    │   └── game/
    │       ├── engine.js       ← game loop + canvas mgmt
    │       ├── player.js       ← cyklista, cadence, energia
    │       ├── pickups.js      ← spawn + collision
    │       ├── tactics.js      ← decision moduly
    │       ├── monument.js     ← profile loader + gradient logic
    │       ├── ui.js           ← HUD, modals, finish screen
    │       └── input.js        ← keyboard + touch
    ├── monuments/
    │   ├── palava.json         ← MVP trať data
    │   ├── vysocina.json       ← stub
    │   └── jested.json         ← stub
    └── assets/
        ├── logos/
        │   ├── rc_logo_horizontal_sb.svg
        │   ├── rc_logo_vertical_sb.svg
        │   ├── rc_logo_symbol_db.svg
        │   └── enervit_logo.svg
        ├── pickups/            ← TBD ikony produktov
        └── og/                 ← TBD social share image
```

## 8. Analytics events (GA4)

Hookuj cez `js/analytics.js`:

| Event | Kedy | Params |
|---|---|---|
| `game_start` | klik na Štart Pálava | monument |
| `monument_picked` | výber monumentu z hero | monument, was_active |
| `tactical_choice` | vybratie taktiky | monument, segment_pct, choice |
| `pickup_collected` | zobratý pickup | monument, type, km |
| `bonk` | hráč šiel na 0 energy | monument, km |
| `game_finish` | dokončený monument | monument, time_s, style, energy_left |
| `share_clicked` | klik na share PNG | monument, channel |
| `replay_clicked` | klik na hraj znova | monument |

## 9. Performance ciele

- **Lighthouse mobile ≥ 90** (perf, a11y, best-practices)
- **TTI < 2 s** na 4G priemernom mobile
- **Bundle JS < 60 KB** unminified pre MVP (vanilla, žiadne deps)
- **60 fps** game loop na priemernom mid-range mobile (CPU 4× throttle test)
- WebP/AVIF pre obrázky, SVG pre ikony, font subset (latin + latin-ext)

## 10. Accessibility

- Klávesová hra full end-to-end (medzerník = hold-to-pedal, Enter = potvrdiť, Esc = pause/menu)
- Touch targets ≥ 44 × 44 dp
- Kontrast minimum AA, kritické UI AAA
- Alt texty na všetky obrázky/ikony
- Reduced motion: zjednodušený parallax pri `prefers-reduced-motion`

## 11. GDPR / cookies

- GA4 = analytical cookies, vyžadujú **opt-in**
- Plán: vlastný banner (jednoduchý, lightweight) namiesto Cookiebot pre MVP
- Žiadne 3rd-party trackery okrem GA4
- Privacy notice link v päte na Enervit privacy page

## 12. Roadmap (revízia 2 — story-driven illustrated)

Po prvotnej iterácii sme procedural canvas pivot opustili — nedosahuje
kvalitu @road__classics × @themartinpaseka illustration referencie.
Nový plán je sprite-based asset pipeline cez **Gemini Nano Banana**
(2.5 Flash Image) generated illustrations + multi-stage story flow
inšpirovaný [dogtravel.cz](https://www.dogtravel.cz/).

| Sess. | Obsah | Status |
|---|---|---|
| 1 | Asset generation pipeline (Nano Banana script + manifest + style guide) → ~40 illustrations | aktívne |
| 2 | Scene state machine + sprite renderer + GPX-driven segments | pending |
| 3 | Pre-race story stages: ráno/kuchyňa, garáž/bike, jersey packing, drive, štart | pending |
| 4 | Race scene v plnej kráse: real GPX trasa, illustrated peloton, mid-race events | pending |
| 5 | Finiš pri Reistnej kolonáde, audio, animácie, polish, lighthouse, launch | pending |

## 13. Asset pipeline

- **Image gen:** Gemini 2.5 Flash Image API (Nano Banana)
- **Style anchor:** `assets/illustrations/style-reference.png` (uložený screenshot z @road__classics × @themartinpaseka IG story)
- **Manifest:** `tools/assets-manifest.json` — každá ilustrácia má `id`, `prompt`, `aspect`, `category`
- **Generator script:** `tools/generate-assets.mjs` — Node, čítaj manifest, volaj API, ulož `public/assets/scenes/<id>.png`
- **API key:** v `.env.local` (gitignored) ako `GEMINI_API_KEY`

### Categories (~40 assets)
- **landscapes/** — 8× scenérie (Valtice ráno, vinice, Lednice château, Mikulov, Děvín, Novomlýnské nádrže, Tesarova past, Reistna kolonáda)
- **prerace/** — 5× kuchyňa, garáž, bike, jersey s vreckami, štart line briefing
- **characters/** — 8× cyklista (front/back/3-quarter), peloton 4×, vinař, mechanik, sommelier, dog mascot
- **stations/** — 3× Enervit stánok pri scenérii (gel/bar/drink variant)
- **events/** — 4× defekt pneu, gel grab, attack moment, klobúk fanúšika
- **finish/** — 2× cieľová pása, peloton group photo
- **map/** — 4× location pin, R-monogram badge, km marker, achievement icon

## 14. GPS & route data

- **Pálava long GPX:** [roadclassics.cz/stahovani/15-gpx-palava-2026-dlouha](https://www.roadclassics.cz/stahovani/15-gpx-palava-2026-dlouha)
- **Pálava short GPX:** [roadclassics.cz/stahovani/16-gpx-palava-2026-kratka](https://www.roadclassics.cz/stahovani/16-gpx-palava-2026-kratka)
- Parser: `tools/gpx-to-segments.mjs` → vyextrahuje turn-by-turn + elevation profile
- Output: `public/monuments/palava-real.json` — segmenty s reálnou geometriou
- Použité v race scéne pre zakrivenie cesty a presné landmark prepojenie

---

**Posledná aktualizácia:** 2026-05-07 (revízia 2)
**Repozitár:** https://github.com/jurajgiacko/roadclassics
**Live:** https://roadclassics.vercel.app
