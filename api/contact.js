/* =========================================================================
   AXIO // api/contact.js
   Função serverless da Vercel: recebe o formulário de contato e envia a
   mensagem pelo Resend. A chave fica na variável de ambiente RESEND_API_KEY.
   ========================================================================= */

'use strict';

const TO = 'axiodev.contact@gmail.com';
// sem domínio próprio, o Resend só envia a partir do endereço de testes dele
const FROM = 'Site Axio <onboarding@resend.dev>';
const LIMITS = { name: 100, email: 200, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_ELAPSED_MS = 3000;

const send = (res, status, data) => res.status(status).json(data);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Use POST.' });
  }

  let body;
  try {
    body = req.body && typeof req.body === 'object' ? req.body : {};
  } catch (e) {
    return send(res, 400, { error: 'Não foi possível ler o formulário.' });
  }

  // robôs: preenchem o campo invisível ou enviam rápido demais.
  // Recebem "ok" para não saberem que foram filtrados.
  if (body.website || !(Number(body.elapsed) >= MIN_ELAPSED_MS)) {
    return send(res, 200, { ok: true });
  }

  const name = String(body.name || '').replace(/[\r\n]+/g, ' ').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();

  const rules = [
    [name.length > 0, 'Informe seu nome.'],
    [name.length <= LIMITS.name, `O nome pode ter até ${LIMITS.name} caracteres.`],
    [EMAIL_RE.test(email) && email.length <= LIMITS.email, 'Informe um e-mail válido, por exemplo voce@empresa.com.'],
    [message.length > 0, 'Escreva sua mensagem antes de enviar.'],
    [message.length <= LIMITS.message, `A mensagem pode ter até ${LIMITS.message} caracteres.`],
  ];
  const failed = rules.find(([ok]) => !ok);
  if (failed) return send(res, 400, { error: failed[1] });

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('[contact] RESEND_API_KEY não configurada');
    return send(res, 503, { error: 'Envio indisponível no momento.' });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: TO,
        reply_to: email, // "Responder" no Gmail vai direto para quem escreveu
        subject: `Contato pelo site: ${name}`,
        text: `${message}\n\n--\n${name}\n${email}\nEnviado pelo formulário do site.`,
      }),
    });
    if (!r.ok) {
      console.error('[contact] Resend respondeu', r.status, await r.text());
      return send(res, 502, { error: 'Envio indisponível no momento.' });
    }
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('[contact] falha ao chamar o Resend:', err);
    return send(res, 502, { error: 'Envio indisponível no momento.' });
  }
};
