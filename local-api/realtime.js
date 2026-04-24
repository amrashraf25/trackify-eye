const { WebSocketServer } = require('ws');
const { dbEvents } = require('./db');

function setupRealtime(server) {
  const wss = new WebSocketServer({ server, path: '/realtime/v1/websocket' });

  wss.on('connection', (ws) => {
    // Map: joinRef → { table, event, topic }
    const subs = new Map();

    function send(msg) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }

    // Broadcast DB changes to this client
    function onDbChange(change) {
      for (const [, sub] of subs) {
        const eventMatch = sub.event === '*' || sub.event.toUpperCase() === change.event.toUpperCase();
        const tableMatch = !sub.table || sub.table === change.table;
        if (eventMatch && tableMatch) {
          send([null, null, sub.topic, 'postgres_changes', {
            data: {
              commit_timestamp: new Date().toISOString(),
              errors: null,
              new: change.newRow || {},
              old: change.oldRow || {},
              schema: 'public',
              table: change.table,
              type: change.event,
            }
          }]);
        }
      }
    }

    dbEvents.on('change', onDbChange);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!Array.isArray(msg)) return;

      const [joinRef, ref, topic, event, payload] = msg;

      if (event === 'heartbeat') {
        send([joinRef, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} }]);
        return;
      }

      if (event === 'phx_join') {
        const changes = payload?.config?.postgres_changes || [];
        changes.forEach((c, i) => {
          const key = `${joinRef}-${i}`;
          subs.set(key, { table: c.table, event: c.event || '*', topic });
        });
        // Also subscribe to all events if no postgres_changes config
        if (!changes.length) {
          subs.set(joinRef, { table: null, event: '*', topic });
        }
        send([joinRef, ref, topic, 'phx_reply', {
          status: 'ok',
          response: {
            postgres_changes: changes.map((c, i) => ({
              id: i + 1, event: c.event, schema: c.schema || 'public',
              table: c.table, filter: c.filter || ''
            }))
          }
        }]);
        return;
      }

      if (event === 'phx_leave') {
        for (const key of [...subs.keys()]) {
          if (key.startsWith(joinRef)) subs.delete(key);
        }
        send([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
        return;
      }

      // access_token update (Supabase sends this periodically)
      if (event === 'access_token') {
        send([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
        return;
      }
    });

    ws.on('close', () => dbEvents.off('change', onDbChange));
    ws.on('error', () => dbEvents.off('change', onDbChange));
  });

  return wss;
}

module.exports = { setupRealtime };
