/**
 * Client-side image preprocessing utility for VaiCar.
 * Automatically resizes and normalizes images using HTML5 Canvas
 * to ensure high-resolution photos taken on smartphones (iPhone/Android)
 * convert to clean, standard, compressed JPEG buffers without failing upload size limits.
 */
export async function processDocumentOrImageFile(
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.85
): Promise<string> {
  if (!file) {
    throw new Error('Nenhum arquivo fornecido.');
  }

  const lowerName = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');

  if (isPdf) {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('O arquivo PDF não pode ser maior que 10MB.');
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Erro ao ler arquivo PDF.'));
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) return reject(new Error('Falha ao processar PDF.'));
        resolve(result);
      };
      reader.readAsDataURL(file);
    });
  }

  return processImageFile(file, maxWidth, maxHeight, quality);
}

export async function processImageFile(
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.85
): Promise<string> {
  if (!file) {
    throw new Error('Nenhum arquivo fornecido.');
  }

  const lowerName = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
  if (isPdf) {
    return processDocumentOrImageFile(file, maxWidth, maxHeight, quality);
  }

  // Validate format
  const isImageMime = file.type.startsWith('image/');
  const hasImageExt = /\.(jpg|jpeg|png|webp|heic|heif|avif)$/i.test(lowerName);

  if (!isImageMime && !hasImageExt) {
    throw new Error('Formato inválido. Selecione um arquivo de imagem (JPG, PNG, WebP) ou PDF.');
  }

  if (file.type === 'image/svg+xml' || lowerName.endsWith('.svg')) {
    throw new Error('Arquivos SVG não são permitidos por segurança.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem.'));
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        return reject(new Error('Falha ao processar arquivo de imagem.'));
      }

      const img = new Image();
      img.onerror = () => {
        // If canvas loading fails (e.g. raw HEIC in non-Safari browser), fallback to raw data URL if it looks like an image
        if (rawDataUrl.startsWith('data:image/')) {
          resolve(rawDataUrl);
        } else {
          reject(new Error('Não foi possível carregar a imagem. Tente outro formato como JPG ou PNG.'));
        }
      };

      img.onload = () => {
        try {
          let { width, height } = img;

          // Downscale if image is larger than maxWidth/maxHeight
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(width, 1);
          canvas.height = Math.max(height, 1);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(rawDataUrl);
          }

          // Draw and re-encode to clean standard JPEG
          ctx.drawImage(img, 0, 0, width, height);
          const normalizedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(normalizedDataUrl);
        } catch {
          // If canvas tainted or failed, return rawDataUrl
          resolve(rawDataUrl);
        }
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
}
