const { DisTube } = require('distube');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { SpotifyPlugin } = require('@distube/spotify');
const { DirectLinkPlugin } = require('@distube/direct-link');
const ffmpegStatic = require('ffmpeg-static');

/**
 * Enhanced SpotifyPlugin with automatic scraper fallback
 * Handles private / dev-mode Spotify playlists seamlessly without throwing 404 errors.
 */
class AutoFallbackSpotifyPlugin extends SpotifyPlugin {
  async resolve(url, options) {
    try {
      return await super.resolve(url, options);
    } catch (err) {
      // Jika API menolak (misal playlist private), otomatis fallback ke mode scraper
      if (this.api && this.api._tokenAvailable) {
        this.api._tokenAvailable = false;
        try {
          const fallbackResult = await super.resolve(url, options);
          this.api._tokenAvailable = true;
          return fallbackResult;
        } catch (e2) {
          this.api._tokenAvailable = true;
          throw err;
        }
      }
      throw err;
    }
  }
}

/**
 * Initializes and configures the DisTube music player instance (DisTube v5 compatible)
 * @param {import('discord.js').Client} client
 * @returns {DisTube}
 */
function initPlayer(client) {
  const spotifyOptions = {};
  if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    spotifyOptions.api = {
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    };
  }

  const plugins = [
    new SoundCloudPlugin(),
    new AutoFallbackSpotifyPlugin(spotifyOptions),
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

module.exports = { initPlayer, AutoFallbackSpotifyPlugin };
