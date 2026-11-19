/**
 * Web Audio API synthesizer for emergency siren and notification chimes.
 * Operates purely via the browser's built-in AudioContext with zero external audio assets.
 */

export const playDeviceAlertTone = (type: 'emergency' | 'warning' | 'chime' = 'emergency') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'emergency') {
      // 2-tone urgent emergency siren (Civil Defence alternating pitch)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(659.25, now + 0.18); // E5
      osc.frequency.setValueAtTime(880, now + 0.36);
      osc.frequency.setValueAtTime(659.25, now + 0.54);
      osc.frequency.setValueAtTime(880, now + 0.72);
      osc.frequency.setValueAtTime(659.25, now + 0.90);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.25);
    } else if (type === 'warning') {
      // 3-tone warning chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.30); // G5

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    } else {
      // Clean civic notification chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    }
  } catch (e) {
    console.warn('Audio alert not supported or blocked by user gesture policy:', e);
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
