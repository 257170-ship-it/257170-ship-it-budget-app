# 新版安全帳本部署與切換

本次GitHub Pages上線的是新版草稿預覽與舊版相容入口。新版Apps Script原始碼已備妥，但尚未部署到使用者Google帳號；不能把模擬測試當成已完成雲端驗證。正式舊資料尚未遷移。

## 一次性的帳本擁有者操作

目前工具沒有既有Apps Script編輯／部署權限。需要擁有者完成的工作是：在自己的Google Workspace帳號建立新版Apps Script測試部署，依下列步驟安裝套件，完成後提供測試部署網址。不要把密碼、OAuth token或金鑰貼到對話。

1. 執行npm ci與npm run build，或使用已提供的Apps Script安裝ZIP。backend/generated內的Domain.gs、Code.gs、Index.html及appsscript.json就是完整套件；app.js/app.css只是建置中間檔，不需上傳。
2. 在同一Google Workspace網域的帳本擁有者帳號建立新的獨立Apps Script專案，不覆蓋舊版程式。
3. 建立Domain.gs、Code.gs、Index.html，貼入對應檔案；在專案設定啟用顯示資訊清單，使用提供的appsscript.json。
4. 在Script Properties設定ROLES_JSON，例如：{"you@school.edu.tw":"admin","staff@school.edu.tw":"entry","reviewer@school.edu.tw":"viewer"}。請替換成實際Google登入帳號。角色viewer可讀、entry可登錄、editor可編輯草稿與核銷、admin可核定／調整與遷移。不要把ROLES_JSON放進GitHub或VITE變數。
5. 從編輯器執行setupTestBook，授權由你確認。它只會建立一份全新測試試算表與私有Drive附件資料夾，填入LEDGER_SPREADSHEET_ID、ATTACHMENT_FOLDER_ID、ENVIRONMENT=test及WRITE_ENABLED=true。已設定帳本時會拒絕再次建立，不會覆蓋既有資料。
6. 部署為網頁應用程式：以「我／部署者」執行，存取限制為同一Workspace網域；保持附件與試算表不對一般使用者直接共用。使用者透過後端角色讀寫，不需要試算表編輯權限。
7. 使用實際Google帳號開啟新部署，確認顯示「獨立測試帳本」，再測試新增草稿、管理者核定、不同角色、多人衝突、附件上傳／下載及寫入後重新載入。
8. 把測試部署網址填入公開網站的「安全帳本網址」，或以VITE_SECURE_WEBAPP_URL建置預填連結。這只是連結，不是認證憑證；實際讀寫發生在Apps Script登入頁內，以google.script.run與Session身分驗證。
9. 完成上述部署後，把網址交回Codex，才能進行實際Google雲端整合驗證。只有此時才可把「尚未驗證」改成「雲端驗證成功」。

## 身分適用範圍

此實作預設Google Workspace同網域。Session.getActiveUser取得不到email時一律拒絕，不會退回使用前端傳來的email或角色。若使用個人Gmail或需跨網域，不能改成匿名或分享密碼繞過，需另行完成Google OIDC身分驗證後端並驗證token。這不是目前可宣稱已支援的情境。

以部署者執行的目的，是避免把試算表／Drive直接編輯權限授予entry或viewer，使其繞過後端規則。部署者本身為受信任管理者，可直接管理底層資料。

官方參考：

- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/reference/base/session
- https://developers.google.com/apps-script/guides/html/communication
- https://developers.google.com/apps-script/reference/lock/lock-service

## 正式遷移前仍需確認

不要在本次測試階段修改正式舊帳本。以下為未來確認後的操作，不是要求立刻執行：

1. 以獨立測試帳本的副本完成核對，確認版本、角色與附件可讀。
2. 擁有者決定正式切換時間，備份舊API原始回應、解析後資料、試算表副本及附件；下載逐案筆數／支出／代墊／附件核對結果。
3. 在舊Apps Script的所有可用寫入部署停用doPost或撤銷舊部署，保留原資料；確認舊版網址不再接受寫入。只新增新版程式不會自動停用舊部署。
4. 在新的正式Apps Script專案建立空白目標帳本與私有附件資料夾，設定ENVIRONMENT=production、LEGACY_SPREADSHEET_ID指向舊帳本。新舊帳本ID不可相同。不要把含測試支出的測試帳本改標成正式帳本。
5. 在安全帳本「備份與遷移」取得migrationPreview的核對與hash。雜湊會因任何舊資料變更而失效。
6. 向使用者提供備份位置、逐案核對結果與回復方案，取得明確的正式切換確認。
7. 擁有者在Script Properties設定LEGACY_WRITE_DISABLED=true、APPROVED_MIGRATION_HASH=已確認的hash及WRITE_ENABLED=true。
8. 從Apps Script編輯器執行runApprovedMigration。程式會再檢查來源hash、目標為空、前後核對一致，保存私有Drive備份與搬移舊照片，再提交。requestId與hash對應，重試不重複入帳。
9. 重新載入核對筆數與逐案金額。所有舊額度仍保留legacyRecordedBudget，核定欄空白；不自動把舊額度當核定。實際核定資料由管理者補入。

## 寫入恢復與回復方案

- 多表操作先append標記為PREPARED的版本列，只有Journal的COMMITTED標記持久化後可讀；中斷列標為ABORTED並永久排除。
- 回應逾時時保留同一requestId重試。已提交的相同內容會回傳原版本；不同內容／不同使用者不可重用同ID。
- UI寫後驗證讀取原提交版本，即使其他使用者後續提交也不會錯誤地重複入帳。
- 檔案上傳若在提交前中斷，可能留下私有孤立檔案；日誌會記錄檔案ID，由管理者核對清理，不自動刪除可能已提交的原件。
- 若正式切換後需回復，先WRITE_ENABLED=false、備份新帳本，讀取指定歷史revision或使用已保存舊備份，復原至另一份新帳本後核對。不要直接刪除Journal、歷史列或原附件。
- Ledger／Drive由部署者擁有，未對外公開。角色在每次RPC由後端檢查，不接受前端自稱角色。
- Journal目前以完整掃描重建最新逐筆狀態，適合小型學校帳本；大量歷史需另作可驗證的封存／快照索引，禁止直接清空歷史。
- Google Sheets／Drive並非交易資料庫。Journal提供帳務可見性邊界與重試恢復，不能宣稱雲端基礎設施有跨服務交易保證。
