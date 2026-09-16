import * as pdfjsLib from 'pdfjs-dist';
import { detectScannedType } from './scanner-utils';

// @ts-ignore - Ignore TS error for Vite ?url import
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configura o worker do PDF.js para funcionar com Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Processa um arquivo PDF gerando imagens das primeiras páginas para tentar escanear 
 * códigos de barra ou QR codes visualmente primeiro, com fallback para extração de texto.
 */
export async function processPdfForScanner(
  file: File, 
  expectedType: 'pix' | 'barcode' | 'auto' = 'auto'
): Promise<{ fallbackText?: string; imageFiles?: File[]; error?: string } | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Carrega o documento PDF
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    
    const numPages = pdf.numPages;
    let fallbackText: string | undefined = undefined;

    // 1. Extração de texto como fallback (lê todas as páginas)
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items.map((item: any) => item.str).join(' ');
      
      const pixMatch = textItems.match(/000201[0-9a-zA-Z]+/);
      const isPix = pixMatch && pixMatch[0].length > 30 && detectScannedType(pixMatch[0]) === 'pix';
      
      // Busca específica por Linha Digitável
      // O regex procura blocos contendo apenas dígitos, espaços, pontos e traços, evitando
      // juntar CNPJ, datas com barras (/), valores com vírgulas (,), etc.
      let barcodeMatch: string | null = null;
      const regex = /(?:^|[^\d\.\-])((?:\d[\s\.\-]*){43,60})(?=$|[^\d\.\-])/g;
      let match;
      while ((match = regex.exec(textItems)) !== null) {
        const clean = match[1].replace(/\D/g, '');
        // Código físico (44), Linha Digitável de Boleto (47) ou Arrecadação (48)
        if (clean.length === 44 || clean.length === 47 || clean.length === 48) {
          barcodeMatch = clean;
          break;
        }
      }

      const isBarcode = barcodeMatch !== null;

      if (expectedType === 'barcode') {
        if (isBarcode) { fallbackText = barcodeMatch!; break; }
        if (isPix && !fallbackText) { fallbackText = pixMatch![0]; } // Guarda caso não ache barcode nas outras páginas
      } else if (expectedType === 'pix') {
        if (isPix) { fallbackText = pixMatch![0]; break; }
        if (isBarcode && !fallbackText) { fallbackText = barcodeMatch!; }
      } else {
        // Auto
        if (isBarcode) { fallbackText = barcodeMatch!; break; }
        if (isPix) { fallbackText = pixMatch![0]; break; }
      }
    }

    // 2. Renderiza as primeiras páginas como Imagem para tentar escanear visualmente (prioridade)
    const imageFiles: File[] = [];
    const numPagesToRender = Math.min(numPages, 3); // renderiza no máximo as 3 primeiras páginas

    for (let i = 1; i <= numPagesToRender; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // Escala 2.0 para melhor resolução

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
        canvas: canvas,
      };

      await page.render(renderContext).promise;

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (blob) {
        imageFiles.push(new File([blob], `pdf-page-${i}.jpg`, { type: 'image/jpeg' }));
      }
    }

    return { imageFiles, fallbackText };

  } catch (error: any) {
    console.error('Erro ao processar PDF:', error);
    return { error: error?.message || 'Erro desconhecido ao processar PDF' };
  }
}
