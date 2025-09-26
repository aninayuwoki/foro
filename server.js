const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { getPublicaciones, updatePublicaciones, uploadImage } = require('./publicaciones');

// --- Verificación de variables de entorno ---
if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER || !process.env.GITHUB_REPO) {
  console.error('Error: Las variables de entorno GITHUB_TOKEN, GITHUB_OWNER, y GITHUB_REPO son obligatorias.');
  process.exit(1); // Termina el proceso si las variables no están definidas
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configuracion inicial
app.use(express.static('public'));
app.use(express.json());

// Verificar directorio para subidas (uploads)
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuración de multer para subida de imágenes en memoria
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

// Función para extraer enlaces de video de un mensaje
function extraerEnlacesVideo(mensaje) {
  const videoInfo = {
    tieneVideo: false,
    plataforma: null,
    videoId: null,
    urlOriginal: null
  };

  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = mensaje.match(youtubeRegex);

  if (youtubeMatch) {
    videoInfo.tieneVideo = true;
    videoInfo.plataforma = 'youtube';
    videoInfo.videoId = youtubeMatch[1];
    videoInfo.urlOriginal = youtubeMatch[0];
    return videoInfo;
  }

  const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/;
  const vimeoMatch = mensaje.match(vimeoRegex);

  if (vimeoMatch) {
    videoInfo.tieneVideo = true;
    videoInfo.plataforma = 'vimeo';
    videoInfo.videoId = vimeoMatch[1];
    videoInfo.urlOriginal = vimeoMatch[0];
    return videoInfo;
  }

  return videoInfo;
}

// --- Endpoints Refactorizados ---

app.get('/api/publicaciones', async (req, res) => {
  try {
    const { data } = await getPublicaciones();
    const hashtag = req.query.hashtag;
    if (hashtag) {
      const filtradas = data.filter(pub => pub.mensaje.toLowerCase().includes('#' + hashtag.toLowerCase()));
      return res.json(filtradas);
    }
    res.json(data);
  } catch (error) {
    console.error('Error al leer publicaciones:', error);
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

app.get('/api/publicaciones/mas-votadas', async (req, res) => {
  try {
    const { data } = await getPublicaciones();
    const ordenadas = data.slice().sort((a, b) => {
      const votosA = (a.likes || 0) - (a.dislikes || 0);
      const votosB = (b.likes || 0) - (b.dislikes || 0);
      if (votosB !== votosA) return votosB - votosA;
      return new Date(b.fecha) - new Date(a.fecha);
    });
    res.json(ordenadas);
  } catch (error) {
    console.error('Error al obtener publicaciones más votadas:', error);
    res.status(500).json({ error: 'Error al obtener publicaciones más votadas' });
  }
});

app.post('/api/publicaciones/:id/estrella', async (req, res) => {
  try {
    const { data, sha } = await getPublicaciones();
    const id = parseInt(req.params.id);
    const { valor } = req.body;

    if (![1, 2, 3, 4, 5].includes(valor)) {
      return res.status(400).json({ error: 'Valor de estrella inválido. Debe ser entre 1 y 5.' });
    }

    const publicacion = data.find(pub => pub.id === id);
    if (!publicacion) return res.status(404).json({ error: 'Publicación no encontrada' });

    if (!Array.isArray(publicacion.estrellas)) publicacion.estrellas = [];
    publicacion.estrellas.push(valor);

    await updatePublicaciones(data, sha);
    res.json({
      mensaje: 'Estrella agregada con éxito',
      total: publicacion.estrellas.length,
      promedio: (publicacion.estrellas.reduce((a, b) => a + b, 0) / publicacion.estrellas.length).toFixed(2)
    });
  } catch (error) {
    console.error('Error al agregar estrella:', error);
    res.status(500).json({ error: 'Error al agregar la puntuación' });
  }
});

app.get('/api/hashtags', async (req, res) => {
  try {
    const { data } = await getPublicaciones();
    const hashtags = new Set();
    data.forEach(pub => {
      const matches = pub.mensaje.match(/#\w+/g);
      if (matches) matches.forEach(tag => hashtags.add(tag.substring(1).toLowerCase()));
    });
    res.json(Array.from(hashtags));
  } catch (error) {
    console.error('Error al leer hashtags:', error);
    res.status(500).json({ error: 'Error al obtener hashtags' });
  }
});

app.post('/api/publicaciones', upload.single('imagen'), async (req, res) => {
  try {
    const { data, sha } = await getPublicaciones();
    const nueva = req.body;

    // Si se sube una imagen, guardarla en GitHub y obtener la URL
    if (req.file) {
      const imageUrl = await uploadImage(req.file);
      nueva.imagen = imageUrl;
    }

    const videoInfo = extraerEnlacesVideo(nueva.mensaje);
    if (videoInfo.tieneVideo) {
      nueva.video = {
        plataforma: videoInfo.plataforma,
        videoId: videoInfo.videoId,
        urlOriginal: videoInfo.urlOriginal
      };
    }

    if (nueva.respuestaA !== undefined) {
      const original = data.find(pub => pub.id === parseInt(nueva.respuestaA));
      if (!original) return res.status(404).json({ error: 'Publicación original no encontrada' });
      original.replicas = original.replicas || [];
      const nuevaReplica = {
        nombre: nueva.nombre,
        mensaje: nueva.mensaje,
        fecha: new Date().toISOString(),
        imagen: nueva.imagen,
        likes: 0,
        dislikes: 0,
        genero: nueva.genero,
        emojiCounts: {}
      };
      if (videoInfo.tieneVideo) nuevaReplica.video = nueva.video;
      original.replicas.push(nuevaReplica);
    } else {
      nueva.id = Date.now();
      nueva.fecha = new Date().toISOString();
      nueva.replicas = [];
      nueva.likes = 0;
      nueva.dislikes = 0;
      nueva.emojiCounts = {};
      const matches = nueva.mensaje.match(/#\w+/g);
      nueva.hashtags = matches ? matches.map(tag => tag.substring(1).toLowerCase()) : [];
      data.push(nueva);
    }
    await updatePublicaciones(data, sha);
    res.status(201).json({ mensaje: 'Guardado con éxito' });
  } catch (error) {
    console.error('Error al guardar publicación:', error);
    res.status(500).json({ error: 'Error al guardar la publicación' });
  }
});

app.post('/api/publicaciones/:id/voto', async (req, res) => {
  try {
    const { data, sha } = await getPublicaciones();
    const id = parseInt(req.params.id);
    const { tipo } = req.body;

    const publicacion = data.find(pub => pub.id === id);
    if (!publicacion) return res.status(404).json({ error: 'Publicación no encontrada' });

    if (tipo === 'like') publicacion.likes = (publicacion.likes || 0) + 1;
    else if (tipo === 'dislike') publicacion.dislikes = (publicacion.dislikes || 0) + 1;

    await updatePublicaciones(data, sha);
    res.json({ likes: publicacion.likes, dislikes: publicacion.dislikes });
  } catch (error) {
    console.error('Error al procesar voto:', error);
    res.status(500).json({ error: 'Error al procesar el voto' });
  }
});

app.post('/api/publicaciones/:id/respuesta/:indice/voto', async (req, res) => {
  try {
    const { data, sha } = await getPublicaciones();
    const id = parseInt(req.params.id);
    const indice = parseInt(req.params.indice);
    const { tipo } = req.body;

    const publicacion = data.find(pub => pub.id === id);
    if (!publicacion || !publicacion.replicas || !publicacion.replicas[indice]) {
      return res.status(404).json({ error: 'Respuesta no encontrada' });
    }

    const respuesta = publicacion.replicas[indice];
    if (tipo === 'like') respuesta.likes = (respuesta.likes || 0) + 1;
    else if (tipo === 'dislike') respuesta.dislikes = (respuesta.dislikes || 0) + 1;

    await updatePublicaciones(data, sha);
    res.json({ likes: respuesta.likes, dislikes: respuesta.dislikes });
  } catch (error) {
    console.error('Error al procesar voto en respuesta:', error);
    res.status(500).json({ error: 'Error al procesar el voto en la respuesta' });
  }
});

app.get('/api/publicaciones/:id', async (req, res) => {
  try {
    const { data } = await getPublicaciones();
    const publicacion = data.find(p => p.id === parseInt(req.params.id));
    if (!publicacion) return res.status(404).json({ error: 'Publicación no encontrada' });
    res.json(publicacion);
  } catch (error) {
    console.error('Error al obtener publicación:', error);
    res.status(500).json({ error: 'Error al obtener la publicación' });
  }
});

app.post('/api/publicaciones/:id/emoji-reaction', async (req, res) => {
  try {
    const { data, sha } = await getPublicaciones();
    const id = parseInt(req.params.id);
    const { emoji, action } = req.body;

    const EMOJIS_PERMITIDOS = ['👍', '😂', '❤️', '🤔', '😢', '😮'];
    if (!EMOJIS_PERMITIDOS.includes(emoji)) return res.status(400).json({ error: 'Emoji no permitido' });
    if (!['add', 'remove'].includes(action)) return res.status(400).json({ error: 'Acción no válida' });

    const publicacion = data.find(pub => pub.id === id);
    if (!publicacion) return res.status(404).json({ error: 'Publicación no encontrada' });

    publicacion.emojiCounts = publicacion.emojiCounts || {};
    publicacion.emojiCounts[emoji] = publicacion.emojiCounts[emoji] || 0;

    if (action === 'add') publicacion.emojiCounts[emoji] += 1;
    else if (action === 'remove') publicacion.emojiCounts[emoji] = Math.max(0, publicacion.emojiCounts[emoji] - 1);

    await updatePublicaciones(data, sha);
    res.json({ success: true, count: publicacion.emojiCounts[emoji] });
  } catch (error) {
    console.error('Error al procesar reacción de emoji:', error);
    res.status(500).json({ error: 'Error al procesar la reacción' });
  }
});

app.get('/api/publicaciones/:id/emoji-reactions', async (req, res) => {
  try {
    const { data } = await getPublicaciones();
    const publicacion = data.find(pub => pub.id === parseInt(req.params.id));
    if (!publicacion) return res.status(404).json({ error: 'Publicación no encontrada' });
    res.json({ publicacionId: publicacion.id, emojiCounts: publicacion.emojiCounts || {} });
  } catch (error) {
    console.error('Error al obtener reacciones de emoji:', error);
    res.status(500).json({ error: 'Error al obtener las reacciones' });
  }
});

app.post('/api/publicaciones/:id/respuesta/:indice/emoji-reaction', async (req, res) => {
  try {
    const { data, sha } = await getPublicaciones();
    const id = parseInt(req.params.id);
    const indice = parseInt(req.params.indice);
    const { emoji, action } = req.body;

    if (!['👍', '😂', '❤️', '🤔', '😢', '😮'].includes(emoji)) return res.status(400).json({ error: 'Emoji no permitido' });
    if (!['add', 'remove'].includes(action)) return res.status(400).json({ error: 'Acción no válida' });

    const publicacion = data.find(pub => pub.id === id);
    if (!publicacion || !publicacion.replicas || !publicacion.replicas[indice]) {
      return res.status(404).json({ error: 'Respuesta no encontrada' });
    }

    const respuesta = publicacion.replicas[indice];
    respuesta.emojiCounts = respuesta.emojiCounts || {};
    respuesta.emojiCounts[emoji] = respuesta.emojiCounts[emoji] || 0;

    if (action === 'add') respuesta.emojiCounts[emoji] += 1;
    else if (action === 'remove') respuesta.emojiCounts[emoji] = Math.max(0, respuesta.emojiCounts[emoji] - 1);

    await updatePublicaciones(data, sha);
    res.json({ success: true, count: respuesta.emojiCounts[emoji] });
  } catch (error) {
    console.error('Error al procesar reacción de emoji en respuesta:', error);
    res.status(500).json({ error: 'Error al procesar la reacción' });
  }
});

app.get('/api/emoji-stats', async (req, res) => {
  try {
    const { data } = await getPublicaciones();
    const stats = {};

    const countEmojis = (item) => {
      if (item.emojiCounts) {
        Object.entries(item.emojiCounts).forEach(([emoji, count]) => {
          stats[emoji] = (stats[emoji] || 0) + count;
        });
      }
    };

    data.forEach(pub => {
      countEmojis(pub);
      if (pub.replicas) pub.replicas.forEach(resp => countEmojis(resp));
    });

    res.json({
      totalReactions: Object.values(stats).reduce((sum, count) => sum + count, 0),
      emojiStats: stats
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de emojis:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Manejador de errores para la carga de archivos
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande. Límite: 2MB.' });
    }
    return res.status(400).json({ error: 'Error al subir el archivo.' });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});