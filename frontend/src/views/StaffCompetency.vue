<!-- frontend/src/views/StaffCompetency.vue -->
<template>
  <div class="staff-competency-dark-page">
    <input
      type="file"
      ref="excelInput"
      style="display: none;"
      accept=".xlsx, .xls, .csv"
      @change="handleExcelImport"
    />

    <!-- 1. 頂部控制列 -->
    <div class="control-header-panel">
      <!-- 第一排：左上倉別頁籤 + 中間 KPI + 右上角「地端已同步」 -->
      <div class="top-row">
        <div class="wh-tabs-group">
          <button
            type="button"
            v-for="wh in warehouses"
            :key="wh"
            class="wh-tab-btn"
            :class="{ active: currentWarehouse === wh }"
            @click="switchWarehouse(wh)"
          >
            <span>{{ getWhIcon(wh) }} {{ wh }}</span>
            <span class="wh-count-badge">{{ (appData[wh]?.employees || []).length }}</span>
            <span
              v-if="overdueCountByWh[wh] > 0"
              class="overdue-dot"
              :title="`有 ${overdueCountByWh[wh]} 位逾 30 天未更新`"
            ></span>
          </button>

          <button
            type="button"
            class="wh-tab-btn overdue-filter-btn"
            :class="{ 'overdue-active': updateStatusFilter === 'overdue' }"
            @click="toggleFilterOverdueOnly"
          >
            🔔 逾30天未更新
            <span class="overdue-pill">{{ currentOverdueCount }}</span>
          </button>
        </div>

        <div class="kpi-strip">
          <div class="kpi-chip">
            <span class="k-lbl">總人數</span>
            <span class="k-val text-blue">{{ currentEmployees.length }} 人</span>
          </div>
          <div class="kpi-chip">
            <span class="k-lbl">能力項數</span>
            <span class="k-val text-purple">{{ currentSkills.length }} 項</span>
          </div>
          <div class="kpi-chip">
            <span class="k-lbl">平均掌握度</span>
            <span class="k-val text-green">{{ avgMasteryPct }}%</span>
          </div>
          <div class="kpi-chip clickable" @click="toggleFilterOverdueOnly" title="點擊篩選逾30天未更新人員">
            <span class="k-lbl text-red">逾1月未更</span>
            <span class="k-val text-red">{{ currentOverdueCount }} 人</span>
          </div>
        </div>

        <!-- 右上角：地端已同步狀態標籤 -->
        <span class="sync-badge top-right-sync" :class="`sync-${syncState}`">{{ syncStatusText }}</span>
      </div>

      <!-- 第二排：左側 5 顆功能按鈕（向左移） + 同一排右側「逾 30 天未更新」警告橫幅 -->
      <div class="second-action-row">
        <div class="action-btns-left">
          <el-button size="mini" type="warning" icon="el-icon-plus" @click="openAddEmployeeModal">新增人員</el-button>
          <el-button size="mini" type="info" plain icon="el-icon-setting" @click="openManageSkillsModal">管理項目</el-button>
          <el-button
            v-if="canImport"
            size="mini"
            type="success"
            icon="el-icon-upload2"
            @click="triggerExcelPicker"
          >
            匯入 Excel
          </el-button>
          <el-button
            v-if="canExport"
            size="mini"
            type="primary"
            icon="el-icon-download"
            @click="exportToExcel"
          >
            匯出 Excel
          </el-button>
          <el-button size="mini" type="info" icon="el-icon-refresh" @click="resetWarehouseSkillsToLatest">重新整理</el-button>
        </div>

        <div v-if="currentOverdueCount > 0" class="overdue-banner-inline">
          <span class="overdue-txt">
            ⚠️ <strong>【{{ currentWarehouse }}】</strong>目前共有 <strong>{{ currentOverdueCount }}</strong> 位人員超過 1 個月（30 天）尚未更新能力紀錄！
          </span>
          <el-button size="mini" type="danger" plain @click="toggleFilterOverdueOnly">
            {{ updateStatusFilter === 'overdue' ? '顯示全部人員' : `只顯示逾 30 天未更新 (${currentOverdueCount}人)` }}
          </el-button>
        </div>
      </div>

      <!-- 第三排：全下拉選單篩選與搜尋列 -->
      <div class="filter-row">
        <el-input
          v-model="searchTerm"
          size="mini"
          placeholder="🔍 搜尋員編 / 姓名..."
          style="width: 155px;"
          clearable
          @input="changePage(1)"
        />

        <!-- 選擇人員組別時，自動帶出該組別的能力項目與該組班別人數 -->
        <el-select
          v-model="staffGroupFilter"
          size="mini"
          style="width: 150px;"
          @change="onStaffGroupChange"
        >
          <el-option :label="`全部人員組別 (${currentEmployees.length}人)`" value="all" />
          <el-option
            v-for="(cnt, grp) in staffGroupCounts"
            :key="grp"
            :label="`${grp} (${cnt}人)`"
            :value="grp"
          />
        </el-select>

        <el-select v-model="shiftFilter" size="mini" style="width: 128px;" @change="changePage(1)">
          <el-option :label="`全部班別 (${totalFilteredInSelectedGroup}人)`" value="all" />
          <el-option
            v-for="(cnt, sh) in shiftCounts"
            :key="sh"
            :label="`${sh} (${cnt}人)`"
            :value="sh"
          />
        </el-select>

        <el-select
          v-model="groupFilter"
          size="mini"
          style="width: 168px;"
          placeholder="選擇能力項目"
          @change="onSkillGroupChange"
        >
          <el-option :label="`全部能力項目 (${currentSkills.length}項)`" value="all" />
          <el-option
            v-for="g in orderedSkillGroups"
            :key="g"
            :label="`${g} (${skillGroupCounts[g] || 0}項)`"
            :value="g"
          />
        </el-select>

        <el-select
          v-model="skillTypeFilter"
          size="mini"
          style="width: 120px;"
          @change="resetFocus"
        >
          <el-option label="全部性質" value="all" />
          <el-option label="現場能力" value="field" />
          <el-option label="異動單人員" value="special" />
          <el-option label="幹部能力" value="cadre" />
        </el-select>

        <el-select v-model="updateStatusFilter" size="mini" style="width: 155px;" @change="changePage(1)">
          <el-option label="全部更新狀態" value="all" />
          <el-option label="逾 30 天未更新 / 未建檔" value="overdue" />
          <el-option label="30 天內已更新" value="fresh" />
        </el-select>

        <el-select v-model="sortBy" size="mini" style="width: 125px;" @change="changePage(1)">
          <el-option label="預設順序" value="default" />
          <el-option label="總分高到低" value="rankAsc" />
          <el-option label="總分低到高" value="rankDesc" />
          <el-option label="最久未更新優先" value="staleFirst" />
          <el-option label="員編順序" value="idAsc" />
        </el-select>

        <el-select v-model="pageSize" size="mini" style="width: 105px;" @change="changePage(1)">
          <el-option label="每頁 50 筆" :value="50" />
          <el-option label="每頁 100 筆" :value="100" />
          <el-option label="每頁 200 筆" :value="200" />
          <el-option label="每頁 500 筆" :value="500" />
        </el-select>

        <div class="kbd-guide">
          <span>🖱️ <strong>按住左鍵拖曳</strong>批量勾選 ｜ ⌨️ <kbd>↑↓←→</kbd>+<kbd>Space</kbd></span>
          <span v-if="activeCellText" class="active-cell-lbl">{{ activeCellText }}</span>
        </div>
      </div>
    </div>

    <!-- 2. 主能力矩陣表格區（表頭精簡為 2 層：第一層直接顯示「組別-現場人員」等合併標題） -->
    <div class="matrix-wrapper" v-loading="loading">
      <div
        class="table-scroll-container"
        ref="tableScrollContainer"
        tabindex="0"
        @keydown="handleMatrixKeydown"
      >
        <table class="competency-table">
          <thead>
            <tr>
              <th rowspan="2" class="sticky-col-1 th-base">所屬組別</th>
              <th rowspan="2" class="sticky-col-2 th-base">班別</th>
              <th rowspan="2" class="sticky-col-3 th-base">員編</th>
              <th rowspan="2" class="sticky-col-4 th-base">姓名</th>
              <th rowspan="2" class="sticky-col-5 th-base" title="僅計算該員所屬組別工作項目的完成比例">該組進度</th>
              <th rowspan="2" class="sticky-col-6 th-base" title="計算全倉所有工作項目的完成比例">全能進度</th>
              <th
                v-for="(seg, idx) in mergedHeaderSegments"
                :key="'seg_' + idx"
                :colspan="seg.count"
                class="th-merged-group"
                :class="`th-sub-${seg.type}`"
              >
                {{ seg.mergedTitle }} ({{ seg.count }})
              </th>
              <th rowspan="2" class="th-sum-field border-left-heavy">現場</th>
              <th rowspan="2" class="th-sum-special">異動</th>
              <th rowspan="2" class="th-sum-cadre">幹部</th>
              <th rowspan="2" class="th-sum-total">總分</th>
              <th rowspan="2" class="th-base">排名</th>
              <th rowspan="2" class="th-base" style="min-width: 88px;">最後更新</th>
              <th rowspan="2" class="th-base" style="min-width: 105px;">操作</th>
            </tr>

            <tr>
              <th
                v-for="s in visibleSkills"
                :key="s.id"
                class="skill-col-th"
                :class="`th-skill-${s.type}`"
                :title="`${s.group} - ${s.name}`"
              >
                {{ s.name }}
              </th>
            </tr>
          </thead>

          <tbody
            @mousedown.prevent="onTbodyMouseDown"
            @mouseover="onTbodyMouseOver"
          >
            <tr v-if="pagedRows.length === 0">
              <td :colspan="visibleSkills.length + 13" class="empty-cell">
                {{ currentEmployees.length === 0 ? '尚無人員資料，請點擊「匯入 Excel」上傳人員能力表！' : '找不到符合條件的人員資料' }}
              </td>
            </tr>
            <tr
              v-for="(row, rIdx) in pagedRows"
              :key="`${currentWarehouse}_${currentPage}_${row.emp.id}`"
              :class="rIdx % 2 === 0 ? 'row-even' : 'row-odd'"
            >
              <td class="sticky-col-1">
                <span class="staff-grp-badge">{{ row.emp.staffGroup || '未分組' }}</span>
              </td>
              <td class="sticky-col-2">
                <span v-if="row.emp.shiftName" class="shift-badge">{{ row.emp.shiftName }}</span>
                <span v-else class="text-dim" style="font-size: 11px;">-</span>
              </td>
              <td class="sticky-col-3 font-bold text-blue">{{ row.emp.id }}</td>
              <td class="sticky-col-4 font-bold">{{ row.emp.name }}</td>
              <td class="sticky-col-5">
                <div class="pct-box">
                  <div class="pct-track">
                    <div
                      class="pct-fill"
                      :class="row.groupPct === 100 ? 'fill-full' : (row.groupPct >= 60 ? 'fill-group-mid' : 'fill-group-low')"
                      :style="{ width: `${row.groupPct}%` }"
                    ></div>
                  </div>
                  <span class="pct-txt text-cyan">{{ row.groupPct }}%</span>
                </div>
              </td>
              <td class="sticky-col-6">
                <div class="pct-box">
                  <div class="pct-track">
                    <div
                      class="pct-fill"
                      :class="row.pct === 100 ? 'fill-full' : (row.pct >= 60 ? 'fill-mid' : 'fill-low')"
                      :style="{ width: `${row.pct}%` }"
                    ></div>
                  </div>
                  <span class="pct-txt">{{ row.pct }}%</span>
                </div>
              </td>

              <td
                v-for="(s, cIdx) in visibleSkills"
                :key="s.id"
                v-memo="[row.emp.id, row.emp.skills[s.id] === 1, focusedRowIdx === rIdx && focusedColIdx === cIdx]"
                :data-r="rIdx"
                :data-c="cIdx"
                class="skill-cell"
                :class="[
                  row.emp.skills[s.id] === 1 ? `cell-checked-${s.type}` : '',
                  focusedRowIdx === rIdx && focusedColIdx === cIdx ? 'cell-focused' : ''
                ]"
              >
                <span
                  class="skill-box"
                  :class="row.emp.skills[s.id] === 1 ? `box-${s.type}` : 'box-empty'"
                >
                  {{ row.emp.skills[s.id] === 1 ? '✓' : '-' }}
                </span>
              </td>

              <td class="font-bold text-blue border-left-heavy">{{ row.fieldScore }}</td>
              <td class="font-bold text-yellow">{{ row.specialScore }}</td>
              <td class="font-bold text-purple">{{ row.cadreScore }}</td>
              <td class="font-bold text-green" style="font-size: 13px;">{{ row.totalScore }}</td>
              <td>
                <span class="rank-badge" :class="row.totalScore > 0 && row.rank <= 3 ? `rank-${row.rank}` : ''">
                  {{ row.rank }}
                </span>
              </td>
              <td>
                <span class="upd-badge" :class="getUpdateBadgeClass(row.emp.lastUpdated)" :title="row.emp.lastUpdated || '尚未更新'">
                  {{ getUpdateBadgeLabel(row.emp.lastUpdated) }}
                </span>
              </td>
              <td class="row-actions-cell">
                <button
                  type="button"
                  class="mini-icon-btn btn-check-all"
                  :title="isAllVisibleChecked(row.emp) ? '一鍵取消目前篩選能力' : '一鍵全勾選目前篩選能力'"
                  @mousedown.stop
                  @click.stop="toggleAllSkillsForEmployee(row.emp)"
                >
                  ✓✓
                </button>
                <button type="button" class="mini-icon-btn btn-edit" title="編輯人員" @mousedown.stop @click.stop="openEditEmployeeModal(row.emp)">✎</button>
                <button type="button" class="mini-icon-btn btn-del" title="刪除人員" @mousedown.stop @click.stop="confirmDeleteEmployee(row.emp)">✕</button>
              </td>
            </tr>
          </tbody>

          <tfoot v-if="visibleSkills.length > 0">
            <tr>
              <td colspan="6" class="sticky-col-1 tfoot-title">各項目會做人數 / 覆蓋率</td>
              <td v-for="s in visibleSkills" :key="'foot_' + s.id" class="tfoot-cell">
                <div :class="getSkillPct(s.id) === 0 ? 'text-red' : (getSkillPct(s.id) >= 80 ? 'text-green' : 'text-yellow')">
                  {{ skillCapableCounts[s.id] || 0 }}人
                </div>
                <div class="text-dim" style="font-size: 10px;">{{ getSkillPct(s.id) }}%</div>
              </td>
              <td colspan="7" class="tfoot-goal border-left-heavy">目標：全倉全能覆蓋 100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- 底部分頁列 -->
      <div class="pagination-bar">
        <span>
          顯示第 <strong>{{ totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, totalFiltered) }}</strong> 筆，共 <strong>{{ totalFiltered }}</strong> 筆人員資料
        </span>
        <div class="page-btns">
          <button type="button" class="nav-page-btn" :disabled="currentPage <= 1" @click="changePage(1)">首頁</button>
          <button type="button" class="nav-page-btn" :disabled="currentPage <= 1" @click="changePage(currentPage - 1)">上一頁</button>
          <span class="page-indicator">第 {{ currentPage }} / {{ totalPages }} 頁</span>
          <button type="button" class="nav-page-btn" :disabled="currentPage >= totalPages" @click="changePage(currentPage + 1)">下一頁</button>
          <button type="button" class="nav-page-btn" :disabled="currentPage >= totalPages" @click="changePage(totalPages)">末頁</button>
        </div>
      </div>
    </div>

    <!-- 3. 新增 / 編輯人員 Modal -->
    <el-dialog
      v-model="showEmpModal"
      :title="editingOriginalEmp ? `編輯人員能力 - ${empForm.name} (${empForm.id})` : '新增人員與能力登記'"
      width="780px"
      top="4vh"
      append-to-body
      custom-class="dark-dialog"
    >
      <div class="emp-modal-body">
        <div class="emp-form-grid-5">
          <div>
            <label class="f-lbl">所屬倉別 *</label>
            <el-select v-model="empForm.warehouse" size="mini" style="width: 100%;">
              <el-option v-for="w in warehouses" :key="w" :label="w" :value="w" />
            </el-select>
          </div>
          <div>
            <label class="f-lbl">所屬組別 *</label>
            <el-select v-model="empForm.staffGroup" size="mini" filterable allow-create placeholder="選擇或輸入組別" style="width: 100%;">
              <el-option v-for="g in getWarehouseGroups(empForm.warehouse)" :key="g" :label="g" :value="g" />
            </el-select>
          </div>
          <div>
            <label class="f-lbl">班別</label>
            <el-select v-model="empForm.shiftName" size="mini" filterable allow-create clearable placeholder="選擇或輸入班別" style="width: 100%;">
              <el-option label="早班" value="早班" />
              <el-option label="中班" value="中班" />
              <el-option label="晚班" value="晚班" />
              <el-option label="常日班" value="常日班" />
            </el-select>
          </div>
          <div>
            <label class="f-lbl">員工編號 *</label>
            <el-input v-model="empForm.id" size="mini" placeholder="例如: 801824" />
          </div>
          <div>
            <label class="f-lbl">員工姓名 *</label>
            <el-input v-model="empForm.name" size="mini" placeholder="例如: 張紘瑋" />
          </div>
        </div>

        <div class="review-check-bar">
          <el-checkbox v-model="empForm.markReviewed">
            <span class="text-green font-bold">儲存時同時更新該員「能力最後更新時間」為現在（完成本月盤點）</span>
          </el-checkbox>
        </div>

        <div class="quick-skill-toolbar">
          <span class="font-bold text-dim">快速勾選能力：</span>
          <el-button size="mini" type="success" plain @click="toggleModalSkills('field', true)">全選現場</el-button>
          <el-button size="mini" type="warning" plain @click="toggleModalSkills('special', true)">全選異動</el-button>
          <el-button size="mini" type="primary" plain @click="toggleModalSkills('cadre', true)">全選幹部</el-button>
          <el-button size="mini" type="info" plain @click="toggleModalSkills('all', false)">全部清除</el-button>
        </div>

        <div class="modal-skills-scroll">
          <div
            v-for="grp in getWarehouseGroups(empForm.warehouse)"
            :key="grp"
            class="modal-skill-group-box"
          >
            <div class="msg-title">{{ grp }}</div>
            <div class="msg-grid">
              <label
                v-for="s in (appData[empForm.warehouse]?.skills || []).filter(x => x.group === grp)"
                :key="s.id"
                class="msg-item"
                :class="{ 'msg-checked': empForm.skills[s.id] === 1 }"
              >
                <input
                  type="checkbox"
                  :checked="empForm.skills[s.id] === 1"
                  @change="e => toggleModalSingleSkill(s.id, e.target.checked)"
                />
                <span class="msg-tag" :class="`tag-${s.type}`">
                  {{ s.type === 'cadre' ? '幹部' : (s.type === 'special' ? '異動' : '現場') }}
                </span>
                <span class="msg-name">{{ s.name }}</span>
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
      custom-class="dark-dialog"
    >
      <div class="skills-modal-body">
        <div class="add-skill-bar">
          <el-select v-model="manageWh" size="mini" style="width: 115px;">
            <el-option v-for="w in warehouses" :key="w" :label="w" :value="w" />
          </el-select>
          <el-select v-model="newSkillGroup" size="mini" filterable allow-create placeholder="選擇或輸入組別" style="width: 140px;">
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
            placeholder="輸入新能力名稱..."
            style="flex: 1;"
            @keyup.enter="addNewSkill"
          />
          <el-button size="mini" type="primary" @click="addNewSkill">新增</el-button>
        </div>

        <div class="modal-skills-scroll">
          <div
            v-for="grp in getWarehouseGroups(manageWh)"
            :key="'m_' + grp"
            class="modal-skill-group-box"
          >
            <div class="msg-title">{{ grp }}</div>
            <div class="skill-pills-wrap">
              <span
                v-for="s in (appData[manageWh]?.skills || []).filter(x => x.group === grp)"
                :key="s.id"
                class="manage-skill-pill"
                :class="`pill-${s.type}`"
              >
                <span>[{{ s.type === 'cadre' ? '幹部' : (s.type === 'special' ? '異動' : '現場') }}] {{ s.name }}</span>
                <i class="el-icon-close del-x" @click="removeSkill(s)"></i>
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
const STICKY_LEFT_TOTAL_PX = 454;

