# #59 / #68 için önerilen ekip mesajı

Henüz gönderilmemiştir; GitHub'a aktarım için Özgür'ün onayı gerekir.

@emirislamoglu-boop @selim-aksu Türkçe AI kabulü için küçük bir inceleme paketi
hazırlandı. 38 sentetik politika örneği ve insan formunu koruyan bir test var;
39 yerel kontrol geçti, model çağrısı yapılmadı. Geçerli etiketli 12 yorumun
yalnız 6'sı mevcut profilden geçiyor. Bunu genel Türkçe kabul başarısı saymıyoruz.

**Emir:** #68'in güncel dalından ilerleyerek `input-07`–`input-12` doğal ifade
eksiklerini ve `output-02` aynı anlamlı çıktı reddini değerlendir. Desteklenen
kapsamı açıkça kararlaştır; mahremiyet/olumsuzluk/çelişki/uydurma iddia kontrollerini
gevşeterek test yeşillendirme. Sözcük/prompt/politika değişirse ilgili cache kimliğini
sürümle ve önceki cache metinlerinin kullanılmadığını doğrula. Etiket ve beklenen
kararları yalnız testi geçirmek için değiştirme; değişimin gerekçesini kaydet.

**Yusuf:** politika sonuçlarına bakmadan `turkish-human-review-pending.md`
formundaki 28 girdi ve 10 çıktı adayını bağımsız etiketle. Ad, tarih, incelenen
commit ve kısa gerekçeleri ekle. Sonra politika sonuçlarıyla karşılaştırıp yanlış
kabul/yanlış retleri ayrı raporla. Rapor otomasyonunun geçmesi insan kabulü
anlamına gelmez; bu kümeden gerçek yorum dağılımına doğruluk oranı çıkarma.

Önerilen ara hedef: **23 Kasım ilk bağımsız değerlendirme ve fark listesi**;
25 Kasım test raporu PR hedefini destekleyecek şekilde düzeltmeleri önceliklendirelim.
Canlı kota/model denemesi gerekirse önce sentetik örnekler ve sayısı belirli küçük
bir plan hazırlayalım; API anahtarını issue/PR/rapora koymayalım.

Kaynaklar: `docs/testing/TURKISH-AI-REVIEW-2026-11-22.md`,
`docs/testing/fixtures/turkish-ai-acceptance.json`,
`docs/testing/evidence/ai/turkish-human-review-pending.md` ve
`docs/testing/evidence/ai/turkish-offline-2026-11-22.json`.

TC-17 model üretimi öneri gerekçesi ayrı açık iş olarak kalıyor. Bu değerlendirme
tamamlanmadan #68'i hazır veya #59/#82'yi Done saymayalım. Özgür ortak runtime/
Docker entegrasyonunu koruyarak koordine ediyor.
