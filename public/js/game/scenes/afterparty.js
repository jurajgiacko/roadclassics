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
      { img: 'afterparty-cellar.png',  title: 'Vinotéka u sommeliéra',  body: 'Sommelier ťa pozná z pretekov a rozumie tvojmu solo úteku. Otvára Pálava Riesling z 2019. Bublinky stúpajú rýchlejšie ako tvoj puls na Děvíne.' },
      { img: 'afterparty-music.png',   title: 'Cimbálovka & oslavné kola',body: 'Niekto pripije: „Na atak!" Cimbálovka strieda valčík za csardas. Tvoj víťazný nájazd dnes ešte raz, len v hudbe.' },
      { img: 'afterparty-cheers.png',  title: 'Trofejný prípitok',       body: 'Diplom sa nedostal len peletónu — zarezal si vlastný pruh. Päť pohárov v strede stola. Tvoje meno padá v rozhovore.' },
      { img: 'afterparty-stars.png',   title: 'Sám na vrchole',          body: 'Pred polnocou kráčaš ku kolonáde sám. Hviezdy svietia ako pri tvojom šprinte. <em>Vyhral si svoj ročník — aj keby si nikoho nepredbehol, vyhral si seba.</em>', finale: true }
    ],
    'celebrate-tempar': [
      { img: 'afterparty-cellar.png',  title: 'Vinotéka v skupine',      body: 'Schádzaš s peletónom pod klenbu. Bublinky cinkajú, niekto rozdáva fotky z dnešnej Reistny. Si jedným z mnohých — a to je dobré.' },
      { img: 'afterparty-music.png',   title: 'Tanec spoločne',          body: 'Cimbálovka hrá, peletón sa drží v kruhu. Ako celý deň — radosť zdieľaná je dvojnásobná.' },
      { img: 'afterparty-cheers.png',  title: 'Toast za team',           body: '„Na ďalší rok!" prevoláva niekto. Sklá štrnknú. Tvoje sedieť-na-kolesá strategia ti dnes priniesla nielen čas, ale aj kamarátov.' },
      { img: 'afterparty-stars.png',   title: 'Tichý záver',             body: 'Pri kolonáde si naznačíš pohár. Hviezdy. Ticho. <em>Nie každý monument musí byť výhra. Niekedy stačí prísť — s ostatnými.</em>', finale: true }
    ],
    'celebrate-fueler': [
      { img: 'afterparty-cellar.png',  title: 'Vinotéka & čerstvé sily', body: 'Tvoja stratégia plnenia tres-ky sa vyplatila — máš ešte energiu dopiť celú fľašu. Sommelier dvíha obočie nad tvojou výdržou.' },
      { img: 'afterparty-cheers.png',  title: 'Spoznaný energetický mág',body: 'Pri stole padajú otázky: „Ktorý gel pred Reistnou? Caffeine?" Ty si prikývol. Tvoja schopnosť dávkovať ti dnes priniesla viac ako svaly.' },
      { img: 'afterparty-music.png',   title: 'Tanec s vínom',           body: 'Hraje sa folklór, ty si to vychutnávaš. Dnes ťa neporazila energy, ani víno ťa neporazí.' },
      { img: 'afterparty-stars.png',   title: 'Zaslúžená vyhliadka',     body: 'Stojíš pri kolonáde s posledným pohárom. <em>Niektorí sú silní v nohách. Ty si silný v plánovaní.</em>', finale: true }
    ],
    'celebrate-taktik': [
      { img: 'afterparty-cellar.png',  title: 'Pivnica — adaptívny štýl',body: 'Jeden moment pivo, druhý prosecco. Tvoja taktika dnes bola: čítaj situáciu. Aj večer čítaš.' },
      { img: 'afterparty-music.png',   title: 'Cimbálovka & rozhovory',  body: 'Skáčeš medzi stolmi, vypočuješ si tri verzie dnešného šprintu. Tak ako si v race vyberal, tak vyberáš teraz.' },
      { img: 'afterparty-cheers.png',  title: 'Univerzálny toast',       body: 'Pripijaš s každým za niečo iné. Niekto ti hovorí: „Si tam, kde by tě bylo třeba." Ty len kývneš.' },
      { img: 'afterparty-stars.png',   title: 'Pri kolonáde',            body: 'Stojíš a premýšľaš o všetkých malých rozhodnutiach dňa. <em>Nemáš jeden štýl. Máš všetky.</em>', finale: true }
    ],

    /* recovery: PIVO + STYLE */
    'classic-attacker': [
      { img: 'afterparty-cellar.png',  title: 'Pivnica & krígle',         body: 'Trafíš sa do pivnice cez všetky tie čerstvo zorané vinice. Pivo ide dole prvé bez problému. Atak na Děvín bol mladší ako toto pivo.' },
      { img: 'afterparty-music.png',   title: 'Folklórna divočina',       body: 'Cimbálovka rozdrbe klasiku, ty kopíruješ kroky. Adrenalin z race ešte neopadol — premieta sa do stupy.' },
      { img: 'afterparty-cheers.png',  title: 'Krígle na atak',           body: '„Na sólovú jazdu!" Päť krígľov sa stretne v strede. Pena tečie. Tvoj solo úsek dnes bol v záznamoch.' },
      { img: 'afterparty-stars.png',   title: 'Tichý vrchol',             body: 'Kráčaš pri kolonáde, posledný hlt z fľaše. <em>Pivo je odmena tela. Kolonáda je odmena duše.</em>', finale: true }
    ],
    'classic-tempar': [
      { img: 'afterparty-cellar.png',  title: 'Pivnica — peletón celý',   body: 'Všetkých pätnásť čo si dnes držal v skupine sedí teraz okolo teba. Pivo cinká. Reči o tom, kto kedy zaberol.' },
      { img: 'afterparty-music.png',   title: 'Tanec za rytmu',           body: 'Cimbálovka, kolektívny tanec. Tak ako v race — chytené koleso, jeden rytmus. Aj večer.' },
      { img: 'afterparty-cheers.png',  title: 'Klasický prípitok',        body: '„Bratrstvo silnice!" volá niekto. Krígle štrnknú. Si v tom najlepšom skupinovom feel-e v živote.' },
      { img: 'afterparty-stars.png',   title: 'Posledný hltok',           body: 'Pri kolonáde s pivom v ruke. <em>Niekedy je vyhrať aj zostať s ostatnými.</em>', finale: true }
    ],
    'classic-fueler': [
      { img: 'afterparty-cellar.png',  title: 'Pivnica & rozbory',        body: 'Pri stole rozoberáš s ostatnými, ktorý gel kedy. Pivo sa pije pomaly — analyzujete dnešok ako lab.' },
      { img: 'afterparty-cheers.png',  title: 'Toast za stratégiu',       body: '„Na bilancovanie!" Pivo cinklo. Dnes nešlo o silu — o systém. To pochopil každý pri stole.' },
      { img: 'afterparty-music.png',   title: 'Folklór & pokoj',          body: 'Hraje sa, ty kývаš hlavou. Plnú energy si si schoval na koniec — aj na večer.' },
      { img: 'afterparty-stars.png',   title: 'Tichá kontrola',           body: 'Kolonáda, posledné pivo. <em>Nie všetci kompozeri ide o adrenalín. Niektorí sú o execution.</em>', finale: true }
    ],
    'classic-taktik': [
      { img: 'afterparty-cellar.png',  title: 'Pivnica & flexibilita',    body: 'Najprv s peletónom, potom solo. Aj večer si flexibilný — pivo s každou skupinkou.' },
      { img: 'afterparty-music.png',   title: 'Tanec medzi stoly',        body: 'Cimbálovka pomalá, potom rýchla. Ty s ňou. Tak ako celý deň — citlivý na rytmus.' },
      { img: 'afterparty-cheers.png',  title: 'Mix toast',                body: 'Pripiješ s útočníkmi, potom s tempařmi. Nikoho nepatríš naplno — a všetci ťa berú.' },
      { img: 'afterparty-stars.png',   title: 'Stred sveta',              body: 'Pri kolonáde, pivo sa stratilo. <em>Nemáš jeden štýl. Máš dnes svoj deň.</em>', finale: true }
    ],

    /* recovery: R2 + STYLE */
    'pro-attacker': [
      { img: 'afterparty-cellar.png',  title: 'R2 & rozbor v pivnici',    body: 'Sediš so svojím R2 shake-rom uprostred peletónu. Bobby nebude piť. Profesionálny reštart, ako Pidcock po Strade.' },
      { img: 'afterparty-music.png',   title: 'Cimbálovka & pohľady',     body: 'Hraje sa folklor, ty si stranou. Tvoj solo atak dnes hovoril sám za seba. Nepotrebuješ to vykecať.' },
      { img: 'afterparty-cheers.png',  title: 'Tichý prípitok vodou',     body: 'Sommelier ti naleje vodu s plátkom citróna. „Aj to je oslava." Cinkne sa. Pamätáš si dnešok dokonale jasno.' },
      { img: 'afterparty-stars.png',   title: 'Kolonáda — vízia',         body: 'Stojíš pri kolonáde s tréningovým plánom v hlave. Dnes bol prvý monument. <em>Budeš sa vracať. A vyhrávať.</em>', finale: true }
    ],
    'pro-tempar': [
      { img: 'afterparty-cellar.png',  title: 'R2 & disciplína',          body: 'Peletón pije, ty máš shake. Disciplína dnes vyhrala v skupine — ostáva ti aj večer.' },
      { img: 'afterparty-cheers.png',  title: 'Pripitok studenou vodou',  body: '„Profík," kýva niekto. Tvoja taktická trpezlivosť dnes a tvoja recovery dnes — dva roky tréningu zhutnené do jedného dňa.' },
      { img: 'afterparty-music.png',   title: 'Folklór — pozorovateľ',    body: 'Hraje sa cimbál. Ty počítaš make-up na zajtrajšie tréningové intervaly.' },
      { img: 'afterparty-stars.png',   title: 'Kolonáda — protokol',      body: 'Pri kolonáde stojíš a v hlave ti beží zajtrajší easy-spin. <em>Profík sa nenarodí. Vykuje sa.</em>', finale: true }
    ],
    'pro-fueler': [
      { img: 'afterparty-cellar.png',  title: 'R2 & dvojitý protokol',    body: 'Dvojitý win — perfektné palivo počas race + R2 po. Tvoj nutričný plán by mohli kúpiť tímy World Tour.' },
      { img: 'afterparty-cheers.png',  title: 'Studená voda & rozbor',    body: '„Ktoré gely si bral?" pýta sa niekto. Vymenuješ. Stôl si robí poznámky.' },
      { img: 'afterparty-music.png',   title: 'Folklór — focus',          body: 'Hraje sa cimbálovka, ty kontroluješ HRV na hodinkách. Recovery monitor je v zelenej.' },
      { img: 'afterparty-stars.png',   title: 'Kolonáda — vedomé',        body: 'Pri kolonáde si vedomý každého procesu v tele. <em>Si stroj. Ale stroj ktorý vie.</em>', finale: true }
    ],
    'pro-taktik': [
      { img: 'afterparty-cellar.png',  title: 'R2 & analýza',             body: 'Sledujеš ostatných pri pivách, popíjaš R2. Dnes si menil stratégiu trikrát — perfekta adaptácia.' },
      { img: 'afterparty-music.png',   title: 'Cimbálovka — patterns',    body: 'Hudbu počúvaš ako power profile. Atak v 3. takte, recovery vo 4.' },
      { img: 'afterparty-cheers.png',  title: 'Toast za execution',       body: 'Pripiješ vodou. „Niekedy je víťazstvo: rozhodnúť sa správne v správny moment." Stôl prikývne.' },
      { img: 'afterparty-stars.png',   title: 'Kolonáda — meta-mode',     body: 'Stojíš a hodnotíš celý deň ako spectacle. <em>Vidíš veci, ktoré ostatní nevidia. Aj dnes. Aj zajtra.</em>', finale: true }
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
      back.textContent = '← Späť';
      back.addEventListener('click', () => { idx -= 1; render(j); });
      actions.appendChild(back);
    }
    const next = document.createElement('button');
    next.type = 'button'; next.className = 'btn btn-primary';
    next.textContent = p.finale ? 'Ukončiť deň' : 'Ďalej →';
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
