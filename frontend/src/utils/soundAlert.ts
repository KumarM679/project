/**
 * High-Loudness Audible Sound Alert Synthesizer
 * Generates pure audible acoustic alarm sound via Web Audio API + HTML5 Audio.
 * Note: Vibration is disabled as requested ("the alert should be make sound not the vebrate").
 */

let activeAudioCtx: AudioContext | null = null;
let activeGainNodes: GainNode[] = [];
let activeOscillators: OscillatorNode[] = [];
let activeAudioElement: HTMLAudioElement | null = null;
let alertTimeoutId: any = null;

/**
 * Generates an in-memory WAV audio data URI for maximum acoustic speaker output.
 * Ensures audible sound plays on mobile browsers and desktop speakers reliably.
 */
function createSirenWavBlobUrl(durationSec = 4.2): string {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Synthesize alternating dual-tone emergency siren (960 Hz <-> 720 Hz)
  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const isHigh = Math.floor(t / 0.22) % 2 === 0;
    const freq = isHigh ? 960 : 720;
    phase += (2 * Math.PI * freq) / sampleRate;
    // Blend sine with overtone for high-penetration siren sound
    const sample = Math.sin(phase) * 0.75 + Math.sin(phase * 2) * 0.25;
    const intSample = Math.max(-32767, Math.min(32767, Math.floor(sample * 31000)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

export const stopDeviceAlertTone = () => {
  try {
    if (alertTimeoutId) {
      clearTimeout(alertTimeoutId);
      alertTimeoutId = null;
    }

    if (activeAudioElement) {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
      activeAudioElement = null;
    }

    activeGainNodes.forEach((gain) => {
      try {
        const curr = activeAudioCtx?.currentTime || 0;
        gain.gain.setValueAtTime(gain.gain.value, curr);
        gain.gain.linearRampToValueAtTime(0.001, curr + 0.05);
      } catch {}
    });

    setTimeout(() => {
      activeOscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {}
      });
      activeOscillators = [];
      activeGainNodes = [];
    }, 60);
  } catch (e) {
    console.warn('Error stopping alert audio:', e);
  }
};

/**
 * Plays an audible acoustic alarm tone.
 * Generates true audible sound through Web Audio API and HTML5 Audio fallback.
 * Strictly avoids device vibration.
 */
export const playDeviceAlertTone = (type: 'emergency' | 'warning' | 'chime' = 'emergency'): boolean => {
  try {
    stopDeviceAlertTone();

    // 1. Try HTML5 Audio with synthesized WAV for loudspeaker playback on mobile/desktop
    if (type === 'emergency') {
      try {
        const wavUrl = createSirenWavBlobUrl(4.2);
        const audio = new Audio(wavUrl);
        audio.volume = 1.0;
        activeAudioElement = audio;
        audio.play().catch((err) => {
          console.warn('HTML5 audio play blocked by autoplay policy, falling back to Web Audio:', err);
        });
      } catch (err) {
        console.warn('Could not initialize HTML5 audio element:', err);
      }
    }

    // 2. High-amplitude Web Audio API synthesizer
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return true;

    if (!activeAudioCtx || activeAudioCtx.state === 'closed') {
      activeAudioCtx = new AudioContextClass();
    }
    const ctx = activeAudioCtx;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Dynamic compressor for acoustic volume maximization
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-12, ctx.currentTime);
    compressor.knee.setValueAtTime(6, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0.002, ctx.currentTime);
    compressor.release.setValueAtTime(0.1, ctx.currentTime);
    compressor.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'emergency') {
      const duration = 4.2;

      // Master Gain set to maximum loudness (1.0)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(1.0, now);
      masterGain.connect(compressor);
      activeGainNodes.push(masterGain);

      // Horn 1: Sawtooth horn (piercing acoustic spectrum)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';

      // Horn 2: Square wave overtone (EAS alarm character)
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      const osc2Gain = ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.7, now);
      osc2.connect(osc2Gain);
      osc2Gain.connect(masterGain);

      // Alternating high-low emergency pulses (960 Hz <-> 720 Hz / 853 Hz <-> 660 Hz)
      const stepTime = 0.22;
      const numSteps = Math.floor(duration / stepTime);

      for (let i = 0; i < numSteps; i++) {
        const t = now + i * stepTime;
        const isHigh = i % 2 === 0;
        const freq1 = isHigh ? 960 : 720;
        const freq2 = isHigh ? 853 : 660;

        osc1.frequency.setValueAtTime(freq1, t);
        osc2.frequency.setValueAtTime(freq2, t);
      }

      // Smooth decay at the very end
      masterGain.gain.setValueAtTime(1.0, now + duration - 0.15);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + duration + 0.05);
      osc2.start(now);
      osc2.stop(now + duration + 0.05);

      activeOscillators.push(osc1, osc2);

      alertTimeoutId = setTimeout(() => {
        stopDeviceAlertTone();
      }, (duration + 0.1) * 1000);

      return true;
    } else if (type === 'warning') {
      // 3-tone ascending alert chime (D5 -> F#5 -> A5)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.85, now);
      masterGain.connect(compressor);
      activeGainNodes.push(masterGain);

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(739.99, now + 0.22); // F#5
      osc.frequency.setValueAtTime(880.00, now + 0.44); // A5

      masterGain.gain.setValueAtTime(0.85, now + 0.75);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

      osc.connect(masterGain);
      osc.start(now);
      osc.stop(now + 1.15);
      activeOscillators.push(osc);
      return true;
    } else {
      // Clean civic notification tone (E5 -> B5)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.65, now);
      masterGain.connect(compressor);
      activeGainNodes.push(masterGain);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(987.77, now + 0.16); // B5

      masterGain.gain.setValueAtTime(0.65, now + 0.40);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.90);
      activeOscillators.push(osc);
      return true;
    }
  } catch (e) {
    console.warn('Audio alert error:', e);
    return false;
  }
};

/**
 * Native OS / Browser notification dispatch for connected device
 */
export const triggerDeviceNotification = (title: string, body: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!('Notification' in window)) {
      resolve(false);
      return;
    }

    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: 'jaldrishti-emergency-alert',
          requireInteraction: true
        });
        resolve(true);
      } catch (e) {
        console.warn('Could not show notification:', e);
        resolve(false);
      }
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          try {
            new Notification(title, {
              body,
              icon: '/favicon.ico',
              tag: 'jaldrishti-emergency-alert',
              requireInteraction: true
            });
            resolve(true);
          } catch {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    } else {
      resolve(false);
    }
  });
};
