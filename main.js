import mqtt from 'mqtt';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import './style.css';

const $ = (id) => document.getElementById(id);

const landingView = $('landing-view');
const teamView = $('team-view');
const dashboardView = $('dashboard-view');
const workspaceView = $('workspace-view');

function showView(view) {
  landingView.classList.toggle('view-hidden', view !== 'landing');
  teamView.classList.toggle('view-hidden', view !== 'team');
  dashboardView.classList.toggle('view-hidden', view !== 'dashboard');
  workspaceView.classList.toggle('view-hidden', view !== 'workspace');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

$('visitor-entry').addEventListener('click', () => showView('dashboard'));
$('dashboard-home').addEventListener('click', () => showView('landing'));
$('team-entry').addEventListener('click', () => showView('team'));

$('workspace-back').addEventListener('click', () => showView('team'));
$('workspace-home').addEventListener('click', (event) => { event.preventDefault(); showView('landing'); });
$('operator-select').addEventListener('change', (event) => {
  const name = event.target.value;
  $('operator-current').textContent = name || 'NOT SELECTED';
  if (!name) return;
  const log = $('team-activity-log');
  const empty = log.querySelector('.empty-state');
  if (empty) empty.remove();
  const row = document.createElement('div');
  row.className = 'event-row';
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString();
  const message = document.createElement('span');
  message.textContent = name + ' selected for this local demo session.';
  row.append(time, message);
  log.prepend(row);
});
$('team-back').addEventListener('click', () => showView('landing'));
$('team-home').addEventListener('click', (event) => {
  event.preventDefault();
  showView('landing');
});

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY;
const authMessage = $('auth-message');
const loginForm = $('admin-login-form');
let supabase = null;
let authCheckInProgress = false;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  const missingConfig = [!supabaseUrl && 'SUPABASE_URL', !supabaseAnonKey && 'SUPABASE_PUBLISHABLE_KEY'].filter(Boolean);
  authMessage.textContent = `Missing Vercel environment variable: ${missingConfig.join(' and ')}. Check this Preview deployment's build environment.`;
}

async function verifyAdminAndOpen(session) {
  if (!supabase || !session?.user) return false;
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) {
    authMessage.textContent = 'Could not verify Admin access. Check the Supabase table and Row Level Security policy.';
    return false;
  }
  if (!data) {
    await supabase.auth.signOut();
    authMessage.textContent = 'Access denied: this account is not on the Admin allowlist.';
    return false;
  }
  $('workspace-access-label').textContent = 'ADMIN / VERIFIED';
  showView('workspace');
  return true;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabase) return;
  const button = $('admin-login-button');
  button.disabled = true;
  authMessage.textContent = 'Verifying credentials and Admin permission…';
  const email = $('admin-email').value.trim();
  const password = $('admin-password').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    authMessage.textContent = 'Sign-in failed. Check the email and password, then try again.';
  } else {
    await verifyAdminAndOpen(data.session);
  }
  $('admin-password').value = '';
  button.disabled = false;
});

$('admin-signout').addEventListener('click', async () => {
  if (supabase) await supabase.auth.signOut();
  loginForm.reset();
  authMessage.textContent = 'Signed out. Admin sign-in is required to reopen the workspace.';
  showView('landing');
});

if (supabase) {
  supabase.auth.getSession().then(async ({ data }) => {
    if (data.session) await verifyAdminAndOpen(data.session);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session && !authCheckInProgress && !workspaceView.classList.contains('view-hidden')) {
      showView('landing');
    }
  });
}

const TELEMETRY_TOPIC = 'chandraya-x/v1/rover/telemetry';
const EVENTS_TOPIC = 'chandraya-x/v1/rover/events';
const ONLINE_TOPIC = 'chandraya-x/v1/rover/online';
const ACK_TOPIC = 'chandraya-x/v1/rover/command-ack';

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

function addEvent(data, prefix = '') {
  const log = $('event-log');
  const empty = log.querySelector('.empty-state');
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className = 'event-row';
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString();
  const message = document.createElement('span');
  const detail = typeof data === 'string'
    ? data
    : (typeof data?.message === 'string' ? data.message : JSON.stringify(data));
  message.textContent = prefix ? `[${prefix}] ${detail}` : detail;
  row.append(time, message);
  log.prepend(row);
  while (log.children.length > 30) log.lastElementChild.remove();
}

function updatePresence(data) {
  const value = typeof data === 'string'
    ? data
    : (data?.online ?? data?.status ?? data?.state ?? data?.message ?? 'PRESENCE RECEIVED');
  const normalized = String(value).trim().toLowerCase();
  let label = String(value).toUpperCase();

  if (value === true || ['online', 'connected', 'ready', 'true', '1'].includes(normalized)) label = 'ONLINE';
  if (value === false || ['offline', 'disconnected', 'false', '0'].includes(normalized)) label = 'OFFLINE';

  $('rover-presence').textContent = label.slice(0, 32);
  $('presence-time').textContent = new Date().toLocaleTimeString();
  addEvent({ message: `Rover presence: ${label}` }, 'LINK');
}

function updateCommandAck(data) {
  const detail = typeof data === 'string'
    ? data
    : (data?.message ?? data?.status ?? data?.command ?? JSON.stringify(data));
  $('last-ack').textContent = String(detail).slice(0, 90);
  addEvent(data, 'COMMAND ACK');
}

function parseMessage(payload) {
  const raw = payload.toString();
  try { return JSON.parse(raw); }
  catch { return raw; }
}

// Browser-side VITE_ values are public. This identity must remain read-only.
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
    client.subscribe([TELEMETRY_TOPIC, EVENTS_TOPIC, ONLINE_TOPIC, ACK_TOPIC], { qos: 0 }, (err) => {
      if (err) setConnection(false, 'Subscription failed');
    });
  });
  client.on('reconnect', () => setConnection(false, 'Reconnecting…'));
  client.on('close', () => setConnection(false, 'Connection closed'));
  client.on('error', () => setConnection(false, 'Connection error'));
  client.on('message', (topic, payload) => {
    const data = parseMessage(payload);
    if (data === null || data === '') return;
    if (topic === TELEMETRY_TOPIC) updateTelemetry(data);
    if (topic === EVENTS_TOPIC) addEvent(data);
    if (topic === ONLINE_TOPIC) updatePresence(data);
    if (topic === ACK_TOPIC) updateCommandAck(data);
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
