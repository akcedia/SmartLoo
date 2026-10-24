# SmartLoo — Dış Veri Adapter’ı ve AI Servis Sözleşmesi

İlgili görev: [#28](https://github.com/akcedia/SmartLoo/issues/28)

Katkı sahibi: Emir Miraç İslamoğlu

Durum: İnceleme için tasarım önerisi

## 1. Amaç ve kapsam

Bu belge, İBB tesis verisinin SmartLoo’nun kullanacağı ortak tesis biçimine dönüştürülmesini ve AI servisinin girdi, çıktı ve hata kurallarını tanımlar.

Kapsam, FR-04 ve FR-07’nin dış kaynak bölümüdür. Tasarım; veri dönüşümü, kaynak kimliği, eksik alanlar, AI çıktı doğrulaması, önbellek ve hata durumlarını kapsar. Gerçek sağlayıcıya ihtiyaç duymayan örnek girdiler ve beklenen çıktılar sunar.

Bu belge çalışan bir veri aktarımı veya canlı AI entegrasyonu tamamlandığını ileri sürmez.

## 2. Dayanaklar ve bilgi sınırı

- [Gereksinim raporu](../REQUIREMENTS.MD)
- [İBB kaynak eşleştirmesi ve AI veri akışı analizi](../analysis/SmartLoo_FR04_FR07_Analiz.md)
- [Ortak proje yapısı ve sözleşme görevi #23](https://github.com/akcedia/SmartLoo/issues/23)
- [Önceki analiz görevi #14](https://github.com/akcedia/SmartLoo/issues/14) ve [PR #22](https://github.com/akcedia/SmartLoo/pull/22)

Mevcut gereksinimler, önceki analizde bildirilen kaynak bulguları ve bu belgedeki tasarım önerileri ayrı tutulur. Önceki sayısal bulgular bu tasarım çalışmasında yeniden doğrulanmış sayılmaz. Kaynak kimliği kararının dayandığı profil kanıtlarının kontrolü #14 kapsamında takip edilir.

Ortak API, veri modeli ve ortam değişkeni adlarını etkileyen öneriler ekip incelemesi gerektirir. Bu belge bu sözleşmeleri tek taraflı değiştirmez.

## 3. Tesis verisi adapter sözleşmesi

### 3.1 Sorumluluk ve sınır

Adapter, İBB tesis GeoJSON verisini alır; alan, tip ve koordinat kontrollerinden sonra normalize tesis adayları üretir.

Bu aşamada veritabanına yazmaz. Kaynak kimliği ve batch doğrulaması tamamlandıktan sonra ayrı import bileşeni yazma işlemini yürütür. Yönetici import API’sinin CSV/JSON sözleşmesi korunur; GeoJSON için burada tanımlanan işlem dış kaynak normalizasyonudur.

Aşağıdaki `source_properties` alanı ve adapter iç yapısı tasarım önerisidir; mevcut ortak API’ye eklenmiş alanlar değildir.

### 3.2 Alan dönüşümü

| Kaynak alanı | Normalize hedef | Dönüşüm |
|---|---|---|
| `MAHAL_ADI` | `name` | Zorunlu, boş olmayan metin |
| `ILCE` | `district` | Zorunlu, boş olmayan metin |
| `geometry.coordinates[0]` | `longitude` | Sonlu sayı; −180 ile 180 arasında |
| `geometry.coordinates[1]` | `latitude` | Sonlu sayı; −90 ile 90 arasında |
| `X`, `Y` | `source_properties` | Varsa geometry ile tutarlılık kontrolü; geometry eksikse sessiz yedek olarak kullanılmaz |
| `TUVALET_DURUM` | `source_properties` | Ham idari durum korunur; “şu an açık” anlamına gelmez |
| `TUVALET_TIP` | `source_properties` | Ham tesis tipi korunur |
| `BAKIM_ODASI` | `source_properties` | Anlamı doğrulanmadan bebek alt değiştirme bilgisine dönüştürülmez |
| `HIZMET_YERI` | `source_properties` | Ham yer kategorisi korunur |
| Kaynakta bulunmayan erişilebilirlik, ücret ve saat bilgileri | İlgili normalize alanlar | `null`; eksik bilgi `false`, `0` veya boş saat olarak doldurulmaz |

GeoJSON koordinat sırası `[boylam, enlem]` olarak işlenir. Sayısal aralık kontrolü tek başına eksenlerin doğru sırada olduğunu kanıtlamaz; bilinen bir örnekle ayrıca kontrol edilir.

### 3.3 Örnek girdi

Aşağıdaki kayıt sentetik bir mock örneğidir; gerçek bir İBB kaydının kopyası değildir. Örnek kısalık için tek feature gösterir; adapter’ın batch girdisi bir GeoJSON `FeatureCollection` nesnesidir.

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [29.0, 41.0]
  },
  "properties": {
    "MAHAL_ADI": "Örnek Tesis",
    "ILCE": "Örnek İlçe",
    "TUVALET_DURUM": "Aktif",
    "TUVALET_TIP": "Sabit",
    "BAKIM_ODASI": "Var",
    "HIZMET_YERI": "Park",
    "X": 29.0,
    "Y": 41.0
  }
}
```

### 3.4 Beklenen normalize aday

Bu çıktı, adapter’ın iç sözleşmesi için öneridir; doğrudan public API yanıtı veya veritabanı şeması değildir. Kalıcı tesis UUID’si ve kaynak kimliği, sonraki kimlik çözümleme aşamasında belirlenir.

```json
{
  "name": "Örnek Tesis",
  "district": "Örnek İlçe",
  "longitude": 29.0,
  "latitude": 41.0,
  "has_disabled_access": null,
  "has_baby_changing": null,
  "is_free": null,
  "price_try": null,
  "opening_hours": null,
  "source_properties": {
    "TUVALET_DURUM": "Aktif",
    "TUVALET_TIP": "Sabit",
    "BAKIM_ODASI": "Var",
    "HIZMET_YERI": "Park",
    "X": 29.0,
    "Y": 41.0
  }
}
```

`Aktif`, güncel açılış saatini kanıtlamaz. `BAKIM_ODASI: "Var"` ise doğrulanmış bir bebek alt değiştirme imkânı sayılmaz. Bu nedenle ilgili alanlar örnekte `null` kalır.

Kullanım istatistikleri bu tesis adayına otomatik eklenmez. Geçiş sayıları hijyen puanı veya canlı doluluk olarak kullanılmaz.

## 4. Doğrulama ve hata sözleşmesi

### 4.1 Doğrulama sırası

1. Girdi geçerli JSON ve `FeatureCollection` olmalıdır; `features` bir liste olmalıdır.
2. Her kayıt `Feature`, geometry ise `Point` olmalıdır.
3. Koordinatlar bu adapter sözleşmesinde iki sonlu JSON sayısı olmalıdır. Boolean, sayısal metin, `NaN` ve sonsuz değer kabul edilmez.
4. Boylam/enlem aralıkları, zorunlu ad/ilçe alanları ve sağlanan ham alanların tipleri kontrol edilir.
5. `X` veya `Y` sağlanmışsa ilgili geometry bileşeniyle karşılaştırılır. Önerilen tolerans `1e-8` derecedir; bu bir tutarlılık eşiğidir, konumsal doğruluk garantisi değildir.
6. Tekrarlar, kaynak kimliği çakışmaları ve çözümlenmemiş durum değerleri kontrol edilir.

Geometry eksikken X/Y kullanarak sessiz düzeltme yapılmaz. Koordinatlar otomatik yer değiştirilmez. Opsiyonel alanın eksik olması kabul edilebilir; sağlanmış fakat geçersiz olması hata olarak raporlanır.

### 4.2 Hata çıktısı

Aşağıdaki alan ve hata kodları adapter’ın iç sözleşmesi için öneridir. Public API alan adları ekip sözleşmesiyle kesinleştirilecektir. Feature indeksleri sıfırdan başlar.

```json
{
  "valid": false,
  "candidates": [],
  "errors": [
    {
      "feature_index": 0,
      "field": "geometry.coordinates[1]",
      "code": "INVALID_COORDINATE",
      "message": "Latitude must be between -90 and 90."
    }
  ]
}
```

| Durum | Önerilen hata kodu | Sonuç |
|---|---|---|
| Bozuk JSON veya yanlış koleksiyon yapısı | `INVALID_DOCUMENT` | Batch reddedilir |
| Point olmayan veya eksik geometry | `INVALID_GEOMETRY` | Kayıt hatası raporlanır |
| Geçersiz koordinat tipi veya aralığı | `INVALID_COORDINATE` | Kayıt hatası raporlanır |
| X/Y ile geometry uyuşmazlığı | `COORDINATE_MISMATCH` | Kayıt hatası raporlanır |
| Boş ad veya ilçe | `MISSING_REQUIRED_FIELD` | Kayıt hatası raporlanır |
| Sağlanan alanın yanlış tipi | `INVALID_FIELD_TYPE` | Kayıt hatası raporlanır |
| Çözümlenmemiş idari durum eşlemesi | `UNRESOLVED_STATUS` | Canlı import engellenir |
| Tekrar veya belirsiz kaynak kimliği | `IDENTITY_CONFLICT` | Canlı import engellenir |

Tüm batch doğrulanmadan canlı veri değişmez. Herhangi bir hata varsa yazma bileşeni çağrılmaz; kısmi import yapılmaz. İç doğrulama çıktısı HTTP yanıtı değildir. Yönetici import API’sinde geçersiz batch için mevcut HTTP 422 kuralı korunur.

Kaynağa erişilemiyorsa boş ve başarılı import sonucu üretilmez; hata bildirilir ve mevcut tesisler korunur. Yeni dosyada görünmeyen tesisler otomatik silinmez veya kapatılmaz.

## 5. Kaynak kimliği ve tekrar import

### 5.1 Kimliklerin ayrılması

- `id`: SmartLoo’nun ürettiği kalıcı tesis UUID’sidir. Yorumlar bu kimliğe bağlanır.
- `source_id`: SmartLoo’nun kaynak kaydını tekrar tanımak için kullandığı kimliktir.
- İBB dataset/resource UUID’si bir dosyayı tanımlar; tek bir tesisi tanımlamaz.
- Ad, koordinat veya feature indeksi tek başına kalıcı tesis kimliği sayılmaz.

Önceki analiz benzersizlik ve tekrar bulguları bildirir. Bu belge bu sayıları yeniden doğrulamaz. 422 kaynak kaydı, doğrudan 422 benzersiz fiziksel tesis olarak yorumlanmaz.

### 5.2 Önerilen kimlik politikası

1. Kaynak resource kimliği ve indirilen dosyanın SHA-256 özeti kaydedilir. Dosya özeti, tesis kimliği yerine kullanılmaz.
2. Ham tekrarlar ve aynı aday kimliğe düşen kayıtlar staging aşamasında raporlanır. Staging, canlı veriye yazılmadan önceki hazırlık alanıdır.
3. Onaylanmış, belirsizliği giderilmiş kayıtlar için sürümlü bir fingerprint üretilir.
4. Fingerprint ile kalıcı SmartLoo UUID’si arasındaki ilişki bir kimlik kayıt defterinde tutulur.
5. Aynı onaylı kaynak kimliği yeniden geldiğinde mevcut UUID kullanılır; ikinci tesis oluşturulmaz.
6. Kimliğe dahil olmayan metadata değişiklikleri mevcut tesisi günceller.

Önerilen fingerprint girdisi; kaynak ad alanı, politika sürümü, normalize ilçe, normalize ad, boylam ve enlemden oluşur. JSON dizisi UTF-8 ve sabit serileştirme kurallarıyla SHA-256 işlemine alınır.

Normalizasyon için Unicode NFC, baş/son boşlukların kaldırılması ve ardışık boşlukların teke indirilmesi önerilir. Harf büyüklüğü ve Türkçe karakterler korunur; kayıplı harf dönüşümü veya koordinat yuvarlama yapılmaz. Eşdeğer sayılar aynı ondalık gösterime dönüştürülür. Kurallar ve test vektörleri uygulama öncesi Fırat ile kesinleştirilecektir.

`source_id` için önerilen biçim `v1:<sha256>` değeridir. Bu, sağlayıcının verdiği bir tesis ID’si değildir.

### 5.3 Çakışma ve ad/konum değişikliği

| Durum | Önerilen davranış |
|---|---|
| Aynı dosyanın tekrar import edilmesi | Mevcut kimlikler korunur; yeni tesis çoğaltılmaz |
| Tam içerik tekrarı | Otomatik birleştirilmez; fiziksel anlamı incelemeye gönderilir |
| Aynı koordinatta farklı kayıtlar | Yalnız konuma bakılarak birleştirilmez |
| Aynı fingerprint için birden fazla kaynak kaydı | Çakışma çözülmeden canlı batch uygulanmaz |
| Mevcut fingerprint için metadata değişikliği | Aynı UUID üzerinde güncellenir |
| Ad veya konum değişikliği | Yeni fingerprint oluşur; olası eski tesisle eşleşme incelemeye gönderilir |
| Yeni fingerprint için önceden onaylı eşleme yok | Yeni tesis veya mevcut tesis değişikliği olduğu doğrulanana kadar yazılmaz |

Benzer ad veya yakın konum yalnız eşleştirme adayı üretir; otomatik eşleşme kanıtı değildir. Onaylanan ad/konum değişikliğinde yeni fingerprint eski UUID’ye alias olarak bağlanır; yorumlar eski UUID’den kopmaz.

Bu politika, onaylı kimliklerin tekrar import’unu destekler. Sağlayıcının kalıcı tesis ID’si bulunmadığında tüm ad/konum değişikliklerinin otomatik tanınmasını garanti etmez.

### 5.4 İdari durum sınırı

`Aktif → ACTIVE` ve `Pasif → CLOSED` eşlemeleri ekip incelemesine sunulan önerilerdir; güncel açılış durumu hesaplamaz.

`Dönemlik` için takvim ve ortak model kararı gerekir. Bilinmeyen veya çözümlenmemiş değerler sessizce `ACTIVE` yapılmaz; ham değer korunur ve canlı import öncesi çözüm istenir.

## 6. AI servis sözleşmesi

### 6.1 Sorumluluk ve veri akışı

Mevcut public endpoint `GET /api/v1/toilets/{id}/summary` olarak korunur. Aşağıdaki sağlayıcı girdisi backend’in iç sözleşmesi için öneridir; yeni bir public endpoint tanımlamaz.

Akış:

1. Tesisin varlığı doğrulanır; bulunamazsa HTTP 404 döner.
2. Kullanılabilir yorumlar ve güncel yorum sürümü alınır.
3. Geçerli cache kontrol edilir.
4. Kişisel veriler temizlenir ve uygun yorumlar seçilir.
5. En az 3 uygun yorum varsa en güncel en fazla 50 yorum sağlayıcıya gönderilir.
6. Yanıt şema, dil ve içerik kurallarına göre doğrulanır.
7. Geçerli sonuç cache’e alınır; hata durumunda fallback döner.

Cache kontrolünden önce yorumların silinmesi veya değişmesi nedeniyle eski sonucun geçersiz olmadığı doğrulanmalıdır.

### 6.2 Uygun yorum ve kişisel veri temizliği

Önerilen uygunluk kuralı: silinmemiş, moderasyon politikası uyarınca görünür ve kişisel veri temizliği sonrasında anlamlı metni kalan yorumlar özet girdisine dahil edilir. Yalnız puan içeren yorumlar istatistiklerde kullanılabilir; metin özeti için uygun yorum sayısını artırmaz. Kesin moderasyon kuralları ekipçe kararlaştırılır.

Yorumlar `created_at` azalan sırayla seçilir; eşitlik durumunda kararlı bir iç kimlik sırası kullanılır. Düzenlenen yorumun güncel metni kullanılır. Bu seçim politikası tasarım önerisidir.

Sağlayıcıya kullanıcı adı, kullanıcı UUID’si, e-posta, telefon, kimlik bilgisi veya tam kullanıcı konumu gönderilmez. Metin içindeki kişisel veriler de temizlenir. Güvenle temizlenemeyen yorum sağlayıcı girdisinden çıkarılır.

Sağlayıcıya gönderilen yorum sayısı ile tesisin toplam yorum sayısı farklı olabilir:

- `based_on_reviews`: Özette kullanılan uygun yorum sayısı.
- `review_count`: Uygulamadaki görünür yorumların toplamı.
- `average_cleanliness`: Uygulamanın gerçek puanlardan hesapladığı ortalama.

Son iki değer AI tarafından hesaplanmaz.

### 6.3 Örnek sağlayıcı girdisi

Aşağıdaki içerik sentetik bir mock girdisidir. `request_review_ref`, yalnız bu istekte kullanılan geçici referanstır; kalıcı yorum veya kullanıcı kimliği değildir.

```json
{
  "contract_version": "1",
  "language": "tr",
  "reviews": [
    {
      "request_review_ref": "r1",
      "text": "Temizdi ancak sabun yoktu."
    },
    {
      "request_review_ref": "r2",
      "text": "Genel olarak temiz, sabun eksikti."
    },
    {
      "request_review_ref": "r3",
      "text": "Temiz buldum. Sabun göremedim."
    }
  ]
}
```

`contract_version`, `language` ve `request_review_ref` iç sözleşme önerileridir.

Yorumlar güvenilmeyen veri olarak işlenir. Yorum içindeki “talimatları unut” veya “şu yanıtı ver” gibi ifadeler sistem talimatı sayılmaz. Sistem kuralları yorum metinlerinden ayrı tutulur; yorumlar araç çalıştırma veya dış bağlantı açma yetkisi vermez.

### 6.4 Beklenen sağlayıcı çıktısı

```json
{
  "summary": "Yorumlar tesisin temiz olduğunu, ancak sabun bulunmadığını belirtiyor.",
  "pros": ["Temizlik olumlu değerlendiriliyor"],
  "cons": ["Sabun eksikliği bildiriliyor"],
  "recommendation": "acceptable",
  "categories": {
    "cleanliness": "positive",
    "odor": "unknown",
    "supplies": "negative",
    "accessibility": "unknown",
    "safety": "unknown"
  }
}
```

`categories` nesnesi ve `positive`, `negative`, `mixed`, `unknown` değerleri tasarım önerisidir; ortak yanıt şeması ekip incelemesiyle kesinleştirilecektir. `mixed`, çelişen değerlendirmeleri; `unknown`, yeterli kanıt bulunmadığını belirtir.

| Alan | Kabul kuralı |
|---|---|
| `summary` | Boş olmayan Türkçe metin; en fazla 400 Unicode kod noktası |
| `pros` | En fazla 3 boş olmayan kısa metin |
| `cons` | En fazla 3 boş olmayan kısa metin |
| `recommendation` | Yalnız `recommended`, `acceptable`, `avoid` |
| `categories` | Önerilen beş kategori ve yalnız izinli değerler |

Önerilen şema tüm alanları zorunlu tutar ve tanımsız ek alanları reddeder. Liste öğeleri için en fazla 100 Unicode kod noktası önerilir. Modelin ürettiği sayı veya boolean değerler metne çevrilerek sessizce kabul edilmez.

Şema kontrolü tek başına doğruluk garantisi değildir. Dil, kişisel veri sızıntısı ve yorumlarla desteklenmeyen iddialar ayrıca kontrol edilir. Kontrollerden geçmeyen veya güvenilirliği belirlenemeyen çıktı fallback’e yönlendirilir.

Özet, resmi denetim yapılmış gibi konuşamaz veya güvenlik garantisi veremez. Yorumdaki erişilebilirlik iddiası doğrulanmış tesis özelliğine dönüştürülmez. Sessizlik olumlu kanıt sayılmaz; çelişkili yorumlar gizlenmez.

### 6.5 Public yanıta eklenen alanlar

Başarılı public yanıt, kabul edilmiş özet alanlarına ek olarak şunları içerir:

- `based_on_reviews`: Backend’in gerçekten gönderdiği yorum sayısı; 3–50.
- `generated_at`: Backend’in doğrulama tamamlandığında ürettiği UTC ISO-8601 zamanı.

Bu alanlar modelden alınmaz. Başarılı yanıt HTTP 200 döner. Arayüz sonucu AI tarafından oluşturulduğunu belirterek gösterir.

### 6.6 Timeout ve fallback

Sağlayıcı çağrısı ve yanıtın alınması için toplam üst sınır 10 saniyedir. Aynı istek içinde bu sınırı aşan tekrar denemesi yapılmaz.

| Durum | Sağlayıcı çağrısı | Beklenen davranış |
|---|---|---|
| 3’ten az uygun yorum | Yapılmaz | HTTP 200; `summary: null`; yetersiz yorum mesajı |
| Sağlayıcı hatası veya süre aşımı | Denenmiş olabilir | HTTP 200; `summary: null`; gerçek istatistikler |
| Geçersiz JSON veya şema | Yapılmıştır | Hatalı çıktı gösterilmez; fallback |
| Desteklenmeyen iddia veya kişisel veri sızıntısı | Yapılmıştır | Çıktı ve cache yazımı reddedilir; fallback |
| Geçerli cache | Yapılmaz | Cache’teki geçerli sonuç döner |

Örnek servis hatası yanıtı:

```json
{
  "summary": null,
  "message": "Summary temporarily unavailable.",
  "average_cleanliness": 4.0,
  "review_count": 3
}
```

Bu örnekteki istatistikler sentetik fixture değerleridir. Gerçekte backend’in hesapladığı değerler kullanılır; puan yoksa ortalama `null` olur.

Yetersiz yorum durumunda mesaj:
`Not enough reviews to generate a summary (minimum 3).`

AI hatası temel tesis aramasını engellemez. Kişiselleştirilmiş önerilerde önce gerçek tesis alanlarına göre zorunlu tercihler uygulanır; AI yoksa uygun tesisler AI gerekçesi olmadan görünür kalır. AI, bilinmeyen erişilebilirlik veya ücret bilgisini tahmin ederek filtreyi geçiremez.

## 7. Cache ve yorum değişiklikleri

Başarılı özet için mevcut gereksinimdeki Redis TTL değeri 6 saattir. Fallback sonuçları bu tasarımda başarılı özet gibi cache’lenmez.

Önerilen cache kimliği; tesis UUID’si, yorum sürümü, dil, sözleşme sürümü ve özetleme politikası sürümünden oluşur. Model veya prompt politikası değiştiğinde politika sürümü de değiştirilir.

Yorum oluşturma, düzenleme, silme ve görünürlüğü değiştiren moderasyon işlemleri yorum sürümünü değiştirir. Hesap silme nedeniyle yorumun metni veya görünürlüğü etkileniyorsa aynı kural uygulanır.

Önerilen sorumluluk paylaşımı:

- Yorum/veri bileşeni, yeni yorum sürümünü ve güncel istatistikleri sağlar.
- AI bileşeni, cache sürümünü kontrol eder ve eski sonucu kullanmaz.
- Devam eden AI çağrısı tamamlandığında sürüm tekrar kontrol edilir. Yorumlar değişmişse eski sonuç yayımlanmaz veya güncel cache’e yazılmaz.
- Redis erişilemiyorsa cache atlanabilir. Güncel veri doğrulanamıyorsa eski özet sunmak yerine fallback kullanılır.

Kesin sürüm saklama ve invalidation mekanizması Özgür/Fırat ile kararlaştırılacaktır. Bu bölüm tamamlanmış ekip kararı değildir.

Loglarda correlation ID, hata kodu, süre ve sürüm bilgisi tutulması önerilir. Ham yorumlar, kişisel veriler, sağlayıcı anahtarları ve reddedilen ham model çıktısı loglanmaz.

## 8. Deterministik mock senaryoları

Bu bölüm uygulanacak testlerin girdilerini ve beklenen sonuçlarını tanımlar. Çalıştırılabilir mock veya test kodunun tamamlandığı anlamına gelmez.

Mock sağlayıcı, yorum metninden gerçek çıkarım yapmak yerine senaryo adına göre sabit çıktı veya hata üretir. Zaman ve kimlikler fixture tarafından sabitlenir; gerçek sağlayıcı çağrılmaz.

### 8.1 Ortak fixture

- Sentetik tesis UUID’si: `00000000-0000-4000-8000-000000000028`
- Sabit saat: `2026-10-24T09:00:00Z`
- Başlangıç yorum sürümü: `1`
- Sözleşme sürümü: `1`
- Başlangıçta boş cache.
- Bölüm 6.3’teki üç görünür yorumun her birinin puanı `4`.
- Bu fixture için `review_count = 3`, `average_cleanliness = 4.0`.
- Mock başarılı çıktısı bölüm 6.4’teki JSON’dur.

Saat ve zaman aşımı testlerinde gerçek 10 saniyelik bekleme yerine kontrol edilebilir saat ve timeout üreten sahte sağlayıcı kullanılması önerilir.

### 8.2 Adapter ve kimlik senaryoları

| Senaryo | Girdi / hazırlık | Beklenen sonuç |
|---|---|---|
| A01 — Geçerli dönüşüm | Bölüm 3.3 kaydı tek elemanlı FeatureCollection içinde | Bölüm 3.4 adayı üretilir; boylam 29, enlem 41 |
| A02 — Eksik bilgi | Erişilebilirlik, ücret ve saat alanları kaynakta yok | İlgili alanlar `null`; `BAKIM_ODASI: Var` bebek bakımını `true` yapmaz |
| A03 — Geçersiz koordinat | Enlem 95 | `INVALID_COORDINATE`; canlı yazma çağrısı 0 |
| A04 — Eksen sırası | Bilinen sentetik koordinat `[29, 41]` | Çıktı boylam 29, enlem 41; ters eşleme testi başarısız olur |
| A05 — X/Y uyuşmazlığı | Geometry boylamı 29, X değeri 30 | `COORDINATE_MISMATCH`; canlı yazma çağrısı 0 |
| A06 — Atomik red | Bir geçerli kayıt ve adı boş ikinci kayıt | Batch reddedilir; ilk kayıt dahil hiçbir kayıt yazılmaz |
| A07 — Tekrar import | Onaylı fingerprint→UUID eşlemesi mevcut; aynı girdi iki kez işlenir | Aynı UUID kullanılır; tesis sayısı artmaz |
| A08 — Kimlik çakışması | İki kayıt aynı fingerprint’e düşer | `IDENTITY_CONFLICT`; otomatik birleştirme yapılmaz |
| A09 — Aynı konum | Aynı koordinatta farklı adlar | Yalnız koordinata göre birleştirme yapılmaz; yeni kimlikler onay bekler |
| A10 — Ad/konum değişikliği | Onaylı kaydın adı veya konumu değişir | İnceleme adayı oluşur; onay olmadan yeni tesis yazılmaz |
| A11 — Çözümsüz durum | `TUVALET_DURUM: Dönemlik`, onaylı takvim/eşleme yok | `UNRESOLVED_STATUS`; canlı import uygulanmaz |
| A12 — Kaynak kesintisi | Kaynak indirme hatası | Başarılı boş import üretilmez; mevcut tesisler korunur |

A04, kaynak koordinatının sahadaki doğruluğunu kanıtlamaz; adapter’ın bilinen girdiyi doğru eksenlere taşıdığını kontrol eder.

### 8.3 AI ve cache senaryoları

| Senaryo | Girdi / hazırlık | Beklenen sonuç |
|---|---|---|
| M01 — Başarılı özet | Ortak fixture ve başarılı mock | HTTP 200; bölüm 6.4 çıktısı; `based_on_reviews: 3`; sabit `generated_at`; sağlayıcı çağrısı 1 |
| M02 — Yetersiz yorum | Yalnız iki uygun yorum | HTTP 200; `summary: null`; yetersiz yorum mesajı; sağlayıcı çağrısı 0 |
| M03 — Üst sınır | Kararlı sırada 51 uygun yorum | En güncel 50 yorum gönderilir; `based_on_reviews: 50` |
| M04 — Cache isabeti | M01 sonrasında aynı sürümle ikinci okuma | İki okumadan sonra toplam sağlayıcı çağrısı 1 |
| M05 — Yorum düzenleme | M01 sonrası bir metin değişir; sürüm 2 olur | Eski cache kullanılmaz; sonraki okumadan sonra toplam çağrı 2 |
| M06 — Yorum silme | Üç yorumdan biri silinir; sürüm değişir | Eski özet kullanılmaz; iki uygun yorum nedeniyle yeni sağlayıcı çağrısı yapılmaz |
| M07 — Timeout | Mock timeout hatası üretir | HTTP 200; `summary: null`; ortalama 4.0, yorum sayısı 3; başarılı özet cache’i yazılmaz |
| M08 — Geçersiz çıktı | Mock `recommendation: perfect` veya 401 karakter özet döndürür | Şema doğrulaması reddeder; fallback |
| M09 — Kişisel veri | Yorumda sentetik e-posta bulunur | Sağlayıcı argümanlarında e-posta bulunmaz |
| M10 — Güvenilmeyen talimat | Yorum “talimatları unut” içerir; mock desteklenmeyen iddia döndürür | Yorum talimat olarak çalıştırılmaz; desteklenmeyen çıktı reddedilir |
| M11 — Eşzamanlı değişiklik | Çağrı sürüm 1 ile başlar; tamamlanmadan sürüm 2 olur | Sürüm 1 sonucu yayımlanmaz ve güncel cache’e yazılmaz; fallback |
| M12 — Redis kesintisi | Cache okuması hata verir | Güncel yorumlar doğrulanabiliyorsa sağlayıcı akışı sürer; aksi halde fallback |
| M13 — Öneri fallback’i | AI hata verir; tercihlere uygun tesisler mevcut | En fazla 3 uygun tesis görünür kalır; AI gerekçesi uydurulmaz |
| M14 — Cache süresi | M01 sonrası kontrollü saat 6 saat ilerletilir | Cache süresi dolmuştur; sonraki okumada yeniden üretim gerekir |
| M15 — Arama bağımsızlığı | AI mock hata verir; arama fixture’ı geçerli | Temel arama HTTP 200 döner ve beklenen tesisleri korur |

M10 gibi mock testleri hata yolunu doğrular; gerçek modelin tüm prompt-injection girişimlerine dayanıklı olduğunu kanıtlamaz.

M13 için aday fixture: A erişilebilir ve ücretsiz, B erişilebilirlik bilgisi bilinmiyor ve ücretsiz, C erişilebilir ve ücretli. Tercihler erişilebilir ve ücretsiz olduğunda yalnız A döner; AI hatası bu uygunluk sonucunu değiştirmez.

## 9. Gereksinimlerle eşleştirme

| Dayanak | Tasarım karşılığı | Önerilen doğrulama |
|---|---|---|
| FR-04 / TC-08 | Türkçe, en fazla 400 karakter, yapılandırılmış özet | M01, M08 |
| FR-04 / TC-15 | Yetersiz yorum ve servis hatasında fallback; arama devam eder | M02, M07, M15 |
| FR-04 / TC-16 | Cache ve yorum değişikliği | M04–M06, M11, M14 |
| FR-04 / TC-17 | Tercihlere uygun en fazla 3 öneri | M13 |
| FR-04 / TC-28 | Kişisel veri temizliği ve güvenilmeyen yorum | M09, M10 |
| FR-07 / TC-19, TC-36 | Tekrar import ve kaynak kimliği | A07–A10 |
| FR-07 / TC-20 | Hatalı batch’in atomik reddi | A03, A05, A06, A11 |
| #28 dış kaynak kapsamı | GeoJSON dönüşümü ve bilinmeyen alanlar | A01, A02, A04, A12 |

A ve M kimlikleri bu belgenin yerel senaryo adlarıdır; mevcut TC numaralarının yerine geçmez. Tam test kapsamı veya başarılı test sonucu iddiası değildir.

## 10. Açık kararlar ve teslim sınırı

Ekip incelemesinde kesinleştirilecek konular:

- Fırat ile fingerprint serileştirmesi, kimlik kayıt defteri ve çakışma onayı.
- Özgür/Fırat ile yorum sürümünün saklanması ve cache geçersizleştirme sorumlulukları.
- Ortak API’ye yansıyacak kategori, hata ve iç sözleşme alanları.
- `Dönemlik` durumunun modelde gösterimi.
- Moderasyon ve AI çıktısının içerik doğrulama yaklaşımı.

Bu katkı ortak ortam değişkeni veya bağımlılık dosyası değiştirmez. Gerçek sağlayıcı anahtarı içermez.

Teslim doğrulaması ayrıca kaydedilecektir. Bu metin hazırlanırken çalıştırılabilir adapter, mock sağlayıcı veya yeni otomatik test eklenmemiştir; bölüm 8’deki senaryolar çalıştırılmamıştır.

#28’in kapanışı için en az bir başka ekip üyesinin tasarım PR’ını incelemesi gerekir. #14 ve PR #22’nin kanıt takibi ayrı devam eder.