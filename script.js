(function () {
    'use strict';
    const STORAGE_KEY = 'empleosya_access_granted';
    const OFFER_MAX_CHARS = 1500;
    const JOB_ICONS = {
        cocina: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 13V21M18 13V21M6 13L10 3H14L18 13M6 13H18"/><circle cx="8" cy="9" r="1.5"/><circle cx="16" cy="9" r="1.5"/></svg>`,
        ventas: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><circle cx="12" cy="14" r="2"/></svg>`,
        tecnologia: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
        construccion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.7-3.7a1 1 0 000-1.4L19.8 2.8a1 1 0 00-1.4 0l-3.7 3.7z"/><path d="M2 22l20-20M14 22l8-8M2 2l8 8"/></svg>`,
        oficina: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="9" y1="12" x2="15" y2="12"/></svg>`,
        general: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`
    };
    function getJobIcon(desc) {
        const lower = desc.toLowerCase();
        if (/cocin|pizz|ayudante de cocina|gastronom/i.test(lower)) return JOB_ICONS.cocina;
        if (/dependient|vendedor|gestor comercial|promotor|clientes/i.test(lower)) return JOB_ICONS.ventas;
        if (/ingenier|informát|sistema|redes|web|tecnolog/i.test(lower)) return JOB_ICONS.tecnologia;
        if (/construc|albañil|pladur|techos|paredes|obra/i.test(lower)) return JOB_ICONS.construccion;
        if (/especialista|administrat|contable|abogad|rrhh|capital humano/i.test(lower)) return JOB_ICONS.oficina;
        return JOB_ICONS.general;
    }
    function sanitize(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    function cleanPhone(phone) {
        if (!phone) return '';
        return phone.replace(/[^\d+]/g, '');
    }
    function renderCard(offer) {
        if (!offer.movil || !offer.descripcion) return '';
        const id = offer.id || `#${window.jobOffers.indexOf(offer) + 1}`;
        const clean = cleanPhone(offer.movil);
        const smsBody = 'Hola le contacto por la plataforma EMPLEOS_YA y me interesó su oferta laboral.';
        const smsHref = `sms:${clean}?body=${encodeURIComponent(smsBody)}`;
        const jobIcon = getJobIcon(offer.descripcion);
        return `
            <div class="job-card" data-id="${id}">
                <span class="job-id-badge">${id}</span>
                <div class="job-icon">${jobIcon}</div>
                <h3>Oferta Laboral</h3>
                <p class="job-desc">${sanitize(offer.descripcion)}</p>
                <div class="contact-wrapper">
                    <a href="${smsHref}" class="contact-btn contact-sms-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/>
                        </svg>
                        Contactar por SMS
                    </a>
                </div>
            </div>`;
    }
    function setupScrollAnimations() {
        const cards = document.querySelectorAll('.job-card');
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.15, rootMargin: '0px 0px -30px 0px' });
            cards.forEach((card, i) => {
                card.style.transitionDelay = `${i * 0.06}s`;
                observer.observe(card);
            });
        } else {
            cards.forEach(card => card.classList.add('visible'));
        }
    }
    function renderJobs() {
        const container = document.getElementById('jobs-container');
        if (!container || !window.jobOffers) return;
        container.innerHTML = window.jobOffers.map(renderCard).join('');
        requestAnimationFrame(() => {
            setupScrollAnimations();
            addRippleEffect();
        });
    }
    function addRippleEffect() {
        document.querySelectorAll('.btn-primary, .contact-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                const ripple = document.createElement('span');
                ripple.className = 'ripple';
                const rect = btn.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${e.clientX - rect.left - size/2}px`;
                ripple.style.top = `${e.clientY - rect.top - size/2}px`;
                btn.appendChild(ripple);
                ripple.addEventListener('animationend', () => ripple.remove());
            });
        });
    }
    function setupHeaderDropdown() {
        const toggle = document.getElementById('dropdownToggle');
        const menu = document.getElementById('dropdownMenu');
        if (!toggle || !menu) return;
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.contains('open');
            menu.classList.toggle('open');
            toggle.setAttribute('aria-expanded', !isOpen);
        });
        document.addEventListener('click', (e) => {
            if (!toggle.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && menu.classList.contains('open')) {
                menu.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.focus();
            }
        });
    }
    function setupGmailOfferForm() {
        const form = document.getElementById('gmail-offer-form');
        const companyInput = document.getElementById('offer-company');
        const positionInput = document.getElementById('offer-position');
        const recipientInput = document.getElementById('offer-recipient');
        const descriptionInput = document.getElementById('offer-description');
        const counter = document.getElementById('offer-char-counter');
        const status = document.getElementById('offer-form-status');
        if (!form || !descriptionInput || !counter || !status || form.dataset.gmailReady === 'true') return;
        form.dataset.gmailReady = 'true';

        function updateCounter() {
            const length = descriptionInput.value.length;
            counter.textContent = `${length}/${OFFER_MAX_CHARS} caracteres`;
            counter.classList.toggle('limit-warning', length > OFFER_MAX_CHARS * 0.9 && length <= OFFER_MAX_CHARS);
            counter.classList.toggle('limit-error', length > OFFER_MAX_CHARS);
        }

        function showStatus(message, type) {
            status.textContent = message;
            status.className = type ? `form-status ${type}` : 'form-status';
        }

        descriptionInput.addEventListener('input', updateCounter);
        updateCounter();

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const company = companyInput.value.trim();
            const position = positionInput.value.trim();
            const recipient = recipientInput.value.trim();
            const description = descriptionInput.value.trim();

            if (!company || !position || !description) {
                showStatus('Completa empresa, cargo y descripción antes de enviar.', 'error');
                return;
            }
            if (description.length > OFFER_MAX_CHARS) {
                showStatus(`La descripción supera el límite de ${OFFER_MAX_CHARS} caracteres.`, 'error');
                descriptionInput.focus();
                return;
            }
            if (recipient && !recipientInput.checkValidity()) {
                showStatus('Ingresa un correo válido o deja el destinatario vacío.', 'error');
                recipientInput.focus();
                return;
            }

            const subject = `Nueva oferta de empleo: ${position}`;
            const body = [
                'Hola, comparto una nueva oferta laboral para EMPLEOS YA.',
                '',
                `Empresa o contacto: ${company}`,
                `Puesto o cargo: ${position}`,
                '',
                'Descripción:',
                description,
                '',
                'Enviado desde la plataforma EMPLEOS YA.'
            ].join('\n');
            const gmailUrl = new URL('https://mail.google.com/mail/');
            gmailUrl.searchParams.set('view', 'cm');
            gmailUrl.searchParams.set('fs', '1');
            if (recipient) gmailUrl.searchParams.set('to', recipient);
            gmailUrl.searchParams.set('su', subject);
            gmailUrl.searchParams.set('body', body);
            window.open(gmailUrl.toString(), '_blank', 'noopener,noreferrer');
            showStatus('Gmail se abrió en una nueva pestaña con la oferta preparada.', 'success');
        });
    }

    function setupNavigation() {
        const sections = document.querySelectorAll('.page-section');
        const links = document.querySelectorAll('.nav-link');
        const cta = document.getElementById('verVacantesBtn');
        function showSection(id) {
            sections.forEach(s => s.classList.remove('active'));
            const target = document.getElementById(id);
            if (target) target.classList.add('active');
            links.forEach(l => {
                l.classList.remove('active');
                if (l.dataset.section === id) l.classList.add('active');
            });
            if (id === 'vacantes') renderJobs();
            if (id === 'enviar-oferta') setupGmailOfferForm();
        }
        links.forEach(l => l.addEventListener('click', e => {
            e.preventDefault();
            showSection(l.dataset.section);
            history.replaceState(null, '', `#${l.dataset.section}`);
        }));
        if (cta) {
            cta.addEventListener('click', () => {
                showSection('vacantes');
                history.pushState(null, '', '#vacantes');
            });
        }
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1) || 'inicio';
            if (document.getElementById(hash)) showSection(hash);
        });
    }
    function initAccessGate() {
        const overlay = document.getElementById('access-gate');
        const appContent = document.getElementById('app-content');
        const form = document.getElementById('access-form');
        const input = document.getElementById('access-code');
        const errorMsg = document.getElementById('access-error');
        if (!overlay || !appContent) return;
        if (sessionStorage.getItem(STORAGE_KEY) === 'true') {
            overlay.style.display = 'none';
            appContent.style.display = 'block';
            setupApp();
            return;
        }
        overlay.style.display = 'flex';
        appContent.style.display = 'none';
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const code = input.value.trim();
            if (window.accessCodes && window.accessCodes.includes(code)) {
                sessionStorage.setItem(STORAGE_KEY, 'true');
                overlay.style.display = 'none';
                appContent.style.display = 'block';
                setupApp();
            } else {
                errorMsg.style.display = 'block';
                input.classList.add('shake');
                setTimeout(() => input.classList.remove('shake'), 500);
            }
        });
    }
    function setupApp() {
        setupHeaderDropdown();
        setupNavigation();
        setupGmailOfferForm();
        const initial = window.location.hash.slice(1) || 'inicio';
        if (document.getElementById(initial)) {
            document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
            document.getElementById(initial).classList.add('active');
            document.querySelectorAll('.nav-link').forEach(l => {
                l.classList.toggle('active', l.dataset.section === initial);
            });
            if (initial === 'vacantes') renderJobs();
            if (initial === 'enviar-oferta') setupGmailOfferForm();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAccessGate);
    } else {
        initAccessGate();
    }
})();