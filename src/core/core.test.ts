import { describe, expect, it } from "vitest";
import { z } from "zod";

import { inviteCodeMatches } from "@/core/auth/invite";
import { toErrorResponse } from "@/core/http/error-response";
import { NotFoundError, UserFacingError } from "@/core/http/errors";
import { xlsxResponse } from "@/core/http/responses";
import { readUploadedFile } from "@/core/http/upload";

describe("inviteCodeMatches", () => {
  it("accepts only the exact code", () => {
    expect(inviteCodeMatches("secreto", "secreto")).toBe(true);
    expect(inviteCodeMatches("secret", "secreto")).toBe(false);
    expect(inviteCodeMatches("", "secreto")).toBe(false);
    expect(inviteCodeMatches(undefined, "secreto")).toBe(false);
  });

  it("rejects everything when no code is configured", () => {
    expect(inviteCodeMatches("", undefined)).toBe(false);
    expect(inviteCodeMatches("x", "")).toBe(false);
  });
});

describe("toErrorResponse", () => {
  it("exposes user-facing messages with their status", async () => {
    const response = toErrorResponse(new NotFoundError("No está."));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "No está." });
  });

  it("maps validation errors to 400", () => {
    const result = z.string().safeParse(1);
    expect(toErrorResponse(result.error).status).toBe(400);
  });

  it("hides internal error details", async () => {
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      const response = toErrorResponse(new Error("password authentication failed for user"));
      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toContain("password");
    } finally {
      console.error = originalConsoleError;
    }
  });
});

describe("readUploadedFile", () => {
  const rules = { extensions: [".xlsx"], maxBytes: 10, label: "un archivo .xlsx" };

  function upload(file?: File) {
    const body = new FormData();

    if (file) {
      body.append("file", file);
    }

    return new Request("http://localhost/upload", { method: "POST", body });
  }

  it("returns the file contents", async () => {
    const file = await readUploadedFile(upload(new File(["abc"], "Datos.XLSX")), rules);
    expect(file.name).toBe("Datos.XLSX");
    expect(file.buffer.toString()).toBe("abc");
  });

  it("rejects missing files, wrong extensions and oversized files", async () => {
    await expect(readUploadedFile(upload(), rules)).rejects.toThrow("Sube un archivo .xlsx.");
    await expect(readUploadedFile(upload(new File(["a"], "a.csv")), rules)).rejects.toThrow(
      "Solo se admite un archivo .xlsx.",
    );
    await expect(
      readUploadedFile(upload(new File(["01234567890"], "a.xlsx")), rules),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it("accepts a matching MIME type even without the extension", async () => {
    const file = new File(["a"], "factura", { type: "application/pdf" });
    const result = await readUploadedFile(upload(file), {
      ...rules,
      extensions: [".pdf"],
      mimeTypes: ["application/pdf"],
    });
    expect(result.size).toBe(1);
  });
});

describe("xlsxResponse", () => {
  it("sets an ASCII fallback and a UTF-8 file name", () => {
    const response = xlsxResponse(new Uint8Array([1]), "Líneas_1.xlsx");
    const disposition = response.headers.get("Content-Disposition") ?? "";

    expect(disposition).toContain('filename="Lineas_1.xlsx"');
    expect(disposition).toContain("filename*=UTF-8''L%C3%ADneas_1.xlsx");
  });
});
