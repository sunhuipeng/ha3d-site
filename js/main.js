/* ==========================================================================
   main.js — 展示页交互：进场动画 / 数字滚动 / 标签页 / 截图标注 / 导航状态
   ========================================================================== */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- 导航 ---------------- */
  const nav = document.getElementById('nav');
  const links = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
  const sections = links
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  function update() {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 24);
    const y = window.scrollY + 140;
    let cur = null;
    sections.forEach((s) => { if (s.offsetTop <= y) cur = s.id; });
    links.forEach((a) => {
      const on = a.getAttribute('href') === '#' + cur;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  /* scroll 事件高频触发，合并到每帧最多执行一次 */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  update();

  /* ---------------- 进场动画 ---------------- */
  const revealEls = document.querySelectorAll('.rv, .rv-scale');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => {
      if (!el.classList.contains('in')) io.observe(el);
    });
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* ---------------- 数字滚动 ---------------- */
  function animateCount(el) {
    const target = parseFloat(el.dataset.count || '0');
    if (!target || reduceMotion) { el.textContent = String(target || 0); return; }
    const dur = 1100;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    const co = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) { animateCount(e.target); co.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => co.observe(c));
  } else {
    counters.forEach(animateCount);
  }

  /* ---------------- 标签页 ---------------- */
  const CODE_PATHS = {
    'c-dev': 'custom/plugins/myplug/plugin.js',
    'c-open': 'assets/plugins/door/plugin.js',
    'c-bg': 'assets/plugins/background/plugin.js',
  };

  document.querySelectorAll('[data-tabs]').forEach((bar) => {
    const btns = Array.from(bar.querySelectorAll('button[data-tab]'));
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.tab;
        btns.forEach((b) => b.classList.toggle('active', b === btn));

        document.querySelectorAll('[data-fig="' + key + '"]').forEach((fig) => {
          fig.classList.add('active');
        });
        // 同一组的其它图隐藏
        const group = bar.dataset.tabs;
        const map = {
          editor: ['e2d', 'e3d'],
          code: ['c-dev', 'c-open', 'c-bg'],
        };
        (map[group] || []).forEach((k) => {
          if (k !== key) {
            document.querySelectorAll('[data-fig="' + k + '"]').forEach((fig) => fig.classList.remove('active'));
          }
        });

        const pathEl = document.querySelector('[data-code-path]');
        if (pathEl && CODE_PATHS[key]) pathEl.textContent = CODE_PATHS[key];
      });
    });
  });

  /* ---------------- 截图标注 ---------------- */
  document.querySelectorAll('.annot').forEach((fig) => {
    const pins = Array.from(fig.querySelectorAll('.pin'));
    const list = document.querySelector('.annot-list[data-annot-list="' + fig.dataset.annot + '"]');
    const items = list ? Array.from(list.querySelectorAll('.annot-item')) : [];

    const activate = (n, scroll) => {
      pins.forEach((p) => p.classList.toggle('active', p.dataset.pin === n));
      items.forEach((it) => it.classList.toggle('active', it.dataset.pin === n));
      if (scroll) {
        const it = items.find((x) => x.dataset.pin === n);
        if (it) it.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };

    pins.forEach((p) => {
      p.addEventListener('click', (e) => { e.stopPropagation(); activate(p.dataset.pin, true); });
      p.addEventListener('mouseenter', () => activate(p.dataset.pin, false));
      p.addEventListener('focus', () => activate(p.dataset.pin, false));
    });
    items.forEach((it) => {
      it.addEventListener('click', () => activate(it.dataset.pin, false));
      it.addEventListener('mouseenter', () => activate(it.dataset.pin, false));
    });
  });

  /* ---------------- Hero 轮播 ---------------- */
  const car = document.getElementById('heroCarousel');
  if (car) {
    const slides = Array.from(car.querySelectorAll('.c-slide'));
    const dotsWrap = car.querySelector('.c-dots');
    const progress = document.createElement('div');
    progress.className = 'c-progress';
    car.appendChild(progress);

    const DUR = 4200;
    let idx = 0, timer = null, hover = false;

    slides.forEach((_, i) => {
      const d = document.createElement('i');
      if (i === 0) d.className = 'active';
      d.addEventListener('click', () => go(i));
      dotsWrap.appendChild(d);
    });
    const dots = Array.from(dotsWrap.children);

    function animateProgress() {
      progress.style.transition = 'none';
      progress.style.width = '0';
      if (reduceMotion || hover) return;
      requestAnimationFrame(() => {
        progress.style.transition = 'width ' + DUR + 'ms linear';
        progress.style.width = '100%';
      });
    }
    function restart() {
      clearInterval(timer);
      animateProgress();
      if (!reduceMotion && !hover) timer = setInterval(() => go(idx + 1), DUR);
    }
    function go(i) {
      idx = (i + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('active', k === idx));
      dots.forEach((d, k) => d.classList.toggle('active', k === idx));
      restart();
    }

    car.querySelector('.c-arrow.prev').addEventListener('click', () => go(idx - 1));
    car.querySelector('.c-arrow.next').addEventListener('click', () => go(idx + 1));
    car.addEventListener('mouseenter', () => { hover = true; clearInterval(timer); });
    car.addEventListener('mouseleave', () => { hover = false; restart(); });

    // 仅当轮播可见时才自动播放
    if ('IntersectionObserver' in window && !reduceMotion) {
      const cio = new IntersectionObserver((es) => {
        es.forEach((e) => {
          if (e.isIntersecting) { hover = false; restart(); }
          else { hover = true; clearInterval(timer); progress.style.width = '0'; }
        });
      }, { threshold: 0.25 });
      cio.observe(car);
    } else {
      restart();
    }
  }

  /* ---------------- Hero 视差 ---------------- */
  const shot = document.getElementById('heroShot');
  if (shot && !reduceMotion && window.matchMedia('(min-width: 1080px)').matches) {
    const art = shot.closest('.hero-art');
    art.addEventListener('mousemove', (e) => {
      const r = art.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      shot.style.transform =
        'rotateY(' + (-9 + dx * 6).toFixed(2) + 'deg) rotateX(' + (5 - dy * 5).toFixed(2) + 'deg) rotateZ(.6deg) translateZ(0)';
    });
    art.addEventListener('mouseleave', () => {
      shot.style.transform = 'rotateY(-9deg) rotateX(5deg) rotateZ(.6deg)';
    });
  }

  /* ---------------- 演示区内的跳转按钮 ---------------- */
  document.querySelectorAll('[data-scroll]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = document.querySelector(b.dataset.scroll);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ---------------- 插件库分类筛选 ---------------- */
  const plugGrid = document.querySelector('.plug-grid');
  if (plugGrid) {
    const plugCards = Array.from(plugGrid.querySelectorAll('.plug'));
    const plugTabs = Array.from(document.querySelectorAll('.plug-tabs .pt'));

    /* 统计每个分类的数量，写回 tab 上的角标 */
    plugTabs.forEach((t) => {
      const k = t.dataset.k;
      const cnt = k === 'all' ? plugCards.length
        : plugCards.filter((c) => c.querySelector('.kind') && c.querySelector('.kind').textContent.trim() === k).length;
      const slot = t.querySelector('[data-cnt]');
      if (slot) slot.textContent = cnt;
    });

    plugTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const k = tab.dataset.k;
        plugTabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle('active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        plugCards.forEach((c) => {
          const kindEl = c.querySelector('.kind');
          const kind = kindEl ? kindEl.textContent.trim() : '';
          const show = k === 'all' || kind === k;
          c.classList.toggle('hide', !show);
          /* 被过滤后才露出的卡片可能没触发过进场动画，补一个 */
          if (show) c.classList.add('in');
        });
      });
    });
  }
})();

  /* ---------------- studio.html：MCP 提示符轮播 ---------------- */
  const mcMsgs = document.querySelectorAll('.mc-msg');
  if (mcMsgs.length >= 2) {
    const CALLS = ['studio_upload_glb()', 'studio_write_plugin()', 'studio_screenshot()', 'MCP 已连接，等待指令…'];
    const ACKS  = ['✓ 模型已装配', '✓ plugin.js 已生成', '✓ 截图核验通过', '✓ 已发布到 ha-3d-home'];
    let mi = 0;
    setInterval(() => {
      mi = (mi + 1) % CALLS.length;
      mcMsgs.forEach((el, k) => {
        el.classList.add('swap');
        setTimeout(() => {
          el.textContent = k === 0 ? CALLS[mi] : ACKS[mi];
          el.classList.remove('swap');
        }, 260);
      });
    }, 3200);
  }

  /* ---------------- studio.html：小人台词轮播 ---------------- */
  const pfMsg = document.querySelector('.pf-bubble .pf-msg');
  if (pfMsg) {
    const LINES = [
      '给卧室做一盏水晶吊灯…',
      '调光要顺滑一点哦',
      '拍照看看效果？',
      '不错不错，发布吧！',
      'MCP 已连接，继续叭叭…'
    ];
    let pi = 0;
    setInterval(() => {
      pi = (pi + 1) % LINES.length;
      pfMsg.classList.add('swap');
      setTimeout(() => {
        pfMsg.textContent = LINES[pi];
        pfMsg.classList.remove('swap');
      }, 220);
    }, 3200);
  }

