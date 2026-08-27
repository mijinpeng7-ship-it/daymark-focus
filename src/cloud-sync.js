(() => {
  const config = window.DAYMARK_CLOUD_CONFIG || {};
  const sessionKey = 'daymark-cloud-session-v1';
  let session = JSON.parse(localStorage.getItem(sessionKey) || 'null');
  const configured = () => Boolean(config.url && config.publishableKey);
  const headers = (auth = false) => ({ apikey: config.publishableKey, 'Content-Type': 'application/json', ...(auth && session ? { Authorization: `Bearer ${session.access_token}` } : {}) });
  async function request(path, options = {}, auth = false) {
    if (!configured()) throw new Error('请先配置 Supabase 项目地址和 Publishable Key');
    const response = await fetch(`${config.url}${path}`, { ...options, headers: { ...headers(auth), ...(options.headers || {}) } });
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.msg || body?.message || body?.error_description || '云端请求失败');
    return body;
  }
  function keepSession(value) { session = value; value ? localStorage.setItem(sessionKey, JSON.stringify(value)) : localStorage.removeItem(sessionKey); }
  async function signIn(email, password) { const value = await request('/auth/v1/token?grant_type=password', { method:'POST', body:JSON.stringify({ email, password }) }); keepSession(value); return value.user; }
  async function signUp(email, password) { const value = await request('/auth/v1/signup', { method:'POST', body:JSON.stringify({ email, password }) }); if (value.access_token) keepSession(value); return value.user; }
  function signOut() { keepSession(null); }
  function user() { return session?.user || null; }
  async function sync(localTodos, localUpdatedAt) {
    if (!session?.user) throw new Error('请先登录');
    const payload = { user_id:session.user.id, todos:localTodos, updated_at:localUpdatedAt || new Date().toISOString() };
    const rows = await request(`/rest/v1/user_data?user_id=eq.${session.user.id}`, { method:'GET' }, true);
    const remote = rows?.[0];
    if (!remote) {
      await request('/rest/v1/user_data?on_conflict=user_id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify(payload) }, true); return { todos:localTodos, updatedAt:payload.updated_at };
    }
    const localUpdated = Date.parse(localUpdatedAt || 0) || 0;
    const remoteUpdated = Date.parse(remote.updated_at || 0) || 0;
    if (remoteUpdated > localUpdated) return { todos:Array.isArray(remote.todos) ? remote.todos : localTodos, updatedAt:remote.updated_at };
    await request(`/rest/v1/user_data?user_id=eq.${session.user.id}`, { method:'PATCH', headers:{ Prefer:'return=minimal' }, body:JSON.stringify(payload) }, true); return { todos:localTodos, updatedAt:payload.updated_at };
  }
  window.DaymarkCloud = { configured, user, signIn, signUp, signOut, sync };
})();