export default {
  name: 'StaffCompetency',
  props: {
    isAdmin: { type: Boolean, default: false },
    isSysAdmin: { type: Boolean, default: false }
  },
  data() {
    return {
      loading: false,
      warehouses: ['林口倉', '3PL一組', '3PL二組'],
      currentWarehouse: '林口倉',
      appData: {
        '林口倉': { skills: [], employees: [] },
        '3PL一組': { skills: [], employees: [] },
        '3PL二組': { skills: [], employees: [] }
      },
      renderTick: 0,

      searchTerm: '',
      staffGroupFilter: 'all',
      shiftFilter: 'all',
      updateStatusFilter: 'all',
      skillTypeFilter: 'all',
      groupFilter: 'all',
      sortBy: 'default',
      currentPage: 1,
      pageSize: 100,

      focusedRowIdx: -1,
      focusedColIdx: -1,

      syncState: 'synced',
      syncStatusText: '✅ 地端已同步',

      showEmpModal: false,
      editingOriginalEmp: null,
      empForm: {
        warehouse: '林口倉',
        staffGroup: '',
        shiftName: '',
        id: '',
        name: '',
        markReviewed: true,
        skills: {}
      },

      showSkillsModal: false,
      manageWh: '林口倉',
      newSkillGroup: '',
      newSkillType: 'field',
      newSkillName: ''
    }
  },
  created() {
    this._rawPendingMap = new Map();
    this._syncTimer = null;
    this._pollTimer = null;
    this._isFlushing = false;
    this._isPolling = false;
    this._localVersion = 0;

    this._isMouseDragging = false;
    this._dragTargetVal = 1;
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
    skillGroupCounts() {
      const map = {};
      this.currentSkills.forEach(s => {
        map[s.group] = (map[s.group] || 0) + 1;
      });
      return map;
    },
    staffGroupCounts() {
      const map = {};
      this.currentEmployees.forEach(e => {
        const g = e.staffGroup || '未分組';
        map[g] = (map[g] || 0) + 1;
      });
      return map;
    },
    // 依目前選取的人員組別，同步統計各班別人數
    shiftCounts() {
      const map = {};
      const targetEmps = this.staffGroupFilter === 'all'
        ? this.currentEmployees
        : this.currentEmployees.filter(e => (e.staffGroup || '未分組') === this.staffGroupFilter);

      targetEmps.forEach(e => {
        const sh = e.shiftName || '未設定班別';
        map[sh] = (map[sh] || 0) + 1;
      });
      return map;
    },
    totalFilteredInSelectedGroup() {
      return Object.values(this.shiftCounts).reduce((a, b) => a + b, 0);
    },
    overdueCountByWh() {
      void this.renderTick;
      const res = {};
      this.warehouses.forEach(wh => {
        res[wh] = (this.appData[wh]?.employees || []).filter(e => this.isEmployeeOverdue(e)).length;
      });
      return res;
    },
    currentOverdueCount() {
      return this.overdueCountByWh[this.currentWarehouse] || 0;
    },
    visibleSkills() {
      return this.currentSkills.filter(s => {
        const okType = this.skillTypeFilter === 'all' || s.type === this.skillTypeFilter;
        const okGrp = this.groupFilter === 'all' || s.group === this.groupFilter;
        return okType && okGrp;
      });
    },
    // 將原本第一列的「組別」跟第二列的「性質」合併為單一表頭：「組別-現場人員」
    mergedHeaderSegments() {
      const segs = [];
      this.visibleSkills.forEach(s => {
        const roleLabel = s.type === 'cadre'
          ? '幹部人員'
          : (s.type === 'special' ? '異動單人員' : '現場人員');
        const mergedTitle = `${s.group}-${roleLabel}`;
        const last = segs[segs.length - 1];
        if (last && last.mergedTitle === mergedTitle && last.type === s.type) {
          last.count++;
        } else {
          segs.push({ mergedTitle, type: s.type, count: 1 });
        }
      });
      return segs;
    },
    scoredRows() {
      void this.renderTick;
      const totalSkillCnt = this.currentSkills.length;
      const grpCntMap = this.skillGroupCounts;

      const rows = this.currentEmployees.map(emp => {
        const f = emp._f || 0;
        const sp = emp._sp || 0;
        const ca = emp._ca || 0;
        const totalScore = f + sp + ca;
        const pct = totalSkillCnt > 0 ? Math.round((totalScore / totalSkillCnt) * 100) : 0;

        const grpTotal = grpCntMap[emp.staffGroup] || 0;
        const grpDone = emp._grpDone || 0;
        const groupPct = grpTotal > 0 ? Math.round((grpDone / grpTotal) * 100) : 0;

        return { emp, fieldScore: f, specialScore: sp, cadreScore: ca, totalScore, pct, groupPct, rank: 1 };
      });

      const sortedScores = [...rows].map(r => r.totalScore).sort((a, b) => b - a);
      const rankLookup = new Map();
      sortedScores.forEach((sc, idx) => {
        if (!rankLookup.has(sc)) rankLookup.set(sc, idx + 1);
      });
      rows.forEach(r => {
        r.rank = rankLookup.get(r.totalScore) || 1;
      });
      return rows;
    },
    skillCapableCounts() {
      void this.renderTick;
      const counts = {};
      const emps = this.currentEmployees;
      for (let i = 0; i < emps.length; i++) {
        const sk = emps[i].skills;
        if (!sk) continue;
        for (const k in sk) {
          if (sk[k] === 1) counts[k] = (counts[k] || 0) + 1;
        }
      }
      return counts;
    },
    filteredRows() {
      const kw = this.searchTerm.trim().toLowerCase();
      let list = this.scoredRows.filter(item => {
        const okKw = !kw || item.emp.id.toLowerCase().includes(kw) || item.emp.name.toLowerCase().includes(kw);
        const okGrp = this.staffGroupFilter === 'all' || (item.emp.staffGroup || '未分組') === this.staffGroupFilter;
        const empShift = item.emp.shiftName || '未設定班別';
        const okShift = this.shiftFilter === 'all' || empShift === this.shiftFilter;
        let okUpd = true;
        if (this.updateStatusFilter === 'overdue') okUpd = this.isEmployeeOverdue(item.emp);
        else if (this.updateStatusFilter === 'fresh') okUpd = !this.isEmployeeOverdue(item.emp);
        return okKw && okGrp && okShift && okUpd;
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
      const safePage = Math.max(1, Math.min(this.currentPage, this.totalPages));
      const start = (safePage - 1) * this.pageSize;
      return this.filteredRows.slice(start, start + this.pageSize);
    },
    avgMasteryPct() {
      void this.renderTick;
      const staffCnt = this.currentEmployees.length;
      const skillCnt = this.currentSkills.length;
      if (!staffCnt || !skillCnt) return 0;
      let sumChecked = 0;
      for (let i = 0; i < staffCnt; i++) {
        const e = this.currentEmployees[i];
        sumChecked += (e._f || 0) + (e._sp || 0) + (e._ca || 0);
      }
      return Math.round((sumChecked / (staffCnt * skillCnt)) * 100);
    },
    activeCellText() {
      if (this.focusedRowIdx < 0 || this.focusedColIdx < 0) return '';
      const r = this.pagedRows[this.focusedRowIdx];
      const s = this.visibleSkills[this.focusedColIdx];
      if (!r || !s) return '';
      return `聚焦：${r.emp.name} (${r.emp.id}) ｜ ${s.group} - ${s.name}`;
    }
  },
  mounted() {
    this.fetchAllData(true);
    window.addEventListener('mouseup', this.handleGlobalMouseUp);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.startAutoSyncPoll();
  },
  beforeUnmount() {
    window.removeEventListener('mouseup', this.handleGlobalMouseUp);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.stopAutoSyncPoll();
    this.flushUpdates();
  },
  methods: {
    startAutoSyncPoll() {
      this.stopAutoSyncPoll();
      this._pollTimer = setInterval(() => {
        this.checkVersionAndSilentSync();
      }, 5000);
    },
    stopAutoSyncPoll() {
      if (this._pollTimer) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
    },
    handleVisibilityChange() {
      if (!document.hidden) {
        this.checkVersionAndSilentSync();
      }
    },
    isUserActivelyEditing() {
      return (
        this._isMouseDragging ||
        this._isFlushing ||
        (this._rawPendingMap && this._rawPendingMap.size > 0) ||
        this.showEmpModal ||
        this.showSkillsModal ||
        this.loading
      );
    },
    async checkVersionAndSilentSync() {
      if (document.hidden || this._isPolling || this.isUserActivelyEditing()) return;
      this._isPolling = true;
      try {
        const verRes = await axios.get('/api/staff-competency/version');
        const remoteVer = verRes.data?.version || 0;
        if (remoteVer && remoteVer !== this._localVersion) {
          if (this.isUserActivelyEditing()) return;
          const allRes = await axios.get('/api/staff-competency/all');
          if (allRes.data?.success && allRes.data.data && !this.isUserActivelyEditing()) {
            this.hydrateAppData(allRes.data.data);
            this._localVersion = allRes.data.version || remoteVer;
            this.syncState = 'synced';
            this.syncStatusText = '✅ 地端已同步';
          }
        }
      } catch (e) {
      } finally {
        this._isPolling = false;
      }
    },

    hydrateAppData(rawData) {
      const result = {};
      this.warehouses.forEach(wh => {
        const block = rawData?.[wh] || { skills: [], employees: [] };
        const skills = block.skills || [];
        const skillMetaMap = new Map(skills.map(s => [s.id, { type: s.type, group: s.group }]));

        const employees = (block.employees || []).map(emp => {
          const rawSkills = { ...(emp.skills || {}) };
          let f = 0, sp = 0, ca = 0, grpDone = 0;
          for (const sid in rawSkills) {
            if (rawSkills[sid] === 1) {
              const meta = skillMetaMap.get(sid);
              if (meta) {
                if (meta.type === 'field') f++;
                else if (meta.type === 'special') sp++;
                else if (meta.type === 'cadre') ca++;
                if (meta.group === emp.staffGroup) grpDone++;
              }
            }
          }
          return {
            ...emp,
            shiftName: emp.shiftName || '',
            skills: rawSkills,
            _f: f,
            _sp: sp,
            _ca: ca,
            _grpDone: grpDone
          };
        });

        result[wh] = { skills, employees };
      });
      this.appData = result;
      this.renderTick++;
    },

    getWhIcon(wh) {
      if (wh === '林口倉') return '🏢';
      if (wh === '3PL一組') return '📦';
      return '🚚';
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
    getUpdateBadgeLabel(lastUpdated) {
      if (!lastUpdated) return '尚未更新';
      const days = this.getDaysSince(lastUpdated);
      if (days === null) return lastUpdated.split(' ')[0];
      if (days >= OVERDUE_DAYS_LIMIT) return `逾${days}天`;
      return days === 0 ? '今天已更' : `${days}天前`;
    },
    getUpdateBadgeClass(lastUpdated) {
      if (!lastUpdated) return 'upd-warn';
      const days = this.getDaysSince(lastUpdated);
      if (days === null || days >= OVERDUE_DAYS_LIMIT) return 'upd-danger';
      return 'upd-ok';
    },
    getSkillPct(skillId) {
      const tot = this.currentEmployees.length;
      if (!tot) return 0;
      const cnt = this.skillCapableCounts[skillId] || 0;
      return Math.round((cnt / tot) * 100);
    },
    isAllVisibleChecked(emp) {
      if (this.visibleSkills.length === 0) return false;
      return this.visibleSkills.every(s => emp.skills && emp.skills[s.id] === 1);
    },
    getWarehouseGroups(wh) {
      const set = new Set();
      (this.appData[wh]?.skills || []).forEach(s => { if (s.group) set.add(s.group); });
      (this.appData[wh]?.employees || []).forEach(e => { if (e.staffGroup) set.add(e.staffGroup); });
      return Array.from(set);
    },

    resetFocus() {
      this.focusedRowIdx = -1;
      this.focusedColIdx = -1;
    },
    changePage(targetPage) {
      const clamped = Math.max(1, Math.min(targetPage, this.totalPages));
      this.currentPage = clamped;
      this.resetFocus();
      this.$nextTick(() => {
        const container = this.$refs.tableScrollContainer;
        if (container) {
          container.scrollTop = 0;
          container.focus();
        }
      });
    },
    switchWarehouse(wh) {
      this.flushUpdates();
      this.currentWarehouse = wh;
      this.groupFilter = 'all';
      this.staffGroupFilter = 'all';
      this.shiftFilter = 'all';
      this.changePage(1);
    },
    onStaffGroupChange(grp) {
      if (grp === 'all') {
        this.groupFilter = 'all';
      } else if (this.skillGroupCounts[grp]) {
        this.groupFilter = grp;
      } else {
        this.groupFilter = 'all';
      }

      if (this.shiftFilter !== 'all') {
        const hasShiftInGroup = this.currentEmployees.some(e => {
          const okGrp = grp === 'all' || (e.staffGroup || '未分組') === grp;
          return okGrp && (e.shiftName || '未設定班別') === this.shiftFilter;
        });
        if (!hasShiftInGroup) {
          this.shiftFilter = 'all';
        }
      }

      this.changePage(1);
    },
    onSkillGroupChange() {
      this.resetFocus();
    },
    toggleFilterOverdueOnly() {
      this.updateStatusFilter = this.updateStatusFilter === 'overdue' ? 'all' : 'overdue';
      this.changePage(1);
    },

    triggerExcelPicker() {
      if (this.$refs.excelInput) {
        this.$refs.excelInput.value = '';
        this.$refs.excelInput.click();
      }
    },

    async fetchAllData(showSpinner = true) {
      if (showSpinner) this.loading = true;
      try {
        const res = await axios.get('/api/staff-competency/all');
        if (res.data?.success && res.data.data) {
          this.hydrateAppData(res.data.data);
          if (res.data.version) this._localVersion = res.data.version;
        }
      } catch (e) {
        ElMessage.error('載入人員綜合能力資料失敗：' + e.message);
      } finally {
        if (showSpinner) this.loading = false;
      }
    },

    async resetWarehouseSkillsToLatest() {
      await this.fetchAllData(true);
      ElMessage.success(`已重新整理【${this.currentWarehouse}】最新資料！`);
    },

    ensureFocusedCellVisible() {
      this.$nextTick(() => {
        const container = this.$refs.tableScrollContainer;
        if (!container || this.focusedRowIdx < 0 || this.focusedColIdx < 0) return;

        const cell = container.querySelector(
          `tbody td.skill-cell[data-r="${this.focusedRowIdx}"][data-c="${this.focusedColIdx}"]`
        );
        if (!cell) return;

        const cellLeft = cell.offsetLeft;
        const cellRight = cellLeft + cell.offsetWidth;
        const viewLeft = container.scrollLeft + STICKY_LEFT_TOTAL_PX;
        const viewRight = container.scrollLeft + container.clientWidth - 16;

        if (cellLeft < viewLeft) {
          container.scrollLeft = Math.max(0, cellLeft - STICKY_LEFT_TOTAL_PX - 8);
        } else if (cellRight > viewRight) {
          container.scrollLeft = cellRight - container.clientWidth + 24;
        }

        const stickyTopHeight = 76;
        const stickyBottomHeight = 40;
        const cellTop = cell.offsetTop;
        const cellBottom = cellTop + cell.offsetHeight;
        const viewTop = container.scrollTop + stickyTopHeight;
        const viewBottom = container.scrollTop + container.clientHeight - stickyBottomHeight;

        if (cellTop < viewTop) {
          container.scrollTop = Math.max(0, cellTop - stickyTopHeight - 8);
        } else if (cellBottom > viewBottom) {
          container.scrollTop = cellBottom - container.clientHeight + stickyBottomHeight + 8;
        }
      });
    },

    onTbodyMouseDown(e) {
      if (e.button !== 0) return;
      const td = e.target.closest('td.skill-cell');
      if (!td) return;
      const rIdx = Number(td.dataset.r);
      const cIdx = Number(td.dataset.c);
      if (isNaN(rIdx) || isNaN(cIdx)) return;

      const row = this.pagedRows[rIdx];
      const skill = this.visibleSkills[cIdx];
      if (!row || !skill) return;

      const curVal = row.emp.skills?.[skill.id] === 1 ? 1 : 0;
      const targetVal = curVal === 1 ? 0 : 1;

      this._isMouseDragging = true;
      this._dragTargetVal = targetVal;
      this.focusedRowIdx = rIdx;
      this.focusedColIdx = cIdx;
      this.setCellExplicitValue(rIdx, cIdx, targetVal);

      if (this.$refs.tableScrollContainer) {
        this.$refs.tableScrollContainer.focus({ preventScroll: true });
      }
    },

    onTbodyMouseOver(e) {
      if (!this._isMouseDragging) return;
      const td = e.target.closest('td.skill-cell');
      if (!td) return;
      const rIdx = Number(td.dataset.r);
      const cIdx = Number(td.dataset.c);
      if (isNaN(rIdx) || isNaN(cIdx)) return;

      this.focusedRowIdx = rIdx;
      this.focusedColIdx = cIdx;
      this.setCellExplicitValue(rIdx, cIdx, this._dragTargetVal);
    },

    handleGlobalMouseUp() {
      this._isMouseDragging = false;
    },

    handleMatrixKeydown(e) {
      if (this.pagedRows.length === 0 || this.visibleSkills.length === 0) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (this.focusedRowIdx < 0 || this.focusedColIdx < 0) {
          this.focusedRowIdx = 0;
          this.focusedColIdx = 0;
          this.ensureFocusedCellVisible();
          return;
        }
        if (e.key === 'ArrowUp') this.focusedRowIdx = Math.max(0, this.focusedRowIdx - 1);
        if (e.key === 'ArrowDown') this.focusedRowIdx = Math.min(this.pagedRows.length - 1, this.focusedRowIdx + 1);
        if (e.key === 'ArrowLeft') this.focusedColIdx = Math.max(0, this.focusedColIdx - 1);
        if (e.key === 'ArrowRight') this.focusedColIdx = Math.min(this.visibleSkills.length - 1, this.focusedColIdx + 1);
        this.ensureFocusedCellVisible();
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (this.focusedRowIdx >= 0 && this.focusedColIdx >= 0) {
          e.preventDefault();
          this.toggleCell(this.focusedRowIdx, this.focusedColIdx);
        }
      }
    },

    setCellExplicitValue(rIdx, cIdx, targetVal) {
      const row = this.pagedRows[rIdx];
      const skill = this.visibleSkills[cIdx];
      if (!row || !skill) return;

      const emp = row.emp;
      if (!emp.skills) emp.skills = {};
      const curVal = emp.skills[skill.id] === 1 ? 1 : 0;
      if (curVal === targetVal) return;

      const delta = targetVal === 1 ? 1 : -1;
      const nowStr = this.formatNow();

      if (targetVal === 1) emp.skills[skill.id] = 1;
      else delete emp.skills[skill.id];

      if (skill.type === 'field') emp._f = Math.max(0, (emp._f || 0) + delta);
      else if (skill.type === 'special') emp._sp = Math.max(0, (emp._sp || 0) + delta);
      else if (skill.type === 'cadre') emp._ca = Math.max(0, (emp._ca || 0) + delta);

      if (skill.group === emp.staffGroup) {
        emp._grpDone = Math.max(0, (emp._grpDone || 0) + delta);
      }

      emp.lastUpdated = nowStr;
      this.renderTick++;

      this.queueUpdate(this.currentWarehouse, emp.id, skill.id, targetVal, nowStr);
    },

    toggleCell(rIdx, cIdx) {
      const row = this.pagedRows[rIdx];
      const skill = this.visibleSkills[cIdx];
      if (!row || !skill) return;
      const newVal = row.emp.skills?.[skill.id] === 1 ? 0 : 1;
      this.setCellExplicitValue(rIdx, cIdx, newVal);
    },

    toggleAllSkillsForEmployee(emp) {
      if (this.visibleSkills.length === 0) return;
      if (!emp.skills) emp.skills = {};
      const targetVal = this.isAllVisibleChecked(emp) ? 0 : 1;
      const nowStr = this.formatNow();

      this.visibleSkills.forEach(s => {
        const wasChecked = emp.skills[s.id] === 1;
        if (targetVal === 1 && !wasChecked) {
          emp.skills[s.id] = 1;
          if (s.type === 'field') emp._f = (emp._f || 0) + 1;
          else if (s.type === 'special') emp._sp = (emp._sp || 0) + 1;
          else if (s.type === 'cadre') emp._ca = (emp._ca || 0) + 1;
          if (s.group === emp.staffGroup) emp._grpDone = (emp._grpDone || 0) + 1;
          this.queueUpdate(this.currentWarehouse, emp.id, s.id, 1, nowStr);
        } else if (targetVal === 0 && wasChecked) {
          delete emp.skills[s.id];
          if (s.type === 'field') emp._f = Math.max(0, (emp._f || 0) - 1);
          else if (s.type === 'special') emp._sp = Math.max(0, (emp._sp || 0) - 1);
          else if (s.type === 'cadre') emp._ca = Math.max(0, (emp._ca || 0) - 1);
          if (s.group === emp.staffGroup) emp._grpDone = Math.max(0, (emp._grpDone || 0) - 1);
          this.queueUpdate(this.currentWarehouse, emp.id, s.id, 0, nowStr);
        }
      });
      emp.lastUpdated = nowStr;
      this.renderTick++;
      ElMessage.success(targetVal === 1 ? `已全勾選「${emp.name}」目前顯示能力` : `已取消「${emp.name}」目前顯示能力`);
    },

    queueUpdate(whName, empId, skillId, val, lastUpdated) {
      const key = `${whName}|||${empId}|||${skillId}`;
      this._rawPendingMap.set(key, { whName, empId, skillId, val, lastUpdated });

      clearTimeout(this._syncTimer);
      this._syncTimer = setTimeout(() => this.flushUpdates(), 1200);
    },
    async flushUpdates() {
      if (!this._rawPendingMap || this._rawPendingMap.size === 0) return;
      const batch = Array.from(this._rawPendingMap.values());
      this._rawPendingMap.clear();
      this._isFlushing = true;

      this.syncState = 'syncing';
      this.syncStatusText = '⏳ 同步寫入中...';

      try {
        const res = await axios.post('/api/staff-competency/batch-toggle', { updates: batch });
        if (res.data?.version) {
          this._localVersion = res.data.version;
        }
        if (this._rawPendingMap.size === 0) {
          this.syncState = 'synced';
          this.syncStatusText = '✅ 地端已同步';
        }
      } catch (e) {
        batch.forEach(item => {
          const key = `${item.whName}|||${item.empId}|||${item.skillId}`;
          if (!this._rawPendingMap.has(key)) {
            this._rawPendingMap.set(key, item);
          }
        });
        this.syncState = 'error';
        this.syncStatusText = '⚠️ 同步重試中';
      } finally {
        this._isFlushing = false;
      }
    },

    openAddEmployeeModal() {
      const existingGroups = this.getWarehouseGroups(this.currentWarehouse);
      this.editingOriginalEmp = null;
      this.empForm = {
        warehouse: this.currentWarehouse,
        staffGroup: this.staffGroupFilter !== 'all' ? this.staffGroupFilter : (existingGroups[0] || ''),
        shiftName: '',
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
        staffGroup: emp.staffGroup || '',
        shiftName: emp.shiftName || '',
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
        staffGroup: String(this.empForm.staffGroup || '未分組').trim(),
        shiftName: String(this.empForm.shiftName || '').trim(),
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
        await this.fetchAllData(true);
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
        await this.fetchAllData(true);
        ElMessage.success(`已移除 ${emp.name}`);
      }).catch(() => {});
    },

    openManageSkillsModal() {
      const existingGroups = this.getWarehouseGroups(this.currentWarehouse);
      this.manageWh = this.currentWarehouse;
      this.newSkillGroup = this.groupFilter !== 'all' ? this.groupFilter : (existingGroups[0] || '');
      this.newSkillName = '';
      this.showSkillsModal = true;
    },
    async addNewSkill() {
      const name = this.newSkillName.trim();
      const group = this.newSkillGroup.trim();
      const type = this.newSkillType;
      if (!group) return ElMessage.warning('請選擇或輸入作業組別！');
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
        await this.fetchAllData(true);
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
        await this.fetchAllData(true);
        ElMessage.success(`已刪除能力項目：${skill.name}`);
      }).catch(() => {});
    },

    async handleExcelImport(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      this.loading = true;
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const updatedPayload = {};
        let importedSheets = 0;

        const mapWhName = (raw) => {
          const clean = String(raw || '').replace(/\s+/g, '');
          const exact = this.warehouses.find(w => clean === w || clean.includes(w));
          if (exact) return exact;
          if (clean.includes('林口')) return '林口倉';
          if (clean.includes('3PL一') || clean.includes('3PL1')) return '3PL一組';
          if (clean.includes('3PL二') || clean.includes('3PL2')) return '3PL二組';
          return '';
        };

        const firstSheetRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        let rosterHeaderRow = -1, whCol = -1, grpCol = -1, shiftCol = -1, idCol = -1, nameCol = -1;
        for (let r = 0; r < Math.min(firstSheetRows.length, 10); r++) {
          const row = firstSheetRows[r] || [];
          row.forEach((cell, idx) => {
            const txt = String(cell || '').replace(/\s+/g, '');
            if (txt === '倉別' || txt === '倉區') whCol = idx;
            if (txt === '組別' || txt === '所屬組別' || txt === '單位') grpCol = idx;
            if (txt === '班別' || txt === '班次') shiftCol = idx;
            if (txt === '員編' || txt === '員工編號' || txt === '工號') { rosterHeaderRow = r; idCol = idx; }
            if (txt === '姓名' || txt === '員工姓名') nameCol = idx;
          });
          if (whCol !== -1 && idCol !== -1 && nameCol !== -1) break;
        }

        if (whCol !== -1 && idCol !== -1 && nameCol !== -1) {
          const groupedEmps = { '林口倉': [], '3PL一組': [], '3PL二組': [] };
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
            const rawShift = shiftCol !== -1 ? String(row[shiftCol] ?? '').trim() : '';
            groupedEmps[whName].push({
              id: rawId,
              name: empName,
              staffGroup: rawGrp || prevEmp?.staffGroup || '未分組',
              shiftName: rawShift || prevEmp?.shiftName || '',
              lastUpdated: prevEmp?.lastUpdated || '',
              skills: prevEmp?.skills || {}
            });
            cnt++;
          }
          if (cnt > 0) {
            Object.keys(groupedEmps).forEach(wh => {
              if (groupedEmps[wh].length > 0) updatedPayload[wh] = { employees: groupedEmps[wh] };
            });
            const res = await axios.post('/api/staff-competency/sync-all', { data: updatedPayload });
            if (res.data?.version) this._localVersion = res.data.version;
            if (res.data?.data) {
              this.hydrateAppData(res.data.data);
            } else {
              const merged = { ...this.appData };
              Object.keys(updatedPayload).forEach(wh => {
                if (updatedPayload[wh].employees) merged[wh].employees = updatedPayload[wh].employees;
              });
              this.hydrateAppData(merged);
            }
            this.syncState = 'synced';
            this.syncStatusText = '✅ 地端已同步';
            ElMessage.success(res.data?.message || `🎉 成功匯入純人員名冊共 ${cnt} 筆資料！`);
            return;
          }
        }

        wb.SheetNames.forEach(sheetName => {
          const matchedWh = mapWhName(sheetName);
          if (!matchedWh) return;

          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
          if (rows.length < 4) return;

          const row1 = (rows[1] || []).map(x => String(x || '').replace(/\s+/g, ''));
          const hasShiftCol = row1[1] === '班別';
          const idColIdx = hasShiftCol ? 2 : 1;
          const nameColIdx = hasShiftCol ? 3 : 2;
          const skillStartCol = hasShiftCol ? 4 : 3;

          let fCol = row1.findIndex(x => x === '現場小計' || x === '能力總分' || x === '現場');
          if (fCol <= skillStartCol) fCol = rows[2].length;
          const updCol = row1.findIndex(x => x.includes('最後更新'));

          const existingEmpMap = new Map((this.appData[matchedWh]?.employees || []).map(emp => [emp.id, emp]));
          const parsedSkills = [];
          const seenSkillIds = new Set();
          const colToSkillId = {};

          let actGrp = '未分組';
          let actSub = '現場人員所需能力';
          let actType = 'field';

          for (let c = skillStartCol; c < fCol; c++) {
            const gTxt = String(rows[0]?.[c] || '').trim();
            const sTxt = String(rows[1]?.[c] || '').trim();
            const nTxt = String(rows[2]?.[c] || '').trim();
            if (gTxt && !gTxt.includes('加總')) actGrp = gTxt;
            if (sTxt) {
              actSub = sTxt;
              if (sTxt.includes('幹部') || sTxt.includes('部門管理')) actType = 'cadre';
              else if (sTxt.includes('異動')) actType = 'special';
              else actType = 'field';
            }
            if (!nTxt) continue;

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
            let rawId = String(row[idColIdx] ?? '').trim();
            if (rawId.endsWith('.0')) rawId = rawId.slice(0, -2);
            if (/^\d{5}$/.test(rawId)) rawId = rawId.padStart(6, '0');
            const empName = String(row[nameColIdx] ?? '').trim();
            if (!rawId || !empName || rawId.includes('會做人數')) continue;

            const prevEmp = existingEmpMap.get(rawId);
            const rawGrp = String(row[0] ?? '').trim();
            const staffGroup = (rawGrp && rawGrp !== '十二倉') ? rawGrp : (prevEmp?.staffGroup || '未分組');
            const shiftName = hasShiftCol ? String(row[1] ?? '').trim() : (prevEmp?.shiftName || '');
            const skills = {};
            Object.entries(colToSkillId).forEach(([cStr, sid]) => {
              const v = row[Number(cStr)];
              if (v === 1 || v === '1' || v === '✓' || v === 'V' || v === true) {
                skills[sid] = 1;
              }
            });
            const lastUpdated = updCol !== -1 ? String(row[updCol] ?? '').trim() : (prevEmp?.lastUpdated || '');
            newEmployees.push({ id: rawId, name: empName, staffGroup, shiftName, lastUpdated, skills });
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
          const res = await axios.post('/api/staff-competency/sync-all', { data: updatedPayload });
          if (res.data?.version) this._localVersion = res.data.version;
          if (res.data?.data) {
            this.hydrateAppData(res.data.data);
          } else {
            const merged = { ...this.appData };
            Object.keys(updatedPayload).forEach(wh => {
              if (updatedPayload[wh].skills) merged[wh].skills = updatedPayload[wh].skills;
              if (updatedPayload[wh].employees) merged[wh].employees = updatedPayload[wh].employees;
            });
            this.hydrateAppData(merged);
          }
          this.syncState = 'synced';
          this.syncStatusText = '✅ 地端已同步';
          ElMessage.success(res.data?.message || `🎉 成功匯入 ${importedSheets} 個倉別能力矩陣與人員資料！`);
        } else {
          ElMessage.warning('未識別到有效資料，請確認 Excel 包含「倉別/組別/員編/姓名」或林口倉/3PL一組/3PL二組分頁');
        }
      } catch (err) {
        ElMessage.error('Excel 匯入失敗：' + err.message);
      } finally {
        this.loading = false;
        if (this.$refs.excelInput) this.$refs.excelInput.value = '';
      }
    },

    exportToExcel() {
      const wb = XLSX.utils.book_new();
      this.warehouses.forEach(wh => {
        const whData = this.appData[wh] || { skills: [], employees: [] };
        const skills = whData.skills;
        const employees = whData.employees;

        const row1 = ['基本資料', '', '', ''];
        const row2 = ['組別', '班別', '員編', '姓名'];
        const row3 = ['', '', '', ''];

        skills.forEach(s => {
          row1.push(s.group);
          row2.push(s.subHeader || (s.type === 'cadre' ? '幹部所需能力' : (s.type === 'special' ? '異動單人員' : '現場人員所需能力')));
          row3.push(s.name);
        });

        row1.push('能力加總、排名與更新狀態', '', '', '', '', '');
        row2.push('現場小計', '異動單小計', '幹部小計', '能力總分', '排名', '能力最後更新時間');
        row3.push('', '', '', '', '', '');

        const scored = employees.map(emp => ({
          emp,
          f: emp._f || 0,
          sp: emp._sp || 0,
          ca: emp._ca || 0,
          total: (emp._f || 0) + (emp._sp || 0) + (emp._ca || 0)
        }));

        const sortedTotals = [...scored].map(x => x.total).sort((a, b) => b - a);
        const sheetRows = [row1, row2, row3];

        scored.forEach(item => {
          const rank = sortedTotals.indexOf(item.total) + 1;
          const r = [item.emp.staffGroup || '', item.emp.shiftName || '', item.emp.id, item.emp.name];
          skills.forEach(s => r.push(item.emp.skills && item.emp.skills[s.id] === 1 ? 1 : ''));
          r.push(item.f, item.sp, item.ca, item.total, rank, item.emp.lastUpdated || '');
          sheetRows.push(r);
        });

        const ws = XLSX.utils.aoa_to_sheet(sheetRows);
        XLSX.utils.book_append_sheet(wb, ws, wh);
      });

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `人員綜合能力表_${today}.xlsx`);
      ElMessage.success('🎉 已成功匯出人員綜合能力表！');
    }
  }
}
</script>

