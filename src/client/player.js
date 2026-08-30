const { DisTube } = require('distube');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { SpotifyPlugin } = require('@distube/spotify');
const { DirectLinkPlugin } = require('@distube/direct-link');
const ffmpegStatic = require('ffmpeg-static');

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
    new SpotifyPlugin(spotifyOptions),
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
          reconnect: '1',
          reconnect_streamed: '1',
          reconnect_delay_max: '5',
        },
        input: {
          probesize: '1024k',
          analyzeduration: '500000',
        },
      },
    },
  });

  return distube;
}

module.exports = { initPlayer };