/* studio.html：编辑台实拍 → 横向轮播（一屏约 1.5 个，定时左移，无缝循环） */
(function () {
  const car = document.querySelector('.shot-carousel');
  if (!car) return;
  const track = car.querySelector('.shot-track');
  const slides = Array.prototype.slice.call(track.children);
  if (slides.length < 2) return;

  // 克隆第一屏做无缝衔接
  const clone = slides[0].cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  track.appendChild(clone);

  const gap = () => parseFloat(getComputedStyle(track).gap) || 22;
  const slideW = () => slides[0].getBoundingClientRect().width + gap();
  let idx = 0;
  let timer = null;

  // 底部圆点指示器
  const dotsBox = document.querySelector('.shot-dots');
  const dots = slides.map((_, i) => {
    const b = document.createElement('button');
    b.className = 'shot-dot';
    b.type = 'button';
    b.setAttribute('aria-label', '第 ' + (i + 1) + ' 张');
    b.addEventListener('click', () => { idx = i; go(idx, true); play(); });
    if (dotsBox) dotsBox.appendChild(b);
    return b;
  });
  const sync = () => dots.forEach((d, i) => d.classList.toggle('on', i === idx % slides.length));

  const go = (i, animate) => {
    track.style.transition = animate ? 'transform .65s cubic-bezier(.33,.8,.35,1)' : 'none';
    track.style.transform = 'translateX(' + (-i * slideW()) + 'px)';
    sync();
  };
  track.addEventListener('transitionend', (e) => {
    if (e.target !== track) return;
    if (idx >= slides.length) { idx = 0; go(0, false); }
  });
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const play = () => { stop(); timer = setInterval(() => { idx += 1; go(idx, true); }, 4200); };

  car.addEventListener('mouseenter', stop);
  car.addEventListener('mouseleave', play);
  window.addEventListener('resize', () => go(idx, false));
  go(0, false);
  play();
})();

