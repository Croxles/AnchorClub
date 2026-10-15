# Discord.js Bilet, Çekiliş ve Drop Botu

Discord.js v14 ile hazırlanmış temel bir başlangıç projesidir.

## Gereksinimler
- Node.js 18.18 veya üzeri
- Discord Developer Portal'da oluşturulmuş bir bot
- Sunucuda kanalları yönetme, mesaj gönderme ve mesaj geçmişini okuma izinleri

## Kurulum
1. ZIP'i aç.
2. Proje klasöründe terminal aç ve `npm install` çalıştır.
3. `.env.example` dosyasını `.env` adıyla kopyala.
4. `.env` içindeki `DISCORD_TOKEN`, `CLIENT_ID` ve `GUILD_ID` alanlarını doldur.
5. Komutları test sunucuna yükle: `npm run deploy`
6. Botu başlat: `npm start`

Botu sunucuya davet ederken `bot` ve `applications.commands` kapsamlarını seç. Bot izinleri olarak en az View Channels, Send Messages, Embed Links, Read Message History, Manage Channels ve Send Messages in Threads (kullanmıyorsan gerekli değil) izinlerini değerlendir.

## Komutlar
- `/ticket-panel kanal:#kanal` — bilet paneli gönderir.
- `/giveaway odul sure_dakika kazanan kanal` — çekiliş başlatır.
- `/reroll mesaj_id` — biten çekiliş için yeni kazanan seçer.
- `/drop-start odul aralik_dakika kanal` — otomatik drop başlatır ve ilk drop'u hemen gönderir.
- `/drop-stop` — otomatik drop sistemini durdurur.

## Önemli notlar
- Veriler `data/state.json` dosyasında saklanır. Bu dosyayı herkese açık bir yere koyma; yedekle.
- Bu proje temel sürümdür. Bilet transkripti, log kanalı, kategori seçimi, rol bazlı destek erişimi ve veritabanı gibi özellikler henüz ekli değildir.
- Bilet kapatma işlemi kanalı 5 saniye sonra siler; transcript oluşturmaz.
- Drop sistemi sunucu başına tek bir aktif drop yapılandırması tutar. Bot yeniden başlatıldığında otomatik drop zamanlayıcısı yeniden kurulur.
- Çekilişte katılımcılar botun JSON dosyasında saklanır. Birden fazla bot örneğini aynı veri dosyasıyla çalıştırma.
- Gerçek ödül teslimatını (ör. oyun içi eşya veya para) bot otomatik yapmaz; kazananı duyurur.
- Üretim ortamında JSON yerine SQLite/PostgreSQL, kapsamlı loglama, hata izleme, rol/kategori ayarları ve daha sıkı yetki kontrolleri kullanılması önerilir.
