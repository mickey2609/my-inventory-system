<template>
  <div class="login-overlay">
    <div class="login-card">
      <!-- 1. 置中標題與 Icon 區塊 -->
      <div class="login-header">
        <div class="icon">📦</div>
        <h2>庫存儲位管理系統</h2>
      </div>

      <!-- 2. 地端伺服器連線狀態 Badge -->
      <div class="server-status-box" :class="isServerOnline ? 'online' : 'offline'">
        <span class="status-dot"></span>
        <span class="status-text">
          地端伺服器：{{ isServerOnline ? '🟢 正常連線中' : '🔴 伺服器未連線 (請開啟 start_tunnel.bat)' }}
        </span>
      </div>

      <!-- 3. 表單輸入區塊 (支援 Enter 鍵直接觸發登入) -->
      <el-form :model="loginForm" class="login-form" @keyup.enter="onLogin">
        <!-- 帳號欄位 -->
        <el-form-item label="帳號">
          <el-input 
            v-model="loginForm.username" 
            placeholder="請輸入帳號 (例如: admin)" 
            prefix-icon="User"
            clearable 
          />
        </el-form-item>

        <!-- 帳密中間提示文字 -->
        <div class="mid-subtitle">
          請輸入 6 碼員編帳號與密碼以存取系統
        </div>

        <!-- 密碼欄位 -->
        <el-form-item label="密碼">
          <el-input 
            v-model="loginForm.password" 
            type="password" 
            placeholder="請輸入密碼" 
            prefix-icon="Lock"
            show-password 
          />
        </el-form-item>

        <!-- 記住帳號與密碼勾選框 -->
        <div class="form-options">
          <el-checkbox v-model="loginForm.rememberMe">記住帳號與密碼</el-checkbox>
        </div>

        <!-- 4. 登入按鈕 (斷線時禁用) -->
        <el-button 
          type="primary" 
          class="login-btn" 
          :loading="loading" 
          :disabled="!isServerOnline"
          @click="onLogin"
        >
          {{ isServerOnline ? '🔐 登入系統' : '🚫 伺服器斷線中，無法登入' }}
        </el-button>
      </el-form>

      <!-- 5. 超時提示 -->
      <div v-if="timeoutMessage" class="timeout-msg">
        ⚠️ {{ timeoutMessage }}
      </div>

      <!-- 6. 置中版本號資訊 -->
      <div class="version-info">
        Version {{ appVersion }}
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'LoginOverlay',
  props: {
    loginForm: {
      type: Object,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    },
    timeoutMessage: {
      type: String,
      default: ''
    },
    appVersion: {
      type: String,
      default: 'v2026.09.01'
    }
  },
  emits: ['login'],
  data() {
    return {
      isServerOnline: true, // 🌟 預設先給 true，避免畫面載入當下閃爍禁用
      checkTimer: null
    }
  },
  mounted() {
    this.checkServerStatus();
    // 每 4 秒自動檢查一次地端 API 連線狀態
    this.checkTimer = setInterval(this.checkServerStatus, 4000);
  },
  beforeUnmount() {
    if (this.checkTimer) clearInterval(this.checkTimer);
  },
  methods: {
    async checkServerStatus() {
      try {
        const res = await axios.get('/api/get-global-config', { timeout: 3000 });
        // 🌟 放寬判斷：只要 HTTP 狀態碼是 200 且 response 不為空就認定為正常連線
        if (res && res.status === 200 && res.data) {
          this.isServerOnline = true;
        } else {
          this.isServerOnline = false;
        }
      } catch (e) {
        this.isServerOnline = false;
      }
    },
    onLogin() {
      if (!this.isServerOnline) return;
      this.$emit('login');
    }
  }
}
</script>

<style scoped>
.login-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #0b1329;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.login-card {
  width: 420px;
  padding: 36px 32px 28px 32px;
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
}

.login-header {
  text-align: center;
  margin-bottom: 16px;
}

.login-header .icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.login-header h2 {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: 0.5px;
}

.server-status-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 20px;
  transition: all 0.3s ease;
}

.server-status-box.online {
  background-color: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #4ade80;
}

.server-status-box.offline {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.online .status-dot { background-color: #22c55e; box-shadow: 0 0 8px #22c55e; }
.offline .status-dot { background-color: #ef4444; box-shadow: 0 0 8px #ef4444; }

.mid-subtitle {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  margin: 12px 0 20px 0;
  letter-spacing: 0.3px;
}

.login-form :deep(.el-form-item__label) {
  color: #94a3b8 !important;
  font-weight: 500;
}

.form-options {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.form-options :deep(.el-checkbox__label) {
  color: #94a3b8 !important;
}

.login-btn {
  width: 100%;
  height: 42px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  background-color: #2563eb;
  border-color: #2563eb;
}

.login-btn:hover:not(:disabled) {
  background-color: #1d4ed8;
  border-color: #1d4ed8;
}

.login-btn:disabled {
  background-color: #475569 !important;
  border-color: #475569 !important;
  color: #94a3b8 !important;
  cursor: not-allowed;
}

.timeout-msg {
  margin-top: 14px;
  text-align: center;
  color: #ef4444;
  font-size: 13px;
}

.version-info {
  text-align: center;
  margin-top: 22px;
  color: #64748b;
  font-size: 12px;
  letter-spacing: 0.5px;
}
</style>