# Türkçe AI kabul paketi — 22 Kasım 2026

Bu çalışma PR #68'in `ca955dd` sürümünden ayrı yerel dalda hazırlandı.
Uygulama, profil, model, prompt, gerçek hesaplar ve Docker sitesi değiştirilmedi.
Yeni model çağrısı yapılmadı; canlı veri deposu veya API anahtarı kullanılmadı.

## Ölçülen sonuç ve sınır

[Örnek kümesi](fixtures/turkish-ai-acceptance.json), Emir'in
[21 Kasım ön incelemesindeki](evidence/ai/turkish-acceptance.md) 20 girdiyi
korur; sekiz ek teknik girdi ve on sentetik çıktı adayı içerir. İlk 20 girdi
için mevcut belgedeki insan etiketleri aktarılmıştır; yeni insan değerlendirmesi
yapılmış sayılmaz. Ek girdilerin semantik/mahremiyet incelemesi bekleniyor.

Gerçek `restricted_preparer()` ve `restricted_validator()` ile **38/38 politika
beklentisi eşleşti**. Bunun anlamı 38 Türkçe örneğin dilsel olarak kabul edildiği
değildir: belgedeki kullanılabilir 12 yorumun yalnız **6/12'si** uygun girdi oldu;
elenmesi beklenen **8/8** örnek elendi. Aynı anlamı taşıyan farklı çıktı ifadesi
de reddedildi. Seçilmiş sentetik kümeden gerçek kullanım doğruluğu çıkarılamaz.

Ek kontroller Türkçe büyük harf/olumsuzluk, ayrışık Unicode, izinli sözcükle aynı
olan bilinen yazar adı, gizlenmiş iletişim bilgisi, görünmez karakter temizliği,
koşul ve talimat içeren yorumları kapsar. Çıktılarda uydurma su/erişilebilirlik,
güvenlik sertifikası iddiası, iletişim bilgisi, tekrarlı olumsuz madde, dayanağı
olmayan öneri etiketi ve gizlenen çelişki denetlenir. Bunlar genel NLP veya tüm
kişisel bilgi türleri için güvence değildir.

## Tekrarlanabilir kanıt

```text
python -m pytest tests/test_turkish_ai_acceptance.py -q --junitxml=turkish-offline.xml
python scripts/check_required_junit.py turkish-offline.xml --minimum 39
python scripts/check_turkish_ai_acceptance.py --output yeni-olcum.json
```

38 politika senaryosuna, doldurulmuş insan formunun üzerine yazılmasını engelleyen
bir koruma testi eklenmiştir: **39 test**. Rapor aracı mevcut çıktı/form dosyasını
yeniden yazmaz. Yeni koşular yeni dosya adına kaydedilmelidir.

[Yerel ölçüm](evidence/ai/turkish-offline-2026-11-22.json) model çağrısı sayısını
sıfır ve yeni insan incelemesi durumunu false olarak kaydeder. Hazırlanan CI
adımı aynı testleri ve raporu çalıştırıp 39 başarı, sıfır hata/atlama ister;
bu yerel dal henüz GitHub'a gönderilmediğinden yeni CI sonucu yoktur.

## Gerçek insan incelemesi

[Kararları gösterilmeyen form](evidence/ai/turkish-human-review-pending.md)
28 girdi ve on sentetik çıktı adayı içerir. Çıktılar bu form için hazırlanmış
adaylardır; canlı Gemini üretimi gibi etiketlenmemiştir. Değerlendiren adı/tarih/
commit ve karar-gerekçe alanları boş bırakılmıştır; Codex insan yerine onay
vermemiştir. Formdaki görünmez karakterler inceleyenin görebilmesi için açıklanır.

Yusuf bağımsız etiketleri tamamladıktan sonra Emir'in teknik politika kararlarıyla
karşılaştırılmalı. Kullanılabilir yorumların elenme oranı, yanlış kabul edilen
kişisel/talimat metinleri ve çıktıların kanıt uyumu ayrı raporlanmalı. İnsan
etiketi ile profil kararı aynı şey değildir.

## Kabul senaryolarına etkisi

| Senaryo | Son kanıt | Kalan iş |
|---|---|---|
| TC-08 | #68'de tek olumlu gerçek-Gemini sentetik pilotu kayıtlı; bu paket çevrimdışı Türkçe kapsamını ölçüyor. | Bağımsız dil/kanıt etiketleri ve geçerli doğal ifadelerin elenme sorunu. |
| TC-15 | #68 CI'da sentetik sağlayıcıyla 31 gerçek servisli HTTP vakası geçti. | Hata durumunun dağıtılmış Docker ekranında görsel kabulü. |
| TC-16 | #68'de gerçek Redis cache hit ve yorum düzenleme testleri sentetik sağlayıcıyla çalışıyor. | Daha geniş canlı sağlayıcı kabulü ve rapora doğru sürümlerle aktarım. |
| TC-17 | Gerçek yakınlık/filtrelerle en fazla üç mesafe tabanlı öneri var. | Model üretimi, kanıtla doğrulanan öneri gerekçesi hâlâ yok. |
| TC-28 | Seçili kimlik/talimat/uydurma çıktı örnekleri reddediliyor; bilinen yazarın izinli sözcükle aynı olması da test ediliyor. | Bağımsız mahremiyet incelemesi; genel kişisel bilgi tespitinin kanıtı sayılmaz. |

PR #68 taslak kalır. Bu paket #59/#82'yi kapatmaz; eğitmen onayı, merge veya
Learn teslimi değildir. Codex, Özgür'ün isteğiyle çalıştırılabilir veri kümesini,
raporu ve insan formunu hazırladı; yeni insan etiketleri ve ekip görevlendirmesi
henüz yapılmadı.
