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

    function renderJobs() {
        const container = document.getElementById('jobs-container');
        if (!container || !window.jobOffers || !Array.isArray(window.jobOffers)) return;
        container.innerHTML = window.jobOffers.map(renderCard).join('');
    }

    function isSelectionInsidePhone() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
        try {
            const range = selection.getRangeAt(0);
            let node = range.commonAncestorContainer;
            if (node.nodeType === Node.TEXT_NODE) {
                node = node.parentNode;
            }
            return !!(node && (node.classList.contains('phone') || node.closest('.phone')));
        } catch (e) {
            return false;
        }
    }

    function handleCopyCut(e) {
        if (!isSelectionInsidePhone()) {
            e.preventDefault();
            if (e.clipboardData) {
                e.clipboardData.setData('text/plain', '');
            }
            return false;
        }
    }

    function handleContextMenu(e) {
        const target = e.target;
        if (target.classList.contains('phone') || target.closest('.phone')) {
            return true;
        }
        e.preventDefault();
        return false;
    }

    function preventDrag(e) {
        const target = e.target;
        if (target.classList.contains('phone') || target.closest('.phone')) {
            return true;
        }
        e.preventDefault();
        return false;
    }

    function handleKeyDown(e) {
        const key = e.key;
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;

        if (key === 'F12') {
            e.preventDefault();
            return false;
        }
        if (ctrl && (key === 's' || key === 'S')) {
            e.preventDefault();
            return false;
        }
        if (ctrl && (key === 'p' || key === 'P')) {
            e.preventDefault();
            return false;
        }
        if (ctrl && (key === 'u' || key === 'U')) {
            e.preventDefault();
            return false;
        }
        if (ctrl && shift && (key === 's' || key === 'S')) {
            e.preventDefault();
            return false;
        }
        if (ctrl && shift && (key === 'i' || key === 'I')) {
            e.preventDefault();
            return false;
        }
        if (ctrl && shift && (key === 'j' || key === 'J')) {
            e.preventDefault();
            return false;
        }
        if (ctrl && shift && (key === 'c' || key === 'C')) {
            e.preventDefault();
            return false;
        }
    }

    function overridePrint() {
        window.print = function () {
            alert('La impresión de esta página no está permitida.');
            return false;
        };
    }

    function setupPrintBlocker() {
        const printQuery = window.matchMedia('print');
        if (printQuery.addEventListener) {
            printQuery.addEventListener('change', function (e) {
                if (e.matches) {
                    setTimeout(function () {
                        alert('La impresión de esta página no está permitida.');
                    }, 10);
                }
            });
        }
    }

    function setupSecurity() {
        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('copy', handleCopyCut);
        document.addEventListener('cut', handleCopyCut);
        document.addEventListener('dragstart', preventDrag);
        document.addEventListener('contextmenu', handleContextMenu);
        overridePrint();
        setupPrintBlocker();
    }

    function setupScrollToTop() {
        const btn = document.getElementById('scroll-top-btn');
        if (!btn) return;

        function toggleVisibility() {
            const scrollBottom = window.innerHeight + window.scrollY;
            const docHeight = document.documentElement.scrollHeight;
            if (docHeight - scrollBottom <= 120) {
                btn.classList.add('visible');
            } else {
                btn.classList.remove('visible');
            }
        }

        window.addEventListener('scroll', toggleVisibility, { passive: true });
        window.addEventListener('resize', toggleVisibility, { passive: true });

        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        toggleVisibility();
    }

    function startSessionMonitor() {
        if (sessionCheckInterval) clearInterval(sessionCheckInterval);
        sessionCheckInterval = setInterval(checkSessionTimeout, 60000);
    }

    function setupApp() {
        const section = document.getElementById('vacantes');
        if (section) section.classList.add('active');
        renderJobs();
        setupSecurity();
        setupScrollToTop();
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
                input.value = '';
                input.focus();
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