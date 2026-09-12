import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { searchTools, toolCategories, type Tool } from "@/lib/tools";
import { cn } from "@/lib/utils";

interface GlobalToolSearchProps {
  className?: string;
  onSelectTool?: () => void;
}

export function GlobalToolSearch({ className, onSelectTool }: GlobalToolSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results: Tool[] = query.trim() ? searchTools(query) : [];

  // Determine platform for keyboard shortcut display
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent));
  }, []);

  // Global keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setMobileOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 50);
        } else {
          inputRef.current?.focus();
          setIsOpen(true);
        }
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Close desktop dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [results.length, query]);

  const handleSelect = (tool: Tool) => {
    const slug = tool.route.replace(/^\/tools\//, "");
    setIsOpen(false);
    setMobileOpen(false);
    setQuery("");
    onSelectTool?.();
    navigate({ to: "/tools/$slug", params: { slug } });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "ArrowDown" && query.trim()) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = results[highlightedIndex];
      if (selected) {
        handleSelect(selected);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const getCategoryTitle = (tool: Tool) => {
    const cat = toolCategories.find((c) => c.id === tool.category);
    if (cat) return cat.title;
    if (tool.group === "pdf") return "PDF Tools";
    if (tool.group === "image") return "Image Tools";
    return "AI Tools";
  };

  return (
    <>
      {/* Desktop / Tablet Compact Header Search Field */}
      <div ref={containerRef} className={cn("relative hidden md:block", className)}>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/80 px-3 py-1.5 text-sm transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 w-44 lg:w-56">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen && Boolean(query.trim())}
            aria-controls="tool-search-results"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (query.trim()) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search tools..."
            className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setIsOpen(false);
              }}
              className="text-muted-foreground hover:text-foreground p-0.5"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-secondary/80 px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground select-none">
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
          )}
        </div>

        {/* Desktop Results Dropdown */}
        {isOpen && query.trim() && (
          <div
            id="tool-search-results"
            role="listbox"
            className="absolute left-0 lg:right-0 lg:left-auto top-full mt-2 w-80 sm:w-96 rounded-xl border border-border bg-popover p-2 shadow-menu z-50 animate-in fade-in-50 zoom-in-95 duration-100 max-h-[70vh] overflow-y-auto"
          >
            {results.length > 0 ? (
              <div className="space-y-1">
                {results.map((tool, idx) => {
                  const Icon = tool.icon;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => handleSelect(tool)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors cursor-pointer",
                        isHighlighted
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-accent/60",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" strokeWidth={1.9} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-xs sm:text-sm">{tool.name}</p>
                          <p className="truncate text-[0.68rem] text-muted-foreground">
                            {getCategoryTitle(tool)}
                          </p>
                        </div>
                      </div>
                      {tool.access === "pro" && (
                        <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wide text-primary">
                          PRO
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 px-4 text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">No tools found</p>
                <p className="text-xs text-muted-foreground">Try a different search.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Search Button (Collapsible icon trigger) */}
      <button
        type="button"
        aria-label="Search tools"
        onClick={() => {
          setMobileOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 50);
        }}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors md:hidden"
      >
        <Search className="h-4 w-4" />
      </button>

      {/* Mobile Search Modal Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm p-4 md:hidden animate-in fade-in duration-150">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm focus-within:border-primary/50">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools..."
                className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setQuery("");
              }}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              Cancel
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pt-3">
            {query.trim() ? (
              results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => handleSelect(tool)}
                        className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-sm">{tool.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {getCategoryTitle(tool)}
                            </p>
                          </div>
                        </div>
                        {tool.access === "pro" && (
                          <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[0.625rem] font-bold text-primary">
                            PRO
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">No tools found</p>
                  <p className="text-xs text-muted-foreground">Try a different search.</p>
                </div>
              )
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Type a tool name, category, or keyword (e.g. merge, reduction, word)...
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
