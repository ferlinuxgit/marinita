const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function asciiFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]/g, "_");
}

export function fileResponse(content: Uint8Array, fileName: string, contentType: string) {
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${asciiFileName(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}

export function xlsxResponse(content: Uint8Array, fileName: string) {
  return fileResponse(content, fileName, XLSX_CONTENT_TYPE);
}