<style scoped>
.staff-competency-dark-page {
  padding: 8px 12px 10px 12px;
  height: calc(100vh - 52px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #0b1120;
  color: #f8fafc;
  overflow: hidden;
  user-select: none;
}

.control-header-panel {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 8px 10px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

/* 第一排：倉別頁籤 + KPI + 右上角地端已同步 */
.top-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.wh-tabs-group {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #0f172a;
  padding: 3px;
  border-radius: 6px;
  border: 1px solid #334155;
}
.wh-tab-btn {
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: bold;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.wh-tab-btn:hover { background: rgba(255, 255, 255, 0.06); color: #ffffff; }
.wh-tab-btn.active {
  background: linear-gradient(90deg, #2563eb, #4f46e5);
  color: #ffffff;
}
.wh-count-badge {
  background: rgba(255, 255, 255, 0.15);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
}
.overdue-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f87171;
}
.overdue-filter-btn.overdue-active {
  background: #dc2626;
  color: #ffffff;
}
.overdue-pill {
  background: #ef4444;
  color: #ffffff;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
}

.kpi-strip {
  display: flex;
  align-items: center;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  overflow: hidden;
}
.kpi-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-right: 1px solid #334155;
  font-size: 12px;
}
.kpi-chip:last-child { border-right: none; }
.kpi-chip.clickable { cursor: pointer; }
.kpi-chip.clickable:hover { background: rgba(248, 113, 113, 0.12); }
.k-lbl { color: #94a3b8; }
.k-val { font-weight: bold; }

/* 右上角：地端已同步 */
.top-right-sync {
  margin-left: auto;
}
.sync-badge {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 5px;
  font-weight: bold;
  white-space: nowrap;
}
.sync-synced { background: rgba(74, 222, 128, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); }
.sync-syncing { background: rgba(250, 204, 21, 0.15); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.3); }
.sync-error { background: rgba(248, 113, 113, 0.15); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); }

/* 第二排：左側 5 顆功能按鈕 + 同一排右側逾 30 天未更新橫幅 */
.second-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.action-btns-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.action-btns-left .el-button {
  margin-left: 0 !important;
}
.overdue-banner-inline {
  flex: 1;
  min-width: 360px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.45);
  color: #fca5a5;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
}
.overdue-txt {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.kbd-guide {
  margin-left: auto;
  font-size: 11px;
  color: #7dd3fc;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 3px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.kbd-guide kbd {
  background: #0f172a;
  border: 1px solid #38bdf8;
  padding: 0 4px;
  border-radius: 3px;
  color: #facc15;
}
.active-cell-lbl {
  color: #facc15;
  font-weight: bold;
  border-left: 1px solid #334155;
  padding-left: 8px;
}

/* 黑底矩陣表格區（表頭精簡為 2 層） */
.matrix-wrapper {
  flex: 1;
  min-height: 0;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  contain: layout style;
}
.table-scroll-container {
  flex: 1;
  overflow: auto;
  position: relative;
  outline: none;
  will-change: scroll-position;
}

.competency-table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  color: #f8fafc;
}
.competency-table th, .competency-table td {
  border-right: 1px solid #334155;
  border-bottom: 1px solid #334155;
  text-align: center;
  vertical-align: middle;
}

thead th { position: sticky; z-index: 20; }
thead tr:nth-child(1) th { top: 0; height: 28px; }
thead tr:nth-child(2) th { top: 28px; height: 48px; }

.th-base { background: #0f172a; color: #cbd5e1; font-weight: bold; padding: 0 6px; }
.th-merged-group {
  color: #ffffff;
  font-weight: bold;
  padding: 0 8px;
  font-size: 12px;
  letter-spacing: 0.3px;
}

.th-sub-field { background: #075985; color: #e0f2fe; }
.th-sub-special { background: #b45309; color: #fef3c7; }
.th-sub-cadre { background: #6b21a8; color: #f3e8ff; }

.skill-col-th, .skill-cell {
  width: 76px;
  min-width: 76px;
  max-width: 76px;
  contain: content;
}
.skill-col-th {
  padding: 4px 3px;
  line-height: 1.25;
  font-size: 11px;
  word-break: break-word;
}
.th-skill-field { background: #0c4a6e; color: #bae6fd; }
.th-skill-special { background: #78350f; color: #fde68a; }
.th-skill-cadre { background: #4c1d95; color: #e9d5ff; }

.th-sum-field { background: #0c4a6e; color: #38bdf8; min-width: 44px; }
.th-sum-special { background: #78350f; color: #facc15; min-width: 44px; }
.th-sum-cadre { background: #4c1d95; color: #c084fc; min-width: 44px; }
.th-sum-total { background: #064e3b; color: #4ade80; min-width: 46px; }
.border-left-heavy { border-left: 2px solid #64748b !important; }

/* 左側 6 欄凍結（組別74 + 班別64 + 員編72 + 姓名76 + 該組進度84 + 全能進度84 = 454px） */
.sticky-col-1 { position: sticky; left: 0; z-index: 15; width: 74px; min-width: 74px; max-width: 74px; }
.sticky-col-2 { position: sticky; left: 74px; z-index: 15; width: 64px; min-width: 64px; max-width: 64px; }
.sticky-col-3 { position: sticky; left: 138px; z-index: 15; width: 72px; min-width: 72px; max-width: 72px; }
.sticky-col-4 { position: sticky; left: 210px; z-index: 15; width: 76px; min-width: 76px; max-width: 76px; }
.sticky-col-5 { position: sticky; left: 286px; z-index: 15; width: 84px; min-width: 84px; max-width: 84px; }
.sticky-col-6 {
  position: sticky; left: 370px; z-index: 15; width: 84px; min-width: 84px; max-width: 84px;
  border-right: 2px solid #64748b !important;
}
thead .sticky-col-1, thead .sticky-col-2, thead .sticky-col-3,
thead .sticky-col-4, thead .sticky-col-5, thead .sticky-col-6 {
  z-index: 30;
  background: #0f172a !important;
}
tbody tr.row-even td { background: #0f172a; }
tbody tr.row-odd td { background: #131c31; }
tbody tr:hover td { background: #1e293b !important; }

.staff-grp-badge {
  background: rgba(56, 189, 248, 0.15);
  color: #7dd3fc;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
}
.shift-badge {
  background: rgba(250, 204, 21, 0.16);
  color: #fde047;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
}

.pct-box { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 0 3px; }
.pct-track { width: 36px; height: 7px; background: #334155; border-radius: 4px; overflow: hidden; }
.pct-fill { height: 100%; }
.fill-low { background: #f59e0b; }
.fill-mid { background: #38bdf8; }
.fill-group-low { background: #06b6d4; }
.fill-group-mid { background: #22d3ee; }
.fill-full { background: #4ade80; }
.pct-txt { font-size: 11px; font-weight: bold; color: #cbd5e1; }
.text-cyan { color: #22d3ee !important; }

.skill-cell { cursor: pointer; padding: 5px 2px; }
.cell-checked-field { background: #0f2922 !important; }
.cell-checked-special { background: #261d0f !important; }
.cell-checked-cadre { background: #1f1633 !important; }
.cell-focused { outline: 2px solid #38bdf8 !important; outline-offset: -2px; }

.skill-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 12px;
  pointer-events: none;
}
.box-empty { border: 1px dashed #475569; color: #475569; }
.box-field { background: #10b981; color: #ffffff; }
.box-special { background: #f59e0b; color: #0f172a; }
.box-cadre { background: #8b5cf6; color: #ffffff; }

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #334155;
  color: #cbd5e1;
  font-weight: bold;
  font-size: 11px;
}
.rank-1 { background: #facc15; color: #0f172a; }
.rank-2 { background: #cbd5e1; color: #0f172a; }
.rank-3 { background: #d97706; color: #ffffff; }

.upd-badge { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.upd-ok { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
.upd-warn { background: rgba(250, 204, 21, 0.15); color: #facc15; }
.upd-danger { background: rgba(248, 113, 113, 0.2); color: #f87171; }

.row-actions-cell { padding: 4px 6px; white-space: nowrap; }
.mini-icon-btn {
  background: #1e293b;
  border: 1px solid #475569;
  color: #cbd5e1;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  margin: 0 2px;
}
.btn-check-all:hover { border-color: #4ade80; color: #4ade80; }
.btn-edit:hover { border-color: #38bdf8; color: #38bdf8; }
.btn-del:hover { border-color: #f87171; color: #f87171; }

tfoot td {
  position: sticky;
  bottom: 0;
  z-index: 20;
  background: #1e293b !important;
  border-top: 2px solid #38bdf8;
  padding: 5px 4px;
  font-weight: bold;
}
tfoot .sticky-col-1 { z-index: 25; border-right: 2px solid #64748b !important; }

.pagination-bar {
  background: #0f172a;
  border-top: 1px solid #334155;
  padding: 6px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
}
.page-btns { display: flex; align-items: center; gap: 6px; }
.nav-page-btn {
  background: #1e293b;
  border: 1px solid #475569;
  color: #f8fafc;
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
}
.nav-page-btn:hover:not(:disabled) {
  background: #334155;
  border-color: #38bdf8;
  color: #38bdf8;
}
.nav-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.page-indicator { color: #f8fafc; font-weight: bold; padding: 0 6px; }

.emp-modal-body, .skills-modal-body { display: flex; flex-direction: column; gap: 10px; }
.emp-form-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
.f-lbl { display: block; font-size: 12px; color: #cbd5e1; margin-bottom: 4px; font-weight: bold; }
.review-check-bar { background: rgba(74, 222, 128, 0.08); border: 1px solid rgba(74, 222, 128, 0.3); padding: 6px 10px; border-radius: 6px; }
.quick-skill-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.add-skill-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.modal-skills-scroll {
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}
.modal-skill-group-box {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 10px;
}
.msg-title { font-size: 13px; font-weight: bold; color: #38bdf8; margin-bottom: 8px; border-bottom: 1px dashed #334155; padding-bottom: 4px; }
.msg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.msg-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1e293b;
  border: 1px solid #334155;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
  color: #cbd5e1;
}
.msg-checked { border-color: #38bdf8; background: rgba(56, 189, 248, 0.12); color: #ffffff; }
.msg-tag { font-size: 10px; padding: 1px 4px; border-radius: 3px; font-weight: bold; }
.tag-field { background: rgba(16, 185, 129, 0.25); color: #6ee7b7; }
.tag-special { background: rgba(245, 158, 11, 0.25); color: #fcd34d; }
.tag-cadre { background: rgba(168, 85, 247, 0.25); color: #d8b4fe; }
.msg-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.skill-pills-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
.manage-skill-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: bold;
}
.pill-field { background: rgba(16, 185, 129, 0.18); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); }
.pill-special { background: rgba(245, 158, 11, 0.18); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.4); }
.pill-cadre { background: rgba(168, 85, 247, 0.18); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.4); }
.del-x { cursor: pointer; opacity: 0.75; }
.del-x:hover { opacity: 1; color: #f87171; }

.empty-cell { padding: 36px; color: #64748b; font-weight: bold; }
.text-blue { color: #38bdf8; }
.text-purple { color: #c084fc; }
.text-green { color: #4ade80; }
.text-yellow { color: #facc15; }
.text-red { color: #f87171; }
.text-dim { color: #94a3b8; }
.font-bold { font-weight: bold; }
</style>