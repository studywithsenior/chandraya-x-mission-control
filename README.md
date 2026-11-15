# CHANDRAYAAN-X Online Mission Control — Stage 1

Vite + MQTT.js public telemetry website for Vercel.

## What is included
- Public read-only mission dashboard.
- Secure MQTT-over-WebSocket connection (WSS).
- Read-only subscriptions to telemetry, events, rover online presence and command acknowledgements.
- Separate broker connection and rover presence indicators.
- Connection status, receive count, last-packet age and browser session timer.
- No rover command publishing and no operator credentials.

## Integration status
This website displays messages published to the configured EMQX topics. It does not make the current ESP32 firmware publish MQTT automatically. The ESP32 MQTT adapter remains a separate firmware task and must retain the existing AP/local HTTP dashboard and routes.

## Expected MQTT topics
- `chandraya-x/v1/rover/telemetry`
- `chandraya-x/v1/rover/events`
- `chandraya-x/v1/rover/online`
- `chandraya-x/v1/rover/command-ack`

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

The online topic accepts a JSON payload such as `{"online":true}` or a plain text status such as `online`. The command-ack topic is displayed as a read-only event; this website does not publish commands.

These are display formats supported by the website. They are not a claim about the existing firmware's current `/status` response or MQTT implementation.

## Environment variables
Copy `.env.example` to `.env.local` and fill in the WSS endpoint and a narrowly permissioned read-only broker account.

```bash
npm install
npm run dev
```

Deploy with Vite using `npm run build` and output directory `dist`. Set the three `VITE_MQTT_*` variables in Vercel Project Settings.

Do not commit `.env.local`. Do not place operator credentials or a command-publishing account in any `VITE_` variable. Browser-side environment variables are visible to every visitor.

## Security requirements before public launch
- Public browser identity may subscribe only to telemetry, events, online and command-ack topics.
- Deny the public browser identity all publishing permissions.
- Use separate ESP32 and operator identities.
- Do not enable rover control until operator authentication, server-side/broker permissions, command expiry, a single-operator lease, and disconnect-stop logic are implemented.
- Keep school Wi-Fi credentials private and ask a teacher/parent to help manage hosting and broker accounts.
