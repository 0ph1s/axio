/* =========================================================================
   AXIO // api/_email.js
   Template do e-mail que chega quando alguém usa o formulário do site.
   Arquivos com "_" na pasta api/ não viram rota na Vercel.
   Layout em tabelas e estilos inline: é o que os clientes de e-mail entendem.
   ========================================================================= */

'use strict';

const SITE = 'https://axio-dev.vercel.app';

const C = {
  glass: '#120D08',
  glass2: '#1A130C',
  amber: '#FFB547',
  hot: '#FFE6B3',
  text: '#EBCB98',
  dim: '#A97B4B',
  wire: '#5A3B1F',
  wire2: '#35230F',
};

// sem webfonts: cada sistema usa a monoespaçada que tiver
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace";

/** Estilo tipográfico com propriedades longas (alguns clientes ignoram o atalho "font"). */
const type = (size, color, { weight = 400, lh = 1.6, extra = '' } = {}) =>
  `font-family:${MONO};font-size:${size}px;font-weight:${weight};line-height:${lh};color:${color};${extra}`;

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

/** mailto com o endereço codificado: um "?" no e-mail não vira parâmetro. */
const mailto = (email, subject) =>
  `mailto:${encodeURIComponent(email).replace('%40', '@')}?subject=${encodeURIComponent(subject)}`;

function contactEmail({ name, email, message, date = new Date() }) {
  const when = date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const subject = `Contato pelo site: ${name}`;
  const preview = message.replace(/\s+/g, ' ').slice(0, 110);
  const host = SITE.replace(/^https?:\/\//, '');

  const row = (label, value) => `
            <tr>
              <td width="96" valign="top" style="padding:6px 0;${type(13, C.dim)}">${label} <span style="color:${C.wire};">&rsaquo;</span></td>
              <td valign="top" style="padding:6px 0;${type(14, C.text, { extra: 'word-break:break-word;' })}">${value}</td>
            </tr>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.glass};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preview)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.glass}" style="background:${C.glass};">
    <tr>
      <td align="center" style="padding:32px 16px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <tr>
            <td style="padding:0 0 14px;border-bottom:1px solid ${C.wire2};${type(22, C.hot, { lh: 1, extra: 'letter-spacing:0.08em;' })}">AXIO<span style="color:${C.amber};">_</span></td>
          </tr>

          <tr>
            <td style="padding:28px 0 6px;${type(13, C.dim)}"><span style="color:${C.amber};">axio@core</span>:~$ ./init_contact</td>
          </tr>
          <tr>
            <td style="padding:0 0 24px;${type(24, C.hot, { weight: 600, lh: 1.25, extra: 'word-break:break-word;' })}">Nova mensagem de ${esc(name)}</td>
          </tr>

          <tr>
            <td bgcolor="${C.glass2}" style="background:${C.glass2};border:1px solid ${C.wire};padding:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${row('nome', esc(name))}${row('e-mail', `<a href="${esc(mailto(email, 'Re: Contato pelo site'))}" style="color:${C.amber};text-decoration:underline;">${esc(email)}</a>`)}${row('recebido', esc(when))}
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 24px;">
                <tr>
                  <td style="padding:16px 0 16px 18px;border-left:2px solid ${C.amber};${type(15, C.text, { lh: 1.65, extra: 'word-break:break-word;' })}">${esc(message).replace(/\r?\n/g, '<br>')}</td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="${C.amber}" style="background:${C.amber};">
                    <a href="${esc(mailto(email, 'Re: Contato pelo site'))}" style="display:inline-block;padding:14px 22px;${type(13, C.glass, { weight: 600, lh: 1, extra: 'letter-spacing:0.06em;text-decoration:none;' })}">&gt; RESPONDER</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 0 0;${type(12, C.dim)}">Enviado pelo formulário de <a href="${SITE}" style="color:${C.dim};text-decoration:underline;">${host}</a>. Responder este e-mail envia a resposta direto para ${esc(email)}.</td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Nova mensagem de ${name}`,
    '',
    `nome: ${name}`,
    `e-mail: ${email}`,
    `recebido: ${when}`,
    '',
    message,
    '',
    '--',
    `Enviado pelo formulário de ${host}. Responder este e-mail envia a resposta direto para ${email}.`,
  ].join('\n');

  return { subject, html, text };
}

module.exports = { contactEmail };
