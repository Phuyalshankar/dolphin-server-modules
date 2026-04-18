import { useEffect, useRef, useCallback } from 'react';

// Generates synthetic tones using Web Audio API to keep it zero-dependency
export const useAudioTones = () => {
    const audioCtxRef = useRef(null);
    const oscRef = useRef(null);
    const gainNodeRef = useRef(null);
    const ringIntervalRef = useRef(null);
    const typeRef = useRef(null); // 'ring' or 'dial'

    const initAudio = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    };

    const stopTone = useCallback(() => {
        if (ringIntervalRef.current) {
            clearInterval(ringIntervalRef.current);
            ringIntervalRef.current = null;
        }
        if (oscRef.current) {
            try { oscRef.current.stop(); } catch (e) { }
            oscRef.current.disconnect();
            oscRef.current = null;
        }
        if (gainNodeRef.current) {
            gainNodeRef.current.disconnect();
            gainNodeRef.current = null;
        }
        typeRef.current = null;
    }, []);

    const playRingtone = useCallback(() => {
        stopTone();
        initAudio();
        typeRef.current = 'ring';
        const ctx = audioCtxRef.current;

        const playRingCycle = () => {
            if (typeRef.current !== 'ring') return;
            
            // European style ring: 400Hz + 450Hz, 0.4s on, 0.2s off, 0.4s on, 2s off
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(400, ctx.currentTime);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(450, ctx.currentTime);

            osc1.connect(gainNode);
            osc2.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Envelope
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
            gainNode.gain.setValueAtTime(0.5, ctx.currentTime + 0.4);
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
            
            gainNode.gain.setValueAtTime(0, ctx.currentTime + 0.6);
            gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.65);
            gainNode.gain.setValueAtTime(0.5, ctx.currentTime + 1.0);
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.05);

            osc1.start(ctx.currentTime);
            osc2.start(ctx.currentTime);
            osc1.stop(ctx.currentTime + 1.1);
            osc2.stop(ctx.currentTime + 1.1);
        };

        playRingCycle();
        ringIntervalRef.current = setInterval(playRingCycle, 3000);
    }, [stopTone]);

    const playDialtone = useCallback(() => {
        stopTone();
        initAudio();
        typeRef.current = 'dial';
        const ctx = audioCtxRef.current;

        // North American calling tone 440Hz + 480Hz, 2s on, 4s off
        const playDialCycle = () => {
            if (typeRef.current !== 'dial') return;
            
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(440, ctx.currentTime);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(480, ctx.currentTime);

            osc1.connect(gainNode);
            osc2.connect(gainNode);
            gainNode.connect(ctx.destination);

            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime + 2.0);
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.1);

            osc1.start(ctx.currentTime);
            osc2.start(ctx.currentTime);
            osc1.stop(ctx.currentTime + 2.2);
            osc2.stop(ctx.currentTime + 2.2);
        };

        playDialCycle();
        ringIntervalRef.current = setInterval(playDialCycle, 6000);
    }, [stopTone]);

    const playNotifyTone = useCallback(() => {
        initAudio();
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    }, []);

    useEffect(() => {
        return () => stopTone();
    }, [stopTone]);

    return { 
        playRingtone: playDialtone, // Swapped based on user feedback
        playDialtone: playRingtone, // Swapped based on user feedback
        playNotifyTone,
        stopTone 
    };
};
