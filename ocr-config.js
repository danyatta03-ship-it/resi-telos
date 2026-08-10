/* Config OCR AI locale (opzionale).
 *
 * QUANDO SERVE COMPILARE QUESTO FILE?
 *   Solo se l'app viene aperta da file:// (doppio clic su index.html) e
 *   il proxy Netlify /api/gemini non e' raggiungibile. In produzione
 *   (deploy su Netlify) la chiave e' letta lato server dalla env var
 *   GEMINI_API_KEY e questo file resta vuoto.
 *
 * COME COMPILARLO (solo se serve):
 *   window.OCR_AI = {
 *     endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
 *     apiKey: 'AIza...la-tua-chiave-gemini...',
 *     model: 'gemini-2.0-flash'
 *   };
 *
 * NOTA SICUREZZA: se metti qui una API key vera, l'app la espone al
 * browser di chi la usa. Meglio lasciare vuoto e usare sempre il proxy.
 */
window.OCR_AI = window.OCR_AI || null;
