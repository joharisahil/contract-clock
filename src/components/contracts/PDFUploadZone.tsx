"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  HelpCircle,
  Loader2,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { useDropzone } from "react-dropzone";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ContractAIExtractionData } from "@/types";

type PDFUploadZoneProps = {
  organizationId: string;
  onExtracted: (payload: {
    extraction: ContractAIExtractionData;
    pdfUrl: string;
  }) => void;
};

const extractionLabels: Array<{
  key: keyof Omit<ContractAIExtractionData, "confidence">;
  label: string;
}> = [
  { key: "vendor_name", label: "Vendor name" },
  { key: "annual_cost", label: "Annual cost" },
  { key: "currency", label: "Currency" },
  { key: "start_date", label: "Start date" },
  { key: "renewal_date", label: "Renewal date" },
  { key: "notice_period_days", label: "Notice period" },
  { key: "auto_renewal", label: "Auto-renewal" },
  { key: "contract_type", label: "Contract type" },
];

function formatFileSize(size: number) {
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function ConfidenceIcon({ level }: { level: "high" | "medium" | "low" }) {
  if (level === "high") {
    return <CheckCircle2 className="size-4 text-emerald-600" />;
  }

  if (level === "medium") {
    return <TriangleAlert className="size-4 text-amber-600" />;
  }

  return <HelpCircle className="size-4 text-red-600" />;
}

export function PDFUploadZone({
  organizationId,
  onExtracted,
}: PDFUploadZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContractAIExtractionData | null>(null);

  const dropzone = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDropAccepted: (acceptedFiles) => {
      setFile(acceptedFiles[0] ?? null);
      setError(null);
      setResult(null);
    },
    onDropRejected: (rejections) => {
      setError(rejections[0]?.errors[0]?.message ?? "Unable to use that file.");
      setResult(null);
    },
  });

  const extractionSummary = useMemo(() => {
    if (!result) {
      return { found: [] as string[], missing: [] as string[] };
    }

    const found: string[] = [];
    const missing: string[] = [];

    extractionLabels.forEach(({ key, label }) => {
      const value = result[key];

      if (value === null || value === "") {
        missing.push(label);
      } else {
        found.push(label);
      }
    });

    return { found, missing };
  }, [result]);

  const handleExtract = async () => {
    if (!file) {
      setError("Choose a PDF before starting extraction.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(filePath, file, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from("contracts")
        .getPublicUrl(filePath);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("organizationId", organizationId);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as
        | { error: string }
        | {
            extraction: ContractAIExtractionData;
            storageUrl?: string;
            url?: string;
          };

      if (!response.ok || "error" in payload) {
        throw new Error(
          "error" in payload ? payload.error : "Unable to read your contract.",
        );
      }

      setResult(payload.extraction);
      onExtracted({
        extraction: payload.extraction,
        pdfUrl: publicUrlData.publicUrl || payload.storageUrl || payload.url || "",
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to read your contract.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        {...dropzone.getRootProps()}
        className={cn(
          "border-input bg-muted/20 cursor-pointer rounded-2xl border border-dashed p-6 text-center transition-colors",
          dropzone.isDragActive ? "border-primary bg-primary/5" : "",
        )}
      >
        <input {...dropzone.getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <UploadCloud className="text-muted-foreground size-7" />
          <p className="text-sm font-medium">Drop a contract PDF here</p>
          <p className="text-muted-foreground text-xs">PDF only, up to 10MB</p>
        </div>
      </div>

      {file ? (
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <FileText className="text-muted-foreground size-5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-muted-foreground text-xs">
              {formatFileSize(file.size)}
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl border px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Button
        type="button"
        onClick={handleExtract}
        disabled={!file || isLoading}
      >
        {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
        {isLoading ? "Reading your contract..." : "Extract contract details"}
      </Button>

      {result ? (
        <div className="space-y-4 rounded-2xl border p-4">
          <div>
            <p className="font-medium">Extraction summary</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Review the fields below, then continue with the form to confirm
              everything before saving.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-800">Found</p>
              <p className="mt-1 text-sm text-emerald-700">
                {extractionSummary.found.length > 0
                  ? extractionSummary.found.join(", ")
                  : "No fields found yet"}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">Missing</p>
              <p className="mt-1 text-sm text-amber-700">
                {extractionSummary.missing.length > 0
                  ? extractionSummary.missing.join(", ")
                  : "Nothing missing"}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            {extractionLabels.map(({ key, label }) => {
              const confidence = result.confidence[key];
              const value = result[key];

              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-muted-foreground">
                      {value === null || value === ""
                        ? "Not found"
                        : String(value)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ConfidenceIcon level={confidence} />
                    <span className="capitalize">{confidence}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
