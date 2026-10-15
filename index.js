require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, Events, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits
} = require('discord.js');
const store = require('./storage');

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN eksik. .env.example dosyasını .env olarak kopyalayıp doldurun.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel]
});
const giveawayTimers = new Map();
const dropTimers = new Map();

const COLORS = { primary: 0x5865F2, success: 0x57F287, warning: 0xFEE75C, danger: 0xED4245 };

function durationText(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d) return `${d} gün ${h} saat`;
  if (h) return `${h} saat ${m} dakika`;
  return `${m} dakika`;
}

function giveawayEmbed(g) {
  const end = Math.floor(g.endsAt / 1000);
  return new EmbedBuilder()
    .setColor(g.ended ? COLORS.warning : COLORS.primary)
    .setTitle(`🎉 Çekiliş: ${g.prize}`)
    .setDescription(
      `**Katılmak için aşağıdaki butona bas!**\n\n` +
      `🏆 Kazanan sayısı: **${g.winnerCount}**\n` +
      `👥 Katılımcı: **${g.entries.length}**\n` +
      `${g.ended ? '⏰ Çekiliş sona erdi.' : `⏰ Bitiş: <t:${end}:R>`}`
    )
    .setFooter({ text: `Çekiliş ID: ${g.messageId || 'oluşturuluyor'}` });
}

