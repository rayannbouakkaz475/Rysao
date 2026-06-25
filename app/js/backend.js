/* ===========================================================================
   RYSAO TCG — Backend (Supabase) + façade de données DB
   - Si Supabase est configuré ET l'utilisateur connecté  -> mode "cloud"
     (feed / enchères / chat / boutiques partagés + temps réel).
   - Sinon -> mode "local" (localStorage), comportement de démo inchangé.
   Config : Réglages ▸ Backend, ou window.RYSAO_CONFIG (app/js/config.js).
   =========================================================================== */

const Backend = (() => {
  const SDK_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
  let client = null, sdkLoading = null, currentUser = null;

  const cfg = () => ({
    url: (window.RYSAO_CONFIG && window.RYSAO_CONFIG.supabaseUrl) || localStorage.getItem("rysao_supabase_url") || "",
    key: (window.RYSAO_CONFIG && window.RYSAO_CONFIG.supabaseKey) || localStorage.getItem("rysao_supabase_key") || "",
  });
  const isConfigured = () => { const c = cfg(); return !!(c.url && c.key); };

  function loadSDK() {
    if (window.supabase) return Promise.resolve(window.supabase);
    if (sdkLoading) return sdkLoading;
    sdkLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SDK_CDN; s.onload = () => resolve(window.supabase); s.onerror = () => reject(new Error("supabase_sdk_failed"));
      document.head.appendChild(s);
    });
    return sdkLoading;
  }

  async function init() {
    if (!isConfigured()) return null;
    try {
      const sb = await loadSDK();
      const c = cfg();
      client = sb.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true } });
      const { data } = await client.auth.getUser();
      currentUser = data && data.user || null;
      client.auth.onAuthStateChange((_e, session) => {
        currentUser = session && session.user || null;
        if (window.onBackendAuth) window.onBackendAuth(currentUser);
      });
      return client;
    } catch (e) { client = null; return null; }
  }

  const user = () => currentUser;
  const isCloud = () => !!(client && currentUser);

  /* ----- Auth ----- */
  async function signUp(email, password, username) {
    if (!client) await init();
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { username } } });
    if (error) throw error;
    currentUser = data.user; return data.user;
  }
  async function signIn(email, password) {
    if (!client) await init();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user; return data.user;
  }
  async function signOut() { if (client) await client.auth.signOut(); currentUser = null; }

  /* ----- helpers stockage photos ----- */
  async function uploadPhotos(dataURLs) {
    if (!isCloud()) return dataURLs; // local : on garde les dataURL
    const urls = [];
    for (const d of dataURLs) {
      try {
        const blob = await (await fetch(d)).blob();
        const path = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
        const { error } = await client.storage.from("photos").upload(path, blob, { contentType: blob.type || "image/png" });
        if (error) throw error;
        const { data } = client.storage.from("photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      } catch { urls.push(d); }
    }
    return urls;
  }

  return { init, cfg, isConfigured, isCloud, user, loadSDK, signUp, signIn, signOut, uploadPhotos,
    get client() { return client; } };
})();

/* ===========================================================================
   DB — façade de données (cloud ou local), API asynchrone unifiée
   =========================================================================== */
