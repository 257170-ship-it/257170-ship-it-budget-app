import {
  blankProject,
  blankItem,
  emptyState,
  type AppState,
  type Rule,
  type BudgetItem,
} from "../types";
type Line = [string, number, number?, number?, string?];
const source = (
  document: string,
  location: string,
  note = "來源為申請／概算，核定欄保留空白",
) => ({ document, location, note });
function make(
  id: string,
  name: string,
  total: number,
  lines: Line[],
  document: string,
  location: string,
  issues: string[] = [],
  year = 115,
): AppState {
  const s = emptyState(),
    p = {
      ...blankProject(id),
      name,
      year,
      yearType: (year === 114 ? "calendar" : "academic") as
        "calendar" | "academic",
      sourceAmount: total * 100,
      source: source(document, location),
      issues,
      templateId: id,
    };
  s.projects.push(p);
  lines.forEach(([label, amount, price, quantity, unit], n) =>
    s.items.push({
      ...blankItem(id + "-item-" + (n + 1), id),
      name: label,
      originalName: label,
      sourceRow: String(n + 1),
      order: n,
      sourceAmount: amount * 100,
      unitPrice: price === undefined ? amount * 100 : price * 100,
      quantity: quantity ?? 1,
      unit: unit || "式",
      calculation:
        price === undefined
          ? "direct"
          : label.includes("鐘點") ||
              label.includes("教練") ||
              label.includes("教師")
            ? "teaching"
            : "quantity",
      source: source(document, location + "／第" + (n + 1) + "列"),
    }),
  );
  return s;
}
const rule = (
  id: string,
  name: string,
  kind: Rule["kind"],
  value: number,
  document: string,
  location: string,
  note: string,
): Rule => ({
  id,
  name,
  kind,
  value,
  confirmed: false,
  effect: "block",
  source: source(document, location, note),
});
export function getTemplates(): AppState[] {
  const indigenous = make(
    "tpl-indigenous",
    "原民研習",
    100000,
    [
      ["外聘講座鐘點費", 24000, 2000, 12, "節"],
      ["內聘講座鐘點費", 12000, 1000, 12, "節"],
      ["全民健康保險補充保費", 760],
      ["國內旅費", 3200],
      ["租車費", 18000, 6000, 3, "輛"],
      ["保險費", 700, 35, 20, "人"],
      ["膳食費（含茶水）", 12000, 120, 100, "人次"],
      ["印刷費－講義", 16000, 200, 80, "份"],
      ["印刷費－紅布條", 1500, 1500, 1, "條"],
      ["物品費", 7500],
      ["雜支", 4340],
    ],
    "原民歷史正義與轉型正義師資研習.docx",
    "文末經費概算表",
    [
      "正文、明細與合計100,000元，但表頭計畫總額與申請額10,000元，待確認；兩值均保留於此疑義。",
      "部分場次116年4／5月，課程列卻寫115年5月，日期待確認。",
      "文件稱115年9月至116年6月，精確起訖日待確認。",
    ],
  );
  indigenous.items[9].details = [
    ["隨身碟256GB", 1500, 2],
    ["錄音筆", 2000, 1],
    ["SD記憶卡", 1250, 2],
  ].map(([n, p, q], i) => ({
    id: "ind-purchase-" + i,
    name: String(n),
    unit: "件",
    unitPrice: Number(p) * 100,
    quantity: Number(q),
    sourceAmount: Number(p) * Number(q) * 100,
  }));
  indigenous.items[10].rules = [
    rule(
      "ind-misc",
      "雜支業務費6%以內",
      "ratio",
      6,
      "原民研習",
      "文末經費表",
      "計算基礎與流用範圍待確認，不視為已核准流用",
    ),
  ];
  const p3 = make(
    "tpl-plan3",
    "活化計畫三",
    250000,
    [
      ["講座鐘點費（外聘）", 24000, 2000, 12, "小時"],
      ["講座鐘點費（內聘）", 42000, 1000, 42, "小時"],
      ["二代健保補充保費", 507],
      ["印刷費", 4800, 40, 120, "份"],
      ["交通費", 6000, 400, 15, "次"],
      ["膳費（含茶水）", 17280, 120, 144, "人次"],
      ["教材教具費", 16353],
      ["資料蒐集費", 15660],
      ["雜支", 10000],
      ["協同授課鐘點費", 113400, 405, 280, "節"],
    ],
    "活化教學計畫三申請書.pdf",
    "第7–10頁",
    [
      "補充保費507元的適用對象、基礎與取整方式待確認。",
      "教材清單兩筆同名1立方公尺組合展示器各1,000元，保留兩筆。",
      "研習場次與印刷／交通15場、膳費18場不同，數量待確認。",
    ],
  );
  const p4 = make(
    "tpl-plan4",
    "活化計畫四",
    248520,
    [
      ["印刷費", 3600, 40, 90, "份"],
      ["交通費", 24000, 12000, 2, "輛"],
      ["膳費（含茶水）", 8880, 120, 74, "人次"],
      ["教材教具費", 13330],
      ["資料蒐集費", 4760],
      ["雜支", 5000],
      ["學期協同鐘點費", 129600, 405, 320, "節"],
      ["暑期課後鐘點費", 32000, 400, 80, "節"],
      ["保險費", 1850, 25, 74, "人次"],
      ["門票費", 25500, 850, 30, "人次"],
    ],
    "活化教學計畫四申請書.pdf",
    "第12–16頁",
    [
      "門票30人與行程37人、其他項目人次不同，待確認適用對象。",
      "原表鐘點費161,600元拆為405×320＋400×80；群組只控管，不重複加總。",
    ],
  );
  p4.items[6].originalName = "鐘點費";
  p4.items[7].originalName = "鐘點費";
  p4.items[9].originalName = "其他";
  p3.items[9].originalName = "鐘點費";
  p4.groups.push({
    id: "plan4-teaching",
    projectId: p4.projects[0].id,
    subprojectId: null,
    name: "鐘點費（原表161,600元）",
    sourceAmount: 16160000,
    approvedAmount: null,
    adjustedAmount: null,
    rules: [],
  });
  p4.items[6].groupId = "plan4-teaching";
  p4.items[7].groupId = "plan4-teaching";
  for (const s of [p3, p4]) {
    const material = s.items.find((i) => i.name === "教材教具費")!,
      books = s.items.find((i) => i.name === "資料蒐集費")!;
    material.rules = [
      rule(
        s.projects[0].id + "-material",
        "教材教具費總經費20%",
        "ratio",
        20,
        s.projects[0].source.document,
        "經費表備註",
        "核定總額與適用版本待確認",
      ),
    ];
    books.rules = [
      rule(
        s.projects[0].id + "-books",
        "資料蒐集費總經費10%",
        "ratio",
        10,
        s.projects[0].source.document,
        "經費表備註",
        "核定總額與適用版本待確認",
      ),
    ];
    s.projects[0].issues.push("來源規定各案核定後各自執行，不得跨計畫勻支。");
  }
  const media = make(
    "tpl-media",
    "媒體素養",
    300000,
    [
      ["講座鐘點費（外聘）", 24000, 2000, 12, "節×人次"],
      ["講座鐘點費（內聘）", 18000, 1000, 18, "節×人次"],
      ["代課鐘點費", 32400, 405, 80, "節×人次"],
      ["教學材料費", 56570],
      ["資料蒐集費", 28435],
      ["印刷費", 15750],
      ["國內旅費", 3000, 500, 6, "趟"],
      ["膳費", 8000, 100, 80, "人次"],
      ["雜支", 14155],
      ["設備費", 99690],
    ],
    "媒體素養教育重點學校計畫書_新版.pdf",
    "第5–20頁",
    ["材料與設備分列，不依名稱自動推定經常門／資本門。"],
  );
  Object.assign(media.projects[0], {
    startDate: "2026-08-01",
    endDate: "2027-07-31",
    reportDeadline: "2027-09-30",
  });
  media.items[3].details = [
    ["重型鋼管四節燈架", 2800, 4],
    ["雙色溫金屬平板燈", 4000, 2],
    ["C-STAND燈架", 3200, 2],
    ["攝影棚環境燈組", 3000, 4],
    ["Desview T12提詞機", 5000, 1],
    ["滑輪旋轉4用控光幕", 5600, 1],
    ["AMARAN COB 200X S聚光燈", 8370, 1],
  ].map(([n, p, q], i) => ({
    id: "media-m-" + i,
    name: String(n),
    unit: "組",
    unitPrice: Number(p) * 100,
    quantity: Number(q),
    sourceAmount: Number(p) * Number(q) * 100,
  }));
  media.items[9].details = [
    ["Insta 360 Ace Pro 2", 18099],
    ["Go Pro Max", 13591],
    ["多點觸控螢幕", 68000],
  ].map(([n, p], i) => ({
    id: "media-e-" + i,
    name: String(n),
    unit: "台",
    unitPrice: Number(p) * 100,
    quantity: 1,
    sourceAmount: Number(p) * 100,
  }));
  const dance = make(
    "tpl-dance",
    "教優原民舞蹈",
    100000,
    [
      ["外聘教練鐘點費", 91200, 800, 114, "節"],
      ["原住民舞蹈展演配件", 5000, 250, 20, "份"],
      ["原住民舞蹈指導手冊", 1000, 50, 20, "份"],
      ["二代健保補充保費", 1924],
      ["雜支", 876],
    ],
    "統合補助填報系統-學校端.pdf",
    "第5–6頁",
    ["下學期課表列18次×3節，與申請19週／57節不一致；不自動修正114節。"],
  );
  Object.assign(dance.projects[0], {
    startDate: "2026-08-30",
    endDate: "2027-07-31",
  });
  const bus = make(
    "tpl-bus",
    "教優交通車",
    410000,
    [
      ["租車費", 205000, 205000, 1, "輛"],
      ["租車費", 205000, 205000, 1, "輛"],
    ],
    "統合補助填報系統-5學校端.pdf",
    "第3頁",
    ["兩筆同名列各205,000元，來源每列搭乘8人、座位9席；承商／車輛識別待補。"],
  );
  bus.items.forEach((i, n) => {
    i.sourceRow = String(n + 1);
    i.transferPolicy = "locked";
    i.rules = [
      rule(
        "bus-no-transfer-" + n,
        "來源表載不可流用",
        "noTransfer",
        0,
        bus.projects[0].source.document,
        "第3頁表頭",
        "來源明載，不得按名稱合併或以改名規避",
      ),
    ];
  });
  const summer = make(
    "tpl-summer",
    "夏日樂學",
    110000,
    [
      ["一般師資鐘點費", 32000, 400, 80, "節"],
      ["助理講師鐘點費", 7600, 200, 38, "節"],
      ["補充保費", 836],
      ["勞保及勞退費", 100, 100, 1, "人"],
      ["學生活動交通費", 6000, 6000, 1, "天"],
      ["保險費", 1050, 35, 30, "人"],
      ["教學材料費", 19500],
      ["印刷費", 900, 30, 30, "本"],
      ["學生午餐費", 30000, 100, 300, "個"],
      ["講師含助教午餐費", 7000, 100, 70, "個"],
      ["外聘講師住宿費", 3200, 3200, 1, "天"],
      ["外聘講師交通費", 1000, 500, 2, "趟"],
      ["雜支", 814],
    ],
    "115年夏日樂學計畫經費申請表.pdf",
    "第1–3頁",
    [
      "本檔為方案二、甲班；申請額非核定額。",
      "講師午餐申請單價100元，說明列120元；兩者分開保留。",
    ],
  );
  Object.assign(summer.projects[0], {
    startDate: "2026-07-01",
    endDate: "2026-08-31",
    reportDeadline: "2026-10-31",
  });
  summer.subprojects.push({
    id: "summer-class-a",
    projectId: summer.projects[0].id,
    name: "方案二 整合式學習",
    className: "甲班",
    order: 0,
    sourceAmount: 11000000,
  });
  summer.items.forEach((i) => (i.subprojectId = "summer-class-a"));
  summer.items[9].rules = [
    rule(
      "summer-lunch",
      "講師午餐說明列120元上限",
      "unitPrice",
      12000,
      summer.projects[0].source.document,
      "第2頁",
      "申請100元與說明120元分開，適用條件待確認",
    ),
  ];
  summer.items[12].rules = [
    rule(
      "summer-misc",
      "雜支依核定總經費10%編列",
      "ratio",
      10,
      summer.projects[0].source.document,
      "第2頁",
      "是否固定值／上限待確認，不自動補足",
    ),
  ];
  const foundation = make(
    "tpl-foundation",
    "力成基金會",
    250000,
    [
      ["補充書籍", 6000, 6000, 1, "式"],
      ["農業工具", 2000, 2000, 1, "式"],
      ["烹飪器具", 1000, 1000, 1, "式"],
      ["菜苗與種子", 600, 600, 1, "式"],
      ["烹飪調味品", 400, 400, 1, "式"],
      ["AI創客／機器人講師鐘點費", 96000, 800, 120, "節"],
      ["原住民舞蹈講師鐘點費", 96000, 800, 120, "節"],
      ["英語學伴協同教師鐘點費", 48000, 400, 120, "節"],
    ],
    "115力成科技教育基金會贊助多元學習課程計畫書.docx",
    "文末經費概算總表",
    [
      "英語協同教師120節×400=48,000，但說明另有×3名，數量是否含人次待確認。",
      "機器人社團／AI創客社團名稱對照待確認。",
    ],
  );
  Object.assign(foundation.projects[0], {
    startDate: "2026-08-01",
    endDate: "2027-07-31",
  });
  [
    ["reading", "閱讀推動", 6000],
    ["farm", "無毒健康小農場", 4000],
    ["clubs", "週三多元社團", 240000],
  ].forEach(([id, name, amount], n) =>
    foundation.subprojects.push({
      id: "foundation-" + id,
      projectId: foundation.projects[0].id,
      name: String(name),
      className: "",
      order: n,
      sourceAmount: Number(amount) * 100,
    }),
  );
  foundation.items.forEach(
    (i, n) =>
      (i.subprojectId =
        n === 0
          ? "foundation-reading"
          : n <= 4
            ? "foundation-farm"
            : "foundation-clubs"),
  );
  const digital = make(
    "tpl-digital114",
    "數位學習114",
    33000,
    [
      ["內聘講師鐘點費", 20000, 1000, 20, "小時"],
      ["膳費", 7000, 140, 50, "人次"],
      ["印刷費", 5000, 100, 50, "式"],
      ["雜支", 1000],
    ],
    "01_114年度推動中小學數位學習精進方案.doc",
    "經費概算表",
    ["本來源是114年度，精確執行期間待補；不套用資料夾115年度。"],
    114,
  );
  // Original purchase lists preserve same-name rows and document amounts.
  const details = (
    item: BudgetItem,
    rows: [string, number, number, string?][],
  ) => {
    item.details = rows.map(([name, p, q, u], n) => ({
      id: item.id + "-detail-" + n,
      name,
      unit: u || "份",
      unitPrice: p * 100,
      quantity: q,
      sourceAmount: p * q * 100,
    }));
  };
  details(p3.items[6], [
    ["食農各類食材蔬果", 6000, 1, "式"],
    ["沃鬆1號栽培介質70L", 350, 3, "包"],
    ["培養土", 80, 20, "包"],
    ["錢幣塑膠模型", 100, 10],
    ["圓面積圓周率展示器", 200, 2],
    ["鐘面磁性白板貼", 150, 4],
    ["彩色積木建構組", 350, 4],
    ["圓形色紙", 50, 3],
    ["1立方公尺組合展示器", 1000, 1],
    ["1立方公尺組合展示器", 1000, 1],
    ["多邊形面積教學組", 150, 10],
    ["透明分數片", 50, 3],
    ["百分比圓餅圖印章", 230, 2],
    ["多面骰", 43, 1],
  ]);
  details(p3.items[7], [
    ["小學生成語故事", 400, 6, "本"],
    ["作文課後這樣寫會更好", 380, 6, "本"],
    ["小益老師玩數學解謎1", 380, 6, "本"],
    ["小益老師玩數學解謎2", 380, 6, "本"],
    ["賴秋江老師玩轉語文課", 360, 6, "本"],
    ["寫作課玩個夠", 350, 6, "本"],
    ["魔數名師圖解數學課", 360, 6, "本"],
  ]);
  details(p4.items[3], [
    ["譜架", 890, 10, "個"],
    ["I2C溫濕度感測器模組", 40, 5, "個"],
    ["DS18B20防水溫度感測器", 90, 5, "個"],
    ["GY-362加速度感測器", 150, 4, "個"],
    ["NFC讀寫卡套件", 350, 5, "組"],
    ["數學桌遊心算PK賽", 250, 2, "組"],
    ["角色數棒積木卡", 465, 2, "組"],
  ]);
  details(p4.items[4], [
    ["超圖解Arduino互動設計入門", 580, 1, "本"],
    ["IoT物聯網應用", 450, 1, "本"],
    ["Vibe Coding提示詞全攻略", 580, 1, "本"],
    ["好種易活盆栽種菜全圖解", 500, 2, "本"],
    ["種子盆栽真有趣", 480, 2, "本"],
    ["陶笛吹奏宮崎駿樂譜集", 890, 1, "本"],
    ["愛上烏克麗麗", 300, 1, "本"],
  ]);
  details(media.items[4], [
    ["未來兒童", 4399, 1, "期"],
    ["未來少年", 4999, 2, "期"],
    ["國語日報", 4560, 1, "期"],
    ["警告內褲殺手入侵", 320, 2, "本"],
    ["網紅假新聞偽科學", 299, 2, "本"],
    ["假消息終結戰", 380, 2, "本"],
    ["我也想當YouTuber", 340, 2, "本"],
    ["同學別再鬧了", 300, 2, "本"],
    ["國語周刊", 6200, 1, "期"],
  ]);
  summer.projects[0].yearType = "calendar";
  indigenous.items[7].originalName = "印刷費";
  indigenous.items[8].originalName = "印刷費";
  const zeroRows = (s: AppState, names: string[]) =>
    names.forEach((name, n) =>
      s.items.push({
        ...blankItem(s.projects[0].id + "-zero-" + n, s.projects[0].id),
        name,
        originalName: name,
        sourceRow: "零額列-" + (n + 1),
        sourceAmount: 0,
        inactive: true,
        order: s.items.length,
        source: s.projects[0].source,
      }),
    );
  zeroRows(p3, ["出席費", "諮詢費", "住宿費", "場地費"]);
  zeroRows(p4, [
    "出席費",
    "諮詢費",
    "講座鐘點費（外聘）",
    "講座鐘點費（內聘）",
    "二代健保補充保費",
    "住宿費",
    "場地費",
  ]);
  zeroRows(media, ["二代健保補充保費", "教材教案撰稿費", "審查費", "其他"]);
  zeroRows(summer, [
    "鐘點費A（藝師藝有傳統藝師）",
    "鐘點費B（傳統技藝指導者）",
    "代理教師或非公教人員平安保險費",
    "非偏遠地區弱勢學生午餐費",
    "非偏遠地區外聘講師住宿費",
    "非偏遠地區外聘講師交通費",
  ]);
  summer.items.slice(-6).forEach((i) => (i.subprojectId = "summer-class-a"));
  const all = [
    indigenous,
    p3,
    p4,
    media,
    dance,
    bus,
    summer,
    foundation,
    digital,
  ];
  for (const s of all)
    for (const i of s.items)
      i.category = /鐘點|教練/.test(i.name)
        ? "鐘點費"
        : /材料|教材|物品|配件|手冊/.test(i.name)
          ? "教材教具"
          : /資料|書籍/.test(i.name)
            ? "資料蒐集"
            : /交通|旅費|租車/.test(i.name)
              ? "交通旅運"
              : /膳|午餐/.test(i.name)
                ? "膳費"
                : /保險|保費|勞保|勞退/.test(i.name)
                  ? "保險保費"
                  : /印刷/.test(i.name)
                    ? "印刷費"
                    : /設備/.test(i.name)
                      ? "設備費"
                      : "其他";
  const originals = [
    "3-1原住民族歷史正義與轉型正義師資研習暨課程共備-大南國小 (1).docx",
    "115年活化教學與多元計畫(計畫三)申請書及經費申請表(下載).pdf",
    "115年活化教學與多元計畫(計畫四_多元試探活動)申請書及經費申請表(下載).pdf",
    "媒體素養教育重點學校計畫書_新版.pdf",
    "教育部補助學校教育經費統合網站 - 統合補助填報系統-學校端.pdf",
    "教育部補助學校教育經費統合網站 - 統合補助填報系統-5學校端.pdf",
    "115年夏日樂學計畫經費申請表.pdf",
    "115力成科技教育基金會贊助多元學習課程計畫書.docx",
    "01_ 114年度推動中小學數位學習精進方案.doc",
  ];
  all.forEach((s, n) => {
    s.projects[0].source.document = originals[n];
    s.items.forEach((i) => {
      i.source.document = originals[n];
      i.rules.forEach((r) => (r.source.document = originals[n]));
      if (i.sourceAmount === 0) {
        i.unitPrice = 0;
        i.quantity = 0;
      }
    });
  });
  summer.items[6].unit = "批";
  summer.items[summer.items.length - 6].unitPrice = 150000;
  summer.items[summer.items.length - 5].unitPrice = 80000;
  details(media.items[5], [
    ["研習講義（15人×9場）", 50, 135, "本"],
    ["海報／宣傳單（9場）", 1000, 9, "場"],
  ]);
  const longNames: Record<string, string> = {
    小學生成語故事: "成語‧趣味‧知識─小學生成語故事",
    作文課後這樣寫會更好: "作文課後─這樣寫會更好",
    小益老師玩數學解謎1: "小益老師教你玩數學解謎１：燒腦的節慶遊戲密碼",
    小益老師玩數學解謎2: "小益老師教你玩數學解謎２：燒腦的節慶遊戲密碼",
    賴秋江老師玩轉語文課: "賴秋江老師的玩轉語文課",
    寫作課玩個夠: "寫作課，玩個夠！",
    魔數名師圖解數學課: "魔數名師寫的最簡單圖解數學課",
    警告內褲殺手入侵:
      "警告！內褲殺手入侵！──如何辨別假新聞、不實訊息和陰謀論 (中高年級圖文讀本／媒體素養)",
    網紅假新聞偽科學: "網紅，假新聞，偽科學：媒體素養必須知道的21堂課(2版)",
    假消息終結戰: "假消息終結戰：關於虛假訊息的一切",
    我也想當YouTuber:
      "我也想當YouTuber：影片創作、個資保護、分辨假訊息，讀故事建立數位素養，養成媒體識讀能力",
    同學別再鬧了: "同學別再鬧了：面對社群媒體、校園霸凌與同學問題的聰明應對術",
    好種易活盆栽種菜全圖解:
      "好種易活！盆栽種菜全圖解：無農藥、安心吃！全年栽種時程表X55種蔬菜培育祕訣，新手也能四季都豐收",
    種子盆栽真有趣: "種子盆栽真有趣：無性繁殖╳直接種植╳泡水催芽",
    陶笛吹奏宮崎駿樂譜集: "陶笛吹奏宮崎駿吉卜力動畫精選樂譜集",
  };
  all.forEach((s) =>
    s.items.forEach((i) =>
      i.details.forEach((d) => (d.name = longNames[d.name] || d.name)),
    ),
  );
  return [indigenous, p3, p4, media, dance, bus, summer, foundation, digital];
}
export function instantiateTemplate(
  template: AppState,
  prefix: string,
): AppState {
  const s: AppState = JSON.parse(JSON.stringify(template)),
    map = new Map<string, string>();
  for (const key of [
    "projects",
    "subprojects",
    "groups",
    "items",
    "activities",
  ] as const)
    for (const row of s[key]) map.set(row.id, prefix + "-" + row.id);
  for (const key of [
    "projects",
    "subprojects",
    "groups",
    "items",
    "activities",
  ] as const)
    for (const row of s[key]) {
      row.id = map.get(row.id)!;
      if ("projectId" in row) row.projectId = map.get(row.projectId)!;
      if ("groupId" in row && row.groupId) row.groupId = map.get(row.groupId)!;
      if ("subprojectId" in row && row.subprojectId)
        row.subprojectId = map.get(row.subprojectId)!;
      if ("baseItemIds" in row)
        row.baseItemIds = row.baseItemIds.map((id) => map.get(id)!);
    }
  return s;
}
