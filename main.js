import mqtt from 'mqtt';
import './style.css';

const $ = (id) => document.getElementById(id);
const TELEMETRY_TOPIC = 'chandraya-x/v1/rover/telemetry';
const EVENTS_TOPIC = 'chandraya-x/v1/rover/events';

let messageCount = 0;
let lastTelemetryAt = 0;
let sessionStartedAt = Date.now();

function setConnection(connected, label = '') {
  $('connection-label').textContent = connected ? 'ONLINE' : 'OFFLINE';
  $('link-state').textContent = connected ? 'LINK ESTABLISHED' : 'NOT CONNECTED';
  $('broker-state').textContent = label || (connected ? 'Connected' : 'Disconnected');
  document.querySelector('.live-dot').classList.toggle('connected', connected);
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function updateTelemetry(data) {
  if (!data || typeof data !== 'object') return;
  messageCount += 1;
  lastTelemetryAt = Date.now();

  if (data.mode !== undefined) $('mode').textContent = String(data.mode).toUpperCase();
  if (data.status !== undefined) $('rover-status').textContent = String(data.status).toUpperCase();
  if (data.distanceCm !== undefined) {
    const d = safeNumber(data.distanceCm);
    $('distance').textContent = d === null ? '—' : d.toFixed(1);
    $('obstacle-state').textContent = data.obstacle ? 'Obstacle reported' : 'No obstacle reported';
    $('obstacle-state').classList.toggle('warning', Boolean(data.obstacle));
  }
  if (data.speed !== undefined) {
    const speed = safeNumber(data.speed);
    $('speed').textContent = speed === null ? '—' : String(speed);
  }
  if (data.obstacleCount !== undefined) $('obstacle-count').textContent = String(data.obstacleCount);
  $('message-count').textContent = String(messageCount);
  $('last-update').textContent = `Last packet ${new Date(lastTelemetryAt).toLocaleTimeString()}`;
  $('telemetry-age').textContent = 'JUST NOW';
}

function addEvent(data) {
  const log = $('event-log');
  const empty = log.querySelector('.empty-state');
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className = 'event-row';
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString();
  const message = document.createElement('span');
  message.textContent = typeof data.message === 'string' ? data.message : 'Mission event received';
  row.append(time, message);
  log.prepend(row);
  while (log.children.length > 30) log.lastElementChild.remove();
}

function parseMessage(payload) {
  try { return JSON.parse(payload.toString()); }
  catch { return null; }
}

// Stage 1: only a narrowly permissioned, read-only browser credential belongs here.
// VITE_* values are visible to every website visitor; never put an operator secret here.
const brokerUrl = import.meta.env.VITE_MQTT_WS_URL;
const username = import.meta.env.VITE_MQTT_READONLY_USERNAME;
const password = import.meta.env.VITE_MQTT_READONLY_PASSWORD;

if (!brokerUrl || !username || !password) {
  setConnection(false, 'Broker settings not configured');
} else {
  const client = mqtt.connect(brokerUrl, {
    username,
    password,
    clientId: `cx-public-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 3000,
    keepalive: 30,
    protocolVersion: 4
  });

  client.on('connect', () => {
    setConnection(true, 'Connected securely');
    client.subscribe([TELEMETRY_TOPIC, EVENTS_TOPIC], { qos: 0 }, (err) => {
      if (err) setConnection(false, 'Subscription failed');
    });
  });
  client.on('reconnect', () => setConnection(false, 'Reconnecting…'));
  client.on('close', () => setConnection(false, 'Connection closed'));
  client.on('error', () => setConnection(false, 'Connection error'));
  client.on('message', (topic, payload) => {
    const data = parseMessage(payload);
    if (!data) return;
    if (topic === TELEMETRY_TOPIC) updateTelemetry(data);
    if (topic === EVENTS_TOPIC) addEvent(data);
  });
}

// Local UI clock only. It does not claim that the rover is online.
setInterval(() => {
  if (lastTelemetryAt) {
    const seconds = Math.floor((Date.now() - lastTelemetryAt) / 1000);
    $('telemetry-age').textContent = seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`;
  }
  const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
  $('session').textContent = `${String(Math.floor(elapsed / 3600)).padStart(2, '0')}:${String(Math.floor(elapsed / 60) % 60).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
}, 1000);
