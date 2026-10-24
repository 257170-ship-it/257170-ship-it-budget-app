# 計畫經費控帳系統

React + TypeScript + Vite 的經費管理工具，資料透過 Google Apps Script 儲存在 Google 試算表，沒有使用 localStorage。

## 功能

- 計畫新增、編輯、刪除，以及總經費、五類細項上限與執行期間設定。
- 支出登錄；鐘點費 =（原定時數 − 請假時數）× 費率，請假全額扣除。
- 儲存前檢查總經費、分類上限、日期、重複 ID、資料型別與計畫關聯。
- 個人代墊與待核銷、已付款、已歸墊狀態追蹤。
- 依計畫、類別、日期及代墊狀態篩選報表，匯出 Excel（支出明細與計畫經費兩張工作表）。
- JPG/PNG/WebP 憑證縮圖（每筆最多兩張，自動壓縮，原件請另存）。

## 本機執行

需要 Node.js 22 LTS 與 npm。

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

預設使用已提供的 Apps Script 部署。要切換部署，可複製 .env.example 為 .env.local 並修改 VITE_GOOGLE_SCRIPT_URL。
Vite 的 VITE_ 設定會放進前端，不能放密碼或秘密金鑰。

## Google Apps Script 資料契約

試算表 ID：1NlQn1g-E5sQ9wzlUSpMk5z1NHNnV_PG1Zbf4tkRVoO4

GET `?sheet=budget` 必須回傳 JSON 二維陣列：

```json
[["key","value"],["projects","[]"],["expenses","[]"]]
```

POST 同一路徑，Content-Type 是 text/plain;charset=utf-8，內容為上述二維陣列的 JSON；projects 與 expenses 儲存各自的 JSON 字串。
伺服器需回傳 JSON 成功結果，例如 {"success":true}，失敗時回傳 {"error":"說明"} 或 {"success":false}。
請保留 key/value 表頭及兩筆資料列，切勿把格式錯誤或讀取失敗當成空帳本。

## 同步行為與限制

1. 初始載入成功前禁止操作；讀取失敗不寫回空資料。
2. 每次操作只允許一筆寫入，儲存前重新讀取並比較雲端資料。
3. 若其他電腦已修改，停止寫入並提供未確認變更 JSON 備份。
4. 儲存完成後重新讀取，內容一致才顯示「已同步」；不靠 HTTP 200 判斷成功。
5. 失敗時顯示最後確認的狀態，保留未確認變更供下載。重新同步前請先備份；備份是人工復原用途，尚無匯入介面。
6. 使用另一台電腦修改後，請按「重新同步」或重新整理。為避免編輯中的表單被背景更新影響，沒有背景自動載入。
7. 舊版 API 為整份帳本覆寫。前端比對可偵測已發生的修改，但兩台電腦若同時通過比對仍有競爭窗口；完整解法需 Apps Script 端版本號比對並搭配 LockService 在同一把鎖內讀取、比較、寫入。本專案沒有修改既有伺服器，不能宣稱完全避免同時寫入遺失。
8. Google Sheets 單格容量有限；每個資料格超過 45,000 字元即停止寫入。照片目前僅適合少量縮圖；大量憑證請改用 Google Drive，帳本只存檔案參照。
9. 目前提供的 API 可未登入讀取，前端也沒有登入限制。公開網頁的訪客可以使用同一雲端帳本；正式敏感帳務需先在後端加入身分驗證與存取控制。

LockService 官方文件：https://developers.google.com/apps-script/reference/lock/lock-service

## 部署到 GitHub Pages

本專案已提供 .github/workflows/deploy.yml，main 更新時執行 npm ci、測試、建置及 Pages 部署。

首次部署由儲存庫擁有者至 Settings → Pages → Build and deployment，把 Source 設定為 GitHub Actions。
之後在 Actions 執行 Build, test and deploy to GitHub Pages（或推送 main）。
GitHub 連接器沒有儲存庫管理權限，無法代替擁有者開啟 Pages。
正式 URL 請以 Actions 的 github-pages environment 回報為準。

Vercel 也可直接匯入本 repo：Framework 選 Vite，Build Command 設 npm run build，Output Directory 設 dist。

## 驗證

npm test 包含鐘點費計算、預算檢查、刪除回補、代墊狀態、資料格式、儲存前衝突、HTTP/應用層錯誤與寫入後驗證。
Excel 模組在點擊匯出時才載入，約 940 KB（gzip 約 271 KB），因此 Vite 會顯示大型 chunk 提示；主畫面約 172 KB。

ExcelJS 4.4.0 的依賴檢查目前有 uuid 衍生的 moderate advisory；本工具只輸出 Excel、不讀取外部工作簿，沒有使用 uuid v3/v5/v6 的 buffer 參數功能。升級套件前仍應持續追蹤 npm audit。
