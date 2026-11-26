<!-- frontend/src/components/StorageSettingsTab.vue -->
<template>
  <div class="tab-content">
    <input
      type="file"
      ref="skuGroupImportInput"
      style="display: none;"
      accept=".xlsx,.xls,.csv"
      @change="handleSkuGroupImport"
    />

    <div class="settings-split-grid">
      <!-- 左側：月銷量級距門檻設定 -->
      <div class="panel-card">
        <div class="panel-head row-between">
          <span>🔥 第三順位｜月銷量級距門檻參數設定</span>
          <el-button size="mini" type="success" @click="$emit('save')">💾 儲存所有參數並重算</el-button>
        </div>
        <div style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
          <div class="tier-cfg-item">
            <span class="tier-pill tier-A" style="width: 85px; text-align: center;">A級爆品</span>
            <span>近月銷量 ≥</span>
            <el-input-number v-model="modeSettings.tierA_min" :min="2" size="mini" style="width: 130px;" />
            <span class="text-dim">件 / 月</span>
          </div>
          <div class="tier-cfg-item">
            <span class="tier-pill tier-B" style="width: 85px; text-align: center;">B級常銷</span>
            <span>近月銷量 ≥</span>
            <el-input-number v-model="modeSettings.tierB_min" :min="1" size="mini" style="width: 130px;" />
            <span class="text-dim">件 / 月（~ {{ modeSettings.tierA_min - 1 }} 件）</span>
          </div>
          <div class="tier-cfg-item">
            <span class="tier-pill tier-C" style="width: 85px; text-align: center;">C級慢銷</span>
            <span>近月銷量 ≥</span>
            <el-input-number v-model="modeSettings.tierC_min" :min="1" size="mini" style="width: 130px;" />
            <span class="text-dim">件 / 月（~ {{ modeSettings.tierB_min - 1 }} 件）</span>
          </div>
          <div class="tier-cfg-item">
            <span class="tier-pill tier-D" style="width: 85px; text-align: center;">D級滯銷</span>
            <span class="text-dim">近月銷量 = 0 件 / 月（系統自動歸類）</span>
          </div>

          <div class="rule-guide-box">
            <div class="text-blue font-bold" style="margin-bottom: 4px;">📋 儲位規則稽核優先順序說明：</div>
            <div>1. <strong>第一順位（借 / 採）</strong>：先核對儲位允許借或採，吻合才進入下一順位。</div>
            <div>2. <strong>第二順位（商品ID**區 ＞ 區名(帶區編) ＞ 大區名(帶大區編)）</strong>：若商品已加入右側任一「商品ID**區」，則<strong>強制限定</strong>只能放置於有勾選該專區的儲位；同一儲位若設定多個大區/區名，符合其中一項即合格。</div>
            <div>3. <strong>第三順位（月銷量級距）</strong>：前兩順位皆吻合且儲位有勾選月銷級距時才檢查。</div>
          </div>
        </div>
      </div>

      <!-- 右側：商品ID**區 專區管理（方式B：批次貼上 ＋ 方式C：Excel/CSV 匯入匯出） -->
      <div class="panel-card">
        <div class="panel-head row-between">
          <span>🏷️ 第二順位｜「商品ID**區」專區管理（共 {{ (modeSettings.sku_groups || []).length }} 區）</span>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <el-button size="mini" type="info" plain icon="el-icon-download" @click="exportSkuGroupTemplate">
              下載範本
            </el-button>
            <el-button size="mini" type="success" plain icon="el-icon-document" @click="exportAllSkuGroups">
              匯出目前專區
            </el-button>
            <el-button size="mini" type="warning" icon="el-icon-upload2" @click="triggerSkuGroupImport">
              匯入清單
            </el-button>
            <el-button size="mini" type="primary" icon="el-icon-plus" @click="addNewSkuGroup">
              新增專區
            </el-button>
            <el-button size="mini" type="success" @click="$emit('save')">
              💾 儲存設定
            </el-button>
          </div>
        </div>

        <div class="sku-group-workspace">
          <!-- 左側專區清單 -->
          <div class="sku-group-list">
            <div
              v-for="(grp, gIdx) in modeSettings.sku_groups"
              :key="gIdx"
              class="sku-group-item"
              :class="{ active: activeSkuGroupIdx === gIdx }"
              @click="selectGroup(gIdx)"
            >
              <div class="font-bold" style="font-size: 13px;">{{ grp.name }}</div>
              <div class="text-dim" style="font-size: 11px;">已綁定 {{ (grp.skus || []).length }} 個商品</div>
            </div>
          </div>

          <!-- 右側選定專區編輯 -->
          <div v-if="currentSkuGroup" class="sku-group-editor">
            <div class="row-between" style="margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                <span class="font-bold text-blue" style="white-space: nowrap;">專區名稱：</span>
                <el-input v-model="currentSkuGroup.name" size="mini" style="max-width: 240px;" placeholder="例如：商品ID貴重區" />
              </div>
              <el-button size="mini" type="danger" plain @click="deleteCurrentSkuGroup">
                刪除此專區
              </el-button>
            </div>

            <!-- 方式 B：批次貼上商品 ID -->
            <div class="batch-paste-box">
              <div class="row-between" style="margin-bottom: 6px;">
                <label class="m-lbl" style="margin: 0;">📋 批次貼上商品ID（可從 Excel 直接複製整欄貼上，支援換行 / 逗號 / 空白分隔）：</label>
                <el-button size="mini" type="primary" icon="el-icon-plus" @click="appendPastedSkus">
                  加入【{{ currentSkuGroup.name }}】
                </el-button>
              </div>
              <el-input
                v-model="batchPasteText"
                type="textarea"
                :rows="3"
                placeholder="請貼上多筆商品ID，例如：&#10;DSAE8V-A71933364-000&#10;DAAA01-123456789-001"
              />
            </div>

            <!-- 已綁定明細表頭與過濾 -->
            <div class="row-between" style="margin: 10px 0 6px;">
              <span class="text-dim" style="font-size: 12px;">
                目前已納入【{{ currentSkuGroup.name }}】的商品明細（共 <strong>{{ (currentSkuGroup.skus || []).length }}</strong> 筆）：
              </span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <el-input
                  v-model="skuFilterKeyword"
                  size="mini"
                  placeholder="篩選本區商品ID或名稱..."
                  style="width: 180px;"
                  clearable
                />
                <el-button
                  v-if="(currentSkuGroup.skus || []).length > 0"
                  size="mini"
                  type="text"
                  class="text-red"
                  @click="clearCurrentGroupSkus"
                >
                  清空本區商品
                </el-button>
              </div>
            </div>

            <div class="table-scroll" style="border: 1px solid #334155; border-radius: 6px;">
              <table class="dark-table">
                <thead>
                  <tr>
                    <th style="width: 55px;">序號</th>
                    <th style="width: 180px;">商品ID</th>
                    <th>商品名稱（自動帶出）</th>
                    <th style="width: 70px;">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="filteredGroupSkus.length === 0">
                    <td colspan="4" class="empty-td">
                      {{ (currentSkuGroup.skus || []).length === 0 ? '尚未加入任何商品ID，可由上方批次貼上或點選「匯入清單」' : '查無符合關鍵字的商品' }}
                    </td>
                  </tr>
                  <tr v-for="(skuId, sIdx) in filteredGroupSkus.slice(0, 500)" :key="skuId">
                    <td>{{ sIdx + 1 }}</td>
                    <td class="text-blue font-bold">{{ skuId }}</td>
                    <td class="text-left">{{ getSkuNameById(skuId) }}</td>
                    <td>
                      <button type="button" class="del-rule-btn" @click="removeSkuFromCurrentGroup(skuId)">移除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'

