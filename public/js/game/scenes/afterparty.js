/* Afterparty scene — multi-stage evening narrative.
   Four illustrated panels with short text vignettes; player taps "Ďalej"
   to progress. Final panel wraps the day with a CTA to share or restart. */
(function () {
  let overlay = null;
  let idx = 0;

  /* The mood selection from recovery slightly tints the copy */
  function panels(j) {
    const moodIntro = j.recoveryMood === 'pro'
      ? 'Profesionálsky reštart. Ideš na večer s plnou regeneráciou.'
      : j.recoveryMood === 'celebrate'
      ? 'Vinotéka volá. Bublinky šuškajú.'
      : 'Pivo, smiech, odpočinok. Klasika po pretekoch.';
    return [
      {
        img:   '/assets/scenes/finish/afterparty-cellar.png',
        title: 'Vínne pivnice u Reistny',
        body:  `${moodIntro}<br/>Schádzaš pod klenbu pivnice, ktorá pamätá Habsburgov. Stôl je dlhý, vône ťažké, peletón rozprávajú o úseku pri Děvíne ako keby to bola Marná láska.`
      },
      {
        img:   '/assets/scenes/finish/afterparty-music.png',
        title: 'Cimbálovka pred kolonádou',
        body:  'Cimbálová muzika hrá pomalý valčík, niekto ti dáva do ruky pohár. Nohy ťa bolia, ale chodidlá samé od seba mlátia po zemi do rytmu.'
      },
      {
        img:   '/assets/scenes/finish/afterparty-cheers.png',
        title: 'Posledný prípitok',
        body:  'Päť pohárov sa dotýka v strede stola. Niekto navrhne ďalší ročník. Ďalší pretek. Ďalší monument. Všetci pijú tú istú myšlienku.'
      },
      {
        img:   '/assets/scenes/finish/afterparty-stars.png',
        title: 'Sám pod kolonádou',
        body:  'Pred polnocou sa vytratíš ku kolonáde. Hviezdy stoja nad Pálavou ako keby ich pribili. Pohár v ruke. Ticho. <em>Už vieš, prečo sem chodíme.</em>',
        finale: true
      }
    ];
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
