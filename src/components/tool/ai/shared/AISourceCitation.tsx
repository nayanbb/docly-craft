import { FileText } from "lucide-react";

interface AISourceCitationProps {
  pageNumber: number;
  snippet?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Shared Source Citation Badge for Grounded AI responses.
 * Highlights the verified source page in the document.
 */
export function AISourceCitation({
  pageNumber,
  snippet,
  onClick,
  className = "",
}: AISourceCitationProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={snippet ? `Page ${pageNumber}: "${snippet}"` : `Cited from Page ${pageNumber}`}
      className={`inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer ${className}`}
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span>Page {pageNumber}</span>
    </button>
  );
}

interface AISourceCitationsListProps {
  pages: number[];
  snippets?: Array<{ pageNumber: number; snippet: string }>;
  onSelectPage?: (page: number) => void;
  className?: string;
}

export function AISourceCitationsList({
  pages,
  snippets = [],
  onSelectPage,
  className = "",
}: AISourceCitationsListProps) {
  if (!pages || pages.length === 0) return null;

  const uniquePages = Array.from(new Set(pages)).sort((a, b) => a - b);

  return (
    <div className={`flex flex-wrap items-center gap-1.5 pt-2 ${className}`}>
      <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground mr-1">
        Sources:
      </span>
      {uniquePages.map((pageNum) => {
        const matchingSnippet = snippets.find((s) => s.pageNumber === pageNum)?.snippet;
        return (
          <AISourceCitation
            key={pageNum}
            pageNumber={pageNum}
            snippet={matchingSnippet}
            onClick={() => onSelectPage?.(pageNum)}
          />
        );
      })}
    </div>
  );
}
