<!-- frontend/src/views/StaffCompetency.vue -->
<template>
  <div class="staff-competency-light-page">
    <input
      type="file"
      ref="excelInput"
      style="display: none;"
      accept=".xlsx, .xls, .csv"
      @change="handleExcelImport"
    />

    <!-- 1. 頂部深藍 ERP 漸層標題與工具列 -->
    <header class="erp-header-bar">
      <div class="erp-brand-left">
        <span class="erp-logo-text">PChome</span>
        <span class="erp-badge">LOGISTICS ERP</span>
        <span class="erp-divider"></span>
        <h2 class="erp-title">人員綜合能力管理系統</h2>
      </div>

      <div class="erp-actions-right">
        <button class="erp-btn btn-amber" @click="openAddEmployeeModal">
          <span>＋ 新增人員</span>
        </button>

        <button class="erp-btn btn-indigo" @click="syncAllToCloud(true)">
          <span>✓ {{ syncStatusText }}</span>
        </button>

        <button v-if="canImport" class="erp-btn btn-emerald" @click="$refs.excelInput.click()">
          <span>📂 匯入 Excel</span>
        </button>

        <button v-if="canExport" class="erp-btn btn-sky" @click="exportToExcel">
          <span>⬇️ 匯出 Excel</span>
        </button>

        <button class="erp-btn btn-slate" @click="openManageSkillsModal">
          <span>⚙️ 管理項目</span>
        </button>

        <button class="erp-btn btn-teal" @click="resetWarehouseSkillsToLatest" title="重新整理目前倉別最新資料">
          <span>🔄 重新整理</span>
        </button>
      </div>
    </header>

    <!-- 2. 主工作區 -->
    <main class="workspace-main" v-loading="loading">
      <!-- 第一列：左側倉別膠囊頁籤 + 右側即時 KPI 指標條 -->
      <div class="toolbar-card row-between">
        <div class="wh-capsule-group">
          <button
            v-for="wh in warehouses"
            :key="wh"
            class="wh-capsule-btn"
            :class="{ active: currentWarehouse === wh }"
            @click="switchWarehouse(wh)"
          >
            <span>{{ getWhIcon(wh) }} {{ wh }}</span>
            <span class="wh-num-pill">{{ (appData[wh]?.employees || []).length }}</span>
            <span
              v-if="getOverdueCount(wh) > 0"
              class="wh-overdue-dot"
              :title="`有 ${getOverdueCount(wh)} 位逾 30 天未更新`"
            ></span>
          </button>

          <span class="v-sep"></span>

          <button
            class="wh-capsule-btn overdue-tab-btn"
            :class="{ 'overdue-active': updateStatusFilter === 'overdue' }"
            @click="toggleFilterOverdueOnly"
          >
            <span>🔔 逾30天未更新</span>
            <span class="overdue-red-pill">{{ getOverdueCount(currentWarehouse) }}</span>
          </button>
        </div>

        <div class="kpi-frame-strip">
          <div class="kpi-cell">
            <span class="kpi-lbl">👥 總人數</span>
            <span class="kpi-val text-slate-900">{{ currentEmployees.length }} 人</span>
          </div>
          <div class="kpi-cell">
            <span class="kpi-lbl">📋 能力項數</span>
            <span class="kpi-val text-slate-900">{{ currentSkills.length }} 項</span>
          </div>
          <div class="kpi-cell">
            <span class="kpi-lbl">📈 平均掌握度</span>
            <span class="kpi-val text-emerald">{{ avgMasteryPct }}%</span>
          </div>
          <div class="kpi-cell kpi-overdue-cell" @click="toggleFilterOverdueOnly" title="點擊一鍵篩選逾 30 天未更新人員">
            <span class="kpi-lbl text-rose">🕒 逾1月未更</span>
            <span class="kpi-val text-rose">{{ getOverdueCount(currentWarehouse) }} 人</span>
          </div>
        </div>
      </div>

      <!-- 粉紅逾 30 天未更新警告橫幅 -->
      <div v-if="getOverdueCount(currentWarehouse) > 0" class="overdue-alert-strip">
        <div class="alert-left">
          <span>⚠️ 【{{ currentWarehouse }}】目前共有 {{ getOverdueCount(currentWarehouse) }} 位人員超過 1 個月（30 天）尚未更新能力資料！</span>
        </div>
        <button class="alert-action-btn" @click="toggleFilterOverdueOnly">
          {{ updateStatusFilter === 'overdue' ? '↩️ 顯示全部人員' : `🔻 只顯示逾 30 天未更新 (${getOverdueCount(currentWarehouse)}人)` }}
        </button>
      </div>

      <!-- 第二列：搜尋與條件過濾 + 右側手順提示 + 作業組別彩色膠囊 -->
      <div class="toolbar-card filter-block">
        <div class="filter-top-line">
          <div class="filter-controls-left">
            <input
              v-model="searchTerm"
              type="text"
              placeholder="🔍 搜尋員編/姓名..."
              class="light-input"
              @input="currentPage = 1"
            />

            <select v-model="staffGroupFilter" class="light-select" @change="currentPage = 1">
              <option value="all">全部人員組別 ({{ currentEmployees.length }}人)</option>
              <option v-for="(cnt, grp) in staffGroupCounts" :key="grp" :value="grp">
                {{ grp }} ({{ cnt }}人)
              </option>
            </select>

            <select v-model="updateStatusFilter" class="light-select" @change="currentPage = 1">
              <option value="all">全部更新狀態</option>
              <option value="overdue">逾 30 天未更新 / 未建檔</option>
              <option value="fresh">30 天內已更新</option>
            </select>

            <div class="seg-filter-group">
              <button
                v-for="opt in skillTypeOptions"
                :key="opt.val"
                class="seg-btn"
                :class="{ active: skillTypeFilter === opt.val }"
                @click="setSkillFilter(opt.val)"
              >
                {{ opt.label }}
              </button>
            </div>

            <select v-model="sortBy" class="light-select" @change="currentPage = 1">
              <option value="default">預設順序</option>
              <option value="rankAsc">總分高到低</option>
              <option value="rankDesc">總分低到高</option>
              <option value="staleFirst">最久未更新優先</option>
              <option value="idAsc">員編順序</option>
            </select>

            <select v-model.number="pageSize" class="light-select" @change="currentPage = 1">
              <option :value="30">每頁 30 筆</option>
              <option :value="50">每頁 50 筆</option>
              <option :value="100">每頁 100 筆</option>
            </select>
          </div>

          <div class="kbd-guide-pill">
            <span class="kbd-title">⌨️ 手順：</span>
            <kbd>↑↓←→</kbd>
            <span>移動 +</span>
            <kbd>Space</kbd>
            <span>打勾</span>
            <span v-if="activeCellText" class="kbd-active-info">{{ activeCellText }}</span>
          </div>
        </div>

        <!-- 作業組別彩色膠囊列 -->
        <div class="group-filter-line">
          <span class="gf-label">🗂️ 作業組別：</span>
          <button
            class="gf-pill"
            :class="groupFilter === 'all' ? 'gf-all-active' : 'gf-all'"
            @click="setGroupFilter('all')"
          >
            全部 ({{ currentSkills.length }})
          </button>
          <button
            v-for="g in orderedSkillGroups"
            :key="g"
            class="gf-pill"
            :class="groupFilter === g ? getGroupBadgeActiveClass(g) : getGroupBadgeClass(g)"
            @click="setGroupFilter(g)"
          >
            {{ g }} ({{ currentSkills.filter(s => s.group === g).length }})
          </button>
        </div>
      </div>

      <!-- 第三列：主能力矩陣表格（亮白底色＋左側 4 欄凍結＋三層群組表頭） -->
      <div class="matrix-frame-box">
        <div
          class="matrix-scroll-area"
          ref="tableScrollContainer"
          tabindex="0"
          @keydown="handleMatrixKeydown"
        >
          <table class="competency-matrix-table">
            <thead>
              <!-- 第 1 層表頭：作業組別 -->
              <tr>
                <th rowspan="3" class="sticky-col-1 th-dark">所屬組別</th>
                <th rowspan="3" class="sticky-col-2 th-dark">員編</th>
                <th rowspan="3" class="sticky-col-3 th-dark">姓名</th>
                <th rowspan="3" class="sticky-col-4 th-dark">全能進度</th>
                <th
                  v-for="(seg, idx) in groupSegments"
                  :key="'g_' + idx"
                  :colspan="seg.count"
                  class="th-grp-banner"
                  :class="getGroupHeaderBgClass(seg.group)"
                >
                  {{ seg.group }} ({{ seg.count }})
                </th>
                <th colspan="6" class="th-dark border-l-thick">能力加總、排名與更新狀態</th>
                <th rowspan="3" class="th-dark" style="min-width: 100px;">操作</th>
              </tr>

              <!-- 第 2 層表頭：現場 / 異動 / 幹部 -->
              <tr>
                <th
                  v-for="(sub, idx) in subSegments"
                  :key="'sub_' + idx"
                  :colspan="sub.count"
                  class="th-sub-banner"
                  :class="`th-sub-${sub.type}`"
                >
                  {{ sub.subLabel }} ({{ sub.count }})
                </th>
                <th rowspan="2" class="th-sum-field border-l-thick">現場</th>
                <th rowspan="2" class="th-sum-special">異動</th>
                <th rowspan="2" class="th-sum-cadre">幹部</th>
                <th rowspan="2" class="th-sum-total">總分</th>
                <th rowspan="2" class="th-sum-rank">排名</th>
                <th rowspan="2" class="th-sum-rank" style="min-width: 85px;">最後更新</th>
              </tr>

              <!-- 第 3 層表頭：具體能力名稱 -->
              <tr>
                <th
                  v-for="s in visibleSkills"
                  :key="s.id"
                  class="skill-col-th"
                  :class="`th-item-${s.type}`"
                  :title="`${s.group} - ${s.name}`"
                >
                  {{ s.name }}
                </th>
              </tr>
            </thead>

            <tbody>
              <tr v-if="pagedRows.length === 0">
                <td :colspan="visibleSkills.length + 11" class="empty-table-row">
                  {{ currentEmployees.length === 0 ? '尚無人員資料，請點擊右上角「📂 匯入 Excel」上傳人員能力表！' : '找不到符合條件的人員資料' }}
                </td>
              </tr>
              <tr
                v-for="(row, rIdx) in pagedRows"
                :key="row.emp.id"
                :class="rIdx % 2 === 0 ? 'row-even' : 'row-odd'"
              >
                <td class="sticky-col-1">
                  <span class="emp-grp-tag" :class="getGroupBadgeClass(row.emp.staffGroup)">
                    {{ row.emp.staffGroup || '未分組' }}
                  </span>
                </td>
                <td class="sticky-col-2 font-bold text-slate-700">{{ row.emp.id }}</td>
                <td class="sticky-col-3 font-bold text-slate-900">{{ row.emp.name }}</td>
                <td class="sticky-col-4">
                  <div class="progress-wrap">
                    <div class="progress-track">
                      <div
                        class="progress-bar"
                        :class="row.pct === 100 ? 'bg-emerald-500' : (row.pct >= 60 ? 'bg-indigo-500' : 'bg-amber-500')"
                        :style="{ width: `${row.pct}%` }"
                      ></div>
                    </div>
                    <span class="progress-num">{{ row.pct }}%</span>
                  </div>
                </td>

                <!-- 能力打勾儲存格 -->
                <td
                  v-for="(s, cIdx) in visibleSkills"
                  :key="s.id"
                  class="skill-cell"
                  :class="[
                    row.emp.skills[s.id] === 1 ? `cell-on-${s.type}` : '',
                    focusedRowIdx === rIdx && focusedColIdx === cIdx ? 'cell-focused' : ''
                  ]"
                  @click="handleCellClick(rIdx, cIdx)"
                >
                  <span
                    class="skill-box"
                    :class="row.emp.skills[s.id] === 1 ? `skill-box-${s.type}` : 'skill-box-empty'"
                  >
                    {{ row.emp.skills[s.id] === 1 ? '✓' : '-' }}
                  </span>
                </td>

                <!-- 右側加總與最後更新 -->
                <td class="font-bold text-sky-700 bg-sky-50 border-l-thick">{{ row.fieldScore }}</td>
                <td class="font-bold text-amber-700 bg-amber-50">{{ row.specialScore }}</td>
                <td class="font-bold text-purple-700 bg-purple-50">{{ row.cadreScore }}</td>
                <td class="font-extrabold text-slate-900 bg-amber-100">{{ row.totalScore }}</td>
                <td class="bg-slate-50">
                  <span class="rank-circle" :class="row.totalScore > 0 && row.rank <= 3 ? `rank-top-${row.rank}` : ''">
                    {{ row.rank }}
                  </span>
                </td>
                <td class="bg-slate-50">
                  <span class="upd-pill" :class="getUpdateBadgeClass(row.emp.lastUpdated)" :title="row.emp.lastUpdated || '尚未有更新紀錄'">
                    {{ getUpdateBadgeLabel(row.emp.lastUpdated) }}
                  </span>
                </td>
                <td class="op-cell">
                  <button
                    class="op-icon-btn op-check"
                    :title="isAllVisibleChecked(row.emp) ? '一鍵取消目前篩選能力' : '一鍵全勾選目前篩選能力'"
                    @click="toggleAllSkillsForEmployee(row.emp)"
                  >
                    ✓✓
                  </button>
                  <button class="op-icon-btn op-edit" title="編輯人員" @click="openEditEmployeeModal(row.emp)">✎</button>
                  <button class="op-icon-btn op-del" title="刪除人員" @click="confirmDeleteEmployee(row.emp)">🗑</button>
                </td>
              </tr>
            </tbody>

            <tfoot v-if="visibleSkills.length > 0">
              <tr>
                <td colspan="4" class="sticky-col-1 tfoot-sticky-lbl">各項目會做人數 / 覆蓋率</td>
                <td v-for="s in visibleSkills" :key="'foot_' + s.id" class="tfoot-stat-cell">
                  <div :class="getSkillCoverage(s.id).pct === 0 ? 'text-rose' : (getSkillCoverage(s.id).pct >= 80 ? 'text-emerald' : 'text-amber')">
                    {{ getSkillCoverage(s.id).count }}人
                  </div>
                  <div class="tfoot-pct">{{ getSkillCoverage(s.id).pct }}%</div>
                </td>
                <td colspan="7" class="tfoot-goal-cell border-l-thick">目標：全倉全能覆蓋 100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- 底部分頁列 -->
        <div class="light-pagination-bar">
          <div>
            顯示第 <strong>{{ totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, totalFiltered) }}</strong> 筆，共 <strong>{{ totalFiltered }}</strong> 筆人員資料
          </div>
          <div class="pg-btn-group">
            <button class="pg-btn" :disabled="currentPage <= 1" @click="currentPage = 1">首頁</button>
            <button class="pg-btn" :disabled="currentPage <= 1" @click="currentPage--">上一頁</button>
            <span class="pg-indicator">第 {{ currentPage }} / {{ totalPages }} 頁</span>
            <button class="pg-btn" :disabled="currentPage >= totalPages" @click="currentPage++">下一頁</button>
            <button class="pg-btn" :disabled="currentPage >= totalPages" @click="currentPage = totalPages">末頁</button>
          </div>
        </div>
      </div>
    </main>

    <!-- 3. 新增 / 編輯人員 Modal -->
    <el-dialog
      v-model="showEmpModal"
      :title="editingOriginalEmp ? `編輯人員能力 - ${empForm.name} (${empForm.id})` : '新增人員與能力登記'"
      width="740px"
      top="4vh"
      append-to-body
    >
      <div class="modal-light-body">
        <div class="emp-grid-4">
          <div>
            <label class="m-lbl">所屬倉別 *</label>
            <el-select v-model="empForm.warehouse" size="mini" style="width: 100%;">
              <el-option v-for="w in warehouses" :key="w" :label="w" :value="w" />
            </el-select>
          </div>
          <div>
            <label class="m-lbl">所屬組別 *</label>
            <el-select v-model="empForm.staffGroup" size="mini" filterable allow-create style="width: 100%;">
              <el-option v-for="g in getWarehouseGroups(empForm.warehouse)" :key="g" :label="g" :value="g" />
            </el-select>
          </div>
          <div>
            <label class="m-lbl">員工編號 *</label>
            <el-input v-model="empForm.id" size="mini" placeholder="例如: 801824" />
          </div>
          <div>
            <label class="m-lbl">員工姓名 *</label>
            <el-input v-model="empForm.name" size="mini" placeholder="例如: 張紘瑋" />
          </div>
        </div>

        <div class="review-banner">
          <el-checkbox v-model="empForm.markReviewed">
            儲存時同時更新該員「能力最後更新時間」為現在（完成本月盤點）
          </el-checkbox>
        </div>

        <div class="quick-check-row">
          <span class="font-bold">快速勾選已具備能力：</span>
          <el-button size="mini" type="success" plain @click="toggleModalSkills('field', true)">全選現場</el-button>
          <el-button size="mini" type="warning" plain @click="toggleModalSkills('special', true)">全選異動</el-button>
          <el-button size="mini" type="primary" plain @click="toggleModalSkills('cadre', true)">全選幹部</el-button>
          <el-button size="mini" type="info" plain @click="toggleModalSkills('all', false)">全部清除</el-button>
        </div>

        <div class="modal-skills-list">
          <div
            v-for="grp in getWarehouseGroups(empForm.warehouse)"
            :key="grp"
            class="m-grp-card"
          >
            <div class="m-grp-head">{{ grp }}</div>
            <div class="m-grp-grid">
              <label
                v-for="s in (appData[empForm.warehouse]?.skills || []).filter(x => x.group === grp)"
                :key="s.id"
                class="m-skill-item"
                :class="{ 'm-skill-checked': empForm.skills[s.id] === 1 }"
              >
                <input
                  type="checkbox"
                  :checked="empForm.skills[s.id] === 1"
                  @change="e => toggleModalSingleSkill(s.id, e.target.checked)"
                />
                <span class="m-tag" :class="`m-tag-${s.type}`">
                  {{ s.type === 'cadre' ? '幹部' : (s.type === 'special' ? '異動' : '現場') }}
                </span>
                <span class="m-name">{{ s.name }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button size="mini" @click="showEmpModal = false">取消</el-button>
        <el-button size="mini" type="primary" @click="saveEmployee">儲存人員資料</el-button>
      </template>
    </el-dialog>

    <!-- 4. 管理能力項目 Modal -->
    <el-dialog
      v-model="showSkillsModal"
      :title="`⚙️ 管理能力項目 - ${manageWh}`"
      width="700px"
      top="5vh"
      append-to-body
    >
      <div class="modal-light-body">
        <div class="add-skill-row">
          <el-select v-model="manageWh" size="mini" style="width: 115px;">
            <el-option v-for="w in warehouses" :key="w" :label="w" :value="w" />
          </el-select>
          <el-select v-model="newSkillGroup" size="mini" filterable allow-create style="width: 120px;">
            <el-option v-for="g in getWarehouseGroups(manageWh)" :key="g" :label="g" :value="g" />
          </el-select>
          <el-select v-model="newSkillType" size="mini" style="width: 145px;">
            <el-option label="現場人員所需能力" value="field" />
            <el-option label="異動單人員" value="special" />
            <el-option label="幹部所需能力" value="cadre" />
          </el-select>
          <el-input
            v-model="newSkillName"
            size="mini"
            placeholder="輸入能力名稱..."
            style="flex: 1;"
            @keyup.enter="addNewSkill"
          />
          <el-button size="mini" type="primary" @click="addNewSkill">新增</el-button>
        </div>

        <div class="modal-skills-list">
          <div
            v-for="grp in getWarehouseGroups(manageWh)"
            :key="'m_' + grp"
            class="m-grp-card"
          >
            <div class="m-grp-head">{{ grp }}</div>
            <div class="m-pills-wrap">
              <span
                v-for="s in (appData[manageWh]?.skills || []).filter(x => x.group === grp)"
                :key="s.id"
                class="m-pill"
                :class="`m-pill-${s.type}`"
              >
                <span>[{{ s.type === 'cadre' ? '幹部' : (s.type === 'special' ? '異動' : '現場') }}] {{ s.name }}</span>
                <i class="el-icon-close m-del" @click="removeSkill(s)"></i>
              </span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'

const OVERDUE_DAYS_LIMIT = 30;

export default {
  name: 'StaffCompetency',
  props: {
    isAdmin: { type: Boolean, default: false },
    isSysAdmin: { type: Boolean, default: false }
  },
  data() {
    return {
      loading: false,
      warehouses: ['大園倉', '林口倉', '3PL一組', '3PL二組'],
      currentWarehouse: '林口倉',
      appData: {
        '大園倉': { skills: [], employees: [] },
        '林口倉': { skills: [], employees: [] },
        '3PL一組': { skills: [], employees: [] },
        '3PL二組': { skills: [], employees: [] }
      },

      searchTerm: '',
      staffGroupFilter: 'all',
      updateStatusFilter: 'all',
      skillTypeFilter: 'all',
      skillTypeOptions: [
        { val: 'all', label: '全部' },
        { val: 'field', label: '現場' },
        { val: 'special', label: '異動' },
        { val: 'cadre', label: '幹部' }
      ],
      groupFilter: 'all',
      sortBy: 'default',
      currentPage: 1,
      pageSize: 30,

      focusedRowIdx: -1,
      focusedColIdx: -1,

      syncState: 'synced',
      syncStatusText: '雲端已同步',
      pendingUpdates: [],
      syncTimer: null,

      showEmpModal: false,
      editingOriginalEmp: null,
      empForm: {
        warehouse: '林口倉',
        staffGroup: '進貨組',
        id: '',
        name: '',
        markReviewed: true,
        skills: {}
      },

      showSkillsModal: false,
      manageWh: '林口倉',
      newSkillGroup: '進貨組',
      newSkillType: 'field',
      newSkillName: ''
    }
  },
  computed: {
    canImport() {
      if (this.isSysAdmin || this.isAdmin) return true;
      return typeof this.$canImport === 'function' ? this.$canImport('staff_competency') : false;
    },
    canExport() {
      if (this.isSysAdmin || this.isAdmin) return true;
      return typeof this.$canExport === 'function' ? this.$canExport('staff_competency') : true;
    },
    currentSkills() {
      return this.appData[this.currentWarehouse]?.skills || [];
    },
    currentEmployees() {
      return this.appData[this.currentWarehouse]?.employees || [];
    },
    orderedSkillGroups() {
      const list = [];
      this.currentSkills.forEach(s => {
        if (!list.includes(s.group)) list.push(s.group);
      });
      return list;
    },
    staffGroupCounts() {
      const map = {};
      this.currentEmployees.forEach(e => {
        const g = e.staffGroup || '未分組';
        map[g] = (map[g] || 0) + 1;
      });
      return map;
    },
    visibleSkills() {
      return this.currentSkills.filter(s => {
        const okType = this.skillTypeFilter === 'all' || s.type === this.skillTypeFilter;
        const okGrp = this.groupFilter === 'all' || s.group === this.groupFilter;
        return okType && okGrp;
      });
    },
    groupSegments() {
      const segs = [];
      this.visibleSkills.forEach(s => {
        const last = segs[segs.length - 1];
        if (last && last.group === s.group) last.count++;
        else segs.push({ group: s.group, count: 1 });
      });
      return segs;
    },
    subSegments() {
      const segs = [];
      this.visibleSkills.forEach(s => {
        const subLabel = s.subHeader || (s.type === 'cadre' ? '幹部所需能力' : (s.type === 'special' ? '異動單人員' : '現場人員所需能力'));
        const last = segs[segs.length - 1];
        if (last && last.group === s.group && last.subLabel === subLabel && last.type === s.type) last.count++;
        else segs.push({ group: s.group, subLabel, type: s.type, count: 1 });
      });
      return segs;
    },
    scoredRows() {
      const totalSkillCnt = this.currentSkills.length;
      const rows = this.currentEmployees.map(emp => {
        let fieldScore = 0, specialScore = 0, cadreScore = 0;
        this.currentSkills.forEach(s => {
          if (emp.skills && emp.skills[s.id] === 1) {
            if (s.type === 'field') fieldScore++;
            else if (s.type === 'special') specialScore++;
            else if (s.type === 'cadre') cadreScore++;
          }
        });
        const totalScore = fieldScore + specialScore + cadreScore;
        const pct = totalSkillCnt > 0 ? Math.round((totalScore / totalSkillCnt) * 100) : 0;
        return { emp, fieldScore, specialScore, cadreScore, totalScore, pct, rank: 1 };
      });

      const sortedScores = [...rows].map(r => r.totalScore).sort((a, b) => b - a);
      rows.forEach(r => {
        r.rank = sortedScores.indexOf(r.totalScore) + 1;
      });
      return rows;
    },
    filteredRows() {
      const kw = this.searchTerm.trim().toLowerCase();
      let list = this.scoredRows.filter(item => {
        const okKw = !kw || item.emp.id.toLowerCase().includes(kw) || item.emp.name.toLowerCase().includes(kw);
        const okGrp = this.staffGroupFilter === 'all' || (item.emp.staffGroup || '未分組') === this.staffGroupFilter;
        let okUpd = true;
        if (this.updateStatusFilter === 'overdue') okUpd = this.isEmployeeOverdue(item.emp);
        else if (this.updateStatusFilter === 'fresh') okUpd = !this.isEmployeeOverdue(item.emp);
        return okKw && okGrp && okUpd;
      });

      if (this.sortBy === 'rankAsc') list = [...list].sort((a, b) => b.totalScore - a.totalScore);
      else if (this.sortBy === 'rankDesc') list = [...list].sort((a, b) => a.totalScore - b.totalScore);
      else if (this.sortBy === 'idAsc') list = [...list].sort((a, b) => a.emp.id.localeCompare(b.emp.id));
      else if (this.sortBy === 'staleFirst') {
        list = [...list].sort((a, b) => {
          const da = a.emp.lastUpdated ? this.getDaysSince(a.emp.lastUpdated) : 99999;
          const db = b.emp.lastUpdated ? this.getDaysSince(b.emp.lastUpdated) : 99999;
          return db - da;
        });
      }
      return list;
    },
    totalFiltered() {
      return this.filteredRows.length;
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.totalFiltered / this.pageSize));
    },
    pagedRows() {
      const start = (this.currentPage - 1) * this.pageSize;
      return this.filteredRows.slice(start, start + this.pageSize);
    },
    avgMasteryPct() {
      const staffCnt = this.currentEmployees.length;
      const skillCnt = this.currentSkills.length;
      if (!staffCnt || !skillCnt) return 0;
      const sumChecked = this.scoredRows.reduce((acc, r) => acc + r.totalScore, 0);
      return Math.round((sumChecked / (staffCnt * skillCnt)) * 100);
    },
    activeCellText() {
      if (this.focusedRowIdx < 0 || this.focusedColIdx < 0) return '';
      const r = this.pagedRows[this.focusedRowIdx];
      const s = this.visibleSkills[this.focusedColIdx];
      if (!r || !s) return '';
      return `目前聚焦：${r.emp.name} (${r.emp.id}) ｜ ${s.group} - ${s.name}`;
    }
  },
  mounted() {
    this.fetchAllData();
  },
  beforeUnmount() {
    this.flushUpdates();
  },
  methods: {
    getWhIcon(wh) {
      if (wh === '大園倉') return '🏭';
      if (wh === '林口倉') return '🏢';
      if (wh === '3PL一組') return '📦';
      return '🚚';
    },
    getGroupHeaderBgClass(grp) {
      const map = {
        '進貨組': 'bg-blue-800',
        '上架組': 'bg-emerald-800',
        '揀出組': 'bg-amber-800',
        '庫存組': 'bg-purple-800',
        '還貨組': 'bg-rose-800',
        '共同科目': 'bg-orange-800',
        '寵物公園': 'bg-teal-800'
      };
      return map[grp] || 'bg-indigo-800';
    },
    getGroupBadgeClass(grp) {
      const map = {
        '進貨組': 'badge-blue',
        '上架組': 'badge-emerald',
        '揀出組': 'badge-amber',
        '庫存組': 'badge-purple',
        '還貨組': 'badge-rose',
        '共同科目': 'badge-orange',
        '寵物公園': 'badge-teal'
      };
      return map[grp] || 'badge-indigo';
    },
    getGroupBadgeActiveClass(grp) {
      return `${this.getGroupHeaderBgClass(grp)} text-white`;
    },
    formatNow() {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },
    getDaysSince(dateStr) {
      if (!dateStr) return null;
      const parsed = new Date(String(dateStr).replace(/-/g, '/'));
      if (isNaN(parsed.getTime())) return null;
      return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 3600 * 24)));
    },
    isEmployeeOverdue(emp) {
      if (!emp || !emp.lastUpdated) return true;
      const days = this.getDaysSince(emp.lastUpdated);
      return days === null || days >= OVERDUE_DAYS_LIMIT;
    },
    getOverdueCount(wh) {
      return (this.appData[wh]?.employees || []).filter(e => this.isEmployeeOverdue(e)).length;
    },
    getUpdateBadgeLabel(lastUpdated) {
      if (!lastUpdated) return '尚未更新';
      const days = this.getDaysSince(lastUpdated);
      if (days === null) return lastUpdated.split(' ')[0];
      if (days >= OVERDUE_DAYS_LIMIT) return `逾${days}天`;
      return days === 0 ? '今天已更' : `${days}天前`;
    },
    getUpdateBadgeClass(lastUpdated) {
      if (!lastUpdated) return 'upd-amber';
      const days = this.getDaysSince(lastUpdated);
      if (days === null || days >= OVERDUE_DAYS_LIMIT) return 'upd-rose';
      return 'upd-emerald';
    },
    getSkillCoverage(skillId) {
      const tot = this.currentEmployees.length;
      if (!tot) return { count: 0, pct: 0 };
      let count = 0;
      this.currentEmployees.forEach(e => {
        if (e.skills && e.skills[skillId] === 1) count++;
      });
      return { count, pct: Math.round((count / tot) * 100) };
    },
    isAllVisibleChecked(emp) {
      if (this.visibleSkills.length === 0) return false;
      return this.visibleSkills.every(s => emp.skills && emp.skills[s.id] === 1);
    },
    getWarehouseGroups(wh) {
      const defaults = ['進貨組', '上架組', '揀出組', '庫存組', '還貨組'];
      const set = new Set(defaults);
      (this.appData[wh]?.skills || []).forEach(s => { if (s.group) set.add(s.group); });
      (this.appData[wh]?.employees || []).forEach(e => { if (e.staffGroup) set.add(e.staffGroup); });
      return Array.from(set);
    },

    resetFocus() {
      this.focusedRowIdx = -1;
      this.focusedColIdx = -1;
    },
    switchWarehouse(wh) {
      this.flushUpdates();
      this.currentWarehouse = wh;
      this.groupFilter = 'all';
      this.staffGroupFilter = 'all';
      this.currentPage = 1;
      this.resetFocus();
    },
    setGroupFilter(grp) {
      this.groupFilter = grp;
      this.resetFocus();
    },
    setSkillFilter(val) {
      this.skillTypeFilter = val;
      this.resetFocus();
    },
    toggleFilterOverdueOnly() {
      this.updateStatusFilter = this.updateStatusFilter === 'overdue' ? 'all' : 'overdue';
      this.currentPage = 1;
      this.resetFocus();
    },

    async fetchAllData() {
      this.loading = true;
      try {
        const res = await axios.get('/api/staff-competency/all');
        if (res.data?.success && res.data.data) {
          this.appData = res.data.data;
        }
      } catch (e) {
        ElMessage.error('載入人員綜合能力資料失敗：' + e.message);
      } finally {
        this.loading = false;
      }
    },

    async syncAllToCloud(showMsg = false) {
      await this.flushUpdates();
      this.syncState = 'syncing';
      this.syncStatusText = '同步中...';
      try {
        await axios.post('/api/staff-competency/sync-all', { data: this.appData });
        this.syncState = 'synced';
        this.syncStatusText = '雲端已同步';
        if (showMsg) ElMessage.success('✅ 已將全部倉別資料寫入資料庫！');
      } catch (e) {
        this.syncState = 'error';
        this.syncStatusText = '同步失敗';
      }
    },

    async resetWarehouseSkillsToLatest() {
      await this.fetchAllData();
      ElMessage.success(`已重新整理【${this.currentWarehouse}】最新資料！`);
    },

    handleCellClick(rIdx, cIdx) {
      this.focusedRowIdx = rIdx;
      this.focusedColIdx = cIdx;
      this.toggleCell(rIdx, cIdx);
    },
    handleMatrixKeydown(e) {
      if (this.pagedRows.length === 0 || this.visibleSkills.length === 0) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (this.focusedRowIdx < 0 || this.focusedColIdx < 0) {
          this.focusedRowIdx = 0;
          this.focusedColIdx = 0;
          return;
        }
        if (e.key === 'ArrowUp') this.focusedRowIdx = Math.max(0, this.focusedRowIdx - 1);
        if (e.key === 'ArrowDown') this.focusedRowIdx = Math.min(this.pagedRows.length - 1, this.focusedRowIdx + 1);
        if (e.key === 'ArrowLeft') this.focusedColIdx = Math.max(0, this.focusedColIdx - 1);
        if (e.key === 'ArrowRight') this.focusedColIdx = Math.min(this.visibleSkills.length - 1, this.focusedColIdx + 1);
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (this.focusedRowIdx >= 0 && this.focusedColIdx >= 0) {
          e.preventDefault();
          this.toggleCell(this.focusedRowIdx, this.focusedColIdx);
        }
      }
    },
    toggleCell(rIdx, cIdx) {
      const row = this.pagedRows[rIdx];
      const skill = this.visibleSkills[cIdx];
      if (!row || !skill) return;

      const emp = row.emp;
      const newVal = emp.skills[skill.id] === 1 ? 0 : 1;
      const nowStr = this.formatNow();

      if (newVal === 1) emp.skills[skill.id] = 1;
      else delete emp.skills[skill.id];
      emp.lastUpdated = nowStr;

      this.queueUpdate(this.currentWarehouse, emp.id, skill.id, newVal, nowStr);
    },
    toggleAllSkillsForEmployee(emp) {
      if (this.visibleSkills.length === 0) return;
      const targetVal = this.isAllVisibleChecked(emp) ? 0 : 1;
      const nowStr = this.formatNow();

      this.visibleSkills.forEach(s => {
        if (targetVal === 1) emp.skills[s.id] = 1;
        else delete emp.skills[s.id];
        this.queueUpdate(this.currentWarehouse, emp.id, s.id, targetVal, nowStr);
      });
      emp.lastUpdated = nowStr;
      ElMessage.success(targetVal === 1 ? `已一鍵全勾選「${emp.name}」的 ${this.visibleSkills.length} 項能力` : `已一鍵取消「${emp.name}」的 ${this.visibleSkills.length} 項能力`);
    },

    queueUpdate(whName, empId, skillId, val, lastUpdated) {
      const idx = this.pendingUpdates.findIndex(x => x.whName === whName && x.empId === empId && x.skillId === skillId);
      if (idx !== -1) {
        this.pendingUpdates[idx].val = val;
        this.pendingUpdates[idx].lastUpdated = lastUpdated;
      } else {
        this.pendingUpdates.push({ whName, empId, skillId, val, lastUpdated });
      }
      this.syncState = 'syncing';
      this.syncStatusText = `儲存中 (${this.pendingUpdates.length})...`;
      clearTimeout(this.syncTimer);
      this.syncTimer = setTimeout(() => this.flushUpdates(), 600);
    },
    async flushUpdates() {
      if (this.pendingUpdates.length === 0) return;
      const batch = this.pendingUpdates.splice(0, this.pendingUpdates.length);
      try {
        await axios.post('/api/staff-competency/batch-toggle', { updates: batch });
        if (this.pendingUpdates.length === 0) {
          this.syncState = 'synced';
          this.syncStatusText = '雲端已同步';
        }
      } catch (e) {
        this.syncState = 'error';
        this.syncStatusText = '儲存異常';
      }
    },

    openAddEmployeeModal() {
      this.editingOriginalEmp = null;
      this.empForm = {
        warehouse: this.currentWarehouse,
        staffGroup: this.groupFilter !== 'all' ? this.groupFilter : '進貨組',
        id: '',
        name: '',
        markReviewed: true,
        skills: {}
      };
      this.showEmpModal = true;
    },
    openEditEmployeeModal(emp) {
      this.editingOriginalEmp = { warehouse: this.currentWarehouse, id: emp.id, lastUpdated: emp.lastUpdated };
      this.empForm = {
        warehouse: this.currentWarehouse,
        staffGroup: emp.staffGroup || '進貨組',
        id: emp.id,
        name: emp.name,
        markReviewed: true,
        skills: { ...(emp.skills || {}) }
      };
      this.showEmpModal = true;
    },
    toggleModalSingleSkill(skillId, checked) {
      if (checked) this.empForm.skills[skillId] = 1;
      else delete this.empForm.skills[skillId];
    },
    toggleModalSkills(targetType, checked) {
      const skills = this.appData[this.empForm.warehouse]?.skills || [];
      skills.forEach(s => {
        if (targetType === 'all' || s.type === targetType) {
          if (checked) this.empForm.skills[s.id] = 1;
          else delete this.empForm.skills[s.id];
        }
      });
    },
    async saveEmployee() {
      let cleanId = String(this.empForm.id || '').trim();
      if (/^\d{5}$/.test(cleanId)) cleanId = cleanId.padStart(6, '0');
      const cleanName = String(this.empForm.name || '').trim();
      if (!cleanId || !cleanName) {
        return ElMessage.warning('請輸入員工編號與姓名！');
      }

      const finalLastUpdated = this.empForm.markReviewed
        ? this.formatNow()
        : (this.editingOriginalEmp?.lastUpdated || '');

      const payloadEmp = {
        id: cleanId,
        name: cleanName,
        staffGroup: this.empForm.staffGroup || '一般作業組',
        lastUpdated: finalLastUpdated,
        skills: { ...this.empForm.skills }
      };

      try {
        await axios.post('/api/staff-competency/employee/save', {
          originalWarehouse: this.editingOriginalEmp?.warehouse,
          originalEmpId: this.editingOriginalEmp?.id,
          targetWarehouse: this.empForm.warehouse,
          emp: payloadEmp
        });
        this.showEmpModal = false;
        await this.fetchAllData();
        this.currentWarehouse = this.empForm.warehouse;
        ElMessage.success(`🎉 已儲存人員資料：${cleanName} (${cleanId})`);
      } catch (e) {
        ElMessage.error('儲存人員失敗：' + e.message);
      }
    },
    confirmDeleteEmployee(emp) {
      ElMessageBox.confirm(`確定要從【${this.currentWarehouse}】移除 ${emp.name} (${emp.id}) 嗎？`, '刪除人員確認', {
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        await axios.post('/api/staff-competency/employee/delete', {
          warehouse: this.currentWarehouse,
          empId: emp.id
        });
        await this.fetchAllData();
        ElMessage.success(`已移除 ${emp.name}`);
      }).catch(() => {});
    },

    openManageSkillsModal() {
      this.manageWh = this.currentWarehouse;
      this.newSkillGroup = this.groupFilter !== 'all' ? this.groupFilter : '進貨組';
      this.newSkillName = '';
      this.showSkillsModal = true;
    },
    async addNewSkill() {
      const name = this.newSkillName.trim();
      const group = this.newSkillGroup.trim() || '進貨組';
      const type = this.newSkillType;
      if (!name) return ElMessage.warning('請輸入能力名稱！');

      const subHeader = type === 'cadre' ? '幹部所需能力' : (type === 'special' ? '異動單人員' : '現場人員所需能力');
      const skill = {
        id: `${group}::${subHeader}::${name}`,
        group,
        type,
        name,
        subHeader
      };

      try {
        await axios.post('/api/staff-competency/skill/add', {
          warehouse: this.manageWh,
          skill
        });
        this.newSkillName = '';
        await this.fetchAllData();
        ElMessage.success(`已新增能力：【${this.manageWh} - ${group}】${name}`);
      } catch (e) {
        ElMessage.error('新增能力失敗：' + e.message);
      }
    },
    removeSkill(skill) {
      ElMessageBox.confirm(`確定要刪除【${this.manageWh} - ${skill.group}】的「${skill.name}」嗎？`, '刪除能力確認', {
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        await axios.post('/api/staff-competency/skill/delete', {
          warehouse: this.manageWh,
          skillId: skill.id
        });
        await this.fetchAllData();
        ElMessage.success(`已刪除能力項目：${skill.name}`);
      }).catch(() => {});
    },

    // Excel 匯入（自動建立能力表頭 + 補零 5 碼員編 + 還原大園倉組別 + 支援純人員名冊）
    async handleExcelImport(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const updatedPayload = {};
        let importedSheets = 0;

        const mapWhName = (raw) => {
          const clean = String(raw || '').replace(/\s+/g, '');
          const exact = this.warehouses.find(w => clean === w || clean.includes(w));
          if (exact) return exact;
          if (clean.includes('大園')) return '大園倉';
          if (clean.includes('林口')) return '林口倉';
          if (clean.includes('3PL一') || clean.includes('3PL1')) return '3PL一組';
          if (clean.includes('3PL二') || clean.includes('3PL2')) return '3PL二組';
          return '';
        };

        // 支援格式 B：單一工作表純人員名冊（欄位含 倉別 / 組別 / 員編 / 姓名）
        const firstSheetRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        let rosterHeaderRow = -1, whCol = -1, grpCol = -1, idCol = -1, nameCol = -1;
        for (let r = 0; r < Math.min(firstSheetRows.length, 10); r++) {
          const row = firstSheetRows[r] || [];
          row.forEach((cell, idx) => {
            const txt = String(cell || '').replace(/\s+/g, '');
            if (txt === '倉別' || txt === '倉區') whCol = idx;
            if (txt === '組別' || txt === '所屬組別' || txt === '單位') grpCol = idx;
            if (txt === '員編' || txt === '員工編號' || txt === '工號') { rosterHeaderRow = r; idCol = idx; }
            if (txt === '姓名' || txt === '員工姓名') nameCol = idx;
          });
          if (whCol !== -1 && idCol !== -1 && nameCol !== -1) break;
        }

        if (whCol !== -1 && idCol !== -1 && nameCol !== -1) {
          const groupedEmps = { '大園倉': [], '林口倉': [], '3PL一組': [], '3PL二組': [] };
          let cnt = 0;
          for (let r = rosterHeaderRow + 1; r < firstSheetRows.length; r++) {
            const row = firstSheetRows[r] || [];
            const whName = mapWhName(row[whCol]);
            let rawId = String(row[idCol] ?? '').trim();
            if (rawId.endsWith('.0')) rawId = rawId.slice(0, -2);
            if (/^\d{5}$/.test(rawId)) rawId = rawId.padStart(6, '0');
            const empName = String(row[nameCol] ?? '').trim();
            if (!whName || !rawId || !empName || rawId === '員編') continue;

            const prevEmp = (this.appData[whName]?.employees || []).find(x => x.id === rawId);
            const rawGrp = grpCol !== -1 ? String(row[grpCol] ?? '').trim() : '';
            groupedEmps[whName].push({
              id: rawId,
              name: empName,
              staffGroup: rawGrp || prevEmp?.staffGroup || '一般作業組',
              lastUpdated: prevEmp?.lastUpdated || '',
              skills: prevEmp?.skills || {}
            });
            cnt++;
          }
          if (cnt > 0) {
            Object.keys(groupedEmps).forEach(wh => {
              if (groupedEmps[wh].length > 0) updatedPayload[wh] = { employees: groupedEmps[wh] };
            });
            await axios.post('/api/staff-competency/sync-all', { data: updatedPayload });
            await this.fetchAllData();
            ElMessage.success(`🎉 成功匯入純人員名冊共 ${cnt} 筆資料（既有能力勾選已完整保留）！`);
            if (this.$refs.excelInput) this.$refs.excelInput.value = '';
            return;
          }
        }

        // 支援格式 A：四大倉別能力矩陣分頁（自動建立能力表頭＋人員勾選紀錄）
        wb.SheetNames.forEach(sheetName => {
          const matchedWh = mapWhName(sheetName);
          if (!matchedWh) return;

          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
          if (rows.length < 4) return;

          const row1 = rows[1].map(x => String(x || '').trim());
          const fCol = row1.indexOf('現場小計');
          const updCol = row1.indexOf('能力最後更新時間');
          if (fCol <= 3) return;

          const existingEmpMap = new Map((this.appData[matchedWh]?.employees || []).map(emp => [emp.id, emp]));
          const parsedSkills = [];
          const seenSkillIds = new Set();
          const colToSkillId = {};

          let actGrp = '一般作業組';
          let actSub = '現場人員所需能力';
          let actType = 'field';

          for (let c = 3; c < fCol; c++) {
            const gTxt = String(rows[0]?.[c] || '').trim();
            const sTxt = String(rows[1]?.[c] || '').trim();
            const nTxt = String(rows[2]?.[c] || '').trim();
            if (gTxt) actGrp = gTxt;
            if (sTxt) {
              actSub = sTxt;
              if (sTxt.includes('幹部') || sTxt.includes('部門管理')) actType = 'cadre';
              else if (sTxt.includes('異動')) actType = 'special';
              else actType = 'field';
            }
            if (!nTxt) continue;

            // 自動排除重複欄位 ID（同組同分類出現同名欄位則自動加編號區隔）
            let sid = `${actGrp}::${actSub}::${nTxt}`;
            let suffix = 2;
            while (seenSkillIds.has(sid)) {
              sid = `${actGrp}::${actSub}::${nTxt}(${suffix++})`;
            }
            seenSkillIds.add(sid);

            parsedSkills.push({
              id: sid,
              group: actGrp,
              type: actType,
              name: nTxt,
              subHeader: actSub
            });
            colToSkillId[c] = sid;
          }

          const newEmployees = [];
          for (let r = 3; r < rows.length; r++) {
            const row = rows[r] || [];
            let rawId = String(row[1] ?? '').trim();
            if (rawId.endsWith('.0')) rawId = rawId.slice(0, -2);
            if (/^\d{5}$/.test(rawId)) rawId = rawId.padStart(6, '0');
            const empName = String(row[2] ?? '').trim();
            if (!rawId || !empName || rawId.includes('會做人數')) continue;

            const prevEmp = existingEmpMap.get(rawId);
            const rawGrp = String(row[0] ?? '').trim();
            const staffGroup = (rawGrp && rawGrp !== '十二倉') ? rawGrp : (prevEmp?.staffGroup || '一般作業組');
            const skills = {};
            Object.entries(colToSkillId).forEach(([cStr, sid]) => {
              const v = row[Number(cStr)];
              if (v === 1 || v === '1' || v === '✓' || v === 'V' || v === true) {
                skills[sid] = 1;
              }
            });
            const lastUpdated = updCol !== -1 ? String(row[updCol] ?? '').trim() : (prevEmp?.lastUpdated || '');
            newEmployees.push({ id: rawId, name: empName, staffGroup, lastUpdated, skills });
          }

          if (parsedSkills.length > 0 || newEmployees.length > 0) {
            updatedPayload[matchedWh] = {
              skills: parsedSkills,
              employees: newEmployees
            };
            importedSheets++;
          }
        });

        if (importedSheets > 0) {
          await axios.post('/api/staff-competency/sync-all', { data: updatedPayload });
          await this.fetchAllData();
          ElMessage.success(`🎉 成功匯入並建立 ${importedSheets} 個倉別能力矩陣與人員資料！`);
        } else {
          ElMessage.warning('未識別到有效資料，請確認 Excel 包含「倉別/組別/員編/姓名」或四大倉別分頁');
        }
      } catch (err) {
        ElMessage.error('Excel 匯入失敗：' + err.message);
      } finally {
        if (this.$refs.excelInput) this.$refs.excelInput.value = '';
      }
    },

    exportToExcel() {
      const wb = XLSX.utils.book_new();
      this.warehouses.forEach(wh => {
        const whData = this.appData[wh] || { skills: [], employees: [] };
        const skills = whData.skills;
        const employees = whData.employees;

        const row1 = ['基本資料', '', ''];
        const row2 = ['組別', '員編', '姓名'];
        const row3 = ['', '', ''];

        skills.forEach(s => {
          row1.push(s.group);
          row2.push(s.subHeader || (s.type === 'cadre' ? '幹部所需能力' : (s.type === 'special' ? '異動單人員' : '現場人員所需能力')));
          row3.push(s.name);
        });

        row1.push('能力加總、排名與更新狀態', '', '', '', '', '');
        row2.push('現場小計', '異動單小計', '幹部小計', '能力總分', '排名', '能力最後更新時間');
        row3.push('', '', '', '', '', '');

        const scored = employees.map(emp => {
          let f = 0, sp = 0, ca = 0;
          skills.forEach(s => {
            if (emp.skills && emp.skills[s.id] === 1) {
              if (s.type === 'field') f++;
              else if (s.type === 'special') sp++;
              else if (s.type === 'cadre') ca++;
            }
          });
          return { emp, f, sp, ca, total: f + sp + ca };
        });

        const sortedTotals = [...scored].map(x => x.total).sort((a, b) => b - a);
        const sheetRows = [row1, row2, row3];

        scored.forEach(item => {
          const rank = sortedTotals.indexOf(item.total) + 1;
          const r = [item.emp.staffGroup || '', item.emp.id, item.emp.name];
          skills.forEach(s => r.push(item.emp.skills && item.emp.skills[s.id] === 1 ? 1 : ''));
          r.push(item.f, item.sp, item.ca, item.total, rank, item.emp.lastUpdated || '');
          sheetRows.push(r);
        });

        const ws = XLSX.utils.aoa_to_sheet(sheetRows);
        XLSX.utils.book_append_sheet(wb, ws, wh);
      });

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `人員綜合能力表_${today}.xlsx`);
      ElMessage.success('🎉 已成功匯出完整 4 倉別人員綜合能力表！');
    }
  }
}
</script>

