const { DisTube, InfoExtractorPlugin, Song, Playlist } = require('distube');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { DirectLinkPlugin } = require('@distube/direct-link');
const ffmpegStatic = require('ffmpeg-static');

/**
 * Custom Browser-spoofed fetch to bypass Spotify CDN blocks on cloud servers (Railway/Linux).
 */
const customFetch = (url, opts = {}) => {
  return globalThis.fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });
};

const spotifyUrlInfo = require('spotify-url-info')(customFetch);

/**
 * Universal Spotify Plugin yang mengekstrak track/playlist secara langsung dengan browser spoofing.
 * 100% Tidak akan pernah memunculkan error "The URL is private or unavailable".
 */
class UniversalSpotifyPlugin extends InfoExtractorPlugin {
  validate(url) {
    return typeof url === 'string' && url.includes('spotify.com');
  }

  async resolve(url, options) {
    try {
      const data = await spotifyUrlInfo.getData(url);
      if (data.type === 'track') {
        const artist = data.subtitle || data.artists?.[0]?.name || 'Spotify Artist';
        return new Song(
          {
            plugin: this,
            source: 'spotify',
            playFromSource: false,
            name: data.title,
            id: url.split('/').pop().split('?')[0],
            url: url,
            thumbnail: data.coverArt?.sources?.[0]?.url,
            uploader: { name: artist },
            duration: (data.duration || 180000) / 1000,
          },
          options
        );
      }

      // Playlist atau Album
      const tracks = data.trackList || [];
      return new Playlist(
        {
          source: 'spotify',
          name: data.title || 'Spotify Playlist',
          url: url,
          thumbnail: data.coverArt?.sources?.[0]?.url,
          songs: tracks.map(
            (t) =>
              new Song(
                {
                  plugin: this,
                  source: 'spotify',
                  playFromSource: false,
                  name: t.title,
                  id: t.uri ? t.uri.split(':').pop() : Math.random().toString(),
                  url: `https://open.spotify.com/track/${t.uri ? t.uri.split(':').pop() : ''}`,
                  thumbnail: data.coverArt?.sources?.[0]?.url,
                  uploader: { name: t.subtitle || 'Artist' },
                  duration: (t.duration || 180000) / 1000,
                },
                options
              )
          ),
        },
        options
      );
    } catch (err) {
      console.error('[UniversalSpotifyPlugin] Scraper error:', err.message);
      throw new Error(`Gagal memuat link Spotify: ${err.message}`);
    }
  }

  createSearchQuery(song) {
    return `${song.name} ${song.uploader?.name || ''}`.trim();
  }

  getRelatedSongs() {
    return [];
  }
}

/**
 * Initializes and configures the DisTube music player instance (DisTube v5 compatible)
 * @param {import('discord.js').Client} client
 * @returns {DisTube}
 */
function initPlayer(client) {
  const plugins = [
    new SoundCloudPlugin(),
    new UniversalSpotifyPlugin(),
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

module.exports = { initPlayer, UniversalSpotifyPlugin };
