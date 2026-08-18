# Reel #002 — Campanha de voto Comer & Beber 2026

Previz animado do brief `reelvotocomerbeber20260818.pdf`, para ver o ritmo do
reel antes de gravar.

**Duas versões, mesma estrutura e mesmo tempo:**

| Arquivo | Cenas | Quando usar |
|---|---|---|
| `reel-higgsfield-43s.mp4` | Fotos geradas no Higgsfield | Ver como o reel **fica de verdade**: luz, enquadramento, textura |
| `reel-previz-43s.mp4` | Silhuetas desenhadas | Ler só a estrutura, sem se distrair com a imagem |

Ambos: 1080×1920, 30fps, 51s (cartela 3,5s + reel 43s + fecho 4,5s).

Nenhum dos dois é filmagem. O que entregam de verdade é o **tempo** — quando
cada fala entra, quanto dura cada shot, onde caem os cutaways, quando o texto
sobe na tela.

## O que aparece na tela

| Elemento | O que é |
|---|---|
| Barra segmentada no topo | Os 5 shots do brief, proporcionais à duração |
| `00:12 · A VIRADA` | Cronômetro do reel e nome do shot |
| `245 ppm` (âmbar quando aperta) | Ritmo de fala exigido naquele shot |
| Etiqueta branca à esquerda | Cutaway ativo (forno, fornada, mesa, pizza, time) |
| Faixa de cima do painel | A direção do shot, com o jargão traduzido (o que é plano peito, o que é cutaway) |
| Texto grande | Legenda automática, palavra a palavra, no timing da fala |
| `VOTE QT` (33–43s) | O único momento com texto na tela, como manda o brief |

## Nota de produção: o roteiro não cabe em 43s

Distribuindo as falas nos tempos do brief, o texto pede **229 palavras por
minuto na média**. Conversa natural em português fica em 150–170 ppm, e uma
entrega animada de reel chega a 190–200. Shot a shot:

| Shot | Tempo | Palavras | Ritmo |
|---|---|---|---|
| HOOK | 00–03s | 22 | **440 ppm — não cabe** |
| A HISTÓRIA | 03–12s | 34 | 227 ppm |
| A VIRADA | 12–22s | 38 | 228 ppm |
| O PORQUÊ | 22–33s | 45 | 245 ppm |
| PEDIDO + FECHO | 33–43s | 25 | 150 ppm — confortável |

O hook é o problema real: 22 palavras em 3 segundos é o dobro do que a boca
faz. Em 3s cabem 9 ou 10 palavras. Dos 10 ganchos alternativos do brief, o
**nº 4** ("Eu nunca pedi voto pra ninguém. Hoje é a primeira vez.", 11
palavras) é o que encaixa no tempo. O nº 9, escolha da direção, tem 16
palavras e pede uns 5s.

Dois caminhos, os dois válidos:

1. **Deixa o reel esticar para ~52s.** O roteiro inteiro, falado em ritmo
   natural, dá 50 a 55 segundos. Reels aceita até 90s e o texto não perde nada.
2. **Corta ~30 palavras** para segurar os 43s. Candidatos que saem sem doer:
   "coisa que eu nem sonhava" e "Não é a gente pedindo troféu". O trecho
   "Lá fora quem decide é júri. Aqui, quem decide é você" é o melhor do
   roteiro, não encosta nele.

## As imagens do Higgsfield

Nove quadros em `frames-higgsfield/`, um por beat do roteiro, gerados com
**soul_2** em 9:16 e 2K. Os prompts completos estão em `prompts-higgsfield.md`.

**Custo: 0,12 crédito por imagem.** O storyboard inteiro saiu por pouco mais de
1 crédito. Vídeo, para comparar, custa 8 créditos por clipe de 8s no modelo mais
barato, o que colocaria os 43s em 56 a 72 créditos. Para entender enquadramento,
foto parada resolve e custa uma fração.

Duas coisas que o teste deixou claras:

**O rosto não é o do Matheus.** Sem uma foto de referência, o modelo inventa uma
pessoa. Passar um quadro anterior como referência de identidade (`medias` com
role `image`) aproxima o tipo, a luz e o figurino, mas não trava o rosto. Com uma
foto real do Matheus na referência, trava.

**O modelo fecha no rosto quando recebe referência de identidade.** Pedir "plano
aberto, câmera a 1,5m, espaço acima da cabeça" não venceu a tendência dele de
enquadrar retrato. Não é problema aqui: o brief pede "quase sem corte", ou seja,
os trechos de rosto são uma tomada só, então o previz usa o mesmo quadro do
começo ao fim, com um push-in lento e contínuo, e só troca no fecho, onde o
brief pede ele sorrindo com o texto na tela.

## Trilha

`trilha.py` sintetiza o pad de referência, sem sample de terceiro, seguindo a
direção de áudio do brief: silêncio digital no hook, entrada baixinha aos 3s,
segura na virada, cresce no porquê, resolve suave no fecho. É referência de
dinâmica para o editor, não trilha final.

## Como regerar

```bash
python3 trilha.py trilha.wav                                     # ~30s

# versão Higgsfield (as fotos já estão em frames-higgsfield/)
node render.mjs reel-higgsfield-43s.mp4 trilha.wav --html previz-higgsfield.html

# versão silhueta
node render.mjs reel-previz-43s.mp4 trilha.wav --html previz.html

# quadros soltos, para conferir sem renderizar tudo
node frames.mjs previz-higgsfield.html /tmp "1.5,10.2,26,39.5"
```

O roteiro fica na constante `SHOTS` de cada previz — tempo, fala, direção e
cutaways de cada shot. `window.__render(t, quadro)` é determinístico: cada
quadro depende só do tempo, o que torna o render reproduzível e paralelizável.
