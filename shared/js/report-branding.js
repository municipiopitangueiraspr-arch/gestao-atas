/** Shared municipal branding for human-readable PDF reports. */
const MUNICIPAL_CREST_PATH = "../brasao-pref.png";
let municipalCrestDataUrlPromise = null;

export function getMunicipalCrestUrl() {
  return new URL(MUNICIPAL_CREST_PATH, document.baseURI).href;
}

export function loadMunicipalCrestDataUrl() {
  if (!municipalCrestDataUrlPromise) {
    municipalCrestDataUrlPromise = fetch(getMunicipalCrestUrl(), {
      credentials: "same-origin",
      cache: "force-cache",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Não foi possível carregar o brasão municipal.");
        return response.blob();
      })
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Não foi possível preparar o brasão para o PDF."));
        reader.readAsDataURL(blob);
      }))
      .catch((error) => {
        municipalCrestDataUrlPromise = null;
        throw error;
      });
  }
  return municipalCrestDataUrlPromise;
}

export function addMunicipalCrestToPdf(doc, crestDataUrl, options = {}) {
  const { x = 12, y = 3, width = 16, height = 16 } = options;
  doc.addImage(crestDataUrl, "PNG", x, y, width, height);
}

export function drawMunicipalPdfHeader(doc, crestDataUrl, options = {}) {
  const {
    subtitle = "",
    height = 24,
    margin = 12,
    logoSize = 16,
    titleY = 10,
    subtitleY = 16,
    background = [3, 36, 71],
  } = options;
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...background);
  doc.rect(0, 0, pageWidth, height, "F");
  addMunicipalCrestToPdf(doc, crestDataUrl, {
    x: margin,
    y: Math.max(2, (height - logoSize) / 2),
    width: logoSize,
    height: logoSize,
  });
  const textX = margin + logoSize + 4;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Prefeitura Municipal de Pitangueiras", textX, titleY);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(subtitle, textX, subtitleY);
  }
}
