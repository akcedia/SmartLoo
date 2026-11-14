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

Mevcut gereksinimler, önceki analizde bildirilen kaynak bulguları ve bu belgedeki tasarım önerileri ayrı tutulur. 25 Ekim ek incelemesinde yerel ham dosyalardan profil yeniden üretildi; tamamı ve altı dosyanın hash'i haftalık daldaki profile.json ile eşleşti. Bölüm 5.5 bu ölçümleri kimlik önerisinden ayırır. Sonradan sağlanan Drive ZIP'indeki altı ham girdi hash/boyut olarak aynı dosyalarla eşleşti. Özgür'ün reader izni doğrulandı; alıcı oturumundan indirme ve tüm ekip erişimi ayrıca doğrulanmış değildir.

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

Kaynak profilindeki ölçümler ve kimlik önerisinin sınırı bölüm 5.5'te ilişkilendirilmiştir. 422 kaynak kaydı, doğrudan 422 benzersiz fiziksel tesis olarak yorumlanmaz.

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

### 5.5 Profil kanıtı ile kimlik önerisinin ilişkisi (25 Ekim incelemesi)

Dayanak: [profil JSON](../../smartloo-evidence/profile.json), [profil scripti](../../smartloo-evidence/profile_sources.py) ve [tekrar üretim talimatları](../../smartloo-evidence/README.md). İncelenen haftalık dalın başlangıç commit'i: `28c0fa99d903862f41a97d1ec4374d5a5846dad0`. [Paylaşılan Drive ZIP'i](https://drive.google.com/file/d/1LIb0Os6XRlFNi_wjheVSSiH_bhEPk060/view?usp=drive_link) indirildi; altı ham girdinin tamamı kayıtlı hash/boyut değerleri ve yerel tekrar üretimde kullanılan dosyalarla eşleşti. Özgür'ün okuyucu izni metadata'dan doğrulandı. Alıcının oturumundan indirme ve tüm ekip erişimi ayrıca denenmedi.

| Profil alanı | Gözlenen değer | Kimlik kararına etkisi |
|---|---|---|
| `facility.rows` | 422 kayıt | Fiziksel tesis sayısı değildir |
| `facility.feature_keys`, `facility.properties` | Kalıcı tesis ID alanı yok | Resource UUID'si veya feature indeksi tesis ID'si yapılamaz |
| `facility.name.distinct` | 297 | Ad tek başına kimlik değildir |
| `facility.district_name.distinct` | 302 | İlçe + ad da tek başına yeterli değildir |
| `facility.geometry.distinct` | 411 | Aynı konumu paylaşan kayıtlar var; konuma göre birleştirme yapılamaz |
| `facility.candidate_identity.distinct` | 415 | Profil aday anahtarı bile 422 ayrı kimlik üretmiyor |
| `facility.exact_duplicate_rows_excess` | 7 fazla tam tekrar | Tekrarın fiziksel anlamı doğrulanmadan otomatik birleştirilmez |
| `facility.max_xy_difference` | Her eksende < 5e-11 derece | Önerilen 1e-8 tutarlılık eşiği bu dosyayı kapsar; saha doğruluğunu kanıtlamaz |
| `usage.*.rows` toplamı | 1.048.575 | Kullanım satırıdır; tesis/hijyen/canlı doluluk sayısı değildir |

Profilin `norm()` işlevi Türkçe harfleri sadeleştirir, büyük harfe dönüştürür ve noktalama işaretlerini kaldırır. Bölüm 5.2'nin NFC ve harf koruyan fingerprint önerisi farklıdır. Bu nedenle 415 değeri önerilen v1 fingerprint'in benzersizliği veya onaylı tesis sayısı olarak sunulamaz. Uygulama öncesi yeni politikanın kendi çakışma raporu ve test vektörleri gerekir.

### 5.6 Ortak şema ile eşleşme ve açık kararlar

[Veri sözlüğü §2.2 ve §6](../analysis/data/er-data-dictionary.md), [SQL migration](../../db/migrations/001_create_toilets.sql) ve [gereksinimler FR-07](../REQUIREMENTS.MD) birlikte okundu.

| Konu | Mevcut sözleşme / uygulama | Adapter sınırı ve açık karar |
|---|---|---|
| Kaynak kimliği | SQL'de `UNIQUE(source, source_id)` | Önerilen namespace `ibb`; onaylı fingerprint bu çiftin source_id bileşenidir. Sağlayıcı ID'si bulunmadığından `ibb_source_id = null`; fingerprint bu alana yazılmaz |
| Kalıcı UUID | SQL birincil anahtarı `id` | Upsert mevcut UUID'yi korur; yeni UUID yalnız onaylı yeni tesis için üretilir. Çakışmada otomatik UUID yenilemek çözüm değildir |
| Koordinat hassasiyeti | SQL `numeric(9,6)` | Fingerprint, SQL'den geri okunan yuvarlanmış koordinattan hesaplanamaz. Ham hassas koordinat ve onaylı fingerprint ilişkisi korunmalıdır. Hassasiyet/kayıt defteri saklama tasarımı Fırat ile açık |
| Ad ve metadata | Ad en fazla 150 karakter; SQL'de `source_properties` kolonu yok | Adapter uzun adı sessiz kesmez, doğrulama hatası üretir. Ham metadata staging/provenance önerisidir; mevcut tabloya doğrudan yazılabilir nesne değildir |
| Durum | SQL enum: ACTIVE, CLOSED, MAINTENANCE; varsayılan ACTIVE | Çözümsüz/Dönemlik kaynak değeri varsayılana bırakılmaz; batch engellenir. Eşleme/takvim ekip kararı bekler |
| Bilinmeyen imkânlar | SQL boolean/ücret/saat alanları NULL kabul eder | Bölüm 3.4 null değerleri uyumludur; bilinmeyen bilgi filtreyi geçirmez |
| Öneri kaynağı | Veri sözlüğünde `suggestion` ayrılmış namespace önerisi | Dış import bu namespace'i taklit edemez; namespace yetkilendirmesi import bileşeninde ele alınmalıdır |

Alias/kayıt defteri ve review sürümü mevcut migration'da uygulanmış değildir. SQL unique kısıtı aynı fingerprint'in fiziksel anlamını doğrulamaz veya ad/konum değişikliğini kendiliğinden çözmez. Fırat/Özgür onayı, migration ya da ortak API değişikliği bu belgeyle verilmiş sayılmaz.

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

### 7.1 Yorum yazımı ve cache için önerilen arayüz sorumlulukları

Aşağıdaki dağılım inceleme teklifidir; Özgür/Fırat tarafından kabul edilmiş görev paylaşımı değildir. Veri sözlüğü REQ-DB-05, yorum değişikliği başarılı sayılmadan istatistiklerin yenilenmesini ister; MongoDB/PostgreSQL/Redis arasında ortak transaction uygulanmış değildir.

| İşlem / arayüz | Önerilen sorumlu | Başarı ve hata sınırı |
|---|---|---|
| Yorum ekle/düzenle/sil; moderasyonla görünürlük değiştir | Özgür: yorum servisi; Fırat: veri tutarlılığı | İlgili toilet_id için yeni monoton review_revision üret; güncel görünür sayıyı/ortalamayı sağla; tekrar denemede aynı olayın iki kez uygulanmasını önle |
| Hesap silme | Özgür: hesap/yorum akışı | Etkilenen tesisleri belirle; puanların korunması kuralını sürdür; metin/görünürlük etkileniyorsa sürümü değiştir. Kimlik/PII etkisi için cache'in yeniden değerlendirilmesini sağla |
| Tutarlı okuma | Fırat ile veri arayüzü | Yorumlar, review_revision ve istatistikler aynı mantıksal snapshot'a ait olmalı; revision alanının yeri ve store'lar arası hata kurtarma kararı açık |
| Özet okuma/yazma | Emir: AI adapter tasarımı | Cache anahtarına toilet_id + revision + dil + sözleşme/politika sürümü koy; sağlayıcı dönüşünde revision yeniden kontrol edilmeden sonucu yayımlama |
| Invalidation bildirimi | Yorum/veri servisi üretir, AI bileşeni tüketir | Bildirim gecikse bile eski sürüm anahtarı okunmamalı; yalnız Redis DEL yapmak yarış durumunu çözmez. Outbox/retry veya eşdeğer tutarlılık mekanizması ekipçe seçilecek |
| Redis veya güncel veri kesintisi | AI bileşeni | Redis yoksa doğrulanmış güncel veriyle devam edilebilir. Güncel revision doğrulanamıyorsa eski özet yerine fallback; başarı cache'i yazılmaz |

İç snapshot önerisi: `{toilet_id, review_revision, reviews, review_count, average_cleanliness}`. Bu bir public API alan eklemesi değildir. Mutasyonun yarıda kaldığı, yeniden denendiği veya olayın geç geldiği durumda stale özetin nasıl engelleneceği kararlaştırılmadan bu sorumluluk maddesi tamamlandı sayılmaz.

### 7.2 AI şeması için doğrulanan uyum sınırı

FR-04'teki summary/pros/cons/recommendation ve backend'in eklediği based_on_reviews/generated_at alanları korunur. TC-08 fixture'ında categories.odor beklenir; bu, önerilen beş kategorinin tüm ayrıntıları için ortak JSON Schema onayı değildir. Ek alan reddi, dil/PII/içerik denetiminin uygulanma yöntemi, Unicode uzunluk kuralı ve moderasyon alanları Özgür ile kesinleştirilecektir. Veri sözlüğünde reviews.comment vardır; silinmiş/görünür bayraklarının fiziksel modeli henüz kesinleşmemiştir. Sadece `is_anonymized` olması yorumu görünmez saymak için gerekçe değildir.

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

### 8.4 Hata senaryolarının kesin fixture beklentileri

Bunlar çalıştırılmış test sonuçları değildir. Her senaryo bağımsız olarak bölüm 8.1 fixture'ını sıfırlar; saat, yorum sırası ve revision sabittir.

| Senaryo | Kesin hazırlık ve beklenen gözlemler |
|---|---|
| M02 | r1/r2 tutulur; ikisinin puanı 4. HTTP 200; summary null; minimum 3 mesajı; sağlayıcı çağrısı 0; başarı cache yazımı 0. İstatistik döndürülüyorsa gerçek fixture değerleri count=2, average=4.0 |
| M07 | Üç yorum; mock anında TimeoutError üretir. HTTP 200; summary null; servis-hatası mesajı; count=3, average=4.0; sağlayıcı çağrısı 1; başarı cache yazımı 0. Bu, gerçek 10 saniye zamanlayıcısının ölçümü değildir |
| M08a | Başarılı çıktı kopyasında yalnız recommendation=perfect yapılır; doğrulama reddi; M07 ile aynı fallback ve cache beklentisi |
| M08b | Başarılı çıktı kopyasında summary tam 401 adet U+0061 olur; uzunluk reddi; M07 ile aynı fallback. 400 karakter sınırı ayrıca sınır testi olarak kontrol edilmeli |
| M08c | Sağlayıcı bozuk JSON metni döndürür; parse reddi; M07 ile aynı fallback; ham çıktı kullanıcıya/loga taşınmaz |
| M16 — Yorum ekleme | M01 sonrası dördüncü görünür, uygun ve 4 puanlı yorum eklenir, revision=2. Sonraki okuma eski cache'i kullanmaz; toplam sağlayıcı çağrısı 2; based_on_reviews=4 |
| M17 — Sıfır yorum | Görünür yorum yok; count=0, average=null; summary null; yetersiz yorum mesajı; sağlayıcı çağrısı/cache yazımı 0 |
| M18 — Kısmi yazım / geç bildirim | Yorum değişmiş fakat revision/istatistik tutarlılığı doğrulanamıyor veya invalidation bildirimi geç geliyor. Eski özet sunulmaz; fallback; stale sonuç güncel cache'e yazılmaz |

Mevcut tests/test_requirements.py TC-15 timeout/yetersiz yorum, TC-16 düzenleme/cache, TC-28 kişisel veri/güvenilmeyen içerik beklentileri içerir. src/app.py summary/review/import rotaları henüz 501 döndürür; testlerin bulunması bunların geçtiği anlamına gelmez. Bölüm 8'deki A/M senaryolarının tamamı mevcut pytest kataloğunda uygulanmış değildir.

## 9. Gereksinimlerle eşleştirme

| Dayanak | Tasarım karşılığı | Önerilen doğrulama |
|---|---|---|
| FR-04 / TC-08 | Türkçe, en fazla 400 karakter, yapılandırılmış özet | M01, M08 |
| FR-04 / TC-15 | Yetersiz yorum ve servis hatasında fallback; arama devam eder | M02, M07, M15 |
| FR-04 / TC-16 | Cache ve yorum değişikliği | M04–M06, M11, M14, M16, M18 |
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

Teslim doğrulaması ayrıca kaydedilecektir. Bu dokümantasyon güncellemesinde çalıştırılabilir adapter, mock sağlayıcı veya yeni otomatik test eklenmemiştir; bölüm 8’deki senaryolar çalıştırılmamıştır. 25 Ekim kontrolünde altı JSON örneğinin sözdizimi doğrulandı. Mevcut pytest testleri çalıştırılmak istendi ancak ortamda pytest bulunmadığından test toplama başlayamadı (No module named pytest); başarılı uygulama testi sonucu yoktur. Profil scripti ve README'deki tekrar üretim Python bloğu openpyxl 3.1.5 ile ayrı dizinlerde çalıştırıldı; altı ham dosya hash/boyut değeri ve profil JSON'unun tamamı eşleşti. Sonraki Drive kontrolü paketteki altı ham girdinin aynı baytları içerdiğini doğruladı; tekrar üretim analizi yeniden çalıştırılmadı. Owner oturumunda indirme ve Özgür'ün reader izni doğrulandı; alıcı oturumunda indirme yapılmadı.

#28’in kapanışı için en az bir başka ekip üyesinin tasarım PR’ını incelemesi gerekir. #14 ve PR #22’nin kanıt takibi ayrı devam eder.