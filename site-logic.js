/* Поведение лендинга: анимация рассвета, шапка, навигация, карусель отзывов.
   Только работа с DOM — никакой разметки и никаких текстов. */
window.SiteLogic = (function () {
  const MOBILE = 760;
  const isMobile = () => window.innerWidth <= MOBILE;
  const clamp01 = v => Math.min(1, Math.max(0, v));

  /* Вертикальное положение текстовых блоков героя: нижний зазор — четверть
     свободного места, но не меньше высоты подсказки «листайте». */
  function heroShift(el, block) {
    if (!el.pane) return null;
    const paneR = el.pane.getBoundingClientRect();
    const anchor = block.parentElement.getBoundingClientRect().top;
    const H = block.offsetHeight, V = paneR.height;
    const reserve = el.hint
      ? el.hint.offsetHeight + (parseFloat(getComputedStyle(el.hint).bottom) || 0) + 14
      : 28;
    const gap = Math.max(reserve, (V - H) / 4);
    const top = Math.max(paneR.top + 12, paneR.top + V - gap - H);
    return top - anchor;
  }

  function paintHeader(el, host) {
    if (!el.header) return;
    const y = window.scrollY;
    if (isMobile()) {
      const prev = host.lastY == null ? y : host.lastY;
      const dy = y - prev;
      if (Math.abs(dy) > 4) host.hidden = y > 140 && dy > 0;
      if (y <= 140) host.hidden = false;
      el.header.style.transition = 'transform 320ms cubic-bezier(.4,0,.2,1), background 400ms ease';
      el.header.style.transform = host.hidden ? 'translateY(-105%)' : 'translateY(0)';
      host.lastY = y;
    } else {
      host.hidden = false;
      host.lastY = null;
      el.header.style.transform = 'translateY(0)';
    }
    const solid = y > 80;
    el.header.style.background = solid ? 'rgba(11,16,39,0.88)' : 'transparent';
    el.header.style.backdropFilter = solid ? 'blur(14px)' : 'none';
    el.header.style.borderBottomColor = solid ? 'rgba(246,238,228,0.08)' : 'rgba(246,238,228,0)';
  }

  /* Сцена рассвета, привязанная к прокрутке секции-героя. */
  function paintScene(el, host) {
    if (!el.wrap) return;
    const span = el.wrap.offsetHeight - window.innerHeight;
    const p = clamp01(-el.wrap.getBoundingClientRect().top / (span || 1));
    const seg = (a, b) => clamp01((p - a) / (b - a));

    if (el.dawn) el.dawn.style.opacity = seg(0.04, 0.44);
    if (el.day) el.day.style.opacity = seg(0.4, 0.8);
    if (el.stars) el.stars.style.opacity = 1 - seg(0, 0.34);

    const rise = seg(0, 0.82);
    if (el.sun) {
      el.sun.style.transform =
        'translateY(' + (-rise * (window.innerHeight * 0.74 + 190)).toFixed(1) + 'px)' +
        ' scale(' + (0.82 + rise * 0.34).toFixed(3) + ')';
    }

    if (el.t1) {
      const o = 1 - seg(0.04, 0.28), d = heroShift(el, el.t1);
      el.t1.style.opacity = o;
      el.t1.style.transform = d === null
        ? 'translateY(' + (-50 - seg(0.04, 0.28) * 4) + '%)'
        : 'translateY(' + (d - seg(0.04, 0.28) * el.t1.offsetHeight * 0.04).toFixed(1) + 'px)';
      el.t1.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
    }
    if (el.t2) {
      const o = seg(0.36, 0.58), d = heroShift(el, el.t2);
      el.t2.style.opacity = o;
      el.t2.style.transform = d === null
        ? 'translateY(' + (-50 + (1 - o) * 4) + '%)'
        : 'translateY(' + (d + (1 - o) * el.t2.offsetHeight * 0.04).toFixed(1) + 'px)';
      el.t2.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
    }
    if (el.hint) el.hint.style.opacity = 1 - seg(0, 0.14);

    if (el.btn) {
      const mob = isMobile();
      el.btn.style.marginLeft = mob ? 'auto' : '0';
      el.btn.style.marginRight = mob ? 'auto' : '0';
      if (el.cycles) el.cycles.style.textAlign = mob ? 'center' : 'left';
    }

    paintHeader(el, host);
  }

  /* Плавный переход к блоку: целимся в его заголовок, «Контакты» — в карточку. */
  function scrollToSection(el, id) {
    const target = document.getElementById(id);
    if (!target) return;
    const headerH = el.header ? el.header.getBoundingClientRect().height : 88;
    let anchor = target;
    if (id === 'book') {
      const card = target.firstElementChild && target.firstElementChild.firstElementChild;
      if (card) anchor = card;
    } else {
      const head = target.querySelector('h1, h2') || target;
      const prev = head.previousElementSibling;
      anchor = prev && prev.tagName === 'SPAN' ? prev : head;
    }
    const mob = isMobile();
    const raw = anchor.getBoundingClientRect().top + window.pageYOffset;
    const reserve = mob && raw > window.pageYOffset ? 0 : headerH;
    window.scrollTo({ top: raw - reserve - (mob ? 12 : 28), behavior: 'smooth' });
  }

  /* Какие отзывы не поместились в шесть строк — им нужна кнопка «ещё». */
  function measureClamped(nodes) {
    const long = {};
    Object.keys(nodes).forEach(i => {
      const n = nodes[i];
      if (n) long[i] = n.scrollHeight > n.clientHeight + 2;
    });
    return long;
  }

  function maxScroll(sc) {
    return sc.scrollWidth - sc.clientWidth;
  }

  /* Точки-индикаторы обновляются напрямую по DOM: ре-рендер отменил бы
     плавную прокрутку карусели. */
  function syncDots(scroller, dots, row) {
    if (!scroller) return;
    const max = maxScroll(scroller);
    if (row) row.style.display = max > 8 ? 'flex' : 'none';
    const n = scroller.children.length;
    let best = 0, dist = Infinity;
    if (scroller.scrollLeft >= max - 2) best = n - 1;
    else for (let i = 0; i < n; i++) {
      const d = Math.abs(Math.min(scroller.children[i].offsetLeft, max) - scroller.scrollLeft);
      if (d < dist) { dist = d; best = i; }
    }
    Object.keys(dots).forEach(k => {
      if (dots[k]) dots[k].style.background = Number(k) === best ? '#C2703C' : 'rgba(42,36,56,0.18)';
    });
  }

  /* Собственная анимация scrollLeft: элементный behavior: 'smooth' в превью не работает. */
  function scrollToCard(scroller, i, onFrame) {
    const card = scroller && scroller.children[i];
    if (!scroller || !card) return;
    const from = scroller.scrollLeft;
    const to = Math.min(card.offsetLeft, maxScroll(scroller));
    if (Math.abs(to - from) < 2) return;
    const t0 = performance.now(), dur = 360;
    cancelAnimationFrame(scroller._anim);
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      scroller.scrollLeft = from + (to - from) * ease;
      if (k < 1) scroller._anim = requestAnimationFrame(step);
      else if (onFrame) onFrame();
    };
    scroller._anim = requestAnimationFrame(step);
  }

  return { isMobile, paintScene, scrollToSection, measureClamped, syncDots, scrollToCard };
})();
