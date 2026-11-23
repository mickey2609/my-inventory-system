<!-- frontend/src/views/SettingsPerm.vue -->
<template>
  <div class="settings-perm-container dark-view">
    <!-- 頂部操作列 -->
    <div class="action-header">
      <div class="title-group">
        <h2>🔐 權限設定 (帳號管理)</h2>
        <span class="total-badge">共 {{ usersList.length }} 個帳號</span>
      </div>

      <div class="btn-group">
        <el-input
          v-model="searchKeyword"
          placeholder="🔍 搜尋帳號 / 姓名..."
          size="small"
          clearable
          style="width: 190px;"
        />
        <button class="action-btn warning-btn" @click="$emit('open-import-tip')">
          📥 批次匯入帳號
        </button>
        <button class="action-btn success-btn" @click="$emit('export-users')">
          📊 匯出帳號與權限
        </button>
        <button class="action-btn info-btn" @click="$emit('refresh-users')">
          🔄 重新整理
        </button>
        <button class="action-btn primary-btn" @click="$emit('open-add-dialog')">
          ➕ 新增帳號
        </button>
      </div>
    </div>

    <!-- 所屬組別快速篩選頁籤列 -->
    <div class="group-filter-bar">
      <button
        class="group-tab-btn"
        :class="{ active: selectedGroupFilter === 'ALL' }"
        @click="selectedGroupFilter = 'ALL'"
      >
        🌐 全部組別 <span class="tab-count">{{ filteredAllUsers.length }}</span>
      </button>

      <button
        v-for="grp in groupTabs"
        :key="grp.name"
        class="group-tab-btn"
        :class="{ active: selectedGroupFilter === grp.name, 'mgmt-tab': grp.name === '管理組' }"
        @click="selectedGroupFilter = grp.name"
      >
        {{ grp.icon }} {{ grp.name }} <span class="tab-count">{{ grp.count }}</span>
      </button>

      <div class="expand-controls">
        <el-button size="mini" plain type="info" @click="expandAllGroups">展開全部</el-button>
        <el-button size="mini" plain type="info" @click="collapseAllGroups">收合全部</el-button>
      </div>
    </div>

    <!-- 分組卡片列表區 -->
    <div class="groups-scroll-area">
      <div v-if="groupedSections.length === 0" class="empty-box">
        目前尚無符合條件的帳號資料
      </div>

      <div
        v-for="section in groupedSections"
        :key="section.groupName"
        class="group-section-card"
        :class="{ 'is-mgmt-card': section.groupName === '管理組' }"
      >
        <!-- 組別標題列（點擊可摺疊/展開） -->
        <div class="group-section-header" @click="toggleCollapse(section.groupName)">
          <div class="section-header-left">
            <span class="collapse-arrow">{{ collapsedGroups[section.groupName] ? '▶' : '▼' }}</span>
            <span class="section-title">{{ section.icon }} {{ section.groupName }}</span>
            <span class="section-member-count">{{ section.users.length }} 人</span>
            <span class="section-online-count" v-if="section.onlineCount > 0">
              （🟢 {{ section.onlineCount }} 人在線）
            </span>
          </div>

          <div class="section-header-right" @click.stop>
            <el-button
              v-if="section.groupName !== '未設定組別' && section.users.length > 1"
              size="mini"
              type="primary"
              plain
              @click="openBatchGroupPermModal(section)"
            >
              ⚙️ 整組套用權限
            </el-button>
          </div>
        </div>

        <!-- 該組人員表格 -->
        <div v-show="!collapsedGroups[section.groupName]" class="section-table-wrap">
          <el-table 
            :data="section.users" 
            style="width: 100%" 
            class="custom-perm-table"
          >
            <el-table-column prop="username" label="登入帳號" width="110">
              <template #default="scope">
                <span class="cell-username">{{ scope.row.username }}</span>
              </template>
            </el-table-column>

            <el-table-column prop="name" label="姓名" width="120">
              <template #default="scope">
                <span class="cell-name">
                  {{ scope.row.name || (scope.row.username === 'admin' ? '系統管理員' : scope.row.username) }}
                </span>
              </template>
            </el-table-column>

            <!-- 身份角色標籤 -->
            <el-table-column prop="role" label="身份" width="135">
              <template #default="scope">
                <el-tag :type="getRoleTagType(scope.row)" size="small">
                  {{ getRoleLabel(scope.row) }}
                </el-tag>
              </template>
            </el-table-column>

            <!-- 在線狀態 -->
            <el-table-column label="在線狀態" width="90">
              <template #default="scope">
                <span v-if="isUserOnline(scope.row)" class="status-online">🟢 在線</span>
                <span v-else class="status-offline">⚪ 離線</span>
              </template>
            </el-table-column>

            <!-- 密碼 -->
            <el-table-column label="密碼" width="110">
              <template #default="scope">
                <span v-if="scope.row.username === 'guest'" class="guest-pwd-tip">免密碼直達</span>
                <span v-else-if="isSysAdmin" class="pwd-plain">{{ scope.row.password || '-' }}</span>
                <span v-else class="pwd-mask">******</span>
              </template>
            </el-table-column>

            <!-- 開放功能模組（按業務分類顯示彩色標籤） -->
            <el-table-column label="開放功能模組 (依業務分類 / 匯入匯出標記)" min-width="320">
              <template #default="scope">
                <div v-if="scope.row.permissions === 'all' || scope.row.permissions === 'all,'" class="perm-all-badge">
                  👑 全系統模組權限（含全部匯入 / 匯出）
                </div>
                <div v-else-if="getCategorizedPermTags(scope.row.permissions).length === 0" class="perm-none-text">
                  尚未開放任何模組
                </div>
                <div v-else class="perm-tags-wrap">
                  <span
                    v-for="tag in getCategorizedPermTags(scope.row.permissions)"
                    :key="tag.key"
                    class="mod-pill"
                    :class="`pill-${tag.cat}`"
                  >
                    {{ tag.label }}<span v-if="tag.actionStr" class="pill-act">{{ tag.actionStr }}</span>
                  </span>
                </div>
              </template>
            </el-table-column>

            <!-- 操作按鈕群組 -->
            <el-table-column label="操作" width="350" fixed="right" align="center">
              <template #default="scope">
                <div class="opt-btn-group">
                  <el-button type="purple" size="small" class="opt-btn purple-btn" @click="$emit('open-role', scope.row)">
                    🆔 身份/組別
                  </el-button>
                  
                  <el-button 
                    v-if="scope.row.username !== 'guest'"
                    type="warning" 
                    size="small" 
                    class="opt-btn warning-btn" 
                    @click="$emit('open-pwd', scope.row)"
                  >
                    改密碼
                  </el-button>
                  <el-button 
                    v-else
                    type="info" 
                    size="small" 
                    class="opt-btn info-btn-disabled" 
                    disabled
                  >
                    免設密碼
                  </el-button>

                  <el-button type="primary" size="small" class="opt-btn primary-btn" @click="$emit('open-perm', scope.row)">
                    權限設定
                  </el-button>
                  
                  <el-button 
                    type="danger" 
                    size="small" 
                    class="opt-btn danger-btn" 
                    :disabled="scope.row.username === 'admin' || scope.row.username === 'guest'"
                    @click="$emit('delete-user', scope.row.username)"
                  >
                    刪除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>

    <!-- 整組一鍵套用權限彈窗 -->
    <el-dialog
      v-model="showBatchGroupModal"
      :title="`⚙️ 整組批次套用權限：【${batchTargetGroup}】`"
      width="480px"
      custom-class="dark-dialog"
    >
      <div style="color: #cbd5e1; font-size: 13px; line-height: 1.6; margin-bottom: 14px;">
        請選擇一位「<strong>{{ batchTargetGroup }}</strong>」的基準範本人員，系統會將該人員目前的模組與匯入/匯出權限，一鍵複製套用到同組其他 <strong>{{ batchGroupMembers.length - 1 }}</strong> 位成員：
      </div>

      <el-form label-width="100px" size="small">
        <el-form-item label="基準範本人員：">
          <el-select v-model="batchSourceUsername" placeholder="請選擇範本成員" style="width: 100%;">
            <el-option
              v-for="u in batchGroupMembers"
              :key="u.username"
              :label="`${u.name || u.username} (${u.username})`"
              :value="u.username"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button size="small" @click="showBatchGroupModal = false">取消</el-button>
        <el-button type="primary" size="small" :loading="batchApplying" @click="confirmBatchGroupApply">
          確定套用至全組 ({{ batchGroupMembers.length }} 人)
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios';
import { ElMessage } from 'element-plus';

