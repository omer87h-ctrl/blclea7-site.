'use strict';
/* Public product chrome over the existing Studio. No owner RPC or credentials. */
(function () {
  function ready() {
    const api = globalThis.CLEA7Workbench;
    const navigation = document.querySelector('nav[aria-label="Radni prostor"]');
    if (!api || !navigation || document.body.classList.contains('clea-product-studio')) return;
    document.body.classList.add('clea-product-studio');
    if(new URL(location.href).searchParams.get('audience')==='public')document.body.dataset.cleaAudience='public';
    const old = [...navigation.children], more = document.createElement('details');
    more.className = 'private-studio-tools';
    const summary = document.createElement('summary'), list = document.createElement('div');
    summary.textContent = 'Svi alati'; more.append(summary, list);
    const open = name => document.querySelector('[data-panel="' + name + '"]')?.click();
    const router=Object.freeze({open(name){
      if(!['clea-chat','draw'].includes(name))return false;
      open(name);const url=new URL(location.href);url.searchParams.set('workspace',name);history.replaceState(null,'',url);return true;
    }});
    globalThis.CLEA7ProductNavigation=router;
    const button = (text, action) => {
      const node = document.createElement('button'); node.type = 'button';
      node.textContent = text; node.onclick = action; return node;
    };
    const draw = old.find(n => n.dataset.panel === 'draw');
    draw.id = 'primary-draw'; draw.textContent = 'Draw';
    const code = old.find(n => n.dataset.panel === 'bil');
    const chat = old.find(n => n.dataset.panel === 'clea-chat');
    const home = old.find(n => n.id === 'studio-home');
    const run = document.getElementById('run-top'); run.textContent = 'Pokreni';
    navigation.replaceChildren(); if (home) navigation.append(home);
    navigation.append(draw); if (code) navigation.append(code);
    navigation.append(run); if (chat) navigation.append(chat); navigation.append(more);
    for (const node of old) if (![draw, code, chat, home].includes(node)) list.append(node);
    const brand = document.querySelector('.studio-topbar>a');
    if (brand) {
      brand.href = '../../'; brand.replaceChildren();
      const icon = document.createElement('img'); icon.src = '../../clea-mark.svg';
      icon.alt = ''; icon.width = icon.height = 34;
      brand.append(icon, document.createTextNode('BL CLEA 7 · CLEA Studio'));
    }
    const downloads = document.querySelector('.studio-topbar>a.primary');
    if (downloads) { downloads.href = '../../preuzimanja.html'; downloads.textContent = 'Preuzimanja'; }
    const focus = document.getElementById('sense-focus-companion');
    const launch = document.querySelector('body>[data-sense-touch-launch]');
    // One Studio switch controls live guidance. A modal must NOT cover the
    // canvas, Draw, BIL or project actions while Sense is enabled.
    if (focus) { focus.hidden = true; list.append(focus); }
    if (launch) { launch.hidden = true; list.append(launch); }
    const senseApi = globalThis.CLEA7SenseNavigation;
    if (senseApi?.startLive && senseApi?.stopLive) {
      const sense = button('Uključi Sense', () => {
        if (senseApi.isActive()) senseApi.stopLive();
        else senseApi.startLive(sense);
      });
      sense.id = 'private-studio-sense';
      sense.setAttribute('aria-pressed','false');
      sense.setAttribute('aria-label','Uključi Sense i nastavi raditi u Studiju uz govorne i vibracijske upute');
      sense.setAttribute('aria-controls','sense-guidance-caption');
      const updateSense = () => {
        const active = senseApi.isActive();
        sense.textContent = active ? 'Isključi Sense' : 'Uključi Sense';
        sense.setAttribute('aria-pressed',String(active));
        sense.setAttribute('aria-label',active ? 'Isključi Sense i zaustavi vođenje' : 'Uključi Sense i nastavi raditi u Studiju uz govorne i vibracijske upute');
      };
      document.addEventListener('sense:navigation-changed',updateSense);
      document.querySelector('.studio-topbar').append(sense);
      updateSense();
    }
    document.addEventListener('clea:workspace', event => {
      document.body.dataset.activePanel = event.detail.panel; more.open = false;
      draw.setAttribute('aria-pressed', String(['draw', 'design'].includes(event.detail.panel)));
    });
    // The existing start screen owns drafts/new identities. Never load a sample
    // or overwrite a saved app just because someone opened a presentation link.
    const feature = new URL(location.href).searchParams.get('feature');
    if (feature === 'depth') {
      const highlight = () => document.getElementById('studio-depth-start')?.scrollIntoView({block:'center'});
      setTimeout(highlight, 250);
    }
    const question = sessionStorage.getItem('clea-public-intent');
    if (question) {
      sessionStorage.removeItem('clea-public-intent'); open('clea-chat');
      const input = document.getElementById('chat-question'); if (input) input.value = question;
    }
    globalThis.CLEA7ProductEntry?.ready(router);
  }
  // Workbench API exists before its asynchronous project chooser is ready.
  // Waiting for the explicit initialization signal avoids a mid-paint
  // switch between legacy chrome, splash, and the actual Studio start.
  if (globalThis.CLEA7StudioUiReady) ready();
  else globalThis.addEventListener('clea:studio-ready', ready, {once:true});
})();
