import axios from 'axios';

export function useSystemLogs() {
  const sendLog = async (username, feature, action) => {
    // 🔥 防呆：若訊息為 CPU 超時，不重覆發送日誌 API，避免洗版
    if (typeof action === 'string' && action.includes('exceeded its resource limits')) {
      return;
    }

    try {
      await axios.post('/api/record-log', {
        username: username || 'admin',
        feature: feature || '通用操作',
        action: action || '存取系統'
      });
    } catch (e) {}
  };

  const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return '平板';
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated/i.test(ua)) return '手機';
    return '電腦';
  };

  const setupAxiosInterceptor = (getCurrentUsername) => {
    axios.interceptors.response.use(
      response => response,
      error => {
        const detailMsg = error.response?.data?.detail || error.message;
        
        // 自動忽略超時錯誤的二次紀錄
        if (!detailMsg.includes('exceeded its resource limits')) {
          const user = getCurrentUsername ? getCurrentUsername() : 'unknown';
          sendLog(user, '系統連線', '⚠️ 錯誤: ' + detailMsg);
        }
        return Promise.reject(error);
      }
    );
  };

  return { sendLog, getDeviceType, setupAxiosInterceptor };
}