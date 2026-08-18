# Prompts do storyboard — Higgsfield

Modelo `soul_2`, `aspect_ratio: 9:16`, `quality: 2k`. Custo aferido: **0,12
crédito por imagem**. Nove quadros, um por beat do roteiro.

Os prompts estão em inglês porque o modelo responde melhor assim. O padrão de
cada um é o mesmo: enquadramento em caixa alta, depois quem está em cena e o que
faz, depois a luz, depois o fundo, depois a lente, e por fim o que não pode
aparecer.

| # | Beat | Tempo | Arquivo |
|---|---|---|---|
| 1 | HOOK — plano peito, olho na lente | 00–03s | `frames-higgsfield/shot1.png` |
| 2 | A história — plano peito (alternado, não usado) | 03–12s | `shot2.png` |
| 3 | Cutaway — forno aceso | 06,4–07,4s | `shot3.png` |
| 4 | Cutaway — fornada saindo | 07,4–08,4s | `shot4.png` |
| 5 | A virada — mais fechado (alternado, não usado) | 12–22s | `shot5.png` |
| 6 | Cutaway — cliente rindo na mesa | 24,6–26,8s | `shot6.png` |
| 7 | Cutaway — pizza chegando | 26,8–28,6s | `shot7.png` |
| 8 | Cutaway — o time junto | 28,6–30,6s | `shot8.png` |
| 9 | Pedido + fecho — sorrindo, espaço pro texto | 33–43s | `shot9.png` |

Os quadros 2 e 5 ficaram em `frames-higgsfield/` como alternativos. O previz não
usa: o brief pede "quase sem corte", então os trechos de rosto rodam a mesma
tomada, o quadro 1, do começo até 33s.

## O bloco que trava a identidade

Para o rosto ser o mesmo em todos os quadros, o primeiro vira referência dos
outros:

```json
"medias": [{ "role": "image", "value": "<job_id do quadro 1>" }]
```

E o prompt começa com `Keep the exact same man's face and identity as the
reference image.`

Com um quadro gerado por IA como referência isso aproxima tipo físico, luz e
figurino, mas não trava o rosto. **Com uma foto real do Matheus, trava.** É esse
o caminho para o previz virar ele de fato: subir a foto com `media_upload_widget`
e usar o `media_id` retornado no lugar do `job_id` acima, nos quadros 1, 2, 5 e 9.

## Prompt do quadro 1, o modelo dos outros

```
Vertical 9:16 documentary photograph. CHEST-UP FRAMING (medium close-up, head
and shoulders and upper chest fill the frame). A Brazilian pizzaiolo, mid-30s,
short dark hair, short trimmed beard, wearing a simple dark shirt, standing in
the dining room of an upscale Neapolitan pizza bar. He looks DIRECTLY INTO THE
CAMERA LENS, serious and sincere, mouth slightly open as he begins to speak.
Warm soft tungsten key light on his face from the front. Behind him: exposed
brick wall and dark industrial interior, warm pendant lamps thrown completely
out of focus into round golden bokeh. Camera at chest height, slightly above his
eye line. Shallow depth of field, natural unretouched skin texture, warm
cinematic color grade, real photo, no text, no captions, no logos.
```

Os cutaways seguem a mesma estrutura sem pessoa identificável. O do forno:

```
Vertical 9:16 cinematic photograph, CUTAWAY INSERT SHOT, no people. The glowing
mouth of a wood-fired Neapolitan pizza oven in a dark restaurant kitchen, orange
flames licking the dome inside, burning logs and glowing embers on the oven
floor. The fire is the only light source, throwing warm orange light onto the
tiled oven face. Dark surroundings, deep shadows, shallow depth of field,
handheld feel, warm cinematic color grade, real photo, no text, no people,
no logos.
```

## O que aprendemos gerando

**Sempre termine com o que não pode aparecer.** Sem `no text, no letters, no
signage`, o modelo escreve rabisco ilegível nas paredes. Aconteceu no primeiro
quadro 9 e sumiu ao acrescentar a linha.

**Referência de identidade puxa o enquadramento para retrato.** Pedir "wide
medium shot, camera 1,5 metres away, clear space above his head" não venceu.
Quem precisa de plano aberto com referência, gere sem referência e aceite a
variação de rosto, ou filme de verdade.

**O plano free limita a 1 job simultâneo.** Lotes de 9 passam parcialmente e
alguns voltam com `Rate limit reached`. Reenviar um a um, esperando cada
`jobs_wait` fechar, resolve.
