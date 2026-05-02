(function () {
    'use strict';
    const accessConfig = {
        code: '0102ABC',
        validUntil: '2026-05-15'
    };
    window.validateAccessCode = function (input) {
        if (!input || typeof input !== 'string') {
            return { valid: false, expired: false, message: 'Código inválido.' };
        }
        const clean = input.trim().toUpperCase();
        const expiryDate = new Date(accessConfig.validUntil + 'T23:59:59');
        if (isNaN(expiryDate.getTime())) {
            return { valid: false, expired: false, message: 'Error de configuración.' };
        }
        const now = new Date();
        if (now > expiryDate) {
            return { valid: false, expired: true, message: 'El código de acceso ha expirado. Contacta al administrador.' };
        }
        if (clean !== accessConfig.code.toUpperCase()) {
            return { valid: false, expired: false, message: 'Código incorrecto. Intenta de nuevo.' };
        }
        return { valid: true, expired: false, message: '' };
    };
})();