# CHANDRAYAAN-X Online Mission Control — Stage 1

Vite + MQTT.js public telemetry website for Vercel.

## What is included
- Public read-only mission dashboard.
- Secure MQTT-over-WebSocket connection (WSS).
- Telemetry and event subscriptions.
- Connection status, receive count, last-packet age and browser session timer.
- No rover command publishing and no operator credentials.

## Important integration status
This is the Stage 1 website shell. It does not make the current ESP32 firmware publish MQTT automatically. Stage 2 creates the broker and topic ACLs; a later firmware stage adds an optional MQTT adapter while retaining the existing AP/local HTTP dashboard and routes.

## 1. Install and run locally
Install Node.js (LTS), then from this folder:

```bash
npm install
```

Copy `.env.example` to `.env.local`, then fill in the WSS endpoint and a narrowly permissioned read-only broker account.

```bash
npm run dev
```

Open the local URL printed by Vite.

## 2. Expected MQTT topics
- `chandraya-x/v1/rover/telemetry`
- `chandraya-x/v1/rover/events`

Example telemetry JSON:

```json
{
  "mode": "MANUAL",
  "status": "READY",
  "speed": 150,
  "distanceCm": 42.5,
  "obstacle": false,
  "obstacleCount": 0
}
```

Example event JSON:

```json
{ "message": "Autonomous mode enabled" }
```

These are the Stage 1 website's expected message shapes. They are not a claim about the existing firmware's current `/status` response.

## 3. Deploy to Vercel
- Push this folder to a Git repository.
- Import the repository into Vercel.
- Set the three `VITE_MQTT_*` environment variables in Vercel Project Settings.
- Deploy a Preview first; test it; then deploy Production.

Do not commit `.env.local`. Do not place operator credentials or a command-publishing account in any `VITE_` variable.

## 4. Security requirements before public launch
- Broker ACL: public website identity may subscribe only to telemetry, events, online and command-ack topics.
- Deny browser identity all publishing permissions.
- Use separate ESP32 and operator identities.
- Do not enable rover control until operator authentication, server/broker ACLs, command expiry, a single-operator lease, and disconnect-stop logic are implemented.
- Have a teacher/parent help manage hosting and broker accounts and keep school Wi-Fi credentials private.
