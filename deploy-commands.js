require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Bilet açma panelini gönderir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o => o.setName('kanal').setDescription('Panelin gönderileceği kanal').addChannelTypes(ChannelType.GuildText).setRequired(true)),
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Yeni bir çekiliş başlatır.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('odul').setDescription('Çekiliş ödülü').setRequired(true).setMaxLength(200))
    .addIntegerOption(o => o.setName('sure_dakika').setDescription('Çekiliş süresi (dakika)').setRequired(true).setMinValue(1).setMaxValue(10080))
    .addIntegerOption(o => o.setName('kazanan').setDescription('Kazanan sayısı').setRequired(true).setMinValue(1).setMaxValue(20))
    .addChannelOption(o => o.setName('kanal').setDescription('Çekilişin gönderileceği kanal').addChannelTypes(ChannelType.GuildText).setRequired(true)),
  new SlashCommandBuilder()
    .setName('reroll')
    .setDescription('Bir çekiliş için yeni kazanan seçer.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('mesaj_id').setDescription('Çekiliş mesajının ID’si').setRequired(true)),
  new SlashCommandBuilder()
    .setName('drop-start')
    .setDescription('Belirli aralıklarla otomatik drop başlatır.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('odul').setDescription('Drop ödülü').setRequired(true).setMaxLength(200))
    .addIntegerOption(o => o.setName('aralik_dakika').setDescription('Drop aralığı (dakika)').setRequired(true).setMinValue(1).setMaxValue(1440))
    .addChannelOption(o => o.setName('kanal').setDescription('Drop mesajlarının gönderileceği kanal').addChannelTypes(ChannelType.GuildText).setRequired(true)),
  new SlashCommandBuilder()
    .setName('drop-stop')
    .setDescription('Sunucudaki otomatik drop sistemini durdurur.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(c => c.toJSON());

async function main() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    throw new Error('.env dosyasında DISCORD_TOKEN, CLIENT_ID ve GUILD_ID tanımlanmalı.');
  }
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Komutlar test sunucusuna yüklendi.');
}
main().catch(err => { console.error(err); process.exit(1); });