export default {
  name: 'StorageSettingsTab',
  props: {
    modeSettings: {
      type: Object,
      required: true
    },
    skus: {
      type: Array,
      default: () => []
    }
  },
  emits: ['save'],
  data() {
    return {
      activeSkuGroupIdx: 0,
      batchPasteText: '',
      skuFilterKeyword: ''
    }
  },
  computed: {
    currentSkuGroup() {
      const list = this.modeSettings.sku_groups || []
      return list[this.activeSkuGroupIdx] || list[0] || null
    },
    skuNameMap() {
      const map = new Map()
      ;(this.skus || []).forEach(s => {
        if (s && s.sku_id) map.set(s.sku_id, s.sku_name || '')
      })
      return map
    },
    filteredGroupSkus() {
      if (!this.currentSkuGroup) return []
      const list = this.currentSkuGroup.skus || []
      const kw = this.skuFilterKeyword.trim().toLowerCase()
      if (!kw) return list
      return list.filter(id => {
        const name = (this.skuNameMap.get(id) || '').toLowerCase()
        return id.toLowerCase().includes(kw) || name.includes(kw)
      })
    }
  },
  methods: {
    selectGroup(idx) {
      this.activeSkuGroupIdx = idx
      this.skuFilterKeyword = ''
    },
    getSkuNameById(skuId) {
      return this.skuNameMap.get(skuId) || '（尚未在目前庫存檔中，儲存後仍會自動套用稽核）'
    },
    appendPastedSkus() {
      if (!this.currentSkuGroup) return
      const tokens = String(this.batchPasteText || '')
        .split(/[\r\n,\t\s;；]+/)
        .map(s => s.trim())
        .filter(Boolean)

      if (tokens.length === 0) {
        return ElMessage.warning('請先在上方輸入框貼上至少一筆商品ID！')
      }

      if (!Array.isArray(this.currentSkuGroup.skus)) {
        this.currentSkuGroup.skus = []
      }
      const existing = new Set(this.currentSkuGroup.skus)
      let addedCount = 0
      tokens.forEach(sku => {
        if (!existing.has(sku)) {
          existing.add(sku)
          this.currentSkuGroup.skus.push(sku)
          addedCount++
        }
      })

      this.batchPasteText = ''
      ElMessage.success(`已新增 ${addedCount} 筆商品ID至【${this.currentSkuGroup.name}】（重複項目已自動略過），請記得點擊「儲存設定」！`)
    },
    addNewSkuGroup() {
      const idx = (this.modeSettings.sku_groups || []).length + 1
      if (!Array.isArray(this.modeSettings.sku_groups)) this.modeSettings.sku_groups = []
      this.modeSettings.sku_groups.push({ name: `商品ID自訂區${idx}`, skus: [] })
      this.activeSkuGroupIdx = this.modeSettings.sku_groups.length - 1
      this.skuFilterKeyword = ''
    },
    deleteCurrentSkuGroup() {
      if (!this.currentSkuGroup) return
      ElMessageBox.confirm(`確定要刪除專區「${this.currentSkuGroup.name}」嗎？`, '刪除專區確認', {
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.modeSettings.sku_groups.splice(this.activeSkuGroupIdx, 1)
        this.activeSkuGroupIdx = Math.max(0, this.activeSkuGroupIdx - 1)
      }).catch(() => {})
    },
    clearCurrentGroupSkus() {
      if (!this.currentSkuGroup) return
      ElMessageBox.confirm(`確定要清空【${this.currentSkuGroup.name}】的所有商品ID嗎？`, '清空確認', {
        confirmButtonText: '確定清空',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.currentSkuGroup.skus = []
      }).catch(() => {})
    },
    removeSkuFromCurrentGroup(skuId) {
      if (!this.currentSkuGroup) return
      this.currentSkuGroup.skus = (this.currentSkuGroup.skus || []).filter(id => id !== skuId)
    },
    exportSkuGroupTemplate() {
      const rows = [
        ['專區名稱(必填)', '商品ID(必填)', '商品名稱(選填參考)'],
        ['商品ID貴重區', '示例商品ID001', '範例商品名稱'],
        ['商品ID溫度區', '示例商品ID002', '範例商品名稱']
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '商品ID專區匯入範本')
      XLSX.writeFile(wb, '商品ID專區匯入範本.xlsx')
    },
    exportAllSkuGroups() {
      const rows = [['專區名稱(必填)', '商品ID(必填)', '商品名稱(選填參考)']]
      ;(this.modeSettings.sku_groups || []).forEach(grp => {
        if (!grp.skus || grp.skus.length === 0) {
          rows.push([grp.name, '', ''])
        } else {
          grp.skus.forEach(skuId => {
            rows.push([grp.name, skuId, this.skuNameMap.get(skuId) || ''])
          })
        }
      })
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '商品ID專區設定')
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `商品ID專區設定備份_${today}.xlsx`)
      ElMessage.success('🎉 已匯出目前所有商品ID專區設定！')
    },
    triggerSkuGroupImport() {
      if (this.$refs.skuGroupImportInput) {
        this.$refs.skuGroupImportInput.value = ''
        this.$refs.skuGroupImportInput.click()
      }
    },
    async handleSkuGroupImport(e) {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (rows.length === 0) throw new Error('檔案內容為空')

        if (!Array.isArray(this.modeSettings.sku_groups)) this.modeSettings.sku_groups = []
        let importedCnt = 0

        rows.forEach(row => {
          const sku = String(row['商品ID(必填)'] || row['商品ID'] || row['sku_id'] || '').trim()
          if (!sku) return
          const groupName = String(
            row['專區名稱(必填)'] || row['專區名稱'] || row['區域名稱'] || (this.currentSkuGroup ? this.currentSkuGroup.name : '商品ID貴重區')
          ).trim()

          let targetGrp = this.modeSettings.sku_groups.find(g => g.name === groupName)
          if (!targetGrp) {
            targetGrp = { name: groupName, skus: [] }
            this.modeSettings.sku_groups.push(targetGrp)
          }
          if (!targetGrp.skus.includes(sku)) {
            targetGrp.skus.push(sku)
            importedCnt++
          }
        })

        ElMessage.success(`🎉 已匯入 ${importedCnt} 筆新商品ID至專區，請記得點擊「儲存設定」生效！`)
      } catch (err) {
        ElMessage.error('匯入商品ID清單失敗：' + err.message)
      }
    }
  }
}
</script>

