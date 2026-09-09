import { ref, onBeforeUnmount } from 'vue';

export function useAuthSession(onAutoLogoutCallback) {
  const loginTimestamp = ref(null);
  const loginTimeStr = ref('--/-- --:--');
  const sessionDurationStr = ref('00:00:00');
  const idleCountdownStr = ref('60:00');
  const lastActiveTimestamp = ref(Date.now());
  const TIMEOUT_MS = 3600000; // 1小時閒置逾時 (3600000 ms)
  let clockInterval = null;

  // 1. 讀取儲存的帳號密碼
  const loadSavedCredentials = (loginForm) => {
    if (!loginForm) return;
    const savedUser = localStorage.getItem('remember_username');
    const savedPwd = localStorage.getItem('remember_password');
    if (savedUser && savedPwd) {
      try {
        loginForm.username = atob(savedUser);
        loginForm.password = atob(savedPwd);
        loginForm.rememberMe = true;
      } catch (e) {
        localStorage.removeItem('remember_username');
        localStorage.removeItem('remember_password');
      }
    }
  };

  // 2. 登入成功時儲存或清除帳密
  const saveOrClearCredentials = (loginForm) => {
    if (!loginForm) return;
    if (loginForm.rememberMe) {
      localStorage.setItem('remember_username', btoa(loginForm.username || ''));
      localStorage.setItem('remember_password', btoa(loginForm.password || ''));
    } else {
      localStorage.removeItem('remember_username');
      localStorage.removeItem('remember_password');
    }
  };

  // 🌟 3. 儲存 Session 資訊與最後活躍時間戳
  const saveSession = (username, name) => {
    const now = Date.now();
    const sessionData = {
      isLoggedIn: true,
      username,
      name,
      loginTimestamp: now,
      lastActiveTimestamp: now
    };
    localStorage.setItem('auth_session', JSON.stringify(sessionData));
  };

  // 🌟 4. 更新最後活躍時間 (包含寫入 localStorage)
  const resetUserActivity = () => {
    const now = Date.now();
    lastActiveTimestamp.value = now;

    // 定期同步至 localStorage
    const savedSessionStr = localStorage.getItem('auth_session');
    if (savedSessionStr) {
      try {
        const session = JSON.parse(savedSessionStr);
        session.lastActiveTimestamp = now;
        localStorage.setItem('auth_session', JSON.stringify(session));
      } catch (e) {}
    }
  };

  const clearSession = () => {
    localStorage.removeItem('auth_session');
  };

  const formatLoginTimeStr = () => {
    if (!loginTimestamp.value) return;
    const d = new Date(loginTimestamp.value);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    loginTimeStr.value = `${year}/${month}/${date} ${hours}:${minutes}`;
  };

  const updateClockTick = () => {
    if (!loginTimestamp.value) return;
    const now = Date.now();

    const diffSec = Math.floor((now - loginTimestamp.value) / 1000);
    const hh = String(Math.floor(diffSec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
    const ss = String(diffSec % 60).padStart(2, '0');
    sessionDurationStr.value = `${hh}:${mm}:${ss}`;

    const idleDiffMs = now - lastActiveTimestamp.value;
    const remMs = TIMEOUT_MS - idleDiffMs;

    if (remMs <= 0) {
      clearSession();
      if (typeof onAutoLogoutCallback === 'function') {
        onAutoLogoutCallback();
      }
    } else {
      const remSec = Math.floor(remMs / 1000);
      const remMm = String(Math.floor(remSec / 60)).padStart(2, '0');
      const remSs = String(remSec % 60).padStart(2, '0');
      idleCountdownStr.value = `${remMm}:${remSs}`;
    }
  };

  const startTimers = () => {
    window.addEventListener('mousemove', resetUserActivity, { passive: true });
    window.addEventListener('click', resetUserActivity, { passive: true });
    window.addEventListener('keydown', resetUserActivity, { passive: true });
    window.addEventListener('scroll', resetUserActivity, { passive: true });
    window.addEventListener('touchstart', resetUserActivity, { passive: true });

    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(updateClockTick, 1000);
    updateClockTick();
  };

  const stopTimers = () => {
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
    window.removeEventListener('mousemove', resetUserActivity);
    window.removeEventListener('click', resetUserActivity);
    window.removeEventListener('keydown', resetUserActivity);
    window.removeEventListener('scroll', resetUserActivity);
    window.removeEventListener('touchstart', resetUserActivity);
  };

  onBeforeUnmount(() => {
    stopTimers();
  });

  return {
    loginTimestamp,
    loginTimeStr,
    sessionDurationStr,
    idleCountdownStr,
    lastActiveTimestamp,
    formatLoginTimeStr,
    startTimers,
    stopTimers,
    loadSavedCredentials,
    saveOrClearCredentials,
    saveSession,
    clearSession
  };
}