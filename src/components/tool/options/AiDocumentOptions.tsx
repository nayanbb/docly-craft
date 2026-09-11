import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import { ProviderNotice } from "@/components/tool/ai/ProviderNotice";

interface AiDocumentOptionsProps {
  toolId: string;
  document?: ExtractedDocument | undefined;
}

export function AiDocumentOptions({ toolId }: AiDocumentOptionsProps) {
  return (
    <div className="space-y-4">
      <ProviderNotice
        featureName={toolId.replace(/-/g, " ")}
        customMessage="This tool is managed by Docly's Advanced AI Architecture."
      />
    </div>
  );
}
