"""Generate original placeholder cat vocals. Replace the WAVs with recorded takes anytime."""
import math, random, struct, wave
from pathlib import Path
RATE = 22050
ROOT = Path(__file__).resolve().parents[1] / 'public/assets/audio'
def save(name, samples):
    peak = max(abs(s) for s in samples) or 1
    with wave.open(str(ROOT / name), 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(RATE)
        f.writeframes(b''.join(struct.pack('<h', int(s / peak * 23000)) for s in samples))
def bandpass(samples, frequency, q):
    w = 2 * math.pi * frequency / RATE; a = math.sin(w)/(2*q); a0=1+a
    b0=a/a0; b2=-a/a0; a1=-2*math.cos(w)/a0; a2=(1-a)/a0
    x1=x2=y1=y2=0.; out=[]
    for x in samples:
        y=b0*x+b2*x2-a1*y1-a2*y2
        out.append(y); x2=x1; x1=x; y2=y1; y1=y
    return out
rng=random.Random(42)
duration=2.0; samples=[]; phase=0.; smooth=0.
for i in range(int(RATE*duration)):
    t=i/RATE; phase+=2*math.pi*(72+4*math.sin(t*3))/RATE
    smooth=.86*smooth+.14*rng.uniform(-1,1)
    flutter=(.5+.5*math.sin(2*math.pi*26*t))**1.7
    breath=.6+.4*math.sin(math.pi*t/duration)
    envelope=min(1,t/.12)*min(1,(duration-t)/.35)
    samples.append(envelope*breath*(.55*smooth+.22*math.sin(phase)+.12*math.sin(phase*2))*flutter)
save('level-complete.wav',samples)
duration=.78; source=[]; phase=0.
for i in range(int(RATE*duration)):
    t=i/RATE; u=t/duration
    pitch=350+390*math.sin(math.pi*min(1,u*1.5)) - 160*u
    phase+=2*math.pi*pitch/RATE
    voiced=sum(math.sin(phase*k)/(k**1.2) for k in range(1,9))
    source.append(voiced+.06*rng.uniform(-1,1))
formants=[bandpass(source,frequency,q) for frequency,q in [(420,2.4),(950,3),(1800,3.8),(2700,4)]]
voice=[]
for i in range(len(source)):
    t=i/RATE; u=t/duration
    opening=min(1,u/.22); closing=max(0,(u-.45)/.55)
    envelope=min(1,t/.07)*min(1,(duration-t)/.17)
    voice.append(envelope*(.15*source[i]+(.3+.7*closing)*formants[0][i]+(.3+.7*opening)*(1-.5*closing)*formants[1][i]+(.45*(1-closing))*formants[2][i]+.1*formants[3][i]))
save('upgrade-mrow.wav',voice)
print('Generated 2.0s purr and 0.78s mrow, mono 22.05 kHz PCM WAV.')
