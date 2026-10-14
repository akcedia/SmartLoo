# SmartLoo - Requirements, Analysis Models & Test Traceability Matrix

**Hazırlayan:** Yusuf Selim Aksu (DevOps & QA)  
**Görev:** Requirement Analysis Report - Eşleştirme ve Tutarsızlık Kontrolü (Issue #17 / PR #18)  
**Son Güncelleme:** 14.10.2026  

---

## 1. Traceability Matrix (Gereksinim – Model – Test Eşleştirmesi)

| FR ID | Gereksinim Tanımı (`docs/REQUIREMENTS.MD`) | Analiz / Davranış Modeli (DFD & State) | Veri Modeli Karşılığı (Domain / E-R) | İlgili QA Testleri (TC-01–TC-48 Kataloğu) | Durum |
|---|---|---|---|---|---|
| **FR-01** | Haritada yakındaki tuvaletlerin listelenmesi ve mesafe hesabı | Furkan - Konum & Harita DFD (Issue #16) | `Toilet` Entity (latitude, longitude, geohash) | **TC-01, TC-11, TC-12** | İnceleme bekliyor |
| **FR-02** | Engelli erişimi filtreleme | Furkan - Filtre Akış Modeli (Issue #16) | `Toilet.has_disabled_access` (Boolean/Null) | **TC-02, TC-15, TC-16** | İnceleme bekliyor |
| **FR-03** | Bebek bakım odası filtreleme | Furkan - Filtre Akış Modeli (Issue #16) | `Toilet.has_baby_changing` (Boolean/Null) | **TC-03, TC-17, TC-18** | İnceleme bekliyor |
| **FR-04** | Kullanıcı kimlik doğrulama & JWT | Fırat - Auth Durum Modeli (Issue #13) | `User` Entity (email, password_hash, role) | **TC-04, TC-19, TC-20, TC-21** | İnceleme bekliyor |
| **FR-05** | Yetkisiz kullanıcı yorum engeli | Fırat - Auth Guard / Özgür - Yorum Akışı (Issue #12, #13) | JWT Claims & Role Checks | **TC-05, TC-22, TC-23** | İnceleme bekliyor |
| **FR-06** | Tuvalet puanlama ve temizlik değerlendirmesi | Özgür - Yorum & Moderasyon Akışı (Issue #12) | `Review` Entity + `Toilet.average_cleanliness` | **TC-06, TC-24, TC-25, TC-26** | İnceleme bekliyor |
| **FR-07** | Yeni tuvalet bildirme ve onay süreci | Furkan / Özgür - Öneri Akışı (Issue #12, #16) | `ToiletSuggestion` (status: pending/approved) | **TC-07, TC-27, TC-28** | İnceleme bekliyor |
| **FR-08** | Yorumların AI ile özetlenmesi ve önbellek | Emir - AI Pipeline & Cache Akışı (Issue #14) | `AISummary` Entity / Redis cache | **TC-08, TC-29, TC-30, TC-31** | İnceleme bekliyor |
| **FR-09** | Yönetici panel metrikleri | Onur - Dashboard DFD (Issue #15) | Aggregate İstatistikleri & Metrikler | **TC-09, TC-32, TC-33, TC-34** | İnceleme bekliyor |
| **FR-10** | Analiz verisi dışa aktarma (CSV/JSON) ve import | Onur - Import/Export Akışı (Issue #15) | DTO / Serializer | **TC-10, TC-35..TC-48** | İnceleme bekliyor |

---

## 2. Model ve Test Beklentileri Karşılaştırması (Tutarlılık ve Risk Notları)

1. **Eksik Dış Kaynak Verisi (İBB Açık Veri):**
   - İBB API'sinden gelen kayıtlarda erişilebilirlik veya bebek bakım alanı verisi bulunmadığında alan **`false` yapılmayacak, `unknown` / `null` olarak saklanacaktır**. Arayüzde "Bilgi Yok" olarak gösterilmeli ve kullanıcı yanıltılmamalıdır.
   - Alan adları `docs/REQUIREMENTS.MD` ile tam uyumlu olarak **`has_disabled_access`** ve **`has_baby_changing`** şeklinde E-R tablosuna işlenmelidir.

2. **AI Yanıt Süresi ve Timeout Kuralı (FR-08):**
   - Gereksinim dokümanındaki performans ve NFR kriteri uyarınca AI istek timeout süresi **10 saniye** olarak güncellenmiştir. 10 saniye aşıldığında sistem timeout hatası verip fallback mesajı döndürecektir.

3. **Temizlik ve Puan Ortalaması Alanı:**
   - E-R modelinde genel temizlik puan alanı `docs/REQUIREMENTS.MD` ile tam eşleşecek şekilde **`average_cleanliness`** olarak adlandırılmalıdır.

4. **Model Durumu:**
   - Ekip üyelerinin taslak modelleri henüz ana rapora birleştirilmediğinden tablodaki model durumları **"İnceleme bekliyor"** olarak güncellenmiştir.
