# 🐬 Coturn TURN/STUN Server Deployment Guide

नेपाल सरकारको आफ्नै म्यासेजिङ एपमा भ्वाइस र भिडियो कल (WebRTC) लाई फायरवाल तथा नेटवर्क अड्चन (NAT Traversal) बिना सुचारु रूपमा चलाउनका लागि **Coturn (STUN/TURN)** सर्भर सेटअप गर्नु अनिवार्य हुन्छ। 

यो गाइडले सुरक्षित, टाइम-लिमिटेड टोकन प्रमाणिकरण (Rest API Auth) सहितको Coturn सर्भर कन्फिगर गर्ने तरिका देखाउँछ।

---

## १. इन्स्टलेसन (Installation)
Debian वा Ubuntu सर्भरमा Coturn इन्स्टल गर्न तलको कमान्ड चलाउनुहोस्:
```bash
sudo apt update
sudo apt install coturn -y
```

---

## २. कन्फिगरेसन (Configuration)
`/etc/turnserver.conf` फाइललाई सुरक्षित सम्पादन गर्नुहोस् र तलको जस्तै कन्फिगर गर्नुहोस्:

```ini
# /etc/turnserver.conf

# १. नेटवर्क र पोर्टहरू (Ports & Network)
listening-port=3478
tls-listening-port=443 # फायरवाल बाइपास गर्न TLS (443) पोर्ट प्रयोग गर्नुहोस्
listening-ip=0.0.0.0

# २. सुरक्षित प्रमाणिकरण (REST API Authentication)
# static-auth-secret थपेपछि प्रयोगकर्ताले हार्डकोडेड पासवर्ड बिना 
# Dynamic credentials (HMAC-SHA1) मार्फत सुरक्षित रूपमा कल जडान गर्न सक्छन्।
use-secret-auth
static-auth-secret=यस_ठाउँमा_आफ्नो_बलियो_रहस्य_कि_राख्नुहोस्
realm=gov.np          # तपाईँको मुख्य डोमेन नाम

# ३. लगिङ र सुरक्षा (Logging & Security)
verbose
fingerprint
no-stdout-log
log-file=/var/log/turnserver.log

# ४. मिडिया पोर्ट रेन्ज (Media Ports)
min-port=49152
max-port=65535

# ५. TLS/SSL प्रमाणपत्र (Certificates)
# व्यावसायिक प्रमाणपत्रहरू (e.g., Let's Encrypt) यहाँ राख्नुहोस्
cert=/etc/letsencrypt/live/turn.gov.np/fullchain.pem
pkey=/etc/letsencrypt/live/turn.gov.np/privkey.pem
```

---

## ३. सेवा सुरु गर्ने (Start and Enable Service)
Coturn लाई सुरु गर्न र सर्भर रिबुट हुँदा आफैँ चल्ने बनाउन:
```bash
# /etc/default/coturn मा गएर TURNSERVER_ENABLED=1 सेट गर्नुहोस्
sudo systemctl start coturn
sudo systemctl enable coturn
```

---

## ४. नेपाल सरकारको आन्तरिक नेटवर्कमा कसरी काम गर्छ?
१. जब प्रयोगकर्ता 'A' ले 'B' लाई कल गर्छ, हाम्रो **`webrtc-calling`** मोड्युलको `generateTurnCredentials(secret, userId)` फङ्सनले Coturn को `static-auth-secret` प्रयोग गरी एउटा टेम्पोररी युजरनेम र पासवर्ड बनाउँछ।
२. क्लाइन्ट एपले उक्त डायनामिक credentials प्रयोग गरी यो Coturn सर्भरसँग जडान गर्छ।
३. सर्भरले दुई प्रयोगकर्ताहरू बीचको अडियो/भिडियो डेटा सुरक्षित रूपमा प्रवाह (relay) गराउँछ।