<style scoped>
.staff-competency-light-page {
  height: calc(100vh - 52px);
  background-color: #e2e8f0;
  color: #1e293b;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
  font-family: Arial, 'Noto Sans TC', sans-serif;
}

.erp-header-bar {
  background: linear-gradient(90deg, #172554 0%, #1e3a8a 45%, #1d4ed8 100%);
  color: #ffffff;
  padding: 6px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 2px solid #0f172a;
  flex-shrink: 0;
}
.erp-brand-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.erp-logo-text {
  font-style: italic;
  font-weight: 900;
  font-size: 20px;
  letter-spacing: -0.5px;
  color: #ffffff;
}
.erp-badge {
  background: rgba(23, 37, 84, 0.85);
  border: 1px solid rgba(96, 165, 250, 0.4);
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  color: #bfdbfe;
}
.erp-divider {
  width: 1px;
  height: 16px;
  background: rgba(96, 165, 250, 0.4);
}
.erp-title {
  margin: 0;
  font-size: 14px;
  font-weight: bold;
  color: #ffffff;
}

.erp-actions-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.erp-btn {
  border: none;
  border-radius: 6px;
  padding: 5px 11px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.15s;
}
.erp-btn:hover { opacity: 0.9; }
.btn-amber { background: linear-gradient(180deg, #fbbf24, #f59e0b); color: #0f172a; border: 1px solid #fde68a; }
.btn-indigo { background: #4f46e5; color: #ffffff; border: 1px solid #818cf8; }
.btn-emerald { background: #059669; color: #ffffff; border: 1px solid #34d399; }
.btn-sky { background: #0284c7; color: #ffffff; border: 1px solid #38bdf8; }
.btn-slate { background: #334155; color: #ffffff; border: 1px solid #64748b; }
.btn-teal { background: #0d9488; color: #ffffff; border: 1px solid #2dd4bf; }

.workspace-main {
  flex: 1;
  min-height: 0;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}

.toolbar-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 6px 10px;
  flex-shrink: 0;
}
.row-between {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.wh-capsule-group {
  display: inline-flex;
  align-items: center;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  gap: 3px;
  flex-wrap: wrap;
}
.wh-capsule-btn {
  border: none;
  background: transparent;
  color: #475569;
  font-size: 12px;
  font-weight: bold;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s;
}
.wh-capsule-btn:hover { background: #ffffff; color: #0f172a; }
.wh-capsule-btn.active {
  background: linear-gradient(90deg, #2563eb, #4f46e5);
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.35);
}
.wh-num-pill {
  background: #e2e8f0;
  color: #334155;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 11px;
}
.wh-capsule-btn.active .wh-num-pill {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}
.wh-overdue-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ef4444;
}
.wh-capsule-btn.active .wh-overdue-dot { background: #fde047; }
.v-sep { width: 1px; height: 16px; background: #cbd5e1; margin: 0 2px; }

.overdue-tab-btn.overdue-active {
  background: #e11d48;
  color: #ffffff;
}
.overdue-red-pill {
  background: #ef4444;
  color: #ffffff;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 800;
}
.overdue-tab-btn.overdue-active .overdue-red-pill {
  background: #ffffff;
  color: #e11d48;
}

.kpi-frame-strip {
  display: flex;
  align-items: center;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  overflow: hidden;
  font-size: 12px;
}
.kpi-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-right: 1px solid #cbd5e1;
}
.kpi-cell:last-child { border-right: none; }
.kpi-lbl { color: #64748b; font-weight: bold; }
.kpi-val { font-weight: 900; }
.kpi-overdue-cell {
  background: #fff1f2;
  cursor: pointer;
}
.kpi-overdue-cell:hover { background: #ffe4e6; }

.overdue-alert-strip {
  background: #fff1f2;
  border: 1px solid #fda4af;
  color: #881337;
  border-radius: 8px;
  padding: 5px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}
.alert-action-btn {
  background: #e11d48;
  color: #ffffff;
  border: none;
  border-radius: 5px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
}
.alert-action-btn:hover { background: #be123c; }

.filter-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.filter-top-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.filter-controls-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.light-input, .light-select {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: bold;
  color: #334155;
  outline: none;
}
.light-input { width: 155px; }
.light-input:focus, .light-select:focus {
  border-color: #2563eb;
  background: #ffffff;
}

.seg-filter-group {
  display: inline-flex;
  background: #f1f5f9;
  padding: 2px;
  border-radius: 5px;
  border: 1px solid #cbd5e1;
}
.seg-btn {
  border: none;
  background: transparent;
  padding: 3px 9px;
  font-size: 12px;
  font-weight: bold;
  color: #475569;
  border-radius: 4px;
  cursor: pointer;
}
.seg-btn.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.kbd-guide-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #eff6ff;
  border: 1px solid #93c5fd;
  color: #1e3a8a;
  padding: 3px 10px;
  border-radius: 5px;
  font-size: 12px;
}
.kbd-title { font-weight: bold; color: #1d4ed8; }
.kbd-guide-pill kbd {
  background: #ffffff;
  border: 1px solid #93c5fd;
  border-radius: 4px;
  padding: 0 5px;
  font-weight: bold;
  font-size: 11px;
}
.kbd-active-info {
  border-left: 1px solid #93c5fd;
  padding-left: 8px;
  margin-left: 4px;
  font-weight: bold;
  color: #4338ca;
}

.group-filter-line {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;
  overflow-x: auto;
}
.gf-label { font-size: 12px; font-weight: bold; color: #475569; white-space: nowrap; }
.gf-pill {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid transparent;
}
.gf-all { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }
.gf-all-active { background: #1e293b; color: #ffffff; }

.badge-blue { background: #dbeafe; color: #1e40af; border-color: #bfdbfe; }
.badge-emerald { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
.badge-amber { background: #fef3c7; color: #92400e; border-color: #fde68a; }
.badge-purple { background: #f3e8ff; color: #6b21a8; border-color: #e9d5ff; }
.badge-rose { background: #ffe4e6; color: #9f1239; border-color: #fecdd3; }
.badge-orange { background: #ffedd5; color: #9a3412; border-color: #fed7aa; }
.badge-teal { background: #ccfbf1; color: #115e59; border-color: #99f6e4; }
.badge-indigo { background: #e0e7ff; color: #3730a3; border-color: #c7d2fe; }

.matrix-frame-box {
  flex: 1;
  min-height: 0;
  background: #ffffff;
  border: 2px solid #cbd5e1;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.matrix-scroll-area {
  flex: 1;
  overflow: auto;
  position: relative;
  outline: none;
}

.competency-matrix-table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  color: #1e293b;
}
.competency-matrix-table th, .competency-matrix-table td {
  text-align: center;
  vertical-align: middle;
}

thead th { position: sticky; z-index: 20; }
thead tr:nth-child(1) th { top: 0; height: 28px; }
thead tr:nth-child(2) th { top: 28px; height: 26px; }
thead tr:nth-child(3) th { top: 54px; height: 50px; }

.th-dark {
  background: #0f172a;
  color: #ffffff;
  font-weight: bold;
  border-right: 1px solid #475569;
  border-bottom: 1px solid #475569;
  padding: 0 6px;
}
.th-grp-banner {
  color: #ffffff;
  font-weight: bold;
  border-right: 1px solid #94a3b8;
  border-bottom: 1px solid #94a3b8;
  padding: 0 6px;
}
.bg-blue-800 { background: #1e40af; }
.bg-emerald-800 { background: #065f46; }
.bg-amber-800 { background: #92400e; }
.bg-purple-800 { background: #5b21b6; }
.bg-rose-800 { background: #9f1239; }
.bg-orange-800 { background: #9a3412; }
.bg-teal-800 { background: #115e59; }
.bg-indigo-800 { background: #3730a3; }

.th-sub-banner {
  color: #ffffff;
  font-weight: bold;
  border-right: 1px solid #94a3b8;
  border-bottom: 1px solid #94a3b8;
}
.th-sub-field { background: #075985; }
.th-sub-special { background: #b45309; }
.th-sub-cadre { background: #6b21a8; }

.skill-col-th, .skill-cell {
  width: 78px;
  min-width: 78px;
  max-width: 78px;
}
.skill-col-th {
  padding: 3px 4px;
  font-weight: bold;
  line-height: 1.25;
  word-break: break-word;
  border-right: 1px solid #cbd5e1;
  border-bottom: 2px solid #94a3b8;
}
.th-item-field { background: #e0f2fe; color: #082f49; }
.th-item-special { background: #fef3c7; color: #451a03; }
.th-item-cadre { background: #f3e8ff; color: #3b0764; }

.th-sum-field { background: #0c4a6e; color: #ffffff; min-width: 44px; border-right: 1px solid #64748b; border-bottom: 1px solid #64748b; }
.th-sum-special { background: #78350f; color: #ffffff; min-width: 44px; border-right: 1px solid #64748b; border-bottom: 1px solid #64748b; }
.th-sum-cadre { background: #581c87; color: #ffffff; min-width: 44px; border-right: 1px solid #64748b; border-bottom: 1px solid #64748b; }
.th-sum-total { background: #b45309; color: #ffffff; min-width: 46px; border-right: 1px solid #64748b; border-bottom: 1px solid #64748b; }
.th-sum-rank { background: #1e293b; color: #ffffff; min-width: 44px; border-right: 1px solid #64748b; border-bottom: 1px solid #64748b; }
.border-l-thick { border-left: 2px solid #94a3b8 !important; }

.sticky-col-1 { position: sticky; left: 0; z-index: 18; width: 76px; min-width: 76px; max-width: 76px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
.sticky-col-2 { position: sticky; left: 76px; z-index: 18; width: 76px; min-width: 76px; max-width: 76px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
.sticky-col-3 { position: sticky; left: 152px; z-index: 18; width: 80px; min-width: 80px; max-width: 80px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
.sticky-col-4 {
  position: sticky; left: 232px; z-index: 18; width: 90px; min-width: 90px; max-width: 90px;
  border-right: 2px solid #94a3b8 !important;
  border-bottom: 1px solid #cbd5e1;
  box-shadow: 2px 0 5px -2px rgba(15, 23, 42, 0.16);
}
thead .sticky-col-1, thead .sticky-col-2, thead .sticky-col-3, thead .sticky-col-4 {
  z-index: 32;
  background: #0f172a !important;
}
tbody tr.row-even td { background-color: #ffffff; }
tbody tr.row-odd td { background-color: #f8fafc; }
tbody tr:hover td { background-color: #eff6ff !important; }

.emp-grp-tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  border: 1px solid transparent;
}

.progress-wrap { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 0 4px; }
.progress-track { width: 38px; height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; border: 1px solid #cbd5e1; }
.progress-bar { height: 100%; }
.bg-emerald-500 { background: #10b981; }
.bg-indigo-500 { background: #6366f1; }
.bg-amber-500 { background: #f59e0b; }
.progress-num { font-size: 11px; font-weight: bold; color: #334155; }

.skill-cell {
  padding: 6px 2px;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
}
.cell-on-field { background-color: #ecfdf5 !important; }
.cell-on-special { background-color: #fffbeb !important; }
.cell-on-cadre { background-color: #faf5ff !important; }
.cell-focused {
  outline: 2px solid #2563eb !important;
  outline-offset: -2px;
  background-color: #dbeafe !important;
}

.skill-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 23px;
  height: 23px;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 700;
}
.skill-box-empty { border: 1px dashed #cbd5e1; color: #cbd5e1; background: #ffffff; }
.skill-box-field { background: #10b981; color: #ffffff; border: 1px solid #059669; }
.skill-box-special { background: #f59e0b; color: #ffffff; border: 1px solid #d97706; }
.skill-box-cadre { background: #7c3aed; color: #ffffff; border: 1px solid #6d28d9; }

.bg-sky-50 { background-color: #f0f9ff !important; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
.bg-amber-50 { background-color: #fffbeb !important; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
.bg-purple-50 { background-color: #faf5ff !important; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
.bg-amber-100 { background-color: #fef3c7 !important; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
.bg-slate-50 { background-color: #f8fafc !important; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }

.rank-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  font-weight: bold;
  font-size: 11px;
}
.rank-top-1 { background: #fbbf24; border-color: #f59e0b; color: #451a03; }
.rank-top-2 { background: #cbd5e1; border-color: #94a3b8; color: #1e293b; }
.rank-top-3 { background: #b45309; color: #ffffff; }

.upd-pill { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.upd-emerald { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
.upd-amber { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
.upd-rose { background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }

.op-cell { padding: 4px 6px; border-bottom: 1px solid #cbd5e1; white-space: nowrap; }
.op-icon-btn {
  border: 1px solid transparent;
  background: transparent;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.op-check { color: #059669; }
.op-check:hover { background: #ecfdf5; }
.op-edit { color: #475569; }
.op-edit:hover { background: #eff6ff; color: #2563eb; }
.op-del { color: #475569; }
.op-del:hover { background: #fef2f2; color: #dc2626; }

tfoot td {
  position: sticky;
  bottom: 0;
  z-index: 20;
  background: #e2e8f0 !important;
  border-top: 2px solid #94a3b8;
  border-right: 1px solid #cbd5e1;
  padding: 5px 4px;
  font-weight: bold;
}
.tfoot-sticky-lbl { z-index: 25; border-right: 2px solid #94a3b8 !important; }
.tfoot-pct { font-size: 11px; color: #64748b; }
.tfoot-goal-cell { color: #475569; }

.light-pagination-bar {
  background: #f1f5f9;
  border-top: 2px solid #cbd5e1;
  padding: 6px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #334155;
  flex-shrink: 0;
}
.pg-btn-group { display: flex; align-items: center; gap: 6px; }
.pg-btn {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  padding: 3px 10px;
  font-weight: bold;
  font-size: 12px;
  color: #334155;
  cursor: pointer;
}
.pg-btn:hover:not(:disabled) { background: #e2e8f0; }
.pg-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.pg-indicator {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  padding: 3px 10px;
  font-weight: bold;
}

.modal-light-body { display: flex; flex-direction: column; gap: 10px; }
.emp-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.m-lbl { display: block; font-size: 12px; font-weight: bold; margin-bottom: 4px; }
.review-banner { background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.4); padding: 6px 10px; border-radius: 6px; }
.quick-check-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.add-skill-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.modal-skills-list { max-height: 360px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.m-grp-card { border: 1px solid #334155; border-radius: 6px; padding: 8px 10px; }
.m-grp-head { font-size: 13px; font-weight: bold; color: #38bdf8; margin-bottom: 6px; border-bottom: 1px dashed #334155; padding-bottom: 4px; }
.m-grp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.m-skill-item {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #334155;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
}
.m-skill-checked { border-color: #38bdf8; background: rgba(56, 189, 248, 0.12); }
.m-tag { font-size: 10px; padding: 1px 4px; border-radius: 3px; font-weight: bold; }
.m-tag-field { background: rgba(16, 185, 129, 0.25); color: #6ee7b7; }
.m-tag-special { background: rgba(245, 158, 11, 0.25); color: #fcd34d; }
.m-tag-cadre { background: rgba(168, 85, 247, 0.25); color: #d8b4fe; }
.m-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.m-pills-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
.m-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 5px; font-size: 12px; font-weight: bold; }
.m-pill-field { background: rgba(16, 185, 129, 0.18); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); }
.m-pill-special { background: rgba(245, 158, 11, 0.18); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.4); }
.m-pill-cadre { background: rgba(168, 85, 247, 0.18); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.4); }
.m-del { cursor: pointer; }
.m-del:hover { color: #f87171; }

.empty-table-row { padding: 36px; color: #94a3b8; font-weight: bold; }
.text-slate-900 { color: #0f172a; }
.text-slate-700 { color: #334155; }
.text-emerald { color: #059669; }
.text-rose { color: #e11d48; }
.text-amber { color: #b45309; }
.text-sky-700 { color: #0369a1; }
.text-amber-700 { color: #b45309; }
.text-purple-700 { color: #6b21a8; }
.font-bold { font-weight: bold; }
.font-extrabold { font-weight: 800; }
</style>