/* studio.html：编辑台实拍截图 → 点击放大（灯箱） */
(function () {
  const imgs = document.querySelectorAll('.shot-frame img, .case-grid img');
  if (!imgs.length) return;

  // 收集图片并去重（轮播克隆页与第一张同图）
  const seen = new Set();
  const list = [];
  imgs.forEach((img) => {
    const src = img.currentSrc || img.src;
    if (seen.has(src)) return;
    seen.add(src);
    list.push({ src: img.src, alt: img.alt || '' });
  });

  const box = document.createElement('div');
  box.className = 'imgbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML =
    '<span class="imgbox-close" aria-label="关闭">×</span>' +
    '<button class="imgbox-nav prev" type="button" aria-label="上一张">‹</button>' +
    '<img alt="">' +
    '<button class="imgbox-nav next" type="button" aria-label="下一张">›</button>' +
    '<span class="imgbox-count"></span>';
  document.body.appendChild(box);

  const big = box.querySelector('img');
  const closeBtn = box.querySelector('.imgbox-close');
  const prevBtn = box.querySelector('.imgbox-nav.prev');
  const nextBtn = box.querySelector('.imgbox-nav.next');
  const count = box.querySelector('.imgbox-count');
  let cur = 0;

  const show = (i) => {
    cur = (i + list.length) % list.length;
    big.src = list[cur].src;
    big.alt = list[cur].alt;
    count.textContent = (cur + 1) + ' / ' + list.length;
  };
  const open = (img) => {
    const src = img.currentSrc || img.src;
    const at = list.findIndex((it) => it.src === src);
    show(at >= 0 ? at : 0);
    box.classList.add('on');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    box.classList.remove('on');
    document.body.style.overflow = '';
    setTimeout(() => { if (!box.classList.contains('on')) big.removeAttribute('src'); }, 240);
  };

  imgs.forEach((img) => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => open(img));
  });
  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); show(cur - 1); });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); show(cur + 1); });
  box.addEventListener('click', close);
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  document.addEventListener('keydown', (e) => {
    if (!box.classList.contains('on')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(cur - 1);
    else if (e.key === 'ArrowRight') show(cur + 1);
  });
})();

/* studio.html：可拖动门模型 + 多轮对话无缝滚动 */
(function () {
  /* —— 3D 门模型：拖拽转视角（同 index demo.js 的交互手感），点门扇开/关 —— */
  var stage = document.getElementById('d3Stage');
  var world = document.getElementById('d3World');
  var leaf = document.getElementById('d3Leaf');
  if (stage && world && leaf) {
    var rx = 62, rz = -28;
    var apply = function () {
      world.style.setProperty('--rx', rx + 'deg');
      world.style.setProperty('--rz', rz + 'deg');
    };
    apply();

    var st = null;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      st = { x: e.clientX, y: e.clientY, rx: rx, rz: rz, moved: false };
      stage.classList.add('dragging');
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!st) return;
      var dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (Math.hypot(dx, dy) > 6) st.moved = true;
      rz = st.rz - dx * 0.34;
      rx = Math.max(24, Math.min(78, st.rx - dy * 0.26));
      apply();
    });
    var endDrag = function (e) {
      if (!st) return;
      if (!st.moved && leaf.contains(e.target)) {
        world.classList.toggle('shut');   // 点击门扇：开 / 关
      }
      st = null;
      stage.classList.remove('dragging');
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', function () {
      st = null;
      stage.classList.remove('dragging');
    });
  }

  /* —— 多轮对话：克隆一份实现无缝循环（自愈：先清掉快照可能存回的克隆） —— */
  var flow = document.getElementById('chatFlow');
  if (flow) {
    flow.querySelectorAll('.chat-dup').forEach(function (n) { n.remove(); });
    Array.prototype.slice.call(flow.children).forEach(function (el) {
      var dup = el.cloneNode(true);
      dup.classList.add('chat-dup');
      dup.setAttribute('aria-hidden', 'true');
      flow.appendChild(dup);
    });
  }
})();
