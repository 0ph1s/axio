# AXIO

Landing page institucional da **Axio**: Data Science, Web e Apps Development.

**Site:** https://axio-dev.vercel.app

Estética retro-futurista de terminal: o fundo e o logo são renderizados em ASCII por um shader GLSL próprio, com efeitos CRT (scanlines, halo de fósforo, varredura e vinheta).

## Stack

- HTML5 semântico
- CSS3 com variáveis (sem framework)
- JavaScript ES6+ vanilla
- [GSAP](https://gsap.com/) 3.12.5 + ScrollTrigger + ScrollToPlugin (via CDN)
- [Lenis](https://lenis.darkroom.engineering/) 1.3.26 para a rolagem suave (via CDN)
- WebGL 1 com shaders GLSL escritos à mão (sem bibliotecas)
- Canvas 2D para o monitor de telemetria dos projetos

## Estrutura

```
index.html   estrutura e conteúdo das 5 seções
404.html     página de erro (a Vercel a serve em qualquer caminho inexistente)
style.css    tema âmbar/CRT, layout responsivo
main.js      boot, cursor, rolagem suave, shader ASCII/CRT, animações de scroll, monitor, contato e 404
api/
  contact.js função serverless que envia o formulário de contato pelo Resend
  _email.js  template do e-mail (HTML com estilos inline + versão em texto)
```

## Formulário de contato

O formulário envia para `/api/contact`, uma função da Vercel que valida os campos e manda o e-mail pelo [Resend](https://resend.com/) para axiodev.contact@gmail.com, com o e-mail de quem escreveu como endereço de resposta.

- Precisa da variável de ambiente `RESEND_API_KEY` na Vercel (Settings → Environment Variables). Depois de criar ou trocar a chave, é preciso um novo deploy.
- Sem domínio próprio verificado, o Resend envia a partir de `onboarding@resend.dev` e só para o e-mail dono da conta.
- Contra spam: campo isca invisível, tempo mínimo de 3 s desde a abertura da página e limites de tamanho.
- Se a função falhar, o site abre o cliente de e-mail do visitante com a mensagem pronta.

## Deploy

Hospedado na [Vercel](https://vercel.com/), ligado a este repositório: cada push na `main` publica uma nova versão em produção.

## Rodando localmente

Não há build. Abra o `index.html` no navegador ou sirva a pasta com qualquer servidor estático:

```bash
npx serve .
# ou
python -m http.server 8000
```

## Seções

1. **Hero**: logo AXIO em ASCII, reativo ao mouse
2. **Serviços**: Data Science, Web e Apps em painéis estilo tmux
3. **Projetos**: monitor de telemetria com três canais, um por repositório
4. **Sobre**: manifesto e diagnóstico do sistema
5. **Contato**: copiar e-mail e mensagem rápida (abre o cliente de e-mail)

## Detalhes técnicos

- O shader roda em duas passadas: a cena é calculada na resolução da grade de caracteres e depois mapeada para glifos de um atlas, pixel a pixel.
- A resolução do canvas cai automaticamente se o FPS ficar abaixo de ~40.
- `prefers-reduced-motion` é respeitado; sem WebGL, um logo ASCII estático assume o lugar.
- A PCA do canal 2 é calculada no navegador com dados do NASA Planetary Fact Sheet.
- A rolagem suave usa o mesmo ticker do GSAP, então ScrollTrigger e shader leem a posição já atualizada em cada quadro. No toque e com movimento reduzido, a rolagem é a nativa.
- A 404 usa o mesmo shader com "404" no lugar do logo, mostra o caminho pedido como um `cd` que falhou e sugere a seção mais parecida (distância de edição).
