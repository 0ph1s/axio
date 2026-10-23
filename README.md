# AXIO

Landing page institucional da **Axio**: Data Science, Web e Apps Development.

**Site:** https://axio-dev.vercel.app

Estética retro-futurista de terminal: o fundo e o logo são renderizados em ASCII por um shader GLSL próprio, com efeitos CRT (scanlines, halo de fósforo, varredura e vinheta).

## Stack

- HTML5 semântico
- CSS3 com variáveis (sem framework)
- JavaScript ES6+ vanilla
- [GSAP](https://gsap.com/) 3.12.5 + ScrollTrigger + ScrollToPlugin (via CDN)
- WebGL 1 com shaders GLSL escritos à mão (sem bibliotecas)
- Canvas 2D para o monitor de telemetria dos projetos

## Estrutura

```
index.html   estrutura e conteúdo das 5 seções
style.css    tema âmbar/CRT, layout responsivo
main.js      boot, cursor, shader ASCII/CRT, animações de scroll, monitor e contato
```

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
