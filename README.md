# PetHub Map Web MVP

台灣毛小孩生活地圖 MVP。  
目前為靜態前端版本，可部署至 GitHub Pages、Vercel、Netlify 或一般 Web Server。

## 功能

- 真實互動地圖（Leaflet + OpenStreetMap）
- 關鍵字搜尋
- 縣市篩選
- 服務分類
- 目前營業 / 24H / 已驗證篩選
- 店家卡片與詳細資料
- Google Maps 導航
- 我的附近（瀏覽器 Geolocation）
- 收藏（localStorage）
- JSON 資料庫結構
- GitHub Pages 自動部署 workflow

## 專案結構

```text
pethub-map-mvp/
├─ index.html
├─ styles.css
├─ app.js
├─ data/
│  └─ places.json
└─ .github/
   └─ workflows/
      └─ pages.yml
```

## 本機測試

不要直接雙擊 `index.html`，因為瀏覽器可能阻擋 `fetch()` 讀取 JSON。

Python:

```bash
python -m http.server 8080
```

然後瀏覽：

```text
http://localhost:8080
```

## 上傳 GitHub

1. GitHub 建立一個新 repository，例如 `pethub-map`
2. 將本專案全部檔案上傳至 repository root
3. 到 `Settings > Pages`
4. Source 選 `GitHub Actions`
5. push 到 `main` 後，workflow 會自動部署

網址通常會是：

```text
https://<你的GitHub帳號>.github.io/pethub-map/
```

## 正式資料接入建議

`data/places.json` 目前是 MVP 示範資料。正式版建議將資料來源分為：

- 農業部合法特定寵物業
- 動物醫院 / 獸醫診療機構
- 寵物登記機構
- 地方政府寵物公園與 Open Data
- 店家自行認領資料
- 使用者回報後的審核資料

每筆資料建議保留：

- `id`
- `name`
- `category`
- `city`
- `district`
- `address`
- `lat`
- `lng`
- `phone`
- `website`
- `tags`
- `open`
- `h24`
- `verified`
- `note`
- `source`

## 下一階段

建議升級：
1. Supabase / PostgreSQL 後端
2. 店家登入與認領
3. 真實營業時間
4. 店家照片
5. GPS 距離排序
6. AI 自然語言搜尋
7. 預約
8. Pet Digital ID
9. 疫苗與健康提醒
10. 店家 SaaS / CRM

> 注意：MVP 內的部分店家資料目前為示範用途，正式公開前應逐筆核驗。

