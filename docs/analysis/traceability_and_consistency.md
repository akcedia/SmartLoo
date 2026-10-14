# SmartLoo - Requirements, Analysis Models & Test Traceability Matrix

**Hazırlayan:** Yusuf Selim Aksu (DevOps & QA)  
**Görev:** Requirement Analysis Report - Eşleştirme ve Tutarsızlık Kontrolü (Issue #17)  

---

## 1. Traceability Matrix (Gereksinim - Model - Test Eşleştirmesi)

| FR ID | Gereksinim | İlgili Analiz / Davranış Modeli | Veri Modeli Karşılığı (Domain / E-R) | QA Test ID | Durum |
|---|---|---|---|---|---|
| **FR-01** | Haritada yakındaki tuvaletlerin listelenmesi | Furkan - Konum & Harita DFD | `Toilet` Entity (Enlem, Boylam) | **TC-01** | Uyumlu |
| **FR-02** | Engelli erişimi filtreleme | Furkan - Filtre Akış Modeli | `Toilet.is_accessible` | **TC-02** | Uyumlu |
| **FR-03** | Bebek bakım odası filtreleme | Furkan - Filtre Akış Modeli | `Toilet.baby_room` | **TC-03** | Uyumlu |
| **FR-04** | Kullanıcı kimlik doğrulama & JWT | Fırat - Auth Durum Modeli | `User` Entity (Email, PasswordHash, Role) | **TC-04** | Uyumlu |
| **FR-05** | Yetkisiz kullanıcı yorum engeli | Fırat - Auth Guard / Özgür - Yorum Akışı | JWT Token Doğrulaması | **TC-05** | Uyumlu (401 kontrolü) |
| **FR-06** | Puan ve yorum ekleme | Özgür - Yorum & Moderasyon Akışı | `Review` Entity + `Toilet.avg_rating` | **TC-06** | Tek yorum kuralı doğrulandı |
| **FR-07** | Yeni tuvalet bildirme | Furkan - Harita Öneri Akışı | `ToiletSuggestion` (Status: Pending) | **TC-07** | Moderasyon kuyruğu tanımlı |
| **FR-08** | AI ile yorum özetleme | Emir - AI Pipeline & Cache Akışı | `AISummary` Entity / Redis cache | **TC-08** | Fallback kuralı eklendi |
| **FR-09** | Yönetici panel metrikleri | Onur - Dashboard DFD | Aggregate İstatistikleri | **TC-09** | Uyumlu |
| **FR-10** | Analiz verisi dışa aktarma (CSV/JSON) | Onur - Batch Export Akışı | DTO / Serializer | **TC-10** | Uyumlu |

---

## 2. Model ve Test Beklentileri Karşılaştırması (Tutarlılık Kontrolü)

- **Tek Yorum Kuralı:** Kullanıcının aynı tuvalete birden fazla yorum atamaması kuralı, veri modelinde `(user_id, toilet_id)` unique kısıtı ile güvenceye alınmıştır.
- **Yetkisiz İşlemler:** Giriş yapmamış kullanıcıların yorum ve öneri istekleri HTTP 401 Unauthorized ile reddedilmektedir.
- **Hesap Silme:** Silinen kullanıcının eski yorumları veri bütünlüğü ve puan ortalamasının bozulmaması için `user_id = null` yapılarak anonimleştirilmelidir.
- **AI Fallback:** AI servis gecikmesinde arayüz kilitlenmeyecek, 5 sn timeout sonrası varsayılan fallback metni döndürülecektir.
- **Eksik Veri:** İBB verisindeki boş/null alanlar varsayılan olarak `false` kabul edilecektir.
