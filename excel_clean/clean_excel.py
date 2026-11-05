import pandas as pd
import numpy as np
import re
import os

# 1. 檔案路徑設定（確保與此 py 檔放在同目錄）
input_file = "新增 Microsoft Excel 工作表.xlsx"
output_file = "修復完成_工作表1.xlsx"

if not os.path.exists(input_file):
    print(f"找不到檔案：{input_file}，請確認檔名與路徑是否正確！")
    exit()

print("正在讀取原始檔案...")
df = pd.read_excel(input_file, sheet_name=0)

# 標準欄位清單
standard_cols = [
    '快速通關資訊', '類型', '來源單號', 'PCS數', '成本總計', 
    '商品ID', '商品名稱', 'PM', '放行日期', '放行時間', 
    '預約入庫日', '收貨日期', '收貨時間', '備註', 
    '驗收日期', '驗收時間', '供應商編號', '供應商名稱'
]

repaired_rows = []
current_main_row = None

# 正規表達式：判斷是否為主要單號（BR 或 BY 開頭的編號）
order_pattern = re.compile(r'^(BR|BY)\d+', re.IGNORECASE)

print("開始進行資料清理與合併...")

for idx, row in df.iterrows():
    val_order = str(row['來源單號']).strip() if pd.notna(row['來源單號']) else ""
    first_col = str(row['快速通關資訊']).strip() if pd.notna(row['快速通關資訊']) else ""
    
    # 情況 A：新單號開始（來源單號符合 BR 或 BY 規則）
    if order_pattern.match(val_order):
        if current_main_row is not None:
            repaired_rows.append(current_main_row)
        current_main_row = row[standard_cols].to_dict()
        
        # 處理因逗號溢出到 Unnamed: 18 的欄位右移現象
        if 'Unnamed: 18' in row and pd.notna(row['Unnamed: 18']):
            orig_rmk = str(row['備註']) if pd.notna(row['備註']) else ""
            shift_rmk = str(row['驗收日期']) if pd.notna(row['驗收日期']) else ""
            current_main_row['備註'] = f"{orig_rmk} {shift_rmk}".strip()
            current_main_row['驗收日期'] = row['驗收時間']
            current_main_row['驗收時間'] = row['供應商編號']
            current_main_row['供應商編號'] = row['供應商名稱']
            current_main_row['供應商名稱'] = row['Unnamed: 18']

    # 情況 B：非單號列（屬於備註換行被截斷的延續列）
    else:
        if current_main_row is not None:
            # 判斷是否為截斷後平移到前幾欄的「驗收/供應商」尾巴資料
            cost_val = str(row['成本總計']) if pd.notna(row['成本總計']) else ""
            is_tail_row = any(kw in cost_val for kw in ['公司', '企業', '行', '社', '廠'])
            
            if is_tail_row:
                current_main_row['驗收日期'] = row['類型']
                current_main_row['驗收時間'] = row['來源單號']
                current_main_row['供應商編號'] = row['PCS數']
                current_main_row['供應商名稱'] = row['成本總計']
                if first_col:
                    orig_rmk = str(current_main_row.get('備註', '')) if pd.notna(current_main_row.get('備註', '')) else ""
                    current_main_row['備註'] = f"{orig_rmk} {first_col}".strip()
            else:
                # 純文字備註（例如：驗入日期、組別、姓名、QC發現等）
                extra_text = " ".join([str(val).strip() for val in row.dropna() if str(val).strip() != ""])
                if extra_text:
                    orig_rmk = str(current_main_row.get('備註', '')) if pd.notna(current_main_row.get('備註', '')) else ""
                    current_main_row['備註'] = f"{orig_rmk} ; {extra_text}".strip(" ;")

# 補入最後一筆資料
if current_main_row is not None:
    repaired_rows.append(current_main_row)

# 儲存修復後的新檔案
df_cleaned = pd.DataFrame(repaired_rows)[standard_cols]
df_cleaned.to_excel(output_file, index=False)
print(f"處理完成！共修復整併為 {len(df_cleaned)} 筆資料，已輸出至：{output_file}")