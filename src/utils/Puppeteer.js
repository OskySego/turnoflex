
'use strict';

// Correccion temporal para whatsapp-web.js 1.34.7
// Reintenta errores transitorios de Puppeteer
// durante el registro de funciones del navegador.

async function exposeFunctionIfAbsent(page, name, fn) {
    const exist = await page.evaluate((name) => {
        return !!window[name];
    }, name);

    if (exist) {
        return;
    }

    await exposeFunctionWithRetry(page, name, fn);
}

async function exposeFunctionWithRetry(
    page,
    name,
    fn,
    maxAttempts = 5
) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await page.exposeFunction(name, fn);
            return;
        } catch (error) {
            lastError = error;

            if (
                !isTransientExposeError(error) ||
                attempt === maxAttempts
            ) {
                throw error;
            }

            console.warn(
                `[WhatsApp] Reintentando ${name}: intento ${attempt}`
            );

            await new Promise((resolve) =>
                setTimeout(resolve, 200 * attempt)
            );
        }
    }

    throw lastError;
}

function isTransientExposeError(error) {
    const message =
        error && error.message
            ? error.message
            : String(error);

    return /target closed|detached|destroyed|session closed|execution context/i.test(
        message
    );
}

module.exports = { exposeFunctionIfAbsent };