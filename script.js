(function () {
    'use strict';

    const ACCESS_CONFIG = {
        code: '0102ABC',
        validUntil: '2026-05-15'
    };

    const STORAGE_KEY = 'bolsadeempleo_access_granted_v3';
    const SESSION_TIMEOUT = 3600000;
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION = 300000;

    let sessionStartTime = null;
    let failedAttempts = 0;
    let lockoutUntil = null;
    let scrollObserver = null;
    let sessionCheckInterval = null;

    async function loadJobOffers() {
        try {
            const response = await fetch('work.xml');
            if (!response.ok) throw new Error('Error al cargar work.xml');
            const text = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'application/xml');
            const offerNodes = xml.querySelectorAll('offer');
            const offers = Array.from(offerNodes).map(function (offer) {
                const infoNode = offer.querySelector('info');
                return {
                    id: offer.getAttribute('id'),
                    info: infoNode ? infoNode.textContent.trim() : ''
                };
            });
            if (!offers.length) throw new Error('No se encontraron ofertas en work.xml');
            window.jobOffers = offers;
        } catch (err) {
            window.jobOffers = [];
        }
    }

    function validateAccessCode(input) {
        if (!input || typeof input !== 'string') {
            return { valid: false, expired: false, message: 'Código inválido.' };
        }
        const clean = input.trim().toUpperCase();
        const expiryDate = new Date(ACCESS_CONFIG.validUntil + 'T23:59:59');
        if (isNaN(expiryDate.getTime())) {
            return { valid: false, expired: false, message: 'Error de configuración.' };
        }
        if (new Date() > expiryDate) {
            return { valid: false, expired: true, message: 'El código de acceso ha expirado. Contacta al administrador.' };
        }
        if (clean !== ACCESS_CONFIG.code.toUpperCase()) {
            return { valid: false, expired: false, message: 'Código incorrecto. Intenta de nuevo.' };
        }
        return { valid: true, expired: false, message: '' };
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return String(text).replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    function checkSessionTimeout() {
        if (!sessionStartTime) return false;
        if (Date.now() - sessionStartTime > SESSION_TIMEOUT) {
            destroySession();
            return true;
        }
        return false;
    }

    function destroySession() {
        sessionStorage.removeItem(STORAGE_KEY);
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
        }
        location.reload();
    }

    function isLockedOut() {
        if (lockoutUntil && Date.now() < lockoutUntil) {
            return true;
        }
        if (lockoutUntil && Date.now() >= lockoutUntil) {
            lockoutUntil = null;
            failedAttempts = 0;
        }
        return false;
    }

    function getLockoutRemaining() {
        if (!lockoutUntil) return 0;
        return Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
    }

    const JOB_ICONS = {
        cocina: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 13V21M18 13V21M6 13L10 3H14L18 13M6 13H18"/><circle cx="8" cy="9" r="1.5"/><circle cx="16" cy="9" r="1.5"/></svg>',
        ventas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><circle cx="12" cy="14" r="2"/></svg>',
        tecnologia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
        construccion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.7-3.7a1 1 0 000-1.4L19.8 2.8a1 1 0 00-1.4 0l-3.7 3.7z"/><path d="M2 22l20-20M14 22l8-8M2 2l8 8"/></svg>',
        oficina: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="9" y1="12" x2="15" y2="12"/></svg>',
        general: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>'
    };

    function getJobIcon(info) {
        const lower = info.toLowerCase();
        if (/cocin|pizz|ayudante de cocina|gastronom/i.test(lower)) return JOB_ICONS.cocina;
        if (/dependient|vendedor|gestor comercial|promotor|clientes/i.test(lower)) return JOB_ICONS.ventas;
        if (/ingenier|informát|sistema|redes|web|tecnolog/i.test(lower)) return JOB_ICONS.tecnologia;
        if (/construc|albañil|pladur|techos|paredes|obra/i.test(lower)) return JOB_ICONS.construccion;
        if (/especialista|administrat|contable|abogad|rrhh|capital humano/i.test(lower)) return JOB_ICONS.oficina;
        return JOB_ICONS.general;
    }

    function renderCard(offer) {
        if (!offer.info) return '';
        const id = offer.id;
        const jobIcon = getJobIcon(offer.info);
        let desc = offer.info
            .replace(/<phone>/g, '\x00START\x00')
            .replace(/<\/phone>/g, '\x00END\x00');
        desc = escapeHtml(desc);
        desc = desc.replace(/\0START\0/g, '<span class="phone">').replace(/\0END\0/g, '</span>');
        return '<div class="job-card" data-id="' + escapeHtml(String(id)) + '">' +
            '<span class="job-id-badge">' + escapeHtml(String(id)) + '</span>' +
            '<div class="job-icon">' + jobIcon + '</div>' +
            '<h3>Oferta Laboral</h3>' +
            '<p class="job-desc">' + desc + '</p>' +
            '</div>';
    }

    function setupScrollAnimations() {
        const cards = document.querySelectorAll('.job-card');
        if (!('IntersectionObserver' in window)) {
            cards.forEach(function (card) { card.classList.add('visible'); });
            return;
        }
        if (scrollObserver) scrollObserver.disconnect();
        scrollObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    scrollObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
        cards.forEach(function (card, i) {
            card.style.transitionDelay = (i * 0.03) + 's';
            scrollObserver.observe(card);
        });
    }

    function renderJobs() {
        const container = document.getElementById('jobs-container');
        if (!container || !window.jobOffers || !Array.isArray(window.jobOffers)) return;
        container.innerHTML = window.jobOffers.map(renderCard).join('');
        requestAnimationFrame(function () {
            setupScrollAnimations();
        });
    }

    function startSessionMonitor() {
        if (sessionCheckInterval) clearInterval(sessionCheckInterval);
        sessionCheckInterval = setInterval(checkSessionTimeout, 60000);
    }

    function setupApp() {
        const section = document.getElementById('vacantes');
        if (section) section.classList.add('active');
        renderJobs();
    }

    async function initAccessGate() {
        const overlay = document.getElementById('access-gate');
        const appContent = document.getElementById('app-content');
        const form = document.getElementById('access-form');
        const input = document.getElementById('access-code');
        const errorMsg = document.getElementById('access-error');

        if (!overlay || !appContent) return;

        await loadJobOffers();

        if (sessionStorage.getItem(STORAGE_KEY) === 'true') {
            sessionStartTime = Date.now();
            overlay.style.display = 'none';
            appContent.style.display = 'flex';
            appContent.style.flexDirection = 'column';
            appContent.style.minHeight = '100vh';
            setupApp();
            startSessionMonitor();
            return;
        }

        overlay.style.display = 'flex';
        appContent.style.display = 'none';

        input.addEventListener('input', function () {
            errorMsg.style.display = 'none';
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                input.value = '';
                errorMsg.style.display = 'none';
            }
        });

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (isLockedOut()) {
                const remaining = getLockoutRemaining();
                const mins = Math.ceil(remaining / 60);
                errorMsg.textContent = 'Demasiados intentos. Espera ' + mins + ' minuto(s) para intentar de nuevo.';
                errorMsg.style.display = 'block';
                input.classList.add('shake');
                setTimeout(function () { input.classList.remove('shake'); }, 500);
                return;
            }

            const code = input.value;
            const result = validateAccessCode(code);

            if (result.valid) {
                failedAttempts = 0;
                lockoutUntil = null;
                sessionStartTime = Date.now();
                sessionStorage.setItem(STORAGE_KEY, 'true');
                overlay.style.display = 'none';
                appContent.style.display = 'flex';
                appContent.style.flexDirection = 'column';
                appContent.style.minHeight = '100vh';
                input.value = '';
                errorMsg.style.display = 'none';
                setupApp();
                startSessionMonitor();
            } else {
                failedAttempts++;
                if (failedAttempts >= MAX_ATTEMPTS) {
                    lockoutUntil = Date.now() + LOCKOUT_DURATION;
                    failedAttempts = 0;
                    errorMsg.textContent = 'Demasiados intentos fallidos. Cuenta bloqueada por 5 minutos.';
                } else if (result.expired) {
                    errorMsg.textContent = result.message;
                } else {
                    const remaining = MAX_ATTEMPTS - failedAttempts;
                    errorMsg.textContent = result.message + ' (' + remaining + ' intento(s) restante(s))';
                }
                errorMsg.style.display = 'block';
                input.classList.add('shake');
                input.value = '';
                input.focus();
                setTimeout(function () { input.classList.remove('shake'); }, 500);
            }
        });

        input.focus();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAccessGate);
    } else {
        initAccessGate();
    }
})();