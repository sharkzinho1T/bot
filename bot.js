import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js'

const BOT_TOKEN        = process.env.BOT_TOKEN
const CLIENT_ID        = process.env.CLIENT_ID
const GUILD_ID         = process.env.GUILD_ID
const SERVER_URL       = process.env.SERVER_URL
const HEARTBEAT_SECRET = process.env.HEARTBEAT_SECRET

if (!BOT_TOKEN || !CLIENT_ID || !GUILD_ID || !SERVER_URL) {
  console.error('[ORION] Variáveis faltando: BOT_TOKEN, CLIENT_ID, GUILD_ID, SERVER_URL')
  process.exit(1)
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
})

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Mostra o ping do bot'),

  new SlashCommandBuilder()
    .setName('orion')
    .setDescription('Comandos do Orion')
    .addSubcommand(sub =>
      sub.setName('status').setDescription('Status do Orion')
    )
    .addSubcommand(sub =>
      sub.setName('painel').setDescription('Link do painel')
    )
    .addSubcommand(sub =>
      sub.setName('membros').setDescription('Total de membros')
    )
    .addSubcommand(sub =>
      sub.setName('links').setDescription('Total de links')
    )
    .addSubcommand(sub =>
      sub.setName('servidores').setDescription('Servidores do bot')
    )
    .addSubcommand(sub =>
      sub.setName('dashboard').setDescription('Endereço do dashboard')
    ),

  new SlashCommandBuilder()
    .setName('meu-servidor')
    .setDescription('Configurações do seu servidor')
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Veja as configurações atuais do servidor')
    )
    .addSubcommand(sub =>
      sub.setName('cargo-verificado')
        .setDescription('Define o cargo dado automaticamente para quem se verificar')
        .addRoleOption(opt =>
          opt.setName('cargo')
            .setDescription('Cargo a ser atribuído após verificação')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remover-cargo')
        .setDescription('Remove o cargo automático de verificação')
    ),

  new SlashCommandBuilder()
    .setName('criar-cargo-sem-verificacao')
    .setDescription('Cria o cargo "NÃO VERIFICADO ❎" sem permissão de ver ou falar em nenhum canal')
].map(c => c.toJSON())

/* ── HEARTBEAT ───────────────────────────────── */

async function heartbeat() {
  try {
    const guilds  = [...client.guilds.cache.values()]
    const members = guilds.reduce((t, g) => t + (g.memberCount || 0), 0)
    const headers = { 'Content-Type': 'application/json' }
    if (HEARTBEAT_SECRET) headers['x-heartbeat-secret'] = HEARTBEAT_SECRET

    const r = await fetch(`${SERVER_URL}/api/bot/heartbeat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        online:    true,
        username:  client.user?.tag   ?? null,
        id:        client.user?.id    ?? null,
        guilds:    guilds.length,
        members,
        guildList: guilds.map(g => ({ id: g.id, name: g.name, members: g.memberCount || 0 })),
        ping:      client.ws.ping,
        uptime:    process.uptime()
      })
    })

    if (!r.ok) { console.log(`[HEARTBEAT] HTTP ${r.status}`); return }
    console.log(`[HEARTBEAT] OK | Servidores: ${guilds.length} | Membros: ${members} | Ping: ${client.ws.ping}ms`)
  } catch (err) {
    console.log(`[HEARTBEAT] ERRO: ${err.message}`)
  }
}

/* ── HELPER: checa se membro tem cargo acima do cargo alvo ── */

function memberIsAboveRole(member, role) {
  // pega a posição mais alta dos cargos do membro
  const highestPos = member.roles.cache.reduce(
    (max, r) => Math.max(max, r.position),
    0
  )
  // o membro precisa ter pelo menos um cargo acima do cargo alvo
  return highestPos > role.position
}

/* ── HELPER: busca/salva config do servidor via server API ── */

async function getGuildConfig(guildId) {
  try {
    const headers = {}
    if (HEARTBEAT_SECRET) headers['x-heartbeat-secret'] = HEARTBEAT_SECRET
    const r    = await fetch(`${SERVER_URL}/api/guild-config/${guildId}`, { headers })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

async function setGuildConfig(guildId, verifyRoleId) {
  try {
    const headers = {
      'Content-Type': 'application/json'
    }
    if (HEARTBEAT_SECRET) headers['x-heartbeat-secret'] = HEARTBEAT_SECRET
    const r = await fetch(`${SERVER_URL}/api/guild-config/${guildId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ verify_role_id: verifyRoleId })
    })
    return r.ok
  } catch {
    return false
  }
}