const DB = (() => {
  const ls = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  };
  const meName = () => { const p = ls.get("rysao_profile", {}); return (p.name && p.name.trim()) || "Membre"; };
  const cloud = () => Backend.isCloud();

  // Normalise un post cloud -> forme utilisée par les vues
  function normPost(row, myLikes) {
    return {
      id: row.id, author: row.author_name || "Membre", text: row.body || "",
      photos: row.photos || [], auction: row.auction, ai: row.ai,
      bid: row.auction ? { current: +row.bid_current || 0, by: row.bid_by } : null,
      likes: row._likeCount || 0, liked: myLikes ? myLikes.has(row.id) : false,
      comments: (row.comments || []).map((c) => ({ author: c.author_name, text: c.body, ts: c.created_at })),
      ts: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    };
  }

  const profile = {
    async get() {
      if (cloud()) {
        const { data } = await Backend.client.from("profiles").select("*").eq("id", Backend.user().id).single();
        if (data) return { name: data.username || "", sell: data.sell || [], want: data.want || [] };
      }
      return ls.get("rysao_profile", { name: "", sell: [], want: [] });
    },
    async save(p) {
      ls.set("rysao_profile", p);
      if (cloud()) await Backend.client.from("profiles").update({ username: p.name, sell: p.sell, want: p.want }).eq("id", Backend.user().id);
    },
  };

  const feed = {
    async list() {
      if (cloud()) {
        const { data: posts } = await Backend.client
          .from("posts").select("*, comments(*), likes(count)").order("created_at", { ascending: false }).limit(100);
        const rows = posts || [];
        rows.forEach((r) => { r._likeCount = (r.likes && r.likes[0] && r.likes[0].count) || 0; });
        let myLikes = new Set();
        const { data: ml } = await Backend.client.from("likes").select("post_id").eq("user_id", Backend.user().id);
        if (ml) myLikes = new Set(ml.map((x) => x.post_id));
        return rows.map((r) => normPost(r, myLikes));
      }
      return ls.get("rysao_feed", []);
    },
    async create(post) {
      if (cloud()) {
        const photos = await Backend.uploadPhotos(post.photos || []);
        const { error } = await Backend.client.from("posts").insert({
          author_id: Backend.user().id, author_name: meName(), body: post.text, photos,
          auction: post.auction, ai: post.ai,
          bid_current: post.bid ? post.bid.current : 0, bid_by: null,
        });
        if (error) throw error; return;
      }
      const f = ls.get("rysao_feed", []); f.unshift({ ...post, id: Date.now(), ts: Date.now() }); ls.set("rysao_feed", f);
    },
    async like(id) {
      if (cloud()) {
        const uid = Backend.user().id;
        const { data } = await Backend.client.from("likes").select("post_id").eq("post_id", id).eq("user_id", uid).maybeSingle();
        if (data) await Backend.client.from("likes").delete().eq("post_id", id).eq("user_id", uid);
        else await Backend.client.from("likes").insert({ post_id: id, user_id: uid });
        return;
      }
      const f = ls.get("rysao_feed", []); const p = f.find((x) => x.id === id);
      if (p) { p.liked = !p.liked; p.likes += p.liked ? 1 : -1; ls.set("rysao_feed", f); }
    },
    async comment(id, text) {
      if (cloud()) {
        await Backend.client.from("comments").insert({ post_id: id, author_id: Backend.user().id, author_name: meName(), body: text });
        return;
      }
      const f = ls.get("rysao_feed", []); const p = f.find((x) => x.id === id);
      if (p) { p.comments.push({ author: meName(), text, ts: Date.now() }); ls.set("rysao_feed", f); }
    },
    async bid(id, amount) {
      if (cloud()) { const { error } = await Backend.client.rpc("place_bid", { p_post: id, p_amount: amount }); if (error) throw error; return true; }
      const f = ls.get("rysao_feed", []); const p = f.find((x) => x.id === id);
      if (p && amount > (p.bid.current || 0)) { p.bid = { current: amount, by: meName() }; ls.set("rysao_feed", f); return true; }
      return false;
    },
    subscribe(cb) {
      if (!cloud()) return () => {};
      const ch = Backend.client.channel("feed")
        .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, cb)
        .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, cb)
        .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, cb)
        .subscribe();
      return () => Backend.client.removeChannel(ch);
    },
  };

  const chat = {
    async threads() {
      if (cloud()) {
        const me = meName();
        const { data } = await Backend.client.from("messages").select("sender_name, recipient_name")
          .or(`sender_name.eq.${me},recipient_name.eq.${me}`).order("created_at", { ascending: false }).limit(200);
        const set = new Set();
        (data || []).forEach((m) => { const peer = m.sender_name === me ? m.recipient_name : m.sender_name; if (peer) set.add(peer); });
        return [...set];
      }
      return Object.keys(ls.get("rysao_chats", {}));
    },
    async messages(peer) {
      if (cloud()) {
        const me = meName();
        const { data } = await Backend.client.from("messages").select("*")
          .or(`and(sender_name.eq.${me},recipient_name.eq.${peer}),and(sender_name.eq.${peer},recipient_name.eq.${me})`)
          .order("created_at", { ascending: true });
        return (data || []).map((m) => ({ from: m.sender_name === me ? "me" : peer, text: m.body, ts: m.created_at }));
      }
      return (ls.get("rysao_chats", {})[peer]) || [];
    },
    async ensure(peer) {
      if (cloud()) return;
      const c = ls.get("rysao_chats", {}); if (!c[peer]) { c[peer] = []; ls.set("rysao_chats", c); }
    },
    async send(peer, text) {
      if (cloud()) {
        await Backend.client.from("messages").insert({ sender_id: Backend.user().id, sender_name: meName(), recipient_name: peer, body: text });
        return;
      }
      const c = ls.get("rysao_chats", {}); if (!c[peer]) c[peer] = [];
      c[peer].push({ from: "me", text, ts: Date.now() });
      c[peer].push({ from: peer, text: "👍", ts: Date.now() + 1 }); // auto-réponse démo locale
      ls.set("rysao_chats", c);
    },
    subscribe(cb) {
      if (!cloud()) return () => {};
      const ch = Backend.client.channel("chat")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, cb).subscribe();
      return () => Backend.client.removeChannel(ch);
    },
  };

  const shops = {
    async list() {
      if (cloud()) { const { data } = await Backend.client.from("shops").select("*").order("created_at", { ascending: false }); return data || []; }
      return ls.get("rysao_shops", []);
    },
    async create(shop) {
      if (cloud()) {
        const { data, error } = await Backend.client.from("shops").insert({
          owner_id: Backend.user().id, name: shop.name, address: shop.address, city: shop.city, lat: shop.lat, lon: shop.lon,
        }).select().single();
        if (error) throw error; return data;
      }
      const s = ls.get("rysao_shops", []); const row = { ...shop, id: Date.now() }; s.unshift(row); ls.set("rysao_shops", s); return row;
    },
    async setCoords(id, lat, lon) {
      if (cloud()) { await Backend.client.from("shops").update({ lat, lon }).eq("id", id); return; }
      const s = ls.get("rysao_shops", []); const f = s.find((x) => x.id === id); if (f) { f.lat = lat; f.lon = lon; ls.set("rysao_shops", s); }
    },
  };

  return { profile, feed, chat, shops, mode: () => (cloud() ? "cloud" : "local") };
})();

window.Backend = Backend;
window.DB = DB;
