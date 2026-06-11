import { Client, GatewayIntentBits, Events } from 'discord.js';
import { handleInteraction } from './handlers/interaction.js';

export async function startBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`Bot พร้อมแล้ว: ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, handleInteraction);

  await client.login(process.env.DISCORD_TOKEN);
  return client;
}
