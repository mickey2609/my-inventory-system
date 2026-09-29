import { ref } from 'vue';
import axios from 'axios';

export function useLocSummary(sendCurrentLog) {
  const loading = ref(false);
  const calcProgress = ref(0);
  const progressTimer = ref(null);
  const summaryGridData = ref([]);
  const summaryVolData = ref([]);
  const areaGridTable = ref([]);
  const areaVolTable = ref([]);
  const summaryStats = ref({ 
    total_plan_grid: 0, 
    total_used_grid: 0, 
    total_rem_grid: 0, 
    total_plan_vol: 0, 
    total_used_vol: 0, 
    total_health: '0.0%' 
  });

  const progressColors = [
    { color: '#f56c6c', percentage: 20 },
    { color: '#e6a23c', percentage: 40 },
    { color: '#5cb85c', percentage: 60 },
    { color: '#1989fa', percentage: 80 },
    { color: '#6f7ad3', percentage: 100 }
  ];

  const startProgressSimulation = () => {
    calcProgress.value = 0;
    if (progressTimer.value) clearInterval(progressTimer.value);
    progressTimer.value = setInterval(() => {
      if (calcProgress.value < 92) {
        calcProgress.value += Math.floor(Math.random() * 8) + 3;
      }
    }, 200);
  };

  const finishProgressSimulation = () => {
    if (progressTimer.value) clearInterval(progressTimer.value);
    calcProgress.value = 100;
  };

  const handleSummaryCalc = async () => {
    loading.value = true;
    startProgressSimulation();

    try {
      const res = await axios.get('/api/calc-location-summary');
      if (res.data && res.data.status === 'success') {
        finishProgressSimulation();
        setTimeout(() => {
          summaryGridData.value = [...(res.data.grid_summary || [])];
          summaryVolData.value = [...(res.data.vol_summary || [])];
          areaGridTable.value = [...(res.data.area_grid_table || [])];
          areaVolTable.value = [...(res.data.area_vol_table || [])];
          summaryStats.value = res.data.stats || {};
          sendCurrentLog('儲位數才數統整', '執行全流程統整計算成功');
        }, 300);
      }
    } catch (e) {
      finishProgressSimulation();
      sendCurrentLog('儲位數才數統整', '⚠️ 計算連線失敗: ' + e.message);
    } finally {
      setTimeout(() => { loading.value = false; }, 300);
    }
  };

  return {
    loading,
    calcProgress,
    progressColors,
    summaryGridData,
    summaryVolData,
    areaGridTable,
    areaVolTable,
    summaryStats,
    handleSummaryCalc
  };
}