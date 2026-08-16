# PetHub Platform v1.0

這一版以「正式上線」為標準整理，不再把網站當作 demo。

## 核心原則
1. 不顯示沒有來源的評分、評論數或已驗證標記
2. 店家營業狀態若無即時來源，不顯示為即時營業中
3. 每筆資料保留資料狀態與最後查核日期
4. consumer / merchant 雙邊入口清楚
5. GitHub Pages 可直接部署
6. 支援 PWA、離線快取、SEO、隱私權、使用條款、404

## 已包含
- 全站 responsive
- 地圖搜尋、分類、縣市、24H、資料狀態篩選
- 收藏
- 定位
- Google Maps 導航
- PWA manifest
- Service Worker
- Offline banner
- SEO meta
- Privacy / Terms / 404
- robots.txt / sitemap.xml
- Accessibility focus states / reduced motion

## 重要
目前資料仍是 seed data，正式大規模對外推廣前，應完成：
- 全台資料匯入
- 地址 / 電話 / 營業時間核驗
- 店家認領後台
- 真實 API / database
- 帳號與會員系統
- 預約與付款（若開放）
- analytics / error monitoring
