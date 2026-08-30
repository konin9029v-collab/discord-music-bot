const { DisTube } = require('distube');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { SpotifyPlugin } = require('@distube/spotify');
const { DirectLinkPlugin } = require('@distube/direct-link');
const ffmpegStatic = require('ffmpeg-static');

/**
 * Initializes and configures the DisTube music player instance (DisTube v5 compatible)
 * Mode Bersih & Stabil: Memutar semua lagu dan link secara lancar tanpa hambatan API.
 * @param {import('discord.js').Client} client
 * @returns {DisTube}
 */
function initPlayer(client) {
  const plugins = [
    new SoundCloudPlugin(),
    new SpotifyPlugin(),
    new DirectLinkPlugin(),
  ];

  const ffmpegPath = process.platform === 'win32' ? (ffmpegStatic || 'ffmpeg') : 'ffmpeg';

  const distube = new DisTube(client, {
    plugins: plugins,
    emitNewSongOnly: true,
    savePreviousSongs: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
    joinNewVoiceChannel: false,
    ffmpeg: {
      path: ffmpegPath,
      args: {
        global: {
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          reconnect: '1',
          reconnect_streamed: '1',
          reconnect_delay_max: '5',
        },
      },
    },
  });

  return distube;
}

module.exports = { initPlayer };
