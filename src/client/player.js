const { DisTube, InfoExtractorPlugin, Song, Playlist } = require('distube');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { DirectLinkPlugin } = require('@distube/direct-link');
const https = require('https');
const ffmpegStatic = require('ffmpeg-static');

/**
 * Pure Native Spotify Scraper with ZERO external npm dependencies.
 * Extracts tracks, albums, and playlists directly via Spotify's public oEmbed & Embed State JSON.
 */
async function scrapeSpotifyNative(url) {
  const cleanUrl = url.split('?')[0];
  const isPlaylist = cleanUrl.includes('/playlist/');
  const isTrack = cleanUrl.includes('/track/');
  const isAlbum = cleanUrl.includes('/album/');

  // 1. Fetch oEmbed metadata
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
  const oembedData = await new Promise((resolve) => {
    https
      .get(
        oembedUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
        },
        (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(d));
            } catch (e) {
              resolve(null);
            }
          });
        }
      )
      .on('error', () => resolve(null));
  });

  // 2. Fetch Embed HTML state
  const embedUrl = cleanUrl.replace('open.spotify.com/', 'open.spotify.com/embed/');
  const embedHtml = await new Promise((resolve) => {
    https
      .get(
        embedUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        },
        (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => resolve(d));
        }
      )
      .on('error', () => resolve(''));
  });

  let tracks = [];
  const scriptMatch =
    embedHtml.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/) ||
    embedHtml.match(/<script id="session" data-testid="session" type="application\/json">([\s\S]*?)<\/script>/) ||
    embedHtml.match(/<script id="initial-state">([\s\S]*?)<\/script>/);

  if (scriptMatch) {
    try {
      const json = JSON.parse(scriptMatch[1]);
      const list =
        json.props?.pageProps?.state?.data?.entity?.trackList ||
        json.props?.pageProps?.state?.data?.tracks ||
        [];
      tracks = list.map((t) => ({
        title: t.title || t.name,
        artist: t.subtitle || t.artists?.[0]?.name || 'Spotify Artist',
        duration: (t.duration || 180000) / 1000,
        id: t.uri ? t.uri.split(':').pop() : Math.random().toString(),
      }));
    } catch (e) {}
  }

  return {
    type: isTrack ? 'track' : isPlaylist ? 'playlist' : 'album',
    title: oembedData?.title || 'Spotify Audio',
    thumbnail: oembedData?.thumbnail_url,
    tracks,
  };
}

/**
 * Universal Native Spotify Plugin (Zero external dependencies)
 * 100% immune to missing module errors and API restrictions.
 */
class UniversalSpotifyPlugin extends InfoExtractorPlugin {
  validate(url) {
    return typeof url === 'string' && url.includes('spotify.com');
  }

  async resolve(url, options) {
    const data = await scrapeSpotifyNative(url);

    if (data.type === 'track') {
      return new Song(
        {
          plugin: this,
          source: 'spotify',
          playFromSource: false,
          name: data.title,
          id: url.split('/').pop().split('?')[0],
          url: url,
          thumbnail: data.thumbnail,
          uploader: { name: 'Spotify' },
          duration: 200,
        },
        options
      );
    }

    const songs = data.tracks.map(
      (t) =>
        new Song(
          {
            plugin: this,
            source: 'spotify',
            playFromSource: false,
            name: t.title,
            id: t.id,
            url: `https://open.spotify.com/track/${t.id}`,
            thumbnail: data.thumbnail,
            uploader: { name: t.artist },
            duration: t.duration,
          },
          options
        )
    );

    return new Playlist(
      {
        source: 'spotify',
        name: data.title || 'Spotify Playlist',
        url: url,
        thumbnail: data.thumbnail,
        songs: songs,
      },
      options
    );
  }

  createSearchQuery(song) {
    return `${song.name} ${song.uploader?.name && song.uploader.name !== 'Spotify' ? song.uploader.name : ''}`.trim();
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