function giveawayRow(id, ended = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_join:${id}`)
      .setLabel(ended ? 'Çekiliş sona erdi' : 'Çekilişe katıl')
      .setEmoji('🎉')
      .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(ended)
  );
}

async function finishGiveaway(guildId, messageId, reroll = false) {
  const g = store.state.giveaways[messageId];
  if (!g) throw new Error('Bu çekiliş kayıtlı değil.');
  if (g.ended && !reroll) return [];
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return [];
  const channel = await guild.channels.fetch(g.channelId).catch(() => null);
  if (!channel) return [];
  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return [];

  const pool = [...new Set(g.entries)].filter(id => !g.excludedUsers?.includes(id));
  const winners = [];
  while (pool.length && winners.length < g.winnerCount) {
    const index = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(index, 1)[0]);
  }

  if (!reroll) {
    g.ended = true;
    g.winners = winners;
    store.save();
    if (giveawayTimers.has(messageId)) clearTimeout(giveawayTimers.get(messageId));
    giveawayTimers.delete(messageId);
    await message.edit({ embeds: [giveawayEmbed(g)], components: [giveawayRow(messageId, true)] }).catch(() => {});
  }
  const result = winners.length
    ? `🎉 Tebrikler ${winners.map(id => `<@${id}>`).join(', ')}! **${g.prize}** kazandınız!`
    : `Çekiliş (**${g.prize}**) sona erdi ancak yeterli katılımcı yok.`;
  await channel.send({ content: result }).catch(() => {});
  return winners;
}

function scheduleGiveaway(g) {
  if (giveawayTimers.has(g.messageId)) clearTimeout(giveawayTimers.get(g.messageId));
  if (g.ended) return;
  const delay = Math.max(0, g.endsAt - Date.now());
  const timer = setTimeout(() => {
    finishGiveaway(g.guildId, g.messageId).catch(console.error);
  }, Math.min(delay, 2147483647));
  giveawayTimers.set(g.messageId, timer);
}

async function postDrop(guildId) {
  const config = store.state.drops[guildId];
  if (!config?.active) return;
  const channel = await client.channels.fetch(config.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const dropId = `${guildId}:${Date.now()}`;
  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('📦 DROP YAYINDA!')
    .setDescription(`Ödül: **${config.prize}**\n\nÖdülü almak için ilk sen butona bas!`)
    .setFooter({ text: 'İlk geçerli tıklama kazanır.' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`drop_claim:${dropId}`).setLabel('Ödülü kap').setEmoji('🎁').setStyle(ButtonStyle.Success)
  );
  const message = await channel.send({ embeds: [embed], components: [row] }).catch(err => {
    console.error('Drop gönderilemedi:', err);
    return null;
  });
  if (message) {
    store.state.drops[guildId].activeDrop = {
      id: dropId, messageId: message.id, channelId: channel.id,
      prize: config.prize, claimed: false, createdAt: Date.now()
    };
    store.save();
  }
}

function scheduleDrop(guildId) {
  const config = store.state.drops[guildId];
  if (!config?.active) return;
  if (dropTimers.has(guildId)) clearInterval(dropTimers.get(guildId));
  const interval = Math.max(1, config.intervalMinutes) * 60 * 1000;
  const timer = setInterval(() => postDrop(guildId).catch(console.error), interval);
  dropTimers.set(guildId, timer);
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`${readyClient.user.tag} olarak giriş yapıldı.`);
  for (const g of Object.values(store.state.giveaways)) {
    if (!g.ended) scheduleGiveaway(g);
  }
  for (const [guildId, config] of Object.entries(store.state.drops)) {
    if (config.active) scheduleDrop(guildId);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName, guild, options } = interaction;
      if (!guild) return interaction.reply({ content: 'Bu komut sadece sunucuda kullanılabilir.', ephemeral: true });

      if (commandName === 'ticket-panel') {
        const channel = options.getChannel('kanal', true);
        const embed = new EmbedBuilder()
          .setColor(COLORS.primary)
          .setTitle('🎫 Destek Merkezi')
          .setDescription('Destek ekibine ulaşmak için aşağıdaki butona basarak özel bir bilet açabilirsin.');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_open').setLabel('Bilet oluştur').setEmoji('🎫').setStyle(ButtonStyle.Primary)
        );
        await channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: `Bilet paneli ${channel} kanalına gönderildi.`, ephemeral: true });
      }

      if (commandName === 'giveaway') {
        const prize = options.getString('odul', true);
        const minutes = options.getInteger('sure_dakika', true);
        const winnerCount = options.getInteger('kazanan', true);
        const channel = options.getChannel('kanal', true);
        await interaction.deferReply({ ephemeral: true });
        const g = {
          guildId: guild.id, channelId: channel.id, prize, winnerCount,
          entries: [], endsAt: Date.now() + minutes * 60000, ended: false, winners: []
        };
        const message = await channel.send({ embeds: [giveawayEmbed(g)], components: [giveawayRow('pending')] });
        g.messageId = message.id;
        store.state.giveaways[message.id] = g;
        store.save();
        await message.edit({ embeds: [giveawayEmbed(g)], components: [giveawayRow(message.id)] });
        scheduleGiveaway(g);
        return interaction.editReply(`Çekiliş başlatıldı: ${message.url}`);
      }

      if (commandName === 'reroll') {
        const messageId = options.getString('mesaj_id', true);
        await interaction.deferReply({ ephemeral: true });
        const g = store.state.giveaways[messageId];
        if (!g || g.guildId !== guild.id) return interaction.editReply('Bu sunucuda bu ID ile kayıtlı çekiliş bulunamadı.');
        if (!g.ended) return interaction.editReply('Çekiliş henüz bitmedi.');
        const winners = await finishGiveaway(guild.id, messageId, true);
        return interaction.editReply(winners.length ? `Yeni kazanan(lar): ${winners.map(id => `<@${id}>`).join(', ')}` : 'Seçilebilecek katılımcı bulunamadı.');
      }

      if (commandName === 'drop-start') {
        const prize = options.getString('odul', true);
        const intervalMinutes = options.getInteger('aralik_dakika', true);
        const channel = options.getChannel('kanal', true);
        store.state.drops[guild.id] = { active: true, prize, intervalMinutes, channelId: channel.id, activeDrop: null };
        store.save();
        scheduleDrop(guild.id);
        await postDrop(guild.id);
        return interaction.reply({ content: `Drop sistemi başlatıldı. ${channel} kanalına her ${intervalMinutes} dakikada bir **${prize}** drop'u gönderilecek.`, ephemeral: true });
      }

      if (commandName === 'drop-stop') {
        const config = store.state.drops[guild.id];
        if (config) config.active = false;
        store.save();
        if (dropTimers.has(guild.id)) clearInterval(dropTimers.get(guild.id));
        dropTimers.delete(guild.id);
        return interaction.reply({ content: 'Drop sistemi durduruldu.', ephemeral: true });
      }
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === 'ticket_open') {
      const guild = interaction.guild;
      if (!guild) return interaction.reply({ content: 'Bu işlem sadece sunucuda kullanılabilir.', ephemeral: true });
      const existing = Object.values(store.state.tickets).find(t => t.guildId === guild.id && t.userId === interaction.user.id && !t.closed);
      if (existing) {
        const oldChannel = await guild.channels.fetch(existing.channelId).catch(() => null);
        if (oldChannel) return interaction.reply({ content: `Zaten açık bir biletin var: ${oldChannel}`, ephemeral: true });
        existing.closed = true;
        store.save();
      }

      await interaction.deferReply({ ephemeral: true });
      const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 18) || 'kullanici';
      const channel = await guild.channels.create({
        name: `ticket-${safeName}`,
        type: ChannelType.GuildText,
        topic: `Bilet sahibi: ${interaction.user.id}`,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });
      store.state.tickets[channel.id] = { guildId: guild.id, channelId: channel.id, userId: interaction.user.id, openedAt: Date.now(), closed: false };
      store.save();
      const embed = new EmbedBuilder().setColor(COLORS.primary).setTitle('🎫 Destek Bileti')
        .setDescription(`${interaction.user}, lütfen sorununuzu ayrıntılı biçimde açıklayın.\nDestek ekibi en kısa sürede yardımcı olacaktır.`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Bileti kapat').setEmoji('🔒').setStyle(ButtonStyle.Danger)
      );
      await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });
      return interaction.editReply(`Biletin oluşturuldu: ${channel}`);
    }

    if (interaction.customId === 'ticket_close') {
      const ticket = store.state.tickets[interaction.channelId];
      if (!ticket || ticket.closed) return interaction.reply({ content: 'Bu kanal açık bir bilet olarak kayıtlı değil.', ephemeral: true });
      const isOwner = interaction.user.id === ticket.userId;
      const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
      if (!isOwner && !isStaff) return interaction.reply({ content: 'Bu bileti yalnızca sahibi veya kanal yönetme yetkisi olan yetkililer kapatabilir.', ephemeral: true });
      await interaction.reply({ content: 'Bilet 5 saniye içinde kapatılacak.', ephemeral: true });
      ticket.closed = true;
      ticket.closedAt = Date.now();
      store.save();
      setTimeout(() => interaction.channel?.delete('Bilet kapatıldı').catch(() => {}), 5000);
      return;
    }

    if (interaction.customId.startsWith('giveaway_join:')) {
      const id = interaction.customId.split(':')[1];
      const g = store.state.giveaways[id];
      if (!g || g.ended || Date.now() >= g.endsAt) return interaction.reply({ content: 'Bu çekiliş sona ermiş.', ephemeral: true });
      const idx = g.entries.indexOf(interaction.user.id);
      if (idx >= 0) {
        g.entries.splice(idx, 1);
        await interaction.reply({ content: 'Çekiliş katılımın kaldırıldı.', ephemeral: true });
      } else {
        g.entries.push(interaction.user.id);
        await interaction.reply({ content: 'Çekilişe katıldın! Bol şans. 🍀', ephemeral: true });
      }
      store.save();
      const channel = await client.channels.fetch(g.channelId).catch(() => null);
      const message = channel ? await channel.messages.fetch(id).catch(() => null) : null;
      if (message) await message.edit({ embeds: [giveawayEmbed(g)], components: [giveawayRow(id)] }).catch(() => {});
      return;
    }

    if (interaction.customId.startsWith('drop_claim:')) {
      const dropId = interaction.customId.slice('drop_claim:'.length);
      const config = store.state.drops[interaction.guildId];
      const drop = config?.activeDrop;
      if (!drop || drop.id !== dropId) return interaction.reply({ content: 'Bu drop artık aktif değil.', ephemeral: true });
      if (drop.claimed) return interaction.reply({ content: `Bu drop daha önce <@${drop.winnerId}> tarafından alındı.`, ephemeral: true });
      drop.claimed = true;
      drop.winnerId = interaction.user.id;
      drop.claimedAt = Date.now();
      store.save();
      const embed = new EmbedBuilder().setColor(COLORS.warning).setTitle('📦 DROP KAPILDI!')
        .setDescription(`Ödül: **${drop.prize}**\nKazanan: ${interaction.user}`);
      await interaction.update({ embeds: [embed], components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`drop_claimed:${dropId}`).setLabel('Ödül alındı').setStyle(ButtonStyle.Secondary).setDisabled(true)
        )
      ] });
      return;
    }
  } catch (error) {
    console.error('Etkileşim hatası:', error);
    const message = 'İşlem sırasında bir hata oluştu. Botun kanal ve rol izinlerini kontrol edin.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
