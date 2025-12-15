export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    isLoading = true;
    // @ts-expect-error - pdfjs-dist/build/pdf.mjs is not a module
    loadPromise = import("pdfjs-dist/build/pdf.mjs")
        .then((lib) => {
            // Prefer a matching worker hosted on CDN for the same package version
            // to avoid API/Worker version mismatches. Fall back to local worker file.
            const version = lib?.version || "latest";
            const cdn = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
            try {
                lib.GlobalWorkerOptions.workerSrc = cdn;
                console.info(`pdfjs-dist: set workerSrc to ${cdn}`);
            } catch (e) {
                // If setting CDN worker fails for any reason, fall back to local file
                lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
                console.warn("pdfjs-dist: falling back to local /pdf.worker.min.mjs");
            }

            pdfjsLib = lib;
            isLoading = false;
            return lib;
        })
        .catch((err) => {
            console.error("Failed to load pdfjs-dist", err);
            isLoading = false;
            pdfjsLib = null;
            throw err;
        });

    return loadPromise;
}

export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    try {
        const lib = await loadPdfJs();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);

        if (typeof document === "undefined") {
            return {
                imageUrl: "",
                file: null,
                error: "Document not available in this environment (server-side rendering).",
            };
        }

        const viewport = page.getViewport({ scale: 4 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (context) {
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
        }

        // Try rendering with a few scale fallbacks in case of memory/size issues
        const scalesToTry = [4, 2, 1];
        let rendered = false;
        for (const s of scalesToTry) {
            const tryViewport = page.getViewport({ scale: s });
            canvas.width = tryViewport.width;
            canvas.height = tryViewport.height;
            try {
                await page.render({ canvasContext: context!, viewport: tryViewport }).promise;
                rendered = true;
                break;
            } catch (renderErr) {
                console.warn(`Render failed at scale ${s}:`, renderErr);
                // try next scale
            }
        }

        if (!rendered) {
            return {
                imageUrl: "",
                file: null,
                error: `PDF page render failed at available scales (${scalesToTry.join(", ")})`,
            };
        }

        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        // Create a File from the blob with the same name as the pdf
                        const originalName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File([blob], `${originalName}.png`, {
                            type: "image/png",
                        });

                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } else {
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create image blob",
                        });
                    }
                },
                "image/png",
                1.0
            ); // Set quality to maximum (1.0)
        });
    } catch (err) {
        console.error("convertPdfToImage error:", err);
        const message = err instanceof Error ? err.message : String(err);
        // Detect common worker/version mismatch and provide a helpful hint
        let hint = "";
        if (message.includes("API version") && message.includes("Worker version")) {
            hint = " Possible fix: ensure /pdf.worker.min.mjs matches the installed pdfjs-dist version or let the code use the CDN worker that matches the package version.";
        }
        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF: ${message}.${hint}`,
        };
    }
}