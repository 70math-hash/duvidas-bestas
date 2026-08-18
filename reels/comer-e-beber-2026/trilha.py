#!/usr/bin/env python3
"""
Trilha de referencia do previz — sintetizada, sem sample de terceiro.
Segue a direcao de audio do brief:
  reel 00-03s  HOOK          silencio absoluto ("so a sua voz, sem musica")
  reel 03-12s  A HISTORIA    pad entra bem baixinho
  reel 12-22s  A VIRADA      segura baixo, deixa respirar
  reel 22-33s  O PORQUE      cresce um pouco, calor humano
  reel 33-43s  PEDIDO        resolve suave, acorde final aberto
"""
import wave, math, struct, sys

SR = 44100
SLATE, REEL, ENDC = 3.5, 43.0, 4.5
TOTAL = SLATE + REEL + ENDC

def r2a(t):            # tempo do reel -> tempo absoluto do video
    return SLATE + t

# progressao: cada acorde e uma lista de frequencias (Hz)
Am = [110.00, 164.81, 220.00, 261.63]
F  = [ 87.31, 130.81, 174.61, 220.00]
C  = [130.81, 196.00, 261.63, 329.63]
G  = [ 98.00, 146.83, 196.00, 246.94]
Cf = [130.81, 196.00, 261.63, 392.00]

ACORDES = [                       # (inicio abs, fim abs, notas)
    (0.0,        SLATE,      [65.41, 98.00]),   # drone grave sob a cartela
    (r2a(3.0),   r2a(12.0),  Am),
    (r2a(12.0),  r2a(22.0),  F),
    (r2a(22.0),  r2a(33.0),  C),
    (r2a(33.0),  r2a(39.0),  G),
    (r2a(39.0),  TOTAL,      Cf),
]

def ganho(t):
    """Curva de volume mestre, ponto a ponto, interpolada."""
    pts = [(0.0,0.10), (SLATE-0.4,0.10), (SLATE-0.05,0.0),
           (r2a(3.0),0.0), (r2a(6.0),0.34), (r2a(12.0),0.34),
           (r2a(13.5),0.28), (r2a(22.0),0.28), (r2a(25.0),0.52),
           (r2a(32.0),0.52), (r2a(34.0),0.44), (r2a(41.0),0.44),
           (r2a(43.0),0.28), (TOTAL-1.2,0.24), (TOTAL,0.0)]
    for i in range(len(pts)-1):
        (t0,v0),(t1,v1) = pts[i], pts[i+1]
        if t0 <= t <= t1:
            k = 0 if t1==t0 else (t-t0)/(t1-t0)
            k = k*k*(3-2*k)                     # smoothstep
            return v0 + (v1-v0)*k
    return 0.0

def envelope_acorde(t, t0, t1, fade=1.6):
    if t < t0-fade or t > t1+fade: return 0.0
    if t < t0:  return (t-(t0-fade))/fade
    if t > t1:  return max(0.0, 1-(t-t1)/fade)
    return 1.0

# harmonicos do pad: um som quente, poucos parciais, sem brilho agressivo
PARCIAIS = [(1.0,1.00),(2.0,0.26),(3.0,0.11),(4.0,0.05),(6.0,0.02)]

def render(path):
    n = int(TOTAL*SR)
    quadros = bytearray()
    fase = {}
    for i in range(n):
        t = i/SR
        g = ganho(t)
        amostra = 0.0
        if g > 1e-5:
            for (t0,t1,notas) in ACORDES:
                env = envelope_acorde(t,t0,t1)
                if env <= 0: continue
                for ni,f in enumerate(notas):
                    # tremolo lento e leve desafinacao entre as vozes: da corpo
                    trem = 1 + 0.05*math.sin(2*math.pi*(0.13+0.017*ni)*t + ni)
                    for mult,amp in PARCIAIS:
                        fr = f*mult*(1 + 0.0016*((ni%2)*2-1))
                        amostra += math.sin(2*math.pi*fr*t) * amp * env * trem / (len(notas)*2.2)
        amostra *= g
        # saturacao suave, evita pico duro
        amostra = math.tanh(amostra*1.4)/1.4
        v = int(max(-1.0,min(1.0,amostra))*32767*0.9)
        quadros += struct.pack('<h', v)
        if i % (SR*5) == 0:
            print(f'  ...{t:5.1f}s / {TOTAL:.1f}s', file=sys.stderr)
    with wave.open(path,'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(bytes(quadros))
    print(f'trilha: {path}  ({TOTAL:.1f}s)')

if __name__ == '__main__':
    render(sys.argv[1] if len(sys.argv)>1 else 'trilha.wav')