const GROUP_DISPLAY_ORDER = [
  '管理組',
  '進出貨作業組',
  '進貨驗收組',
  '儲位上架組',
  '揀出貨作業組',
  '庫存作業組',
  '還貨作業組',
  '3PL一組',
  '未設定組別'
];

const MODULE_INFO_MAP = {
  // 庫存與儲位 (inv)
  loc_summary: { label: '儲位數才數統整', cat: 'inv' },
  inv80: { label: '庫存查詢80', cat: 'inv' },
  inv15: { label: '庫存查詢15', cat: 'inv' },
  item_sales_history: { label: '全商品歷史銷量', cat: 'inv' },
  turnover: { label: '迴轉率清單', cat: 'inv' },
  storage_accuracy: { label: '80庫儲位準確率', cat: 'inv' },

  // 倉內魚群與進貨調撥 (fish)
  abnormal_purchase: { label: '不合理進貨清單', cat: 'fish' },
  inbound_fish: { label: '進貨上架魚群', cat: 'fish' },
  replenish_fish: { label: '立即補貨單魚群', cat: 'fish' },
  transfer_80_15: { label: '跨庫調撥 80➔15', cat: 'fish' },
  transfer_15_80: { label: '跨庫調撥 15➔80', cat: 'fish' },
  dispatch_fish: { label: '收發魚群出沒', cat: 'fish' },

  // 宅配與物流分析 (deliv)
  delivery_flow: { label: '宅配出貨流線', cat: 'deliv' },
  delivery_cost: { label: '物流費包材成本', cat: 'deliv' },
  delivery_undelivered: { label: '未配達異常追蹤', cat: 'deliv' },

  // 人員與 AI 工具 (staff)
  staff_competency: { label: '人員綜合能力', cat: 'staff' },
  wms_fish_screenshot: { label: 'WMS截圖辨識', cat: 'staff' }
};

