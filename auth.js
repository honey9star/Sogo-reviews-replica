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
    const adminIdx = users.findIndex(u => u.role === 'admin');
    if (adminIdx === -1) {
      users.push({
        name: 'Admin',
        email: 'Vitto@gmail.com',
        password: 'Vitto123',
        role: 'admin',
        invitationCode: '',
        myInviteCode: 'ADMIN0001',
        createdAt: new Date().toISOString(),
        blocked: false
      });
      saveUsers(users);
    } else if (!users[adminIdx].myInviteCode) {
      // Migration: older saved data may be missing this field.
      users[adminIdx].myInviteCode = users[adminIdx].invitationCode || 'ADMIN0001';
      users[adminIdx].createdAt = users[adminIdx].createdAt || new Date().toISOString();
      users[adminIdx].blocked = !!users[adminIdx].blocked;
      saveUsers(users);
    }

    // Migration: patch any user missing newer fields (createdAt, blocked, myInviteCode).
    let changed = false;
    users.forEach(u => {
      if (!u.createdAt) { u.createdAt = new Date().toISOString(); changed = true; }
      if (u.blocked === undefined) { u.blocked = false; changed = true; }
      if (!u.myInviteCode) { u.myInviteCode = generateInviteCode(); changed = true; }
    });
    if (changed) saveUsers(users);
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

  function updateUser(email, changes) {
    const users = getUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (idx === -1) return null;
    users[idx] = Object.assign({}, users[idx], changes);
    saveUsers(users);
    return users[idx];
  }

  function deleteUser(email) {
    const users = getUsers().filter(u => u.email.toLowerCase() !== email.toLowerCase());
    saveUsers(users);
    // Clean up related data too.
    const chats = getChats();
    delete chats[email.toLowerCase()];
    localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
    const withdrawals = getWithdrawals().filter(w => w.email.toLowerCase() !== email.toLowerCase());
    localStorage.setItem(WITHDRAWALS_KEY, JSON.stringify(withdrawals));
  }

  // Admin creates a client account directly (no invitation code needed).
  function adminCreateUser(name, email, password) {
    const users = getUsers();
    if (users.some(u => normalizeEmail(u.email) === normalizeEmail(email))) {
      return { ok: false, message: 'Ye email pehle se registered hai.' };
    }
    const newUser = {
      name: name || 'New User',
      email,
      password,
      role: 'client',
      invitationCode: '(created by admin)',
      myInviteCode: generateInviteCode(),
      balance: 0,
      createdAt: new Date().toISOString(),
      blocked: false
    };
    users.push(newUser);
    saveUsers(users);
    return { ok: true, user: newUser };
  }

  // Regenerate or set a custom invite code for a user (admin or client).
  function setInviteCode(email, customCode) {
    const code = (customCode && customCode.trim()) ? customCode.trim().toUpperCase() : generateInviteCode();
    return updateUser(email, { myInviteCode: code });
  }

  /* ---------------- Chat (client <-> admin) ---------------- */
  const CHAT_KEY = 'sogo_chats'; // { [clientEmail]: [ {from, text, time} ] }

  function getChats() {
    try {
      return JSON.parse(localStorage.getItem(CHAT_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function getChatThread(clientEmail) {
    const chats = getChats();
    return chats[clientEmail.toLowerCase()] || [];
  }

  function sendChatMessage(clientEmail, from, text) {
    const chats = getChats();
    const key = clientEmail.toLowerCase();
    if (!chats[key]) chats[key] = [];
    chats[key].push({ from, text, time: new Date().toISOString(), read: from === 'admin' });
    localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
  }

  // Mark all of a client's messages as read (admin opened the thread).
  function markChatRead(clientEmail) {
    const chats = getChats();
    const key = clientEmail.toLowerCase();
    if (!chats[key]) return;
    chats[key].forEach(m => { if (m.from === 'client') m.read = true; });
    localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
  }

  function getUnreadMessageCount() {
    const chats = getChats();
    let count = 0;
    Object.values(chats).forEach(thread => {
      thread.forEach(m => { if (m.from === 'client' && !m.read) count++; });
    });
    return count;
  }

  function getActiveChatsCount() {
    const chats = getChats();
    return Object.values(chats).filter(thread => thread.length > 0).length;
  }

  /* ---------------- Withdrawals ---------------- */
  const WITHDRAWALS_KEY = 'sogo_withdrawals';

  function getWithdrawals() {
    try {
      return JSON.parse(localStorage.getItem(WITHDRAWALS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function requestWithdrawal(email, name, amount, accountDetails) {
    const list = getWithdrawals();
    const record = {
      id: 'w_' + Date.now(),
      email, name, amount, accountDetails,
      status: 'pending',
      requestedAt: new Date().toISOString()
    };
    list.push(record);
    localStorage.setItem(WITHDRAWALS_KEY, JSON.stringify(list));
    return record;
  }

  function updateWithdrawal(id, status) {
    const list = getWithdrawals();
    const idx = list.findIndex(w => w.id === id);
    if (idx === -1) return null;
    list[idx].status = status;
    localStorage.setItem(WITHDRAWALS_KEY, JSON.stringify(list));

    if (status === 'rejected') {
      // refund isn't needed since balance was only deducted on approval
    }
    return list[idx];
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
    if (found.blocked) {
      return { ok: false, message: 'Ye account block kar diya gaya hai. Support se raabta karein.' };
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
    const code = (invitationCode || '').trim();
    if (!code) {
      return { ok: false, message: 'Invitation code zaroori hai.' };
    }
    const inviter = users.find(u => (u.myInviteCode || '').toUpperCase() === code.toUpperCase());
    if (!inviter) {
      return { ok: false, message: 'Invitation code ghalat hai.' };
    }
    const newUser = {
      name: name || 'New User',
      email,
      password,
      role: 'client',
      invitationCode: code,
      invitedByEmail: inviter.email,
      myInviteCode: generateInviteCode(),
      balance: 0,
      createdAt: new Date().toISOString(),
      blocked: false
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
    // If an admin blocked this user mid-session, kick them out too.
    const freshUser = getUsers().find(u => u.email.toLowerCase() === session.email.toLowerCase());
    if (!freshUser || freshUser.blocked) {
      logout();
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

  // Admin-only: temporarily view the site as a given client.
  // NOTE: since this is localStorage-based, this changes the session for
  // THIS browser — the admin will need to log back in afterwards.
  function impersonate(email) {
    const user = getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return false;
    setSession(user);
    window.location.href = 'client-dashboard.html';
    return true;
  }

  seedDefaultAdmin();

  return {
    login, signup, logout, getSession, requireRole, redirectForRole, impersonate,
    getUsers, updateUser, deleteUser, adminCreateUser, setInviteCode,
    getChatThread, sendChatMessage, markChatRead, getUnreadMessageCount, getActiveChatsCount,
    getWithdrawals, requestWithdrawal, updateWithdrawal
  };
})();
