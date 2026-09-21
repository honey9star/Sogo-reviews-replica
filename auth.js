/* SOGO REVIEWS — Shared Auth Logic (localStorage-based demo auth)
   ------------------------------------------------------------------
   This is a FRONTEND-ONLY demo auth system. It stores users in the
   browser's localStorage so the site is fully clickable end-to-end
   without a real backend yet.

   IMPORTANT: This is NOT secure for a real production site — anyone
   can open devtools and read/edit localStorage. When you're ready,
   swap SogoAuth's internals for real API calls to your own backend
   (Firebase, Supabase, Node/Express, etc.) and keep the same function
   names so the rest of your pages don't need to change.
*/

const SogoAuth = (() => {
  const USERS_KEY = 'sogo_users';
  const SESSION_KEY = 'sogo_session';

  // Seed a default admin account the very first time the site loads.
  function seedDefaultAdmin() {
    const users = getUsers();
    const adminExists = users.some(u => u.role === 'admin');
    if (!adminExists) {
      users.push({
        name: 'Admin',
        email: 'Vitto@gmail.com',
        password: 'Vitto123',
        role: 'admin',
        invitationCode: 'ADMIN0001'
      });
      saveUsers(users);
    }
  }

  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
  }

  function generateInviteCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  // Returns { ok: true, user } or { ok: false, message }
  function login(email, password) {
    const users = getUsers();
    const found = users.find(
      u => normalizeEmail(u.email) === normalizeEmail(email) && u.password === password
    );
    if (!found) {
      return { ok: false, message: 'Email/phone ya password ghalat hai.' };
    }
    setSession(found);
    return { ok: true, user: found };
  }

  // Returns { ok: true, user } or { ok: false, message }
  function signup({ name, email, password, invitationCode }) {
    const users = getUsers();
    if (users.some(u => normalizeEmail(u.email) === normalizeEmail(email))) {
      return { ok: false, message: 'Ye email pehle se registered hai.' };
    }
    const newUser = {
      name: name || 'New User',
      email,
      password,
      role: 'client',
      invitationCode: invitationCode || '',
      myInviteCode: generateInviteCode(),
      balance: 0
    };
    users.push(newUser);
    saveUsers(users);
    setSession(newUser);
    return { ok: true, user: newUser };
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      email: user.email,
      name: user.name,
      role: user.role
    }));
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch (e) {
      return null;
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'auth.html';
  }

  // Call at the top of a protected page. If not logged in, or logged in
  // with the wrong role, redirects to auth.html automatically.
  function requireRole(role) {
    const session = getSession();
    if (!session || session.role !== role) {
      window.location.href = 'auth.html';
      return null;
    }
    return session;
  }

  function redirectForRole(role) {
    if (role === 'admin') {
      window.location.href = 'master-admin.html';
    } else {
      window.location.href = 'client-dashboard.html';
    }
  }

  seedDefaultAdmin();

  return { login, signup, logout, getSession, requireRole, redirectForRole, getUsers };
})();
