<template>
  <el-drawer 
    title="🎛️ 系統控制中心" 
    v-model="visible" 
    direction="rtl" 
    size="360px" 
    class="dark-drawer unified-drawer"
  >
    <div class="drawer-content-box">
      <!-- 1. 使用者資訊區塊 -->
      <div class="user-card-panel">
        <div class="user-badge">
          <div class="avatar-box">👤</div>
          <div class="user-meta">
            <span class="user-name">{{ currentUser || '尚未登入' }}</span>
            <span class="status-online">🟢 在線中</span>
          </div>
          <el-button type="danger" size="mini" class="drawer-logout-btn" @click="$emit('logout'); visible = false;">
            🚪 登出
          </el-button>
        </div>

        <div class="timer-grid-card">
          <div class="timer-item">
            <span class="timer-lbl">📅 登入時間</span>
            <span class="timer-val font-mono">{{ loginTimeStr || '-' }}</span>
          </div>
          <div class="timer-item">
            <span class="timer-lbl">⏱️ 已在線</span>
            <span class="timer-val text-blue font-mono">{{ sessionDurationStr || '00:00:00' }}</span>
          </div>
          <div class="timer-item highlight-red">
            <span class="timer-lbl">⏳ 閒置倒數</span>
            <span class="timer-val text-red font-mono">{{ idleCountdownStr || '60:00' }}</span>
          </div>
        </div>
      </div>

      <!-- 🌟 2. ⚙️ 系統設定與管理 (已移除功能模組與明細匯入) -->
      <div v-if="isAdmin" class="menu-group-section">
        <div class="group-title">⚙️ 系統設定與管理</div>
        <div class="nav-list">
          <button 
            :class="['nav-card-btn setting', { active: currentTab === 'settings_perm' }]" 
            @click="onSwitchTab('settings_perm')"
          >
            <span class="btn-icon">🔐</span>
            <span class="btn-text">權限設定 (帳號管理)</span>
          </button>

          <!-- 🌟 僅限最高系統管理員 (isSysAdmin) 才可見操作歷程 -->
          <button 
            v-if="isSysAdmin"
            :class="['nav-card-btn setting', { active: currentTab === 'settings_log' }]" 
            @click="onSwitchTab('settings_log')"
          >
            <span class="btn-icon">📜</span>
            <span class="btn-text">登入與操作歷程查詢</span>
          </button>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script>
export default {
  name: 'SystemDrawer',
  props: {
    modelValue: Boolean,
    currentUser: String,
    currentTab: String,
    loginTimeStr: String,
    sessionDurationStr: String,
    idleCountdownStr: String,
    isAdmin: Boolean,
    isSysAdmin: Boolean,
    userPermissions: {
      type: [Array, String],
      default: () => []
    }
  },
  emits: ['update:modelValue', 'logout', 'switch-tab', 'open-import-inventory'],
  computed: {
    visible: {
      get() { return this.modelValue },
      set(val) { this.$emit('update:modelValue', val) }
    }
  },
  methods: {
    onSwitchTab(tabKey) {
      this.$emit('switch-tab', tabKey);
      this.visible = false;
    }
  }
}
</script>

<style scoped>
.drawer-content-box {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 10px 4px;
}

.user-card-panel {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.user-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.avatar-box {
  font-size: 22px;
  background: #1e293b;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid #475569;
}

.user-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.user-name {
  font-weight: 700;
  color: #f8fafc;
  font-size: 15px;
}

.status-online {
  font-size: 12px;
  color: #4ade80;
  margin-top: 2px;
}

.drawer-logout-btn {
  padding: 6px 12px !important;
  font-weight: bold !important;
  border-radius: 6px !important;
}

.timer-grid-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.timer-lbl { color: #94a3b8; }
.timer-val { font-weight: 700; color: #f8fafc; }
.font-mono { font-family: 'Courier New', Courier, monospace; }
.text-blue { color: #38bdf8 !important; }
.text-red { color: #f43f5e !important; }

.timer-item.highlight-red {
  background: rgba(244, 63, 94, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(244, 63, 94, 0.2);
}

.menu-group-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-title {
  font-size: 13px;
  font-weight: bold;
  color: #38bdf8;
  border-bottom: 1px solid #334155;
  padding-bottom: 6px;
  letter-spacing: 0.5px;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-card-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  font-size: 13px;
  font-weight: 600;
  position: relative;
}

.nav-card-btn:hover {
  background-color: #2563eb;
  border-color: #3b82f6;
  color: #ffffff;
  transform: translateX(3px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.nav-card-btn.setting {
  background-color: #1e293b;
  border-color: #475569;
}

.nav-card-btn.setting:hover {
  background-color: #334155;
}

.btn-icon { font-size: 16px; }
.btn-text { flex: 1; }
</style>