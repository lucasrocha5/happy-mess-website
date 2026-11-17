// Happy Mess site: mobile menu, forms, buttons that jump to the waitlist, shop carousel, animations, footer year.

(function () {
  // ----- Mobile menu -----
  var header = document.querySelector('[data-nav]');
  var toggle = header && header.querySelector('[data-nav-toggle]');
  var panel = header && header.querySelector('[data-nav-panel]');

  function setMenu(open) {
    if (!toggle || !panel) return;
    toggle.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    header.classList.toggle('is-open', open);
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    panel.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setMenu(false);
    });
  }

  var desktop = window.matchMedia('(min-width: 1240px)');

  // ----- Forms: send to /api/submit, which posts to Slack -----
  document.querySelectorAll('form[data-form]').forEach(function (form) {
    var status = form.parentElement.querySelector('[data-form-status]');
    var button = form.querySelector('button[type="submit"]');
    var email = form.querySelector('input[type="email"]');

    // The design uses a shorter placeholder on mobile.
    function syncPlaceholder() {
      if (!email) return;
      var text = desktop.matches ? email.dataset.placeholderDesktop : email.dataset.placeholderMobile;
      if (text && email.placeholder !== text) email.placeholder = text;
    }
    syncPlaceholder();
    desktop.addEventListener('change', syncPlaceholder);

    function show(message, state) {
      if (!status) return;
      status.textContent = message;
      status.dataset.state = state;
      status.hidden = false;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        // Point at the first field that needs attention, by its label.
        var bad = form.querySelector('input:invalid, select:invalid, textarea:invalid');
        var group = bad && bad.closest('fieldset');
        var labelFor = bad && bad.id ? form.querySelector('label[for="' + bad.id + '"]') : null;
        var name = (bad && (bad.type === 'radio' || bad.type === 'checkbox') && group && group.querySelector('legend')) || labelFor;
        var text = name ? name.textContent.trim() : '';
        show(bad && bad.type === 'email' ? 'Please enter a valid email address.'
          : 'Please fill in: ' + (text || 'the required fields') + '.', 'error');
        if (bad) bad.focus();
        return;
      }

      // Checkbox groups send every ticked choice, joined with commas.
      var fields = {};
      new FormData(form).forEach(function (value, key) {
        fields[key] = Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] + ', ' + value : value;
      });
      var labelEl = button.querySelector('.btn__label') || button;
      var label = labelEl.textContent;
      button.disabled = true;
      labelEl.textContent = 'Sending...';

      fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form: form.dataset.form, page: window.location.pathname, fields: fields })
      })
        .then(function (response) {
          if (!response.ok) throw new Error('Request failed with ' + response.status);
          form.hidden = true;
          show(form.dataset.success || 'Thank you!', 'success');
        })
        .catch(function () {
          show(form.dataset.error || 'Something went wrong. Please try again.', 'error');
          button.disabled = false;
          labelEl.textContent = label;
        });
    });
  });

  // ----- Buttons that lead to the waitlist: scroll there, then put the cursor in the email field -----
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href="#waitlist"]');
    var section = document.getElementById('waitlist');
    if (!link || !section) return;
    event.preventDefault();
    var form = section.querySelector('form[data-form]');
    var email = section.querySelector('input[type="email"]');
    var arrived = false;
    function arrive() {
      if (arrived) return;
      arrived = true;
      if (form && !form.hidden && email) {
        email.focus({ preventScroll: true });
        form.classList.remove('is-highlighted');
        void form.offsetWidth; // restart the glow animation
        form.classList.add('is-highlighted');
      }
    }
    section.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    if (history.replaceState) history.replaceState(null, '', '#waitlist');
    if ('onscrollend' in window) window.addEventListener('scrollend', arrive, { once: true });
    setTimeout(arrive, reduceMotion.matches ? 0 : 900);
  });

  // ----- Motion: reveal [data-reveal] elements as they scroll into view -----
  // See "Motion and interactions" in css/styles.css for the available effects.
  // Set up once the first paint is done, so it never slows down the first view.
  function startMotion() {
    var revealItems = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      revealItems.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      // Items inside a data-reveal-stagger group that appear together arrive one after another
      var order = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.parentElement && el.parentElement.closest('[data-reveal-stagger]')) {
          el.style.setProperty('--reveal-delay', Math.min(order++, 5) * 90 + 'ms');
        }
        el.classList.add('is-visible');
        observer.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealItems.forEach(function (el) { observer.observe(el); });
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(startMotion, { timeout: 500 });
  else setTimeout(startMotion, 100);

  // Anything that gets keyboard focus is shown straight away, so a focused button is never invisible
  document.addEventListener('focusin', function (event) {
    var el = event.target.closest && event.target.closest('[data-reveal]');
    while (el) {
      el.classList.add('is-visible');
      el = el.parentElement && el.parentElement.closest('[data-reveal]');
    }
  });
  window.hmMotionReady = true;

  // ----- Shop page: kit carousel arrows -----
  // Kit carousel arrows (phones and tablets). On desktop all kits show at once and the arrows stay hidden.
  (function () {
    var list = document.querySelector('[data-kit-list]');
    var nav = document.querySelector('[data-kit-nav]');
    if (!list || !nav) return;
    var prev = nav.querySelector('[data-kit-prev]');
    var next = nav.querySelector('[data-kit-next]');
    nav.hidden = false;
    function update() {
      var max = list.scrollWidth - list.clientWidth - 2;
      prev.disabled = list.scrollLeft <= 2;
      next.disabled = list.scrollLeft >= max;
    }
    function go(dir) {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      list.scrollBy({ left: dir * list.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    }
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    list.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  // ----- Footer year -----
  document.querySelectorAll('[data-year]').forEach(function (el) {
    var year = String(new Date().getFullYear());
    if (el.textContent !== year) el.textContent = year;
  });
})();
