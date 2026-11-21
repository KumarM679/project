/**
 * High-Loudness Web Audio API synthesizer for emergency sirens and civic warnings.
 * Uses dual-tone piercing harmonics, dynamic compression for maximum acoustic output,
 * and device haptic vibration.
 */

let activeAudioCtx: AudioContext | null = null;
let activeGainNodes: GainNode[] = [];
let activeOscillators: OscillatorNode[] = [];
let alertTimeoutId: any = null;

export const stopDeviceAlertTone = () => {
  try {
    if (alertTimeoutId) {
      clearTimeout(alertTimeoutId);
      alertTimeoutId = null;
    }
    activeGainNodes.forEach((gain) => {
      try {
        const curr = activeAudioCtx?.currentTime || 0;
        gain.gain.setValueAtTime(gain.gain.value, curr);
        gain.gain.linearRampToValueAtTime(0.001, curr + 0.08);
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
      if (activeAudioCtx && activeAudioCtx.state !== 'closed') {
        activeAudioCtx.close().catch(() => {});
        activeAudioCtx = null;
      }
    }, 90);

    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  } catch (e) {
    console.warn('Error stopping alert audio:', e);
  }
};

export const playDeviceAlertTone = (type: 'emergency' | 'warning' | 'chime' = 'emergency'): boolean => {
  try {
    stopDeviceAlertTone();

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return false;
    const ctx = new AudioContextClass();
    activeAudioCtx = ctx;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Dynamic compressor to maximize acoustic output & prevent harsh digital clipping
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, ctx.currentTime);
    compressor.knee.setValueAtTime(8, ctx.currentTime);
    compressor.ratio.setValueAtTime(16, ctx.currentTime);
    compressor.attack.setValueAtTime(0.002, ctx.currentTime);
    compressor.release.setValueAtTime(0.12, ctx.currentTime);
    compressor.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'emergency') {
      // HIGH-INTENSITY PIERCING DUAL-TONE CIVIL DEFENSE EMERGENCY SIREN
      // Duration: 4.4 seconds of continuous high-volume alternating alarm pulses
      const duration = 4.4;

      // Master Gain set to maximum loudness (0.95 out of 1.0)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.95, now);
      masterGain.connect(compressor);
      activeGainNodes.push(masterGain);

      // Primary Horn Oscillator (Sawtooth waveform: sharp, high-penetration acoustic spectrum)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';

      // Secondary Overtone Oscillator (Square waveform: rich acoustic harmonic punch)
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      const osc2Gain = ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.65, now);
      osc2.connect(osc2Gain);
      osc2Gain.connect(masterGain);

      // 10 alternating emergency pulses (960 Hz <-> 720 Hz / 853 Hz <-> 660 Hz)
      const stepTime = 0.22;
      const numSteps = Math.floor(duration / stepTime);

      for (let i = 0; i < numSteps; i++) {
        const t = now + i * stepTime;
        const isHigh = i % 2 === 0;
        const freq1 = isHigh ? 960 : 720;
        const freq2 = isHigh ? 853 : 660; // Classical EAS dual-frequency pair

        osc1.frequency.setValueAtTime(freq1, t);
        osc2.frequency.setValueAtTime(freq2, t);
      }

      // Smooth decay at the very end
      masterGain.gain.setValueAtTime(0.95, now + duration - 0.2);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + duration + 0.05);
      osc2.start(now);
      osc2.stop(now + duration + 0.05);

      activeOscillators.push(osc1, osc2);

      // Mobile Device Haptic Vibration (continuous pulsing buzz pattern)
      if ('vibrate' in navigator) {
        navigator.vibrate([400, 150, 400, 150, 400, 150, 600, 200, 600, 200, 600]);
      }

      alertTimeoutId = setTimeout(() => {
        stopDeviceAlertTone();
      }, (duration + 0.1) * 1000);

      return true;
    } else if (type === 'warning') {
      // 3-tone ascending warning chime (Loudness boosted to 0.75)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.75, now);
      masterGain.connect(compressor);
      activeGainNodes.push(masterGain);

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(739.99, now + 0.22); // F#5
      osc.frequency.setValueAtTime(880.00, now + 0.44); // A5

      masterGain.gain.setValueAtTime(0.75, now + 0.75);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

      osc.connect(masterGain);
      osc.start(now);
      osc.stop(now + 1.15);
      activeOscillators.push(osc);

      if ('vibrate' in navigator) {
        navigator.vibrate([300, 120, 300]);
      }
      return true;
    } else {
      // Clean civic chime (Gain boosted to 0.50)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.50, now);
      masterGain.connect(compressor);
      activeGainNodes.push(masterGain);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(987.77, now + 0.16); // B5

      masterGain.gain.setValueAtTime(0.50, now + 0.40);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.85);
      activeOscillators.push(osc);
      return true;
    }
  } catch (e) {
    console.warn('Audio alert not supported or blocked by user gesture policy:', e);
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