/* ── READY ───────────────────────────────────── */

client.once('ready', async () => {
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('        ORION V2 — ONLINE')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Bot:        ${client.user.tag}`)
  console.log(`ID:         ${client.user.id}`)
  console.log(`Servidores: ${client.guilds.cache.size}`)
  console.log(`Server URL: ${SERVER_URL}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN)
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
    console.log('[DISCORD] Comandos registrados.')
  } catch (err) {
    console.log(`[DISCORD] Erro ao registrar comandos: ${err.message}`)
  }

  await heartbeat()
  setInterval(heartbeat, 10000)
})

/* ── INTERACTIONS ────────────────────────────── */

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return

  /* ── /ping ── */
  if (interaction.commandName === 'ping') {
    return interaction.reply(`🏓 Pong! **${client.ws.ping}ms**`)
  }

  /* ── /orion ── */
  if (interaction.commandName === 'orion') {
    const sub = interaction.options.getSubcommand()

    if (sub === 'status') {
      const totalMembers = [...client.guilds.cache.values()]
        .reduce((t, g) => t + (g.memberCount || 0), 0)
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🔮 Orion V2')
            .setDescription('Status atual do sistema.')
            .addFields(
              { name: '🤖 Bot',        value: client.user?.tag ?? '—', inline: true },
              { name: '🏠 Servidores', value: String(client.guilds.cache.size),      inline: true },
              { name: '👥 Membros',    value: String(totalMembers),                   inline: true },
              { name: '📡 Ping',       value: `${client.ws.ping}ms`,                 inline: true }
            )
        ]
      })
    }

    if (sub === 'painel' || sub === 'dashboard') {
      return interaction.reply(`🔮 **Orion V2**\n\nPainel: ${SERVER_URL}/dash/`)
    }

    if (sub === 'membros') {
      const members = [...client.guilds.cache.values()]
        .reduce((t, g) => t + (g.memberCount || 0), 0)
      return interaction.reply(`👥 **Membros:** ${members}`)
    }

    if (sub === 'links') {
      try {
        const headers = {}
        if (HEARTBEAT_SECRET) headers['x-heartbeat-secret'] = HEARTBEAT_SECRET
        const r    = await fetch(`${SERVER_URL}/api/links/count`, { headers })
        const data = await r.json()
        return interaction.reply(`🔗 **Links de autenticação:** ${data.count ?? 0}`)
      } catch {
        return interaction.reply('❌ Não foi possível consultar os links.')
      }
    }

    if (sub === 'servidores') {
      const guilds = [...client.guilds.cache.values()]
      const text   = guilds.length
        ? guilds.map(g => `• **${g.name}** — ${g.memberCount || 0} membros`).join('\n')
        : 'Nenhum servidor encontrado.'
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle('🏠 Servidores').setDescription(text)]
      })
    }
  }

  /* ── /meu-servidor ── */
  if (interaction.commandName === 'meu-servidor') {
    const sub    = interaction.options.getSubcommand()
    const member = interaction.member
    const guild  = interaction.guild

    if (!guild) {
      return interaction.reply({
        content: '❌ Este comando só pode ser usado dentro de um servidor.',
        ephemeral: true
      })
    }

    /* ── /meu-servidor info ── */
    if (sub === 'info') {
      const config = await getGuildConfig(guild.id)

      const roleText = config?.verify_role_id
        ? `<@&${config.verify_role_id}>`
        : '❌ Nenhum cargo configurado'

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`⚙️ Configurações — ${guild.name}`)
            .addFields(
              { name: '🏠 Servidor',         value: guild.name,                     inline: true },
              { name: '🆔 ID',               value: guild.id,                       inline: true },
              { name: '✅ Cargo verificado', value: roleText,                        inline: false }
            )
            .setFooter({ text: 'Use /meu-servidor cargo-verificado para configurar' })
        ],
        ephemeral: true
      })
    }

    /* ── /meu-servidor cargo-verificado ── */
    if (sub === 'cargo-verificado') {
      const role = interaction.options.getRole('cargo')

      // checa se quem usou o comando tem cargo acima do cargo alvo
      if (!memberIsAboveRole(member, role)) {
        return interaction.reply({
          content: `❌ Você precisa ter um cargo **acima** de ${role} para configurá-lo como cargo de verificação.`,
          ephemeral: true
        })
      }

      // checa se o bot tem cargo acima do cargo alvo (pra poder atribuir)
      const botMember = guild.members.cache.get(client.user.id)
        ?? await guild.members.fetch(client.user.id)

      if (!memberIsAboveRole(botMember, role)) {
        return interaction.reply({
          content: `❌ Meu cargo precisa estar **acima** de ${role} na hierarquia para eu poder atribuí-lo.`,
          ephemeral: true
        })
      }

      const ok = await setGuildConfig(guild.id, role.id)

      if (!ok) {
        return interaction.reply({
          content: '❌ Erro ao salvar configuração. Tente novamente.',
          ephemeral: true
        })
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Cargo de verificação configurado!')
            .setDescription(`A partir de agora, quem se verificar via link de auth receberá automaticamente o cargo ${role}.`)
            .setColor(0x3ba55d)
        ],
        ephemeral: true
      })
    }

    /* ── /meu-servidor remover-cargo ── */
    if (sub === 'remover-cargo') {
      const config = await getGuildConfig(guild.id)

      if (!config?.verify_role_id) {
        return interaction.reply({
          content: '❌ Nenhum cargo de verificação configurado.',
          ephemeral: true
        })
      }

      // checa se tem cargo acima do cargo configurado
      const role = guild.roles.cache.get(config.verify_role_id)
      if (role && !memberIsAboveRole(member, role)) {
        return interaction.reply({
          content: `❌ Você precisa ter um cargo **acima** de ${role} para removê-lo.`,
          ephemeral: true
        })
      }

      const ok = await setGuildConfig(guild.id, null)

      if (!ok) {
        return interaction.reply({
          content: '❌ Erro ao remover configuração.',
          ephemeral: true
        })
      }

      return interaction.reply({
        content: '✅ Cargo de verificação removido com sucesso.',
        ephemeral: true
      })
    }
  }
})

  /* ── /criar-cargo-sem-verificacao ── */
  if (interaction.commandName === 'criar-cargo-sem-verificacao') {
    const guild  = interaction.guild
    const member = interaction.member

    if (!guild) {
      return interaction.reply({
        content: '❌ Este comando só pode ser usado dentro de um servidor.',
        ephemeral: true
      })
    }

    // só quem tem permissão de gerenciar cargos/canais pode usar
    if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: '❌ Você precisa da permissão **Gerenciar Cargos** para usar este comando.',
        ephemeral: true
      })
    }

    await interaction.deferReply({ ephemeral: true })

    try {
      // verifica se o cargo já existe
      const existing = guild.roles.cache.find(r => r.name === 'NÃO VERIFICADO ❎')
      if (existing) {
        return interaction.editReply({
          content: `❌ O cargo **NÃO VERIFICADO ❎** já existe: ${existing}`,
        })
      }

      // cria o cargo sem permissões
      const role = await guild.roles.create({
        name: 'NÃO VERIFICADO ❎',
        permissions: [],
        reason: 'Cargo criado pelo Orion V2 — sem acesso a canais'
      })

      // busca todos os canais de texto e voz
      const channels = [...guild.channels.cache.values()].filter(
        c => c.type === 0 || c.type === 2 || c.type === 4 // GUILD_TEXT, GUILD_VOICE, GUILD_CATEGORY
      )

      let success = 0
      let failed  = 0

      for (const channel of channels) {
        try {
          await channel.permissionOverwrites.create(role, {
            ViewChannel:  false,
            SendMessages: false,
            Connect:      false
          })
          success++
        } catch {
          failed++
        }
      }

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Cargo criado com sucesso!')
            .setDescription(`O cargo ${role} foi criado e bloqueado em todos os canais.`)
            .addFields(
              { name: '📋 Nome',             value: 'NÃO VERIFICADO ❎',       inline: true },
              { name: '🔒 Canais bloqueados', value: String(success),           inline: true },
              { name: '⚠️ Falhas',            value: String(failed),            inline: true }
            )
            .addFields({
              name: '💡 Próximo passo',
              value: 'Use `/meu-servidor cargo-verificado` para definir o cargo que os membros recebem **após** se verificarem.'
            })
            .setColor(0x3ba55d)
        ]
      })

    } catch (err) {
      console.error('[ORION] criar-cargo-sem-verificacao:', err.message)
      return interaction.editReply({
        content: `❌ Erro ao criar o cargo: ${err.message}`
      })
    }
  }
})

client.on('error', err => console.log(`[DISCORD] Erro: ${err.message}`))

console.log('[ORION] Conectando ao Discord...')
client.login(BOT_TOKEN).catch(err => {
  console.error(`[ORION] Falha no login: ${err.message}`)
  process.exit(1)
})