<style scoped>
.tab-content { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
.settings-split-grid { flex: 1; min-height: 0; display: grid; grid-template-columns: 410px 1fr; gap: 10px; }

.panel-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
.panel-head { background: #0f172a; padding: 7px 12px; font-size: 13px; font-weight: bold; border-bottom: 1px solid #334155; flex-shrink: 0; }
.row-between { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }

.tier-cfg-item { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; color: #f8fafc; }
.rule-guide-box {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  color: #cbd5e1;
  line-height: 1.7;
  margin-top: 6px;
}

.sku-group-workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: 195px 1fr; }
.sku-group-list { background: #0f172a; border-right: 1px solid #334155; padding: 8px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
.sku-group-item {
  padding: 9px 10px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #1e293b;
  cursor: pointer;
  transition: all 0.12s;
}
.sku-group-item:hover { border-color: #38bdf8; }
.sku-group-item.active {
  background: rgba(37, 99, 235, 0.25);
  border-color: #38bdf8;
  color: #ffffff;
}
.sku-group-editor { padding: 12px; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.batch-paste-box {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 10px;
  flex-shrink: 0;
}
.m-lbl { display: block; font-size: 12px; font-weight: bold; color: #cbd5e1; margin-bottom: 4px; }

.table-scroll { flex: 1; overflow: auto; }
.dark-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dark-table th {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #0f172a;
  color: #cbd5e1;
  padding: 8px 6px;
  border-bottom: 1px solid #475569;
  border-right: 1px solid #334155;
  white-space: nowrap;
}
.dark-table td { padding: 6px 8px; border-bottom: 1px solid #334155; border-right: 1px solid #334155; text-align: center; }
.dark-table tbody tr:hover td { background: rgba(56, 189, 248, 0.08); }
.text-left { text-align: left !important; }
.empty-td { padding: 30px !important; color: #94a3b8; }

.del-rule-btn {
  background: transparent;
  border: 1px solid #475569;
  color: #f87171;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 11px;
  cursor: pointer;
}
.del-rule-btn:hover { background: rgba(248, 113, 113, 0.15); border-color: #f87171; }

.tier-pill { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.tier-A { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
.tier-B { background: rgba(250, 204, 21, 0.2); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.4); }
.tier-C { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); }
.tier-D { background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.4); }

.text-blue { color: #38bdf8; }
.text-red { color: #f87171; }
.text-dim { color: #94a3b8; }
.font-bold { font-weight: bold; }
</style>