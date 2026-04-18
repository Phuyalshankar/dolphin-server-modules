import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        // Add your TURN server here for mobile-to-PC across NATs
        // { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' }
    ]
};

export const useWebRTC = (client, user) => {
    const candidateQueue = useRef([]);
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
 
    const flushCandidates = useCallback(async () => {
        if (!pcRef.current || !pcRef.current.remoteDescription) return;
        console.log(`[WebRTC] Flushing ${candidateQueue.current.length} queued candidates`);
        while (candidateQueue.current.length > 0) {
            const candidate = candidateQueue.current.shift();
            try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.error("Error adding queued ice candidate", err);
            }
        }
    }, [pcRef]);

    const cleanup = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        candidateQueue.current = [];
        setLocalStream(null);
        setRemoteStream(null);
    }, []);

    const initMedia = async (video = true) => {
        console.log('[WebRTC] initMedia called with video:', video);
        console.log('[WebRTC] isSecureContext:', window.isSecureContext, 'hostname:', window.location.hostname);
        
        // WebRTC requires HTTPS or Localhost
        if (!window.isSecureContext && window.location.hostname !== 'localhost') {
            console.error("Security Error: Media access requires HTTPS when accessing from an external IP.");
            return null;
        }

        try {
            // Try requested media
            const stream = await navigator.mediaDevices.getUserMedia({
                video: video,
                audio: true
            });
            console.log('[WebRTC] getUserMedia success, tracks:', stream.getTracks().map(t => t.kind));
            localStreamRef.current = stream;
            setLocalStream(stream);
            return stream;
        } catch (err) {
            console.warn("Requested media failed, attempting fallback...", err.name, err.message);
            
            // Fallback 1: If video was requested but failed, try audio only
            if (video) {
                try {
                    const audioOnly = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    console.log('[WebRTC] Audio-only fallback success, tracks:', audioOnly.getTracks().map(t => t.kind));
                    localStreamRef.current = audioOnly;
                    setLocalStream(audioOnly);
                    return audioOnly;
                } catch (audioErr) {
                    console.warn("Audio fallback failed, proceeding without media", audioErr.name, audioErr.message);
                }
            } else {
                console.warn("Audio request failed, proceeding without media", err.name, err.message);
            }
            
            // Return null but don't alert (allow one-way calls)
            return null;
        }
    };

    const createPeerConnection = (targetDeviceId) => {
        console.log('[WebRTC] Creating PeerConnection for:', targetDeviceId);
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        pc.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state:', pc.connectionState);
        };

        // Add local tracks with explicit direction
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                const kind = track.kind;
                try {
                    pc.addTransceiver(track, { 
                        direction: 'sendrecv', 
                        streams: [localStreamRef.current] 
                    });
                    console.log(`[WebRTC] Added ${kind} track as sendrecv`);
                } catch (e) {
                    // Fallback to addTrack if addTransceiver fails
                    pc.addTrack(track, localStreamRef.current);
                }
            });
        }

        // Add 'recvonly' for missing hardware
        const hasAudio = localStreamRef.current?.getAudioTracks().length > 0;
        const hasVideo = localStreamRef.current?.getVideoTracks().length > 0;

        if (!hasAudio) {
            try { 
                pc.addTransceiver('audio', { direction: 'recvonly' }); 
                console.log('[WebRTC] Requesting remote audio (recvonly)');
            } catch (e) {}
        }
        if (!hasVideo) {
            try { 
                pc.addTransceiver('video', { direction: 'recvonly' }); 
                console.log('[WebRTC] Requesting remote video (recvonly)');
            } catch (e) {}
        }

        // Listen for remote tracks
        pc.ontrack = (event) => {
            console.log('[WebRTC] Remote track received:', event.track.kind, 'id:', event.track.id);
            console.log('[WebRTC] Track enabled:', event.track.enabled, 'readyState:', event.track.readyState);
            
            // Also log stream info
            if (event.streams && event.streams[0]) {
                console.log('[WebRTC] Stream id:', event.streams[0].id, 'audio tracks:', event.streams[0].getAudioTracks().length);
            }
            
            // Critical: Accumulate tracks into a single stream and keep the object stable if possible
            setRemoteStream(prev => {
                const stream = prev || new MediaStream();
                const existing = stream.getTracks().find(t => t.id === event.track.id);
                if (!existing) {
                    stream.addTrack(event.track);
                    console.log(`[WebRTC] Added ${event.track.kind} track to remote stream`);
                }
                // Return a new clone to trigger React state update
                return new MediaStream(stream.getTracks());
            });
        };

        // Listen for ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                client.publish(`phone/signaling/${targetDeviceId}`, {
                    type: 'ICE',
                    from: user.deviceId,
                    to: targetDeviceId,
                    data: { candidate: event.candidate }
                });
            }
        };

        return pc;
    };

    const makeOffer = async (targetDeviceId, video = true) => {
        const stream = await initMedia(video);
        console.log('[WebRTC] makeOffer initMedia result:', stream ? 'got stream' : 'no stream', 'tracks:', stream?.getTracks().length);
        console.log('[WebRTC] makeOffer localStreamRef.current:', localStreamRef.current ? 'exists' : 'null');
        
        const pc = createPeerConnection(targetDeviceId);
        
        const offer = await pc.createOffer();
        console.log('[WebRTC] Offer SDP audio:', offer.sdp.includes('m=audio'), 'video:', offer.sdp.includes('m=video'));
        await pc.setLocalDescription(offer);

        return offer;
    };

    const handleOffer = async (offer, targetDeviceId, video = true) => {
        const stream = await initMedia(video);
        console.log('[WebRTC] handleOffer initMedia result:', stream ? 'got stream' : 'no stream', 'tracks:', stream?.getTracks().length);
        console.log('[WebRTC] handleOffer localStreamRef.current:', localStreamRef.current ? 'exists' : 'null');
        
        const pc = createPeerConnection(targetDeviceId);
        
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushCandidates();
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        console.log('[WebRTC] Answer created, localDescription:', pc.localDescription ? 'exists' : 'null');
        
        return answer;
    };

    const handleAnswer = async (answer) => {
        if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            await flushCandidates();
        }
    };

    const handleIceCandidate = async (candidate) => {
        if (!candidate) return;
        
        // Wrap if needed
        const iceCandidate = candidate.candidate ? candidate : { candidate };

        if (pcRef.current && pcRef.current.remoteDescription) {
            try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(iceCandidate));
            } catch (err) {
                console.error("Error adding ice candidate", err);
            }
        } else {
            console.log('[WebRTC] Queuing ICE candidate (PC not ready)');
            candidateQueue.current.push(iceCandidate);
        }
    };

    return {
        localStream,
        remoteStream,
        makeOffer,
        handleOffer,
        handleAnswer,
        handleIceCandidate,
        cleanup
    };
};