export default {
  name: 'SettingsPerm',
  props: {
    usersList: {
      type: Array,
      default: () => []
    },
    currentUser: {
      type: String,
      default: ''
    },
    currentUsername: {
      type: String,
      default: ''
    },
    isSysAdmin: {
      type: Boolean,
      default: false
    }
  },
  emits: [
    'open-import-tip',
    'export-users',
    'refresh-users',
    'open-add-dialog',
    'open-role',
    'open-pwd',
    'open-perm',
    'delete-user'
  ],
  data() {
    return {
      autoRefreshTimer: null,
      searchKeyword: '',
      selectedGroupFilter: 'ALL',
      collapsedGroups: {},

      showBatchGroupModal: false,
      batchTargetGroup: '',
      batchGroupMembers: [],
      batchSourceUsername: '',
      batchApplying: false
    };
  },
  computed: {
    filteredAllUsers() {
      const kw = (this.searchKeyword || '').trim().toLowerCase();
      if (!kw) return this.usersList;
      return this.usersList.filter(u =>
        (u.username && u.username.toLowerCase().includes(kw)) ||
        (u.name && u.name.toLowerCase().includes(kw)) ||
        (u.staff_group && u.staff_group.toLowerCase().includes(kw))
      );
    },
    groupTabs() {
      const countMap = new Map();
      this.filteredAllUsers.forEach(u => {
        const g = (u.staff_group || '').trim() || '未設定組別';
        countMap.set(g, (countMap.get(g) || 0) + 1);
      });

      const allNames = Array.from(countMap.keys());
      allNames.sort((a, b) => {
        const idxA = GROUP_DISPLAY_ORDER.indexOf(a);
        const idxB = GROUP_DISPLAY_ORDER.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b, 'zh-Hant');
      });

      return allNames.map(name => ({
        name,
        icon: this.getGroupIcon(name),
        count: countMap.get(name) || 0
      }));
    },
    groupedSections() {
      const targetTabs = this.selectedGroupFilter === 'ALL'
        ? this.groupTabs
        : this.groupTabs.filter(t => t.name === this.selectedGroupFilter);

      return targetTabs.map(tab => {
        const users = this.filteredAllUsers.filter(u => {
          const g = (u.staff_group || '').trim() || '未設定組別';
          return g === tab.name;
        });
        const onlineCount = users.filter(u => this.isUserOnline(u)).length;
        return {
          groupName: tab.name,
          icon: tab.icon,
          users,
          onlineCount
        };
      });
    }
  },
  mounted() {
    this.$emit('refresh-users');
    this.autoRefreshTimer = setInterval(() => {
      if (!this.showBatchGroupModal) {
        this.$emit('refresh-users');
      }
    }, 5000);
  },
  beforeUnmount() {
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
  },
  methods: {
    getGroupIcon(grp) {
      if (grp === '管理組') return '👑';
      if (grp === '進貨驗收組') return '📥';
      if (grp === '儲位上架組') return '📦';
      if (grp === '進出貨作業組' || grp === '揀出貨作業組') return '🚚';
      if (grp === '庫存作業組') return '📊';
      if (grp === '還貨作業組') return '🔄';
      if (grp === '3PL一組') return '🏭';
      return '👤';
    },
    toggleCollapse(groupName) {
      this.collapsedGroups[groupName] = !this.collapsedGroups[groupName];
    },
    expandAllGroups() {
      this.collapsedGroups = {};
    },
    collapseAllGroups() {
      const next = {};
      this.groupedSections.forEach(s => {
        next[s.groupName] = true;
      });
      this.collapsedGroups = next;
    },
    openBatchGroupPermModal(section) {
      this.batchTargetGroup = section.groupName;
      this.batchGroupMembers = section.users;
      this.batchSourceUsername = section.users[0]?.username || '';
      this.showBatchGroupModal = true;
    },
    async confirmBatchGroupApply() {
      const sourceUser = this.batchGroupMembers.find(u => u.username === this.batchSourceUsername);
      if (!sourceUser) {
        return ElMessage.warning('請先選擇基準範本人員！');
      }

      const rawPerms = Array.isArray(sourceUser.permissions)
        ? sourceUser.permissions
        : String(sourceUser.permissions || '').split(',').map(s => s.trim()).filter(Boolean);
      const permStr = rawPerms.join(',');

      this.batchApplying = true;
      try {
        const targets = this.batchGroupMembers.filter(
          u => u.username !== sourceUser.username && u.username !== 'admin' && u.username !== 'guest'
        );

        for (const member of targets) {
          await axios.post('/api/update-permissions', {
            username: member.username,
            permissions: permStr,
            selected_modules: rawPerms
          });
        }

        ElMessage.success(`🎉 已成功將【${sourceUser.name || sourceUser.username}】的權限套用至「${this.batchTargetGroup}」全組（共 ${targets.length} 人）！`);
        this.showBatchGroupModal = false;
        this.$emit('refresh-users');
      } catch (e) {
        ElMessage.error('整組套用權限失敗：' + (e.response?.data?.detail || e.message));
      } finally {
        this.batchApplying = false;
      }
    },

    getRoleLabel(row) {
      if (!row) return '👤 一般人員';
      if (row.username === 'guest' || row.role === 'guest') return '🌐 訪客直達';
      const role = row.role;
      if (role === 'sys_admin' || row.username === 'admin') return '👑 系統管理員';
      if (role === 'admin') return '👑 管理員';
      return '👤 一般人員';
    },
    getRoleTagType(row) {
      if (!row) return 'info';
      if (row.username === 'guest' || row.role === 'guest') return 'success';
      const role = row.role;
      if (role === 'sys_admin' || row.username === 'admin') return 'danger'; 
      if (role === 'admin') return 'warning'; 
      return 'info';                          
    },
    isUserOnline(row) {
      if (!row) return false;
      if (row.is_online !== undefined && row.is_online !== null) {
        return row.is_online;
      }

      const curUser = (this.currentUser || '').toLowerCase();
      const curUsername = (this.currentUsername || '').toLowerCase();
      const rowUser = (row.username || '').toLowerCase();
      const rowName = (row.name || '').toLowerCase();

      return (rowUser && rowUser === curUsername) || 
             (rowUser && rowUser === curUser) || 
             (rowName && rowName === curUser);
    },
    getCategorizedPermTags(perms) {
      if (!perms || perms === 'all' || perms === 'all,') return [];

      const rawList = Array.isArray(perms)
        ? perms
        : String(perms).split(',').map(s => s.trim()).filter(Boolean);

      const permSet = new Set(rawList);
      const baseModules = rawList.filter(token => !token.includes(':'));

      return baseModules.map(key => {
        const info = MODULE_INFO_MAP[key] || { label: key, cat: 'inv' };
        const canImp = permSet.has(`${key}:import`);
        const canExp = permSet.has(`${key}:export`);
        const acts = [];
        if (canImp) acts.push('匯入');
        if (canExp) acts.push('匯出');

        return {
          key,
          label: info.label,
          cat: info.cat,
          actionStr: acts.length > 0 ? `(${acts.join('/')})` : ''
        };
      });
    }
  }
}
</script>

