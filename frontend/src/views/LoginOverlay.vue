<template>
  <div class="login-overlay">
    <div class="login-card">
      <!-- 1. 置中標題與 Icon 區塊 -->
      <div class="login-header">
        <div class="icon">📦</div>
        <h2>庫存儲位管理系統</h2>
      </div>

      <!-- 2. 表單輸入區塊 (支援 Enter 鍵直接觸發登入) -->
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

        <!-- 🌟 記住帳號與密碼勾選框 -->
        <div class="form-options">
          <el-checkbox v-model="loginForm.rememberMe">記住帳號與密碼</el-checkbox>
        </div>

        <!-- 3. 登入按鈕 -->
        <el-button 
          type="primary" 
          class="login-btn" 
          :loading="loading" 
          @click="onLogin"
        >
          🔐 登入系統
        </el-button>
      </el-form>

      <!-- 4. 超時提示 -->
      <div v-if="timeoutMessage" class="timeout-msg">
        ⚠️ {{ timeoutMessage }}
      </div>

      <!-- 5. 置中版本號資訊 -->
      <div class="version-info">
        Version {{ appVersion }}
      </div>
    </div>
  </div>
</template>

<script>
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
  methods: {
    onLogin() {
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

/* 置中標題區塊 */
.login-header {
  text-align: center;
  margin-bottom: 24px;
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

/* 帳密中間提示文字 */
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
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  background-color: #2563eb;
  border-color: #2563eb;
}

.login-btn:hover {
  background-color: #1d4ed8;
  border-color: #1d4ed8;
}

.timeout-msg {
  margin-top: 14px;
  text-align: center;
  color: #ef4444;
  font-size: 13px;
}

/* 置中版本號樣式 */
.version-info {
  text-align: center;
  margin-top: 22px;
  color: #64748b;
  font-size: 12px;
  letter-spacing: 0.5px;
}
</style>