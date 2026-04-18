import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { DolphinClient } from '../lib/dolphin-client';

const DolphinContext = createContext(null);

export const useDolphin = () => useContext(DolphinContext);

export const DolphinProvider = ({ children }) => {
    const [client, setClient] = useState(null);
    const [user, setUser] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);
    const [activeCall, setActiveCall] = useState(null);
    const [devices, setDevices] = useState([]);

    useEffect(() => {
        return () => {
            if (client) {
                client.disconnect();
            }
        };
    }, [client]);

    const connect = useCallback(async (deviceId, name) => {
        if (isConnected && client?.deviceId === deviceId) {
            console.log('[DolphinContext] Already connected as', deviceId);
            return true;
        }

        // Cleanup existing client if any
        if (client) {
            client.disconnect();
            setClient(null);
        }

        console.log('[DolphinContext] Initializing connection for:', deviceId);
        const baseUrl = `http://${window.location.hostname}:5001`;
        try {
            const res = await fetch(`${baseUrl}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId, name, room: 'Office' })
            });
            const data = await res.json();
            
            if (data.success) {
                const dolphin = new DolphinClient(`${window.location.hostname}:5001`, deviceId);
                await dolphin.connect();
                
                dolphin.onSignal((payload) => {
                    if (payload.type === 'INVITE') setIncomingCall(payload);
                    else if (payload.type === 'END') setIncomingCall(null);
                });

                setClient(dolphin);
                setUser(data.device);
                setIsConnected(true);
                return true;
            }
        } catch (err) {
            console.error('[DolphinContext] Connection failed:', err);
        }
        return false;
    }, [isConnected, client]);

    const fetchDevices = useCallback(async () => {
        const res = await fetch(`http://${window.location.hostname}:5001/devices`);
        const data = await res.json();
        if (data.success) setDevices(data.data);
    }, []);

    const value = {
        client,
        user,
        isConnected,
        connect,
        incomingCall,
        setIncomingCall,
        activeCall,
        setActiveCall,
        devices,
        fetchDevices
    };

    return (
        <DolphinContext.Provider value={value}>
            {children}
        </DolphinContext.Provider>
    );
};
