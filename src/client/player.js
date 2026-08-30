const { DisTube } = require('distube');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { SpotifyPlugin } = require('@distube/spotify');
const { DirectLinkPlugin } = require('@distube/direct-link');
const ffmpegStatic = require('ffmpeg-static');

/**
 * Enhanced SpotifyPlugin with deep automatic scraper fallback
 * Handles private / dev-mode Spotify playlists seamlessly without throwing 404 errors.
 */
class AutoFallbackSpotifyPlugin extends SpotifyPlugin {
  constructor(options = {}) {
    super(options);
    if (this.api && typeof this.api.getData === 'function') {
      const originalGetData = this.api.getData.bind(this.api);
      this.api.getData = async (url) => {
        try {
          return await originalGetData(url);
        } catch (err) {
          try {
            const infoScraper = require('spotify-url-info')(globalThis.fetch);
            const data = await infoScraper.getData(url);
            const { type } = this.api.parseUrl(url);
            if (type === 'track') {
              return {
                type: 'track',
                id: this.api.parseUrl(data.uri || url).id,
                name: data.title,
                artists: [{ name: data.subtitle || data.artists?.[0]?.name }],
                duration: data.duration,
                thumbnail: data.coverArt?.sources?.[0]?.url,
              };
            }
            const thumbnail = data.coverArt?.sources?.[0]?.url;
            return {
              type,
              name: data.title,
              thumbnail,
              url,
              tracks: (data.trackList || []).map((i) => ({
                type: 'track',
                id: this.api.parseUrl(i.uri).id,
                name: i.title,
                artists: [{ name: i.subtitle }],
                duration: i.duration,
                thumbnail,
              })),
            };
          } catch (fallbackError) {
            throw err;
          }
        }
      };
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
