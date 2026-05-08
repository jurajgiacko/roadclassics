/* Afterparty scene — multi-stage evening narrative.
   Four illustrated panels with short text vignettes; player taps "Ďalej"
   to progress. Final panel wraps the day with a CTA to share or restart. */
(function () {
  let overlay = null;
  let idx = 0;

  /* Riding-style classification — determines which ending arc plays */
  function dominantStyle(log = []) {
    if (!log.length) return 'tempar';
    const counts = log.reduce((a, c) => (a[c] = (a[c] || 0) + 1, a), {});
    const max = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const dominance = max[1] / log.length;
    if (dominance < 0.5)        return 'taktik';
    if (max[0] === 'attack')    return 'attacker';
    if (max[0] === 'refuel')    return 'fueler';
    return 'tempar';
  }

  /* Each branch is a 4-panel arc keyed on (recoveryMood, dominantStyle).
     Some panels share images, but every combination has its own copy
     so the run feels meaningfully different on replay. */
  const ARCS = {
    /* recovery: PROSECCO + STYLE */
    'celebrate-attacker': [
      { img: 'afterparty-cellar.png',  title: 'Vinotéka u sommeliéra',     body: 'Sommelier tě poznává ze závodu a rozumí tvému solo útěku. Otevírá Pálava Riesling z 2019. Bublinky stoupají rychleji než tvůj puls na Děvíně.' },
      { img: 'afterparty-music.png',   title: 'Cimbálovka & oslavné kola', body: 'Někdo připije: „Na atak!" Cimbálovka střídá valčík za csardáš. Tvůj vítězný nájezd dnes ještě jednou, jen v hudbě.' },
      { img: 'afterparty-cheers.png',  title: 'Trofejní přípitek',         body: 'Diplom se nedostal jen peletonu — zařízl jsi vlastní pruh. Pět skleniček uprostřed stolu. Tvoje jméno padá v rozhovoru.' },
      { img: 'afterparty-stars.png',   title: 'Sám na vrcholu',            body: 'Před půlnocí kráčíš ke kolonádě sám. Hvězdy svítí jako při tvém sprintu. <em>Vyhrál jsi svůj ročník — i kdybys nikoho nepředjel, vyhrál jsi sebe.</em>', finale: true }
    ],
    'celebrate-tempar': [
      { img: 'afterparty-cellar.png',  title: 'Vinotéka ve skupině',       body: 'Scházíš s peletonem pod klenbu. Bublinky cinkají, někdo rozdává fotky z dnešní Reistny. Jsi jedním z mnoha — a to je dobré.' },
      { img: 'afterparty-music.png',   title: 'Tanec společně',            body: 'Cimbálovka hraje, peleton se drží v kruhu. Jako celý den — sdílená radost je dvojnásobná.' },
      { img: 'afterparty-cheers.png',  title: 'Toast za tým',              body: '„Na další rok!" volá někdo. Skla cinknou. Tvá strategie sedět-na-kolesech ti dnes přinesla nejen čas, ale i kamarády.' },
      { img: 'afterparty-stars.png',   title: 'Tichý závěr',               body: 'U kolonády si jen naznačíš sklenku. Hvězdy. Ticho. <em>Ne každý monument musí být výhra. Někdy stačí přijet — s ostatními.</em>', finale: true }
    ],
    'celebrate-fueler': [
      { img: 'afterparty-cellar.png',  title: 'Vinotéka & čerstvé síly',   body: 'Tvoje strategie plnění kapes se vyplatila — máš ještě energii dopít celou láhev. Sommelier zvedá obočí nad tvou výdrží.' },
      { img: 'afterparty-cheers.png',  title: 'Energetický mág',           body: 'U stolu padají otázky: „Který gel před Reistnou? Caffeine?" Ty kýveš. Tvoje schopnost dávkovat ti dnes přinesla víc než svaly.' },
      { img: 'afterparty-music.png',   title: 'Tanec s vínem',             body: 'Hraje folklór, ty si to vychutnáváš. Dnes tě neporazila energy, víno tě taky neporazí.' },
      { img: 'afterparty-stars.png',   title: 'Zasloužený výhled',         body: 'Stojíš u kolonády s posledním pohárem. <em>Někteří jsou silní v nohách. Ty jsi silný v plánování.</em>', finale: true }
    ],
    'celebrate-taktik': [
      { img: 'afterparty-cellar.png',  title: 'Sklep — adaptivní styl',    body: 'Jeden moment pivo, druhý prosecco. Tvoje taktika dnes byla: čti situaci. Čteš ji i večer.' },
      { img: 'afterparty-music.png',   title: 'Cimbálovka & rozhovory',    body: 'Skáčeš mezi stoly, vyslechneš tři verze dnešního sprintu. Jak jsi v race vybíral, tak vybíráš teď.' },
      { img: 'afterparty-cheers.png',  title: 'Univerzální toast',         body: 'Připíjíš s každým za něco jiného. Někdo ti říká: „Jsi tam, kde by tě bylo třeba." Jen kývneš.' },
      { img: 'afterparty-stars.png',   title: 'U kolonády',                body: 'Stojíš a přemýšlíš o všech malých rozhodnutích dne. <em>Nemáš jeden styl. Máš všechny.</em>', finale: true }
    ],

    /* recovery: PIVO + STYLE */
    'classic-attacker': [
      { img: 'afterparty-cellar.png',  title: 'Sklep & půllitry',          body: 'Trefíš se do sklepa přes všechny ty čerstvě zorané vinice. Pivo jde dolů první bez problému. Atak na Děvín byl mladší než tohle pivo.' },
      { img: 'afterparty-music.png',   title: 'Folklórní divočina',        body: 'Cimbálovka rozhodí klasiku, ty kopíruješ kroky. Adrenalin ze závodu ještě neopadl — promítá se do tance.' },
      { img: 'afterparty-cheers.png',  title: 'Půllitry na atak',          body: '„Na sólovou jízdu!" Pět půllitrů se srazí uprostřed. Pěna teče. Tvůj solo úsek dnes byl v záznamech.' },
      { img: 'afterparty-stars.png',   title: 'Tichý vrchol',              body: 'Kráčíš u kolonády, poslední doušek z lahve. <em>Pivo je odměna těla. Kolonáda je odměna duše.</em>', finale: true }
    ],
    'classic-tempar': [
      { img: 'afterparty-cellar.png',  title: 'Sklep — celý peleton',      body: 'Všech patnáct, co jsi dnes držel ve skupině, sedí teď kolem tebe. Pivo cinká. Řeči o tom, kdo kdy zabral.' },
      { img: 'afterparty-music.png',   title: 'Tanec do rytmu',            body: 'Cimbálovka, kolektivní tanec. Jako v race — chycené kolo, jeden rytmus. I večer.' },
      { img: 'afterparty-cheers.png',  title: 'Klasický přípitek',         body: '„Bratrstvo silnice!" volá někdo. Půllitry cinknou. Jsi v tom nejlepším skupinovém feel-u v životě.' },
      { img: 'afterparty-stars.png',   title: 'Poslední doušek',           body: 'U kolonády s pivem v ruce. <em>Někdy je vyhrát i zůstat s ostatními.</em>', finale: true }
    ],
    'classic-fueler': [
      { img: 'afterparty-cellar.png',  title: 'Sklep & rozbory',           body: 'U stolu rozebíráš s ostatními, který gel kdy. Pivo se pije pomalu — analyzujete dnešek jako laboratoř.' },
      { img: 'afterparty-cheers.png',  title: 'Toast za strategii',        body: '„Na bilancování!" Pivo cinklo. Dnes nešlo o sílu — o systém. To pochopil každý u stolu.' },
      { img: 'afterparty-music.png',   title: 'Folklór & klid',            body: 'Hraje, ty kýveš hlavou. Plnou energy sis schoval na konec — i na večer.' },
      { img: 'afterparty-stars.png',   title: 'Tichá kontrola',            body: 'Kolonáda, poslední pivo. <em>Ne všichni jezdci jsou o adrenalin. Někteří jsou o execution.</em>', finale: true }
    ],
    'classic-taktik': [
      { img: 'afterparty-cellar.png',  title: 'Sklep & flexibilita',       body: 'Nejdřív s peletonem, pak solo. I večer jsi flexibilní — pivo s každou skupinkou.' },
      { img: 'afterparty-music.png',   title: 'Tanec mezi stoly',          body: 'Cimbálovka pomalá, pak rychlá. Ty s ní. Jako celý den — citlivý na rytmus.' },
      { img: 'afterparty-cheers.png',  title: 'Mix toast',                 body: 'Připíjíš s útočníky, pak s tempaři. Nikam nepatříš naplno — a všichni tě berou.' },
      { img: 'afterparty-stars.png',   title: 'Střed světa',               body: 'U kolonády, pivo se ztratilo. <em>Nemáš jeden styl. Máš dnes svůj den.</em>', finale: true }
    ],

    /* recovery: R2 + STYLE */
    'pro-attacker': [
      { img: 'afterparty-cellar.png',  title: 'R2 & rozbor ve sklepě',     body: 'Sedíš se svým R2 shakerem uprostřed peletonu. Dnes nebudeš pít. Profesionální restart, jako Pidcock po Strade.' },
      { img: 'afterparty-music.png',   title: 'Cimbálovka & pohledy',      body: 'Hraje folklór, ty stojíš stranou. Tvůj solo atak dnes mluvil sám za sebe. Nepotřebuješ to vykecávat.' },
      { img: 'afterparty-cheers.png',  title: 'Tichý přípitek vodou',      body: 'Sommelier ti nalije vodu s plátkem citronu. „I to je oslava." Cinkne se. Pamatuješ si dnešek dokonale jasně.' },
      { img: 'afterparty-stars.png',   title: 'Kolonáda — vize',           body: 'Stojíš u kolonády s tréninkovým plánem v hlavě. Dnes byl první monument. <em>Budeš se vracet. A vyhrávat.</em>', finale: true }
    ],
    'pro-tempar': [
      { img: 'afterparty-cellar.png',  title: 'R2 & disciplína',           body: 'Peleton pije, ty máš shake. Disciplína dnes vyhrála ve skupině — zůstává ti i večer.' },
      { img: 'afterparty-cheers.png',  title: 'Přípitek studenou vodou',   body: '„Profík," kývá někdo. Tvá taktická trpělivost dnes a tvoje recovery dnes — dva roky tréninku zhuštěné do jednoho dne.' },
      { img: 'afterparty-music.png',   title: 'Folklór — pozorovatel',    body: 'Hraje cimbál. Ty počítáš make-up na zítřejší tréninkové intervaly.' },
      { img: 'afterparty-stars.png',   title: 'Kolonáda — protokol',       body: 'U kolonády stojíš a v hlavě ti běží zítřejší easy-spin. <em>Profík se nenarodí. Vykove se.</em>', finale: true }
    ],
    'pro-fueler': [
      { img: 'afterparty-cellar.png',  title: 'R2 & dvojitý protokol',     body: 'Double win — perfektní palivo během race + R2 po. Tvůj nutriční plán by mohly koupit týmy World Tour.' },
      { img: 'afterparty-cheers.png',  title: 'Studená voda & rozbor',     body: '„Které gely jsi bral?" ptá se někdo. Vyjmenuješ. Stůl si dělá poznámky.' },
      { img: 'afterparty-music.png',   title: 'Folklór — focus',           body: 'Hraje cimbálovka, ty kontroluješ HRV na hodinkách. Recovery monitor je v zelené.' },
      { img: 'afterparty-stars.png',   title: 'Kolonáda — vědomě',         body: 'U kolonády jsi vědomý každého procesu v těle. <em>Jsi stroj. Ale stroj, který ví.</em>', finale: true }
    ],
    'pro-taktik': [
      { img: 'afterparty-cellar.png',  title: 'R2 & analýza',              body: 'Sleduješ ostatní u piva, popíjíš R2. Dnes jsi měnil strategii třikrát — perfektní adaptace.' },
      { img: 'afterparty-music.png',   title: 'Cimbálovka — patterns',     body: 'Hudbu posloucháš jako power profile. Atak ve 3. taktu, recovery ve 4.' },
      { img: 'afterparty-cheers.png',  title: 'Toast za execution',        body: 'Připíjíš vodou. „Někdy je vítězství: rozhodnout se správně ve správný moment." Stůl přikývne.' },
      { img: 'afterparty-stars.png',   title: 'Kolonáda — meta-mode',      body: 'Stojíš a hodnotíš celý den jako spectacle. <em>Vidíš věci, které ostatní nevidí. I dnes. I zítra.</em>', finale: true }
    ]
  };

  function panels(j) {
    const mood = j.recoveryMood || 'classic';
    const style = dominantStyle(j.styleLog);
    const key = `${mood}-${style}`;
    const arc = ARCS[key] || ARCS['classic-tempar'];
    return arc.map(p => ({ ...p, img: `/assets/scenes/finish/${p.img}` }));
  }

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'scene-afterparty';
    overlay.className = 'scene-overlay scene-afterparty';
    overlay.innerHTML = `
      <div class="ap-stage">
        <div class="ap-art" id="ap-art"></div>
        <div class="ap-vignette">
          <div class="ap-step" id="ap-step">1 / 4</div>
          <h2 class="ap-title" id="ap-title">…</h2>
          <p class="ap-body" id="ap-body">…</p>
          <div class="ap-actions" id="ap-actions"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function render(j) {
    const list = panels(j);
    const p = list[idx];
    overlay.querySelector('#ap-step').textContent = `${idx + 1} / ${list.length}`;
    overlay.querySelector('#ap-art').style.backgroundImage = `url('${p.img}')`;
    overlay.querySelector('#ap-title').textContent = p.title;
    overlay.querySelector('#ap-body').innerHTML = p.body;
    const actions = overlay.querySelector('#ap-actions');
    actions.innerHTML = '';
    if (idx > 0) {
      const back = document.createElement('button');
      back.type = 'button'; back.className = 'btn btn-ghost';
      back.textContent = '← Zpět';
      back.addEventListener('click', () => { idx -= 1; render(j); });
      actions.appendChild(back);
    }
    const next = document.createElement('button');
    next.type = 'button'; next.className = 'btn btn-primary';
    next.textContent = p.finale ? 'Ukončit den' : 'Dál →';
    next.addEventListener('click', () => {
      if (p.finale) finish(j);
      else { idx += 1; render(j); }
    });
    actions.appendChild(next);
  }

  function finish(j) {
    window.rcTrack && window.rcTrack('afterparty_complete', {
      mood:  j.recoveryMood,
      score: j.score
    });
    /* Show the original finish modal one more time as the day-end summary,
       enriched with afterparty mood. The replay/share/back buttons handle
       continuation. */
    overlay && overlay.classList.remove('show');
    /* Trigger original finish modal display via rcFinish — but state is
       already finished. Reopen modal directly: */
    const modal = document.getElementById('finish-modal');
    if (modal) modal.classList.add('show');
  }

  async function enter() {
    build();
    idx = 0;
    const j = window.rcScenes.journey();
    render(j);
    overlay.classList.add('show');
  }
  async function exit() { overlay && overlay.classList.remove('show'); }

  window.rcScenes.register('afterparty', { enter, exit });
})();