<style scoped>
.settings-perm-container {
  padding: 16px 20px;
  height: calc(100vh - 52px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background-color: #0f172a;
  color: #f8fafc;
}

.action-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-group h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #38bdf8;
}

.total-badge {
  background: rgba(56, 189, 248, 0.15);
  color: #7dd3fc;
  border: 1px solid rgba(56, 189, 248, 0.35);
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.btn-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  padding: 7px 13px;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  font-size: 13px;
  cursor: pointer;
  color: #ffffff;
  transition: opacity 0.2s;
}

.action-btn:hover { opacity: 0.85; }
.warning-btn { background-color: #d97706; }
.success-btn { background-color: #059669; }
.info-btn { background-color: #475569; }
.primary-btn { background-color: #2563eb; }

/* 組別篩選頁籤列 */
.group-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 8px 12px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  flex-shrink: 0;
}

.group-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 16px;
  border: 1px solid #475569;
  background: #0f172a;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.15s;
}

.group-tab-btn:hover {
  border-color: #38bdf8;
  color: #ffffff;
}

.group-tab-btn.active {
  background: #0284c7;
  border-color: #38bdf8;
  color: #ffffff;
}

.group-tab-btn.mgmt-tab.active {
  background: #b45309;
  border-color: #facc15;
  color: #fef08a;
}

.tab-count {
  background: rgba(255, 255, 255, 0.15);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
}

.expand-controls {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

/* 分組卡片滾動區 */
.groups-scroll-area {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 4px;
}

.empty-box {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
  background: #1e293b;
  border-radius: 8px;
  border: 1px solid #334155;
}

.group-section-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.group-section-card.is-mgmt-card {
  border-color: rgba(250, 204, 21, 0.45);
}

.group-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 16px;
  background: #0f172a;
  border-bottom: 1px solid #334155;
  cursor: pointer;
  user-select: none;
}

.group-section-header:hover {
  background: #162033;
}

.section-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.collapse-arrow {
  color: #38bdf8;
  font-size: 11px;
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  color: #f8fafc;
}

.is-mgmt-card .section-title {
  color: #fde047;
}

.section-member-count {
  background: rgba(56, 189, 248, 0.18);
  color: #7dd3fc;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: bold;
}

.section-online-count {
  font-size: 12px;
  color: #4ade80;
  font-weight: bold;
}

.cell-username { color: #38bdf8 !important; font-weight: bold; }
.cell-name { color: #f1f5f9 !important; font-weight: bold; font-size: 14px; }

.status-online { color: #4ade80 !important; font-weight: bold; font-size: 12px; }
.status-offline { color: #94a3b8 !important; font-size: 12px; }
.pwd-plain { color: #fde047 !important; font-weight: bold; font-family: monospace; font-size: 13px; }
.pwd-mask { color: #64748b !important; }
.guest-pwd-tip { color: #38bdf8 !important; font-size: 12px; font-weight: bold; }

/* 彩色分類權限小膠囊 */
.perm-all-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  background: rgba(250, 204, 21, 0.15);
  color: #fde047;
  border: 1px solid rgba(250, 204, 21, 0.4);
  font-size: 12px;
  font-weight: bold;
}

.perm-none-text {
  color: #64748b;
  font-size: 12px;
}

.perm-tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 2px 0;
}

.mod-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.pill-inv {
  background: rgba(56, 189, 248, 0.14);
  color: #7dd3fc;
  border: 1px solid rgba(56, 189, 248, 0.32);
}

.pill-fish {
  background: rgba(74, 222, 128, 0.14);
  color: #86efac;
  border: 1px solid rgba(74, 222, 128, 0.32);
}

.pill-deliv {
  background: rgba(251, 191, 36, 0.14);
  color: #fde047;
  border: 1px solid rgba(251, 191, 36, 0.32);
}

.pill-staff {
  background: rgba(192, 132, 252, 0.15);
  color: #d8b4fe;
  border: 1px solid rgba(192, 132, 252, 0.35);
}

.pill-act {
  margin-left: 2px;
  color: #ffffff;
  font-weight: bold;
}

.opt-btn-group {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding-right: 4px;
}

.opt-btn-group .el-button {
  margin-left: 0 !important;
  padding: 6px 8px !important;
}

.opt-btn.purple-btn {
  background-color: #8b5cf6 !important;
  border-color: #7c3aed !important;
  color: #ffffff !important;
}

.opt-btn.info-btn-disabled {
  background-color: #334155 !important;
  border-color: #475569 !important;
  color: #94a3b8 !important;
  cursor: not-allowed !important;
}

:deep(.custom-perm-table) {
  background-color: #1e293b !important;
  color: #f8fafc !important;
}

:deep(.custom-perm-table th.el-table__cell) {
  background-color: #162033 !important;
  color: #94a3b8 !important;
  border-bottom: 1px solid #334155 !important;
  font-weight: bold;
  font-size: 12px;
  padding: 6px 0 !important;
}

:deep(.custom-perm-table td.el-table__cell) {
  background-color: #1e293b !important;
  border-bottom: 1px solid rgba(51, 65, 85, 0.6) !important;
  color: #f8fafc !important;
  padding: 8px 0 !important;
}
</style>