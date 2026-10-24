# 計畫經費控帳系統 V2

React、TypeScript及Vite的動態預算工具。新版支援九案來源草稿、子計畫、逐項費率與單位、核定額、版本及報表。

## 本機執行

需要Node.js22 LTS及npm。

```sh
npm ci
npm run dev
npm test
npm run build
```

npm run build包含TypeScript檢查、GitHub Pages靜態網站及Apps Script完整安裝套件建置。輸出為dist/與backend/generated/。

## 目前部署範圍

公開網站為工作階段草稿預覽，不會將預覽內容寫入正式帳本，也不使用localStorage。請下載JSON備份，重新開啟時可由「備份與遷移」讀回。
舊版相容帳本保留原雲端功能，使用原API；不是新版安全後端。原API仍有原來的公開存取限制，正式切換需擁有者停用舊寫入。

新版安全帳本需由擁有者部署至Google Apps Script。完整步驟見[後端部署與切換](docs/BACKEND_DEPLOYMENT.md)。尚未完成Google雲端實際部署／整合驗證，不能將本機模擬測試當成正式登入與存取驗證。

## 功能

- 動態預算增列、複製、排序、編輯及停用；同名項目以固定ID分開。
- 選用子計畫／班別、群組控制及採購子清單，不重複累計父子總額。
- 申請、核定與調整額分開；核定未知為null，明確0元為0。
- 金額以整數分運算，支援直接金額、單價數量、授課及指定基礎百分比估算。
- 請假全額扣除，節與小時不自動換算。
- 管理者確認後的比例、單價及流用規則；預算調整完整前後版本紀錄。
- 課表批次預覽、停課、實上與冪等結算，排課不直接產生支出。
- 同計畫憑證分攤；代墊、付款及核銷獨立狀態。
- 依年度／學年度、計畫、子計畫、項目、日期與狀態篩選。
- Excel八張工作表：計畫經費、預算明細、支出明細、分攤、子計畫、鐘點費、憑證索引、採購明細。
- 九案範本保持申請／概算值與來源疑義，沒有自動核定或支出。

## 同步與權限

- GitHub Pages不含Google憑證，沒有從公開頁直接寫入新版私有帳本的通道。
- Apps Script使用同網域Google Workspace Session與ROLES_JSON allowlist，空email一律拒絕。
- viewer／entry／editor／admin在後端檢查。試算表與Drive由部署者擁有，不給一般使用者直接編輯權限。
- 每筆資料一列，以Journal提交標記控制多表操作可見性，LockService內檢查revision。
- requestId冪等、寫後指定版本回讀、衝突時保留待確認變更。
- 憑證存私有Drive原件，試算表只存ID；新附件不接受Base64帳本資料。
- 舊資料只做備份與預覽；正式遷移須先停舊寫入、核對hash、取得確認與設定核准屬性。

## 遷移預覽工具

```sh
npx tsx scripts/migration-preview.ts
npx tsx scripts/migration-preview.ts --input /path/to/legacy.json --out outputs/migration-preview
```

工具只GET舊API，不會POST，不會建立或覆寫正式帳本。輸出原始回應、資料備份、新版預覽與逐案核對。

## 套件與驗證

ExcelJS採延後載入，約940KB的大型chunk為匯出工具，不影響主畫面首次下載該模組。已知uuid衍生moderate advisory尚需上游更新；工具只輸出，不匯入外部Excel，未使用該buffer API。

測試涵蓋九案合計、單位、預算與權限、遷移、資料分攤、Excel、RPC回讀、Journal中斷、回應遺失與重試、角色偽造及附件。後端測試使用記憶體Google服務替身，不代表已通過真實Google雲端整合驗證。
