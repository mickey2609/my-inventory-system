import { ref } from 'vue'
import axios from 'axios'

export function useLocSummary(sendLogFunc) {
  const loading = ref(false)
  const calcProgress = ref(0)
  const progressColors = [
    { color: '#38bdf8', percentage: 20 },
    { color: '#818cf8', percentage: 50 },
    { color: '#fbbf24', percentage: 80 },
    { color: '#4ade80', percentage: 100 }
  ]

  const summaryStats = ref({
    total_plan_grid: 0, total_used_grid: 0, total_rem_grid: 0,
    total_plan_vol: 0, total_used_vol: 0, total_rem_vol: 0,
    total_health: '0.0%'
  })
  const summaryGridData = ref([])
  const summaryVolData = ref([])
  const areaGridTable = ref([])
  const areaVolTable = ref([])

  let progressTimer = null

  const handleSummaryCalc = async () => {
    loading.value = true
    calcProgress.value = 0

    if (progressTimer) clearInterval(progressTimer)
    progressTimer = setInterval(() => {
      if (calcProgress.value < 95) {
        calcProgress.value += Math.floor(Math.random() * 5) + 2
        if (calcProgress.value > 95) calcProgress.value = 95
      }
    }, 150)

    try {
      const res = await axios.get('/api/calc-location-summary', { timeout: 25000 })
      
      if (res.data && res.data.success) {
        summaryStats.value = res.data.summaryStats || {}
        summaryGridData.value = res.data.summaryGridData || res.data.grid_summary || []
        summaryVolData.value = res.data.summaryVolData || res.data.vol_summary || []
        areaGridTable.value = res.data.area_grid_table || res.data.summaryGridData || []
        areaVolTable.value = res.data.area_vol_table || res.data.summaryVolData || []

        calcProgress.value = 100
        if (sendLogFunc) sendLogFunc('儲位數才數統整', '成功完成交叉矩陣數據試算')
      } else {
        throw new Error(res.data?.message || '計算失敗')
      }
    } catch (err) {
      console.error('儲位統計試算失敗:', err)
      calcProgress.value = 100
    } finally {
      if (progressTimer) clearInterval(progressTimer)
      setTimeout(() => {
        loading.value = false
      }, 300)
    }
  }

  return {
    loading,
    calcProgress,
    progressColors,
    summaryStats,
    summaryGridData,
    summaryVolData,
    areaGridTable,
    areaVolTable,
    handleSummaryCalc
  }
